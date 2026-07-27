# Compressor Simulator — Application Specification

*Hand this to Claude Code as the project brief. It contains the full physics,
the tag map, the architecture, and the UI requirements.*

**Document authority.** Where this spec and `compressor_lite.py` disagree, **this
spec wins**. `compressor_lite.py` is the verified physics reference to port from —
its equations, states, and parameter values are correct — but this spec adds
corrections and layers on top of it. Known deliberate differences are called out
inline with the marker **[SPEC OVERRIDES LITE]**.

**Provenance.** Ranges, setpoints, valve scaling, speed setpoints, and I/O
assignments in this spec were verified against the source documents
`PN17481_IO_List_5.xls` and the REMVue 500S Operating Philosophy Rev 4
(Spartan Controls, Jan 2008). Where OpPhil HMI screenshots show different
numbers (e.g. 600 rpm idle, 850–1200 rpm range), those are placeholder
graphics — the I/O list setpoint sheet is authoritative: crank terminate 200,
running permit 550, idle 650, min load 850, max load 1000 rpm.

**Order of work is non-negotiable:** the design point test in section 3.5 must
pass before a single line of UI is written.

---

## 1. What this is

A desktop application that simulates a three-stage reciprocating gas compressor
package and exposes it over OPC UA, so that a real PLC — CODESYS on a laptop, or
physical hardware in a compressor station — can be connected and its control logic
tested against realistic process behaviour without touching real machinery.

**Reference machine:** Ariel JGH/4 three-stage reciprocating compressor driven by a
Caterpillar G3516LE gas engine, controlled by a Spartan Controls REMVue 500S panel.
Enerflex unit 070438, project PN17481, installed in Libya.

**Critical design rule:** the application contains **no control logic**. No timers,
no permissives, no state machines, no PID loops, no alarm evaluation. It models
process response only. All sequencing lives in the PLC. The app produces a
temperature of 280 °F; deciding that this is an alarm is the PLC's job.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────┐
│  Browser UI  (React + TypeScript + Vite)        │
│  animated P&ID, gauges, trends, fault panel     │
└────────────────┬────────────────────────────────┘
                 │  WebSocket, 10 Hz state push
┌────────────────▼────────────────────────────────┐
│  Python backend  (FastAPI + asyncio)            │
│                                                 │
│  ┌───────────────┐   ┌────────────────────────┐ │
│  │ physics loop  │   │  OPC UA client         │ │
│  │ 20 ms fixed   │◄─►│  (asyncua)             │ │
│  │ RK4 integrator│   │  reads commands        │ │
│  └───────────────┘   │  writes measurements   │ │
│                      └───────────┬────────────┘ │
└──────────────────────────────────┼──────────────┘
                                   │ OPC UA
                     ┌─────────────▼─────────────┐
                     │  CODESYS PLC              │
                     │  or real hardware panel   │
                     └───────────────────────────┘
```

### 2.1 Stack

| Layer | Choice | Why |
|---|---|---|
| Physics | Python, numpy | Already written and verified — see section 4 |
| OPC UA | `asyncua` | Mature async Python OPC UA client and server |
| Backend | FastAPI + uvicorn | WebSocket support, simple, well documented |
| Frontend | React + TypeScript + Vite | Fast dev loop, no SSR needed |
| Charts | `uPlot` | Handles 10 Hz streaming trends without dropping frames |
| Styling | Tailwind | |
| Packaging | Browser first. Tauri wrapper optional later | Ship something that runs before worrying about an installer |

**Why the app is the OPC UA client and CODESYS is the server:** CODESYS ships a
free built-in OPC UA server; its OPC UA *client* requires licensing in some
versions. The sim connecting as client to the PLC's server is the pragmatic
direction. Do not "fix" this by inverting it.

**Transport-agnostic tag layer:** a real REMVue 500S panel speaks hardwired I/O
and Modbus, not OPC UA. All tag definitions, scaling, and clamping live in
`tags.py`, and `opcua_link.py` is only one consumer of them. Nothing outside
`opcua_link.py` may import `asyncua`. This keeps the door open for a Modbus or
remote-I/O gateway later without touching physics or the UI.

### 2.2 Timing

- Physics integrates at **fixed 20 ms** steps, RK4
- OPC UA read and write at **100 ms**
- WebSocket push to the UI at **100 ms**
- The physics loop must run in wall-clock real time, not as fast as possible.
  Use `asyncio.sleep` with drift compensation, not a naive sleep.

### 2.3 Repository layout

```
compressor-sim/
  backend/
    physics.py        # the model - port of compressor_lite.py
    tags.py           # tag definitions, ranges, scaling
    opcua_link.py     # asyncua client, read/write loops
    faults.py         # fault injection state
    server.py         # FastAPI app, websocket, REST endpoints
    config.yaml       # parameters, endpoint URL, tag namespace
  frontend/
    src/
      components/
        PidDiagram.tsx      # the animated schematic
        Gauge.tsx
        TrendChart.tsx
        FaultPanel.tsx
        ConnectionBar.tsx
      hooks/useSimState.ts  # websocket subscription
      App.tsx
  README.md
```

---

## 3. Physics — 10 integrator states

Everything else is algebra recomputed each step.

| # | State | Symbol | Unit | Initial |
|---|---|---|---|---|
| 1 | Engine speed | `N` | rpm | 0 |
| 2 | Compressor oil pressure | `P_oil` | Pa gauge | 0 |
| 3 | Engine oil temperature | `T_eoil` | K | 305.37 |
| 4 | Suction pressure | `P_s` | Pa abs | 101325 |
| 5 | Final discharge pressure | `P_d` | Pa abs | 101325 |
| 6 | Bypass valve position | `Z_byp` | % | 100 (fails open) |
| 7 | Suction control valve | `Z_suc` | % | 0 (fails closed) |
| 8 | Suction ESD valve | `Z_sesd` | % | 0 (fails closed) |
| 9 | Discharge ESD valve | `Z_desd` | % | 0 (fails closed) |
| 10 | Blowdown valve | `Z_bdv` | % | 100 (fails open) |

Plus four first-order lags standing in for thermal inertia: `T_d1`, `T_d2`,
`T_oil`, `T_ac`, all initialised to 305.37 K.

### 3.1 Parameters

```python
R_sp      = 345.5      # J/(kg K)  = 8314 / 24.06, from specific gravity 0.8305
n_exp     = 1.2693     # polytropic exponent
e_T       = 0.2122     # (n-1)/n
V_disp    = 0.023258   # m3/rev, stage 1 double-acting
clearance = 0.078
L_slip    = 0.04
V_s       = 3.0        # m3 suction volume
V_d       = 4.5        # m3 discharge volume
K_suc     = 2.10e-3    # supply into suction
K_byp     = 1.50e-3    # bypass, discharge to suction
K_proc    = 1.335e-4   # discharge to pipeline
K_bdv     = 4.00e-3    # blowdown to atmosphere
P_src     = 60 psig    # source boundary
P_proc    = 1050 psig  # pipeline boundary
T_suc     = 100 F      # inlet gas
T_inter   = 105 F      # intercooler outlet, 2 fans
T_ac      = 110 F      # aftercooler outlet, 2 fans
N_crank_term = 200; N_idle = 650; N_min_load = 850; N_max_load = 1000
rate_byp  = (5, 15)    # %/s open, close
rate_suc  = (5, 5)
rate_esd  = (20, 20)
rate_bdv  = (50, 50)
tau_oil_p = 3; tau_eoil = 400; tau_T_cyl = 45; tau_T_oil = 300; tau_T_ac = 60
```

### 3.2 Algebra, every step

```python
# pressure ratio and interstage pressures
r_tot = clip(P_d / P_s, 1, 30)
r_stg = r_tot ** (1/3)
P_1   = min(P_s * r_stg, P_d)      # [SPEC OVERRIDES LITE] clamp is NOT in
P_2   = min(P_1 * r_stg, P_d)      # compressor_lite.py — add it in the port.
                                   # Prevents interstage readings above final
                                   # discharge during startup/blowdown.

# capacity - stage 1 sets throughput for the whole train
VE     = clip(1 - clearance*(r_stg**(1/n_exp) - 1) - L_slip, 0, 1)
rho_s  = P_s / (R_sp * T_suc)
gate   = 1.0 if (N > N_crank_term and Z_sesd > 2) else 0.0
m_comp = V_disp * rho_s * VE * (N/60) * gate

# cooling depends on how many fans are running
n_fans  = cooler_1 + cooler_2
T_inter = [140F, 120F, 105F][n_fans]
T_ac_t  = [175F, 130F, 110F][n_fans]

# flows - orifice form, no reverse flow
def orifice(K, frac, rho_up, dP):
    return 0.0 if (dP <= 0 or frac <= 0) else K * frac * sqrt(rho_up * dP)

m_sup  = orifice(K_suc,  (Z_suc/100)*(Z_sesd/100), rho_src, P_src - P_s)
m_byp  = orifice(K_byp,  Z_byp/100,                rho_d,   P_d - P_s)
m_proc = orifice(K_proc, (Z_desd/100)*(1-f_block), rho_d,   P_d - P_proc)
m_bdv  = orifice(K_bdv,  Z_bdv/100,                rho_s,   P_s - P_atm)

# temperature targets
T_d1_target = T_suc   * r_stg**e_T   if gate else T_amb
T_d2_target = T_inter * r_stg**e_T   if gate else T_amb
```

### 3.3 Derivatives

```python
# pressures - note m_byp appears in BOTH with opposite signs
dP_s/dt = (R_sp*T_suc / V_s) * (m_sup + m_byp - m_comp - m_bdv)
dP_d/dt = (R_sp*T_ac  / V_d) * (m_comp - m_proc - m_byp)

# engine speed
if not (cat_start and driven_ready and not cat_esd):
    dN/dt = -N / 6
elif N < N_crank_term:
    dN/dt = 70
else:
    N_ref = N_min_load + (ao_speed/100)*(N_max_load - N_min_load) if idle_rated else N_idle
    dN/dt = clip(N_ref - N, -75, +50)

# valves - constant velocity travel, not first order
dZ/dt = clip(20*(Z_target - Z), -rate_close, +rate_open)

# oil pressure
if N > N_crank_term:      P_oil_target = 8.27e5 * min(1, N/N_min_load)
elif aux_lube:            P_oil_target = 3.79e5
else:                     P_oil_target = 0
dP_oil/dt = (P_oil_target - P_oil) / tau_oil_p

# lags
dT/dt = (T_target - T) / tau
```

### 3.4 Command interpretation

The bypass valve is AO-scaled so it is fully closed at 75% output:

```python
Z_byp_target = clip(100 * (1 - ao_byp/75), 0, 100)
```

Fail positions on loss of signal: bypass open, suction closed, ESDs closed,
blowdown open.

### 3.5 Design point — the acceptance test

At 1000 rpm, bypass closed, suction valve 45%, both coolers running, ESDs open,
blowdown closed, the model must settle at:

| Quantity | Value |
|---|---|
| Suction | 29.8 psig | ± 0.5 psi |
| ST1 discharge | 117.3 psig | ± 2 psi |
| ST2 discharge | 377.2 psig | ± 5 psi |
| Final discharge | 1149.0 psig | ± 10 psi |
| Stage ratio | 2.97 | ± 0.02 |
| Mass flow | 0.945 kg/s | ± 0.005 |
| Cyl 1 discharge temp | 245.4 °F | ± 2 °F |
| Cyl 2 discharge temp | 251.7 °F | ± 2 °F |

These values were verified by running `compressor_lite.py` for 600 s of sim time
from the pressurised initial condition (2026-07-28). Test with the tolerances
above, not exact equality — RK4 at 20 ms from a different initial condition
lands within tolerance but not on the same last digit.

**All mass flows must balance to under 1e-3 kg/s.** This is the primary test.

---

## 4. Tag map

Direction is stated from the PLC's point of view.

**Naming authority.** The tag names in this section (`PT_1001`, `ZS_2003`,
`CMD_4004`, …) are canonical and owned by `tags.py`. The names returned by the
lite model's `meas()` (`PT_1001_suction_psig`, `ZS_byp_open`, …) are internal to
the physics module only. `tags.py` maps model outputs to canonical tags; no other
module — not the UI, not the OPC UA link — may reference the internal names.
Exactly one naming scheme crosses each boundary.

**Clamping location.** Range clamping (and the optional lag/noise below) happens
in `tags.py` at the instrumentation boundary, **not** in `physics.py`. The
physics module stays a clean port of the lite model and may internally exceed
transmitter ranges; the outside world never sees that.

### 4.1 Analog inputs to PLC — app writes these

| Tag | Description | Unit | Range | Source state |
|---|---|---|---|---|
| `PT_1001` | Stage 1 suction pressure | psig | 0–60 | `P_s` |
| `PT_1002` | Stage 1 discharge pressure | psig | 0–300 | `P_1` |
| `PT_1003` | Stage 2 discharge pressure | psig | 0–1000 | `P_2` |
| `PT_1004` | Stage 3 discharge pressure | psig | 0–2000 | `P_d` |
| `PT_1005` | Compressor oil pressure | psig | 0–200 | `P_oil` |
| `PT_1006` | Final discharge pressure | psig | 0–2000 | `P_d` |
| `ST_1008` | Engine speed | rpm | 0–2000 | `N` |
| `TT_2001` | Compressor oil temperature | °F | 0–500 | `T_oil` |
| `TT_2004` | Cylinder 1 discharge temp | °F | 0–500 | `T_d1` |
| `TT_2005` | Cylinder 2 discharge temp | °F | 0–500 | `T_d2` |
| `TT_2006` | Cylinder 3 discharge temp | °F | 0–500 | `T_d2` |
| `TT_2007` | Cylinder 4 discharge temp | °F | 0–500 | `T_d2` |
| `TT_2013` | Aftercooler temperature | °F | 0–500 | `T_ac` |
| `TT_2009..12` | Packing temps 1–4 | °F | 0–500 | `T_oil + 14` |

**Every analog value must be clamped to its transmitter range before writing.**
A blocked discharge drives the model past 2000 psig; the PLC must see a saturated
2000, exactly as a real transmitter would report.

Optional per-signal first-order lag (0.3–2 s) and Gaussian noise, both off by
default and toggleable from the UI.

### 4.2 Discrete inputs to PLC — app writes these

| Tag | True when |
|---|---|
| `ZS_2001` | Blowdown closed, `Z_bdv < 2` |
| `ZS_2002` | Blowdown open, `Z_bdv > 98` |
| `ZS_2003` | Bypass open, `Z_byp > 98` |
| `ZS_2004` | Bypass closed, `Z_byp < 2` |
| `ZS_2005` | Suction ESD open, `Z_sesd > 98` |
| `ZS_2006` | Suction ESD closed, `Z_sesd < 2` |
| `ZS_2007` | Discharge ESD open, `Z_desd > 98` |
| `ZS_2008` | Discharge ESD closed, `Z_desd < 2` |
| `PS_2009` | Oil pressure healthy, `P_oil > 10 psi` (0.69 barg). Stands in for the prelube pressure switch wired to the ADEM A3; 10 psi is the Compressor Oil Pressure Start Permissive from the I/O list setpoint sheet. |
| `ST_2010` | Engine running, `N > 300` |
| `WD_6001` | Heartbeat counter, increments every 500 ms, rolls at 32767 |

### 4.3 Analog outputs from PLC — app reads these

| Tag | Description | Range | Fail value |
|---|---|---|---|
| `SC_3001` | Engine speed command | 0–100% | 0 |
| `FC_3002` | Bypass valve command | 0–100% | 0 (valve opens) |
| `FC_3003` | Suction valve command | 0–100% | 0 (valve closes) |

### 4.4 Discrete outputs from PLC — app reads these

| Tag | Description | Fail state |
|---|---|---|
| `CMD_4001` | Auxiliary lube solenoid | off |
| `CMD_4003` | CAT idle / rated speed | off |
| `CMD_4004` | Blowdown solenoid, energised = closed | off, valve opens |
| `CMD_4005` | CAT start input | off |
| `CMD_4006` | CAT ESD, energised = healthy | off |
| `CMD_4008` | CAT driven equipment ready | off |
| `CMD_4009` | Suction ESD solenoid, energised = open | off |
| `CMD_4010` | Discharge ESD solenoid | off |
| `CMD_4011` | Cooler motor 1 run | off |
| `CMD_4012` | Cooler motor 2 run | off |

The real panel also drives a *Remote Status* relay (to plant DCS) and a *Panel
Air Cooler* output. If the PLC writes these, the app accepts and ignores them —
never error on unknown command tags.

### 4.5 Alarm and trip setpoints — display defaults only

From `PN17481_IO_List_5.xls`. **The app never evaluates these** — the PLC owns
all alarm/shutdown logic. The app uses them only to colour gauge badges
(green below alarm, amber between alarm and trip, red above trip) and to draw
dashed lines on trends. They live in `config.yaml` so a different package is a
different config.

| Point | Low SD | Low alarm | High alarm | High SD | Unit |
|---|---|---|---|---|---|
| ST1 suction pressure | 27 | 29 | 31 | 33 | psig |
| ST1 discharge pressure | — | — | 182 | 191 | psig |
| ST2 discharge pressure | — | — | 499 | 523 | psig |
| ST3 discharge pressure | — | — | 1379 | 1444 | psig |
| Final discharge pressure | — | — | 1365 | 1430 | psig |
| Compressor oil pressure | 35 | 40 | 190 | 200 | psig |
| Compressor oil temperature | — | — | 180 | 190 | °F |
| Cyl 1 discharge temp | — | — | 300 | 315 | °F |
| Cyl 2 discharge temp | — | — | 272 | 285 | °F |
| Cyl 3 discharge temp | — | — | 281 | 295 | °F |
| Cyl 4 discharge temp | — | — | 272 | 285 | °F |
| Packing temps 1–4 | — | — | 176 | 194 | °F |
| Aftercooler temperature | — | — | 147 | 154 | °F |

Note the suction band: the 29.8 psig design point sits between the 29 low alarm
and 31 high alarm. Small boundary changes visibly walk the value across
setpoints, which is exactly what makes the trainer useful.

### 4.6 PLC timer reference — context only, DO NOT IMPLEMENT

These belong to the PLC under test. Listed here only so fault behaviour makes
sense: Oil Permissive Pressure Fault 120 s, Prelube 120 s, Engine Failed To
Start 30 s, Engine Crank 45 s, B Timer 120 s, b Timer 10 s, Cooldown 60 s,
Postlube 120 s, valve misalignment 10–12 s. This is why the slow-lube fault
uses τ = 90 s (oil takes ~4τ to reach the 10 psi permissive, busting the 120 s
timer) and why the valve-stuck faults matter (they trip the misalignment
timers). The app implements none of these timers.

### 4.7 Watchdog

Both sides increment a counter every 500 ms. If the PLC counter stops advancing
for 2 s, declare the link failed, apply all fail values, and show it in the UI.
This is essential — a dropped OPC UA subscription is otherwise indistinguishable
from a frozen process value.

---

## 5. Fault injection

**Local to the app. Never exposed on OPC UA** — the logic under test must not be
able to clear its own faults.

**Implementation note.** The lite model's `Flt` dataclass covers only a subset of
the table below (lube_low, lube_slow, mag_pickup, overspeed_offset,
disch_blocked, valve_stuck). `faults.py` extends it to the full table; the
missing ones (engine fails to start, cylinder temp bias, signal freeze, signal
invalid, cooler motor trip, link drop) are implemented at the appropriate layer —
engine-fails-to-start in physics, signal freeze/invalid and temp bias in
`tags.py`, cooler trip in command interpretation, link drop in `opcua_link.py`.

**Transport.** Faults and boundary-condition edits travel UI → backend as
WebSocket messages on the same connection as the state push (message type
`"cmd"`). No REST endpoints for faults, no OPC UA nodes for faults. REST is used
only for one-shot actions: reset and config reload.

| Fault | Type | Effect |
|---|---|---|
| Low lube oil pressure | toggle | forces `P_oil` below its 35 psi trip |
| Slow lube build | toggle | sets `tau_oil_p = 90 s`, exceeding the 120 s permissive timer |
| Engine fails to start | toggle | prevents `N` exceeding 550 rpm |
| Mag pickup fault | toggle | forces reported speed to 0 while running |
| Blocked discharge | 0–100% slider | reduces `K_proc` |
| Overspeed bias | slider, rpm | adds offset to reported speed |
| Cylinder temp bias | slider per cylinder, °F | adds offset |
| Valve stuck | per valve | freezes position, exercising misalignment timers |
| Signal freeze | per tag | holds the last transmitted value |
| Signal invalid | per tag | drives the tag out of range |
| Cooler motor trip | per motor | drops the run status |
| Link drop | toggle | suspends OPC UA writes, exercising the watchdog |

---

## 6. User interface

### 6.1 Layout

Single full-screen page, three regions:

- **Top bar** — connection status, endpoint URL, connect/disconnect, sim time,
  run/pause, reset, heartbeat indicator

**Reset is a two-option dropdown, not a single button** — it calls the model's
`init()`:

| Option | State after reset |
|---|---|
| Reset — blown down | Both volumes at atmospheric, blowdown open, bypass open, ESDs closed, speed 0, all temps ambient. The normal cold start condition. |
| Reset — pressurised | Suction at 30 psig, discharge at 1150 psig, blowdown closed, bypass open, ESDs closed, speed 0. A settled-out unit awaiting restart. |

Reset never touches fault toggles or boundary conditions — clearing those is a
separate explicit action on the fault panel.
- **Main area, left two thirds** — the animated P&ID
- **Main area, right third** — tabbed: Trends / Faults / Tag table
- **Bottom strip** — key values as large digits: suction, final discharge,
  cyl 2 temp, speed, flow

### 6.1.1 Visual design rules

- **Dark industrial theme, committed.** Near-black background (`#0d1117` range),
  neutral grey chrome, no light mode. Do not use default light Tailwind styling.
- **Colour is reserved for state.** Pipes get the pressure ramp; badges, gauges,
  and valves get green/amber/red by condition. Panels, borders, buttons, and
  text stay neutral grey. Nothing decorative gets a colour. This one rule is
  what separates a control-room look from a dashboard toy.
- **Typography:** a single monospaced or tabular-figure font for all live values
  so digits do not jitter as they update; a plain sans for labels.
- **No gradients, shadows, or glassmorphism** except the specified heat glow and
  vent plume effects, which are functional.

### 6.2 The P&ID — this is the centrepiece

A hand-built SVG schematic of the package, laid out left to right:

```
 source → [suction scrubber] → [suction ESD] → [suction control valve] →
   ┌──────────────────────────────────────────────────────┐
   │  [ST1 cylinder] → [intercooler 1] → [ST2 scrubber] → │
   │  [ST2 cylinder] → [intercooler 2] → [ST3 scrubber] → │
   │  [ST3 cylinder] → [aftercooler]                      │
   └──────────────────────────────────────────────────────┘
    → [discharge ESD] → pipeline
    with [bypass valve] returning discharge to suction
    and [blowdown valve] venting suction to atmosphere
    engine + crankshaft driving all three cylinders below
```

**Animation requirements:**

- **Pipe colour by pressure** — a continuous colour ramp, blue at atmospheric
  through to red at 2000 psig. The staircase from suction to final discharge
  should be visible at a glance.
- **Valves** show position: a rotating disc or a filled fraction, plus the numeric
  percentage. Green when open, grey when closed, amber in transit.
- **Cylinders pulse** at engine speed. Piston animation optional but a subtle
  scale or glow synced to rpm sells it.
- **Flow arrows** along each pipe, animation speed proportional to mass flow,
  hidden when flow is zero. This makes the bypass recirculation loop obvious when
  unloaded.
- **Coolers** show fan rotation when their motor is commanded, and a heat glow
  proportional to the temperature drop across them.
- **Temperature at each cylinder** shown as a small badge, coloured green /
  amber / red against the alarm and trip setpoints from section 4.
- **Blowdown venting** shows an animated plume when open and pressurised.

Every gauge on the diagram shows the live value with its unit, and turns amber at
its alarm setpoint and red at its trip.

### 6.3 Trends

Up to 12 selectable pens, 30-minute rolling window, using uPlot. **uPlot is a
hard requirement** — do not substitute Recharts, Chart.js, or similar; they drop
frames at 10 Hz streaming. Default pens: suction, ST1, ST2, final discharge,
cyl 1 temp, cyl 2 temp, engine speed, bypass position.

Alarm and trip setpoints drawn as horizontal dashed lines.

### 6.4 Manual override panel

When OPC UA is disconnected, the app must still be usable standalone. Provide
manual sliders and toggles for every command in section 4.3 and 4.4, so the whole
sequence can be driven by hand for demonstrations. When OPC UA connects, these
become read-only indicators showing what the PLC is commanding.

### 6.5 Boundary condition panel

Editable inputs for `P_src`, `P_proc`, `T_suc`, and ambient temperature. These are
the two ends of the system — changing them is how a user explores the machine's
behaviour. Changing `P_src` from 60 to 25 psig should visibly drive cylinder 2
toward its alarm.

---

## 7. Build order

1. `physics.py` with the design point test passing. Nothing else until this works.
2. `server.py` with a websocket pushing state, and a trivial HTML page showing raw
   numbers. Prove the loop runs in real time.
3. Manual override panel — drive the model by hand, confirm it behaves.
4. The P&ID, static first, then animated.
5. Trends.
6. `opcua_link.py` — connect to CODESYS, two tags first, then all of them.
7. Fault injection.
8. Instrumentation lag, noise, range clamping.

---

## 8. Testing

Port the 27 self-tests from the Simulink model:

- design point values, all 8
- mass balance closure on both volumes, under 1e-3 kg/s
- supply equals delivery at steady state
- all three stage ratios equal
- pressures rise monotonically through the stages
- all pressures above atmospheric
- gas heated by compression, never cooled
- no NaN or Inf anywhere
- valve positions within 0–100
- all flows non-negative
- steady-state drift under 2 psi over the last 50 s

Run them as pytest. They must pass before any UI work is considered done.

---

## 9. Things that will be tempting and must not be done

- **Do not add control logic.** No start sequence, no permissive checks, no alarm
  evaluation, no PID. It will be tempting when the PLC side is not ready. A
  simulator that grants its own permissives passes tests the real PLC would fail.
- **Do not let the UI drive the physics timestep.** The physics runs at a fixed
  20 ms regardless of frame rate or websocket backpressure.
- **Do not skip the range clamping.** Unclamped values let the PLC see readings no
  transmitter could produce.
- **Do not expose fault injection over OPC UA.**
- **Do not invert the OPC UA roles.** The app is the client, CODESYS is the
  server. See section 2.1.
- **Do not let internal `meas()` tag names leak past `tags.py`.** One naming
  scheme per boundary.
- **Do not swap uPlot for another chart library.**
- **Do not hardcode parameters in `physics.py`.** Every value in section 3.1
  loads from `config.yaml` so a different compressor is a different config file,
  not a code change.

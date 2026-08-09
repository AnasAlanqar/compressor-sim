# compressor-sim

A process simulator for a three-stage reciprocating gas compressor package,
exposed over OPC UA so a real PLC — CODESYS on a laptop, or a physical panel —
can be connected and its control logic tested against realistic process
behaviour without touching real machinery.

**Reference machine:** Ariel JGH/4 three-stage reciprocating compressor
driven by a Caterpillar G3516LE gas engine, controlled by a Spartan Controls
REMVue 500S panel. Enerflex unit 070438, project PN17481.

The app models **process response only**. It contains no control logic — no
timers, no permissives, no state machines, no PID loops, no alarm evaluation.
All sequencing and alarm/shutdown logic belongs to the PLC under test; the
simulator's job is to produce the pressures, temperatures, and flows that a
real skid would produce and let the PLC react to them.

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Browser UI  (React + TypeScript + Vite)         │
│  animated P&ID, gauges, trends, fault panel       │
└────────────────┬──────────────────────────────────┘
                  │  WebSocket, 10 Hz state push
┌─────────────────▼──────────────────────────────────┐
│  Python backend  (FastAPI + asyncio)               │
│                                                     │
│  ┌───────────────┐   ┌────────────────────────┐    │
│  │ physics loop  │   │  OPC UA client          │    │
│  │ 20 ms fixed   │◄─►│  (asyncua)              │    │
│  │ RK4 integrator│   │  reads commands         │    │
│  └───────────────┘   │  writes measurements    │    │
│                       └───────────┬─────────────┘   │
└───────────────────────────────────┼─────────────────┘
                                    │ OPC UA
                      ┌─────────────▼─────────────┐
                      │  CODESYS PLC               │
                      │  or real hardware panel     │
                      └─────────────────────────────┘
```

- **Physics** integrates 10 states (engine speed, oil pressure, suction and
  discharge pressures, five valve positions) plus four thermal lags at a
  fixed 20 ms step using RK4, running in wall-clock real time.
- **`tags.py`** is the one and only boundary between the physics model's
  internal naming and the outside world — it owns range clamping, scaling,
  and the canonical tag map, so a Modbus or remote-I/O gateway could sit
  where `opcua_link.py` sits today without touching physics or the UI.
- **`opcua_link.py`** connects to the PLC's OPC UA server as a *client*
  (CODESYS ships a free built-in server; its client requires licensing in
  some versions, so the simulator is deliberately the client side).
- **Fault injection** (`faults.py`) is local to the app and never exposed
  over OPC UA — the logic under test must not be able to clear its own
  faults.

See [docs/APP_SPEC.md](docs/APP_SPEC.md) for the full physics model, tag map,
and UI specification, and [docs/compressor_lite_reference.py](docs/compressor_lite_reference.py)
for the original verified physics reference this simulator was ported from.

## Repository layout

```
compressor-sim/
  backend/
    app/
      physics.py       # the model — 10-state RK4 integrator
      tags.py           # canonical tag map, clamping, scaling
      opcua_link.py      # asyncua client, read/write loops
      faults.py           # fault injection state
      server.py            # FastAPI app, websocket, REST endpoints
    config.yaml            # parameters, endpoint URL, alarm setpoints
  frontend/
    src/
      components/          # PidDiagram, TrendChart, FaultPanel, TagTable, ...
      hooks/useSimState.ts   # websocket subscription
      App.tsx
  tools/
    mock_plc.py             # standalone OPC UA server for testing without a real PLC
  tests/                     # pytest suite — physics, tags, faults, HMI, OPC UA link
  docs/
    APP_SPEC.md              # full application specification
    compressor_lite_reference.py  # verified physics reference
```

## Getting started

### Backend

```bash
cd backend
pip install fastapi uvicorn[standard] asyncua numpy pyyaml
python -m uvicorn app.server:app --reload --host 0.0.0.0 --port 8000
```

Open `http://localhost:8000` for a trivial raw-state diagnostic page, or
point the frontend dev server at it.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Testing against a PLC without real hardware

`tools/mock_plc.py` runs a standalone OPC UA server so the backend's client
side can be exercised without a real CODESYS instance or physical panel:

```bash
python tools/mock_plc.py --endpoint opc.tcp://localhost:4840
```

Pass `--codesys` to mimic CODESYS's own NodeId addressing and typing
conventions (32-bit `Float` analog tags, string NodeIds) instead of the
default browse-path mode.

### Tests

```bash
pytest
```

The suite covers the physics design point (suction, stage discharge
pressures, mass flow, and cylinder temperatures within tolerance of the
verified reference), mass-balance closure, tag clamping/scaling, fault
injection, the OPC UA link, and the manual-override HMI path.

## Key design rules

- **No control logic in the simulator.** The app produces a temperature of
  280 °F; deciding that's an alarm is the PLC's job.
- **Physics runs on a fixed timestep**, independent of frame rate or
  websocket backpressure.
- **All analog values are clamped** to their transmitter range before being
  written out — a blocked discharge drives the model past a transmitter's
  span, and the PLC must see a saturated reading, exactly as real hardware
  would report.
- **One naming scheme per boundary.** The physics module's internal state
  names never leak past `tags.py`; only canonical tag names (`PT_1001`,
  `ZS_2003`, `CMD_4004`, ...) cross into the OPC UA link or the UI.
- **Fault injection is invisible to the PLC** — it travels only over the
  UI's websocket connection, never over OPC UA.

Full rationale for these rules is in
[docs/APP_SPEC.md](docs/APP_SPEC.md#9-things-that-will-be-tempting-and-must-not-be-done).

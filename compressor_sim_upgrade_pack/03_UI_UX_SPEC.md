# Desktop UI / UX Specification

## 1. UX objective

The application must answer three questions quickly:

1. **What is happening?**
2. **Why is it happening?**
3. **What can I do next?**

Design the simulator like a modern industrial engineering/operator workstation, not a generic analytics dashboard.

---

## 2. Desktop shell

Target the existing desktop stack and make the layout work well at 1920x1080 while remaining usable at smaller laptop resolutions.

Recommended shell:

```text
+--------------------------------------------------------------+
| PACKAGE STATUS / MODE / RUN STATE / RPM / FLOW / ALARMS      |
+----------+-----------------------------------------+----------+
|          |                                         |          |
| LEFT NAV |              MAIN WORKSPACE             | INSPECTOR|
|          |                                         |          |
|          |                                         |          |
+----------+-----------------------------------------+----------+
| OPTIONAL BOTTOM DRAWER: TRENDS / ALARMS / SEQUENCE            |
+--------------------------------------------------------------+
```

The right inspector appears contextually when equipment or a value is selected.

---

## 3. Navigation

Use task-oriented pages:

- Overview
- Process
- Trends
- Sequence
- Alarms
- Performance
- Faults
- Engineering
- Historian

Avoid meaningless navigation labels such as Page 1 / Page 2 / Misc.

---

## 4. Overview page

Show a concise package status strip:

- RUNNING / STOPPED / STARTING / TRIPPED
- RPM
- compressor mass flow
- suction pressure
- discharge pressure
- driver load estimate
- active alarm/trip count

Below it, show the main process path.

The overview must not be a grid of oversized cards.

---

## 5. Process page

Use a clear SVG/React process mimic rather than requiring a heavy diagramming library.

Process path:

```text
Source
  -> Suction ESD
  -> Suction control valve
  -> Suction volume/scrubber
  -> Stage 1
  -> Cooler 1
  -> Interstage 1 volume
  -> Stage 2
  -> Cooler 2
  -> Interstage 2 volume
  -> Stage 3
  -> Aftercooler / discharge volume
  -> Discharge ESD
  -> Pipeline

Recycle/bypass:
  Discharge -> bypass valve -> suction

Blowdown:
  configured blowdown source -> BDV -> atmosphere
```

Each primary piece of equipment should show only the important live values. Detailed values belong in the inspector.

### Interaction

Clicking equipment opens a right-side inspector with:

- state/status;
- command vs actual;
- pressures;
- temperatures;
- flow;
- relevant stage ratio;
- power/load where relevant;
- alarms;
- active fault indicators;
- `Add to Trend` action;
- `Why?` action where supported.

---

## 6. Visual language

Use a restrained industrial visual system.

### Normal state

Mostly neutral colors.

### Color is reserved for meaning

- red: trip / shutdown / dangerous active condition;
- amber: warning / degraded condition;
- green or positive accent: running / healthy where useful;
- blue or app accent: selection / command / navigation;
- gray: inactive/offline/disabled.

Do not make all running pipes bright green or all equipment heavily animated.

### Flow indication

Flow lines may use subtle direction animation only when calculated flow is non-zero.

If flow is zero, do not animate it.

---

## 7. Context inspector

The inspector is the main method for avoiding clutter.

Example for Stage 2:

```text
STAGE 2
Status: Loaded
Suction P: 117 psig
Discharge P: 377 psig
Pressure ratio: 3.22
Suction T: ...
Discharge T: ...
Mass flow: ...
VE: ...
Power: ...
Torque: ...

[Add to Trend]
[Why?]
[Engineering Details]
```

Do not open multiple floating windows for routine inspection.

---

## 8. Trends

Use the project's existing chart library if suitable. If no suitable high-performance real-time chart exists, prefer `uPlot`.

Requirements:

- Add any important numeric signal to trend from its inspector.
- Support multiple traces.
- Support pause/resume.
- Support time-window selection.
- Show engineering units.
- Allow cursor inspection.
- Keep data sampling independent from rendering where possible.
- Avoid rendering every simulation tick if the simulator tick is much faster than the display refresh rate.

The bottom trend drawer should allow an operator to stay on the process page while watching dynamics.

---

## 9. "Why?" physics panel

This is a core feature.

Do not use an LLM for the first version. Generate explanations deterministically from the mass-balance terms supplied by the backend.

### Discharge example

```text
Why is discharge pressure rising?

Compressor inflow       +0.945 kg/s
Pipeline outflow        -0.812 kg/s
Recycle outflow         -0.000 kg/s
---------------------------------
Net accumulation        +0.133 kg/s

Gas mass is accumulating in the discharge volume, therefore discharge pressure is increasing.
```

### Suction example

```text
Supply inflow           +0.910 kg/s
Recycle return          +0.000 kg/s
Compressor withdrawal   -0.945 kg/s
Blowdown                -0.000 kg/s
---------------------------------
Net accumulation        -0.035 kg/s

Gas mass is leaving the suction volume faster than it is entering, therefore suction pressure is decreasing.
```

Also explain second-order effects where helpful:

- lower suction pressure -> lower density -> lower compressor mass flow;
- bypass opening -> discharge mass removed + suction mass added;
- cooler fan trip -> hotter next-stage suction -> lower density / higher discharge temperature.

---

## 10. Sequence page

Display startup/shutdown as human-readable steps, for example:

```text
[done] Permissives satisfied
[done] Lube oil established
[done] Suction ESD open
[done] Recycle open
[done] Driver started
[active] Warm-up / idle
[pending] Raise to loading RPM
[pending] Close recycle
[pending] Normal loaded operation
```

When waiting, show:

- expected condition;
- command;
- feedback;
- elapsed wait time;
- timeout if applicable.

Never expose only an integer sequence step to the operator.

---

## 11. Alarms page

Use a compact industrial alarm table with:

- timestamp;
- priority;
- tag;
- description;
- state;
- acknowledged/unacknowledged;
- returned/active.

Clicking an alarm should navigate/select the relevant equipment when possible.

Avoid full-screen red alarm popups except for an intentional critical-trip workflow.

---

## 12. Performance page

Show:

- RPM;
- mass flow;
- suction/discharge pressure;
- total pressure ratio;
- estimated total compressor power;
- estimated driver load;
- per-stage ratio;
- per-stage suction/discharge temperatures;
- per-stage power estimate.

Clearly label these as **simulated estimates**.

Do not call them OEM performance values.

---

## 13. Faults page

Group faults by category:

### Process

- suction restriction;
- discharge restriction;
- high downstream/pipeline pressure if supported.

### Compressor

- reduced capacity;
- stage efficiency degradation if implemented.

### Driver

- trip;
- slow RPM response.

### Valves

- recycle stuck open;
- recycle stuck closed;
- actuator slow;
- actuator stuck at position.

### Instrumentation

- pressure bias;
- frozen pressure;
- temperature bias;
- frozen temperature.

### Cooling

- fan trip;
- degraded cooling.

Each fault should have:

- enabled state;
- severity if applicable;
- clear description of what the simulator changes physically;
- reset action.

---

## 14. Engineering page

Show model inputs and assumptions with source/confidence labels.

Example:

| Parameter | Value | Category |
|---|---:|---|
| Displacement | 0.023258 m3/rev | CONFIGURED / REFERENCE |
| Clearance | 0.078 | FITTED |
| Slip | 0.04 | ASSUMED |
| R_sp | 345.5 J/(kg K) | CONFIGURED |
| n | 1.2693 | CONFIGURED |

Include the simulator-scope disclaimer and a link/open action to the full model boundary documentation.

---

## 15. Modes

Support at least:

### Operate

Normal use. Engineering assumptions hidden from the main workflow.

### Training

Allows fault injection and optional hiding of the fault identity from the trainee.

### Engineering

Exposes equations, raw true values, instrument values, mass-balance terms, parameters, and model-source categories.

Do not make all three modes visually different applications. They are views of the same simulator.

---

## 16. Responsive behavior

The desktop app is primary, but prevent layout failure on smaller windows.

Rules:

- collapse left navigation to icons at narrower widths;
- allow inspector to become a drawer;
- allow trend drawer to become full-height when needed;
- do not shrink engineering text below readable size;
- allow process diagram pan/zoom only if necessary;
- prefer hiding secondary labels over overlapping primary process data.

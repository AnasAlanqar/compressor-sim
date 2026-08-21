# Master Coding-Agent Prompt — Compressor Simulator Upgrade

You are upgrading an existing reciprocating gas compressor desktop simulator. Work directly from the repository. Do not redesign the project blindly and do not assume details that can be inspected.

## Primary objective

Upgrade the simulator from a simplified PLC-training compressor model into a stronger **physics-based controls, training, troubleshooting, and engineering-visualization simulator** with a modern desktop UX.

The result must remain explicitly **non-OEM-validated**. Do not claim that the simulator predicts actual Ariel JGH/4 performance or fully simulates a Caterpillar G3516LE engine.

Read these project instructions before editing:

- `00_README.md`
- `01_SIMULATION_SCOPE.md`
- `02_IMPLEMENTATION_ARCHITECTURE.md`
- `03_UI_UX_SPEC.md`
- `04_PHYSICS_UPGRADES.md`
- `05_DEPENDENCIES_AND_ENVIRONMENT.md`
- `06_TEST_AND_ACCEPTANCE.md`
- `07_TASK_BREAKDOWN.md`

If these files are placed in a docs/upgrade folder, resolve paths accordingly.

---

## FIRST: mandatory repository and dependency audit

Before changing code:

1. Inspect the repository tree.
2. Read the existing simulator configuration, physics implementation, tests, API/state definitions, frontend package definition, and desktop entry point.
3. Specifically locate equivalents of:
   - `backend/config.yaml`
   - `backend/app/physics.py`
   - `tests/test_design_point.py`
   - `frontend/package.json`
   - frontend source tree
   - pywebview launcher
4. Search for every Ariel, CAT/Caterpillar, REMVue, design-point, displacement, clearance, valve coefficient, mass-flow, pressure, stage, sequence, alarm, and trend reference.
5. Run the existing backend tests before editing.
6. Run the existing frontend build before editing.
7. Record the current design-point output.

### Dependency requirement

Do not assume packages are available.

- Detect whether Python dependencies are managed by requirements, pyproject, Poetry, uv, Pipenv, etc.
- Detect whether frontend dependencies use npm, pnpm, or yarn.
- Inspect installed packages and existing dependency files.
- Verify imports/modules before adding anything.
- If a required package is missing, install it with the repository's existing package manager and persist the dependency.
- Do not globally install project dependencies.
- Do not add a dependency if the same need is already met by an existing package.

For this phase, avoid heavy thermodynamics packages. The required physics should be achievable without CoolProp/REFPROP/Cantera/Scipy unless the repository already uses them for a justified reason.

For trends, use the existing suitable chart library if present. If there is no suitable real-time chart library, add `uplot` and persist it in the frontend package definition.

For the process mimic, prefer React + SVG/CSS. Do not add a heavy graph/diagram framework only for a fixed compressor process drawing.

After dependency changes, verify imports and builds immediately.

---

## Preserve the baseline truth

The current simulator is a simplified three-stage reciprocating-compressor model shaped around an Ariel JGH/4 + CAT G3516LE package identity.

Known current model values include approximately:

- `R_sp = 345.5 J/(kg K)`
- `n = 1.2693`
- `V_disp = 0.023258 m^3/rev`
- clearance `0.078`
- slip/leakage `0.04`
- suction volume `3.0 m^3`
- discharge volume `4.5 m^3`
- source `60 psig`
- pipeline `1050 psig`
- reference behavior near `1000 rpm`, `29.8 psig` suction, `1149 psig` final discharge and `0.945 kg/s`

Treat these as configured/fitted/assumed model values unless the repository contains a real source proving otherwise.

Do not invent OEM provenance.

---

## Scope to IMPLEMENT

### A. Dynamic process model

Implement separate dynamic gas inventories for at least:

- suction;
- interstage 1;
- interstage 2;
- final discharge.

Use mass conservation:

`dm/dt = sum(inflows) - sum(outflows)`

and derive pressure from the configured ideal-gas model in SI units.

Calculate stage pressure ratios from the actual dynamic pressures. Do not force equal stage pressure ratios after this change.

Preserve/extend the existing compressor mass-flow formulation based on displacement, suction density, RPM, volumetric efficiency, clearance, pressure ratio, leakage/slip, and enabled state.

Do not replace a working calibrated equation just to make the code look different. Refactor only when it improves clarity/testability.

### B. Stage thermodynamics and power

For each stage expose:

- suction/discharge pressure;
- suction/discharge temperature;
- pressure ratio;
- mass flow;
- volumetric efficiency;
- estimated compression power;
- estimated shaft torque contribution where meaningful.

Use the existing polytropic model or a transparent documented equivalent.

### C. Simplified driver/load coupling

Keep the driver intentionally simple.

Implement:

- commanded and actual RPM;
- existing acceleration/deceleration behavior;
- estimated total compressor power demand;
- estimated driver load percentage;
- configurable small RPM droop under high load;
- configurable governor/recovery behavior;
- coast-down on trip.

Do NOT implement or claim:

- CAT combustion;
- fuel maps;
- turbocharger maps;
- emissions;
- actual CAT proprietary torque/governor map.

### D. Valve actuator dynamics

Separate valve command from actual valve position.

Implement configurable open/close rate or first-order travel behavior for primary valves.

Use actual position in flow equations.

Support stuck/slow faults.

Preserve the existing bypass command convention unless you implement a clearly compatible migration.

### E. Cooler dynamics

Implement a first-order practical cooler model for stage intercoolers and aftercooler using ambient/reference temperature, fan state, nominal effectiveness, degradation factor, and time constant.

Do not claim heat-exchanger sizing accuracy.

### F. Instruments

Separate true process values from instrument/PLC-visible values.

Implement at least:

- lag;
- bias;
- frozen reading;
- optional noise with deterministic-test behavior.

Do not let a transmitter fault directly corrupt the true process state.

### G. Fault engine

Implement an initial fault set that changes physical/model parameters:

- suction restriction;
- discharge restriction;
- recycle/bypass stuck;
- actuator slow;
- cooler fan trip/degraded cooling;
- compressor capacity degradation;
- driver trip/slow recovery;
- pressure transmitter bias/freeze;
- temperature transmitter bias/freeze.

Do not implement a fault by only forcing an alarm bit.

### H. Explanation data

Expose backend terms needed to explain pressure changes.

For suction expose at least:

- source/supply inflow;
- recycle return;
- compressor withdrawal;
- blowdown outflow;
- net mass flow.

For discharge expose at least:

- compressor inflow;
- pipeline outflow;
- recycle outflow;
- net mass flow.

---

## Scope to NOT IMPLEMENT in this phase

Do not spend this phase implementing:

- actual Ariel OEM capacity curves;
- detailed cylinder-by-cylinder OEM performance;
- real CAT combustion or fuel consumption;
- real-gas multi-component EOS unless it already exists;
- phase equilibrium/condensation;
- rod load/crosshead load;
- torsional vibration;
- API 618 pulsation analysis;
- detailed compressor valve plate dynamics;
- relief-valve sizing;
- flare sizing;
- predictive maintenance/RUL;
- OEM performance guarantees.

If related placeholders exist, label them future work.

---

## UI/UX to IMPLEMENT

Use the existing React desktop frontend and its established styling/component system.

### Application shell

Create:

- top package-status strip;
- task-oriented left navigation;
- central workspace;
- contextual right inspector;
- optional bottom drawer for trends/alarms/sequence.

### Pages

Implement or reorganize into:

- Overview
- Process
- Trends
- Sequence
- Alarms
- Performance
- Faults
- Engineering
- Historian (can initially reuse existing history capabilities if present)

### Overview

Show at a glance:

- state;
- RPM;
- mass flow;
- suction pressure;
- discharge pressure;
- estimated driver load;
- alarms/trips.

Do not make the screen a wall of giant cards.

### Process mimic

Build a process-oriented fixed diagram using React/SVG/CSS showing:

Source -> suction ESD -> suction control -> suction volume -> Stage 1 -> Cooler 1 -> Interstage 1 -> Stage 2 -> Cooler 2 -> Interstage 2 -> Stage 3 -> aftercooler/discharge -> discharge ESD -> pipeline.

Also show recycle path from discharge to suction and the configured blowdown path.

Clicking equipment opens the contextual inspector.

### Inspector

Show component-specific values and actions such as:

- status;
- command vs actual;
- pressure/temperature/flow;
- stage ratio;
- power/load;
- alarms;
- active faults;
- Add to Trend;
- Why?;
- Engineering Details.

### Trends

Allow selected signals to be added from the inspector.

Use bounded history buffers and do not leak memory.

Do not render at the full physics tick rate if unnecessary.

### Why? panel

Implement deterministic explanations from mass balance, not an LLM.

Example logic:

- if discharge net mass flow > tolerance -> "discharge pressure is rising because compressor inflow exceeds pipeline + recycle outflow";
- if net mass flow < -tolerance -> corresponding falling explanation;
- if near zero -> approximately settled.

Show the actual kg/s terms.

### Sequence

Show named steps with done/active/pending state and waiting reason rather than only numeric step IDs.

### Alarms

Implement a compact industrial alarm table. Clicking an alarm should select/navigate to the relevant equipment if metadata is available.

### Performance

Show per-stage and total simulated estimates. Label them clearly as simulated estimates, not OEM performance.

### Faults

Provide a clear grouped fault-injection interface with severity/position where applicable and reset actions.

### Engineering

Expose model parameters and confidence/source categories:

- CONFIGURED
- FITTED
- ASSUMED
- CALCULATED
- OEM_VERIFIED only when genuinely sourced.

Display this disclaimer:

"Physics-based training and controls simulator. Equipment names identify the reference package; model parameters include configured, fitted, and assumed values and are not an OEM performance guarantee."

---

## Implementation quality rules

- Use SI units internally where practical.
- Keep one authoritative simulation timestep.
- Avoid negative mass, zero absolute pressure, NaN and infinity.
- Keep random behavior off by default or deterministic in tests.
- Keep process equations in backend, not duplicated in frontend.
- Keep UI rendering separate from simulation tick rate.
- Preserve existing working tags and API fields where possible.
- Add fields before deleting/renaming old ones.
- Do not delete existing tests simply because they fail after your changes.
- If a baseline expectation must change, explain exactly why and replace it with an equally strong test.

---

## Required tests

Add tests for:

1. whole-system mass conservation;
2. per-volume mass conservation;
3. suction-valve closing response;
4. bypass opening response;
5. discharge restriction response;
6. dynamic interstage pressures;
7. no NaN/inf in zero/low RPM states;
8. power increasing plausibly with pressure ratio/load;
9. driver load/droop response;
10. cooler fan-trip response;
11. instrument bias/freeze behavior;
12. every supported fault affecting the intended model parameter;
13. API compatibility/new fields;
14. reference design-point regression with documented tolerances.

---

## Required validation before finishing

You are not finished until you have:

- run backend tests;
- run frontend build;
- run configured lint/type checks if present;
- verified every added package is persisted in dependency files;
- launched the actual desktop app through its real entry point;
- confirmed live process data reaches the UI;
- confirmed process mimic, inspector and trends update;
- confirmed Why? calculations match backend mass-balance terms;
- exercised startup, loaded operation, recycle opening, shutdown, and several faults;
- confirmed no missing-module errors;
- confirmed no repeated frontend console exceptions;
- updated handover/documentation with what is simulated and what is not.

---

## Reporting format when done

Provide a final engineering implementation report containing:

1. files changed;
2. architecture changes;
3. equations/models added;
4. dependencies checked;
5. dependencies added and why;
6. tests run and results;
7. reference design-point before vs after;
8. UI pages/features implemented;
9. known limitations;
10. exact list of features explicitly NOT simulated;
11. any assumptions/fitted values introduced;
12. recommended next phase.

Do not say "fully realistic", "digital twin", "OEM accurate", or equivalent unless evidence in the repository genuinely supports that statement.

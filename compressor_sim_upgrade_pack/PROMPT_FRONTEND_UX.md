# Focused Coding Prompt — Desktop Frontend UX Upgrade

Work on the React desktop UI and only the minimum backend/API adjustments necessary to expose existing simulator data. Do not rewrite the core physics in this task.

Read:

- `01_SIMULATION_SCOPE.md`
- `03_UI_UX_SPEC.md`
- `05_DEPENDENCIES_AND_ENVIRONMENT.md`
- `06_TEST_AND_ACCEPTANCE.md`

## Mandatory first actions

1. Inspect `frontend/package.json`, source structure, styling system, routing/navigation, existing chart library, icons, component library, API/WebSocket client, alarm/sequence UI, and pywebview desktop shell.
2. Run the current frontend build before editing.
3. Detect npm/pnpm/yarn from lock files and use only the existing package manager.
4. Inspect installed dependencies before adding any.
5. If there is no suitable real-time trend library, add `uplot`; otherwise reuse the existing chart library.
6. Prefer React + SVG/CSS for the fixed compressor process mimic; do not add a heavy diagram package only for this screen.
7. Persist every added package in `package.json`/lockfile.

## UX structure

Implement a modern industrial desktop shell with:

- top package status strip;
- left navigation;
- central workspace;
- contextual right inspector;
- bottom drawer for trends/alarms/sequence when useful.

Pages:

- Overview
- Process
- Trends
- Sequence
- Alarms
- Performance
- Faults
- Engineering
- Historian

## Process page

Render:

Source -> suction ESD -> suction control -> suction volume -> Stage 1 -> Cooler 1 -> Interstage 1 -> Stage 2 -> Cooler 2 -> Interstage 2 -> Stage 3 -> aftercooler/discharge -> discharge ESD -> pipeline.

Show recycle from discharge to suction and blowdown route.

Use restrained industrial styling. Color must communicate state, not decorate the page.

Click equipment to open the inspector.

## Inspector

Display only component-relevant data and actions:

- state;
- command vs actual;
- pressure/temp/flow;
- stage ratio;
- simulated power/load;
- alarms;
- active faults;
- Add to Trend;
- Why?;
- Engineering Details.

## Trends

- bounded data buffers;
- add signal from inspector;
- engineering units;
- pause/resume;
- multiple traces;
- cursor inspection;
- sane rendering rate separate from the physics tick.

## Why? panel

Use backend mass-balance terms, not an LLM.

Show numerical inflow/outflow/net flow and a deterministic explanation of why suction/discharge pressure is rising/falling/steady.

## Sequence

Show named sequence steps, active/waiting reason, feedback and elapsed wait time.

## Alarms

Use an industrial table with timestamp, priority, tag, description, active/returned, ack state. Clicking an alarm should focus the equipment if possible.

## Performance

Show per-stage and total simulated estimates, clearly labeled "Simulated estimate".

## Faults

Provide grouped injection controls for the faults the backend actually supports. Do not create UI controls for unsupported physics.

## Engineering

Show model parameters plus categories CONFIGURED/FITTED/ASSUMED/CALCULATED/OEM_VERIFIED.

Display:

"Physics-based training and controls simulator. Equipment names identify the reference package; model parameters include configured, fitted, and assumed values and are not an OEM performance guarantee."

## Quality requirements

- no giant-dashboard-card wall;
- no unnecessary modal windows;
- no unreadably tiny labels;
- no uncontrolled red/green coloring;
- no fake values when API data is absent;
- no frontend reimplementation of compressor equations;
- no unbounded arrays for trends;
- retain existing desktop launch behavior.

## Before completion

- run frontend build;
- run existing lint/type/test scripts;
- launch desktop app;
- verify live data;
- verify process selection/inspector;
- verify trends;
- verify Why? numbers match backend;
- verify sequence and alarms;
- verify no missing package/module;
- report every package added and why.

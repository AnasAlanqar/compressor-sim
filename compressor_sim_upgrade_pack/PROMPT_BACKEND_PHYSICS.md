# Focused Coding Prompt — Backend Physics Upgrade

Work only on the simulator backend, configuration, backend tests, and API fields needed for the upgraded physics. Do not redesign the frontend in this task.

Read:

- `01_SIMULATION_SCOPE.md`
- `02_IMPLEMENTATION_ARCHITECTURE.md`
- `04_PHYSICS_UPGRADES.md`
- `05_DEPENDENCIES_AND_ENVIRONMENT.md`
- `06_TEST_AND_ACCEPTANCE.md`

## Mandatory first actions

1. Inspect repository structure and current physics/config/state/API/tests.
2. Run current backend tests and capture baseline.
3. Audit Python dependency management and installed modules.
4. Do not add a package unless necessary and missing.
5. Persist every necessary added dependency in the correct project file.

## Implement

- separate suction/interstage1/interstage2/discharge mass inventories;
- dynamic pressures derived from mass + temperature + volume;
- dynamic per-stage pressure ratios;
- existing/equivalent compressor flow model adapted to the stage architecture;
- per-stage temperature estimate;
- per-stage and total compression power;
- shaft torque estimate;
- simplified driver load/droop/governor coupling;
- command vs actual valve positions with travel dynamics;
- first-order cooler dynamics;
- true value vs instrument indicated value;
- instrument lag/bias/freeze;
- initial physical fault engine;
- suction/discharge mass-balance explanation fields;
- model-source metadata where appropriate;
- backward-compatible API fields.

## Do not implement/claim

- OEM Ariel curves;
- real CAT combustion/fuel maps;
- real-gas EOS unless already present;
- rod load;
- pulsation;
- relief sizing;
- proprietary performance guarantees.

## Tests

Add/retain automated tests for mass conservation, reference design point, valve response, bypass response, interstage dynamics, power/load, cooler faults, instrument faults, fault modifiers, and no NaN/inf.

Do not finish with failing tests unless an existing unrelated failure is proven and documented.

When complete, report exact equations, configuration values added, assumptions introduced, dependency changes, test results, and remaining limitations.

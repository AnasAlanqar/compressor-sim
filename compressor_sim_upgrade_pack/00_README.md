# Compressor Simulator Upgrade Pack

## Purpose

This pack defines the next practical upgrade of the reciprocating-gas-compressor desktop simulator.

The target is **not** to turn the application into a manufacturer-validated Ariel JGH/4 / Caterpillar G3516LE digital twin. The target is to make it a much stronger **physics-based PLC/HMI training, controls-testing, troubleshooting, and engineering visualization simulator** while keeping every assumption explicit.

The implementation should preserve the existing working simulator and incrementally improve it.

## Current baseline to preserve

The current implementation is described as a simplified three-stage reciprocating-compressor model shaped around an Ariel JGH/4 compressor package and CAT G3516LE driver identity.

Known baseline values include:

- Gas constant `R_sp = 345.5 J/(kg K)`
- Polytropic exponent `n = 1.2693`
- Compressor displacement `V_disp = 0.023258 m^3/rev`
- Clearance fraction `0.078`
- Slip/leakage fraction `0.04`
- Existing suction lumped volume `3.0 m^3`
- Existing discharge lumped volume `4.5 m^3`
- Source pressure `60 psig`
- Pipeline pressure `1050 psig`
- Existing tuned valve coefficients such as `K_suc`, `K_byp`, `K_proc`, `K_bdv`
- Existing reference operating point near `1000 rpm`, `29.8 psig` suction, `1149 psig` final discharge, and `0.945 kg/s` compressor mass flow

These values are **model inputs / fitted assumptions**, not automatically verified Ariel or CAT OEM data.

## Recommended implementation order

1. Read `01_SIMULATION_SCOPE.md` first.
2. Read `02_IMPLEMENTATION_ARCHITECTURE.md`.
3. Implement backend upgrades in `04_PHYSICS_UPGRADES.md`.
4. Implement UI/UX from `03_UI_UX_SPEC.md`.
5. Follow `05_DEPENDENCIES_AND_ENVIRONMENT.md` before adding packages.
6. Use `06_TEST_AND_ACCEPTANCE.md` as the acceptance contract.
7. Follow `07_TASK_BREAKDOWN.md` for staged delivery.
8. Use `PROMPT_MASTER_IMPLEMENTATION.md` with a coding agent.
9. Use the focused prompts if backend or frontend work is split between separate agents.

## Non-negotiable principles

- Do not present assumed parameters as OEM specifications.
- Do not silently change the established design-point behavior without documenting why.
- Keep the simulation deterministic by default.
- Separate **true process state**, **instrument measurement**, and **operator command**.
- Preserve mass balance.
- Add tests before replacing working physics.
- Do not add dependencies until the repository and installed environment have been inspected.
- If a package is missing and is actually necessary, install it using the repository's existing package manager and persist the dependency in the correct project file.
- Prefer simple, inspectable equations over unnecessarily advanced libraries.

## Deliverable definition

When this upgrade is complete, a user should be able to:

- operate the compressor package from a process-oriented desktop UI;
- see stage pressures, temperatures, flows, RPM, valve positions, and status;
- trend any important value;
- understand why suction or discharge pressure is moving;
- observe startup/shutdown sequence progress;
- inject basic faults;
- distinguish simulated process values from measured/instrument values;
- inspect engineering assumptions and model boundaries;
- run automated tests that confirm mass balance and the reference operating point remain credible.

# Implementation Task Breakdown

## Phase 0 — Repository audit

- Inspect project tree.
- Identify backend dependency manager.
- Identify frontend package manager.
- Run current tests before modifications.
- Run current frontend build.
- Record baseline design-point results.
- Identify current simulation tick rate and data transport method.
- Locate state/tag/API schemas.
- Locate startup/shutdown sequence logic.
- Locate alarm logic.

**Exit criterion:** Existing application behavior is understood and baseline test/build status is recorded.

---

## Phase 1 — Model boundaries and metadata

- Add/update simulator scope documentation.
- Add model source categories: CONFIGURED/FITTED/ASSUMED/CALCULATED/OEM_VERIFIED.
- Add UI disclaimer.
- Ensure Ariel/CAT references are described as package/reference identity unless verified data exists.

**Exit criterion:** App cannot reasonably be mistaken for an OEM-certified model.

---

## Phase 2 — Backend state refactor

- Separate command, true physical, and instrument states.
- Add explicit stage/interstage state structures.
- Preserve compatibility fields.
- Add mass-balance diagnostic fields.

**Exit criterion:** Existing design-point test still runs and new state can be inspected.

---

## Phase 3 — Independent interstage dynamics

- Add suction/interstage1/interstage2/discharge inventories.
- Derive dynamic pressures.
- Derive stage pressure ratios from actual states.
- Add conservation tests.
- Tune only clearly marked assumed/fitted parameters needed for stable behavior.

**Exit criterion:** Intermediate pressures evolve dynamically and mass conservation tests pass.

---

## Phase 4 — Compressor power and driver load

- Add stage compression-power calculation.
- Add total power and torque.
- Add simplified driver load percentage.
- Add optional load droop/governor recovery.
- Expose all values through API.

**Exit criterion:** Closing bypass/increasing pressure ratio visibly increases load/power and can affect RPM according to configured simplified dynamics.

---

## Phase 5 — Actuators and coolers

- Separate valve command vs actual position.
- Add valve travel dynamics.
- Add cooler first-order thermal dynamics.
- Add fan/degraded-cooling behavior.
- Preserve startup sequence semantics.

**Exit criterion:** Commands create realistic delayed physical response rather than instantaneous jumps where configured.

---

## Phase 6 — Instrument model

- Add true vs indicated values.
- Add lag/bias/freeze faults.
- Keep tests deterministic.
- Ensure PLC logic intentionally uses the correct signal source.

**Exit criterion:** Instrument faults can mislead the PLC/HMI without corrupting true physical state.

---

## Phase 7 — Fault engine

Implement the initial supported fault set:

- suction restriction;
- discharge restriction;
- bypass stuck;
- valve slow response;
- cooler fan/degradation;
- compressor capacity degradation;
- driver trip/slow response;
- PT/TT bias/freeze.

**Exit criterion:** Every fault modifies a real model parameter/state and has an automated test.

---

## Phase 8 — Desktop UI shell

- Implement top package status bar.
- Implement task-oriented left navigation.
- Implement contextual inspector.
- Implement bottom drawer framework.
- Maintain desktop visual hierarchy.

**Exit criterion:** Navigation and inspection work without clutter or floating-window dependence.

---

## Phase 9 — Process mimic

- Draw fixed process using React/SVG/CSS.
- Bind live state.
- Show correct direction/flow status.
- Add click/select behavior.
- Add command vs actual where relevant.

**Exit criterion:** Process state is understandable in seconds.

---

## Phase 10 — Trends and Why panel

- Verify existing chart library or install `uplot` if genuinely needed.
- Add `Add to Trend` behavior.
- Implement bounded trend-history buffers.
- Implement deterministic suction/discharge mass-balance explanations.

**Exit criterion:** User can correlate valve movement, flow, and pressure response without leaving the process workflow.

---

## Phase 11 — Sequence, alarms, performance, faults, engineering pages

- Human-readable sequence timeline.
- Alarm table with navigation to equipment.
- Performance page with simulated estimates.
- Fault injection page.
- Engineering assumptions/source page.

**Exit criterion:** All primary workflows in the UX specification are available.

---

## Phase 12 — Final validation

- Run all tests.
- Run frontend build/typecheck/lint if configured.
- Launch desktop shell.
- Exercise startup/load/unload/shutdown.
- Exercise at least five faults.
- Check memory usage of trends.
- Check no missing dependencies.
- Update handover documentation.

**Exit criterion:** Application is reproducible from a clean environment using persisted dependencies and documentation.

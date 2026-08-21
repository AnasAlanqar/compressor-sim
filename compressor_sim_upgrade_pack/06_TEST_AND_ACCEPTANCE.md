# Test and Acceptance Specification

## 1. Principle

The upgraded simulator is accepted based on **behavior, conservation, regression safety, and UI clarity**, not merely because the application starts.

---

## 2. Preserve baseline regression

Retain the existing design-point test and adapt it only when the new dynamic architecture makes a justified change.

Reference target behavior currently includes approximately:

- 1000 rpm;
- suction valve 45%;
- bypass closed;
- suction/discharge ESD open;
- blowdown closed;
- coolers on;
- suction pressure around 29.8 psig;
- stage-1 discharge around 117.3 psig;
- stage-2 discharge around 377.2 psig;
- final discharge around 1149 psig;
- compressor mass flow around 0.945 kg/s.

Do not require bit-exact values after adding true interstage dynamics. Establish sensible tolerances and explain any changed target.

---

## 3. Mass conservation tests

### Whole system

Over any test interval:

`delta_total_mass = integral(source_in - pipeline_out - blowdown_out) dt`

within tolerance.

Target numerical mass-balance error should remain under the existing project criterion where feasible, e.g. around `1e-3 kg/s` flow-equivalent or a clearly documented integrated tolerance.

### Per volume

For each dynamic volume:

`dm/dt = in - out`

must hold numerically.

---

## 4. Pressure-response tests

### Suction valve closing

Expected:

1. actual valve position closes according to actuator dynamics;
2. supply flow decreases;
3. compressor initially continues withdrawing gas;
4. suction mass falls;
5. suction pressure falls;
6. suction density falls;
7. compressor mass flow eventually falls.

### Bypass opening

Expected:

- recycle flow increases;
- discharge net accumulation decreases;
- discharge pressure falls or rises more slowly;
- suction receives recycle mass and tends to rise relative to no-recycle case.

### Discharge restriction

Expected:

- pipeline outflow decreases;
- discharge inventory accumulates;
- discharge pressure rises;
- alarm/trip logic responds when thresholds are crossed.

---

## 5. Interstage dynamics tests

After the upgrade, verify that stage pressure ratios are derived from dynamic stage boundaries.

Fault/degradation affecting one stage should change intermediate pressures rather than maintaining artificial equal ratios.

At stable normal operation, stage flows should converge closely because interstage mass accumulation tends toward zero.

---

## 6. Power/load tests

At zero RPM:

- compressor power should be zero or safely defined;
- torque calculations must not produce NaN/inf.

At increasing RPM and otherwise similar conditions:

- compressor throughput generally increases;
- estimated power should respond plausibly.

At higher pressure ratio:

- estimated compression power should increase, all else equal.

At increasing compressor load:

- driver load % should increase;
- configured droop/recovery behavior should be visible if enabled.

---

## 7. Cooler tests

With fan on:

- outlet temperature approaches the configured cooled target over time.

With fan trip/degraded cooling:

- cooler outlet temperature rises relative to the healthy case;
- downstream stage suction temperature rises;
- downstream discharge temperature should respond plausibly.

---

## 8. Instrument tests

### Bias

True process value remains unchanged while indicated value changes by the configured bias.

### Freeze

True process value continues changing while indicated value remains fixed.

### Lag

A step in true value produces a first-order delayed indicated response.

### Determinism

Automated tests must disable random noise or use a fixed seed.

---

## 9. Fault-engine tests

Each fault must affect the intended physical/model parameter, not only toggle an alarm flag.

Examples:

- suction restriction changes effective inlet flow;
- capacity degradation changes compressor capacity;
- stuck bypass changes actual valve position;
- cooler fault changes thermal response;
- transmitter freeze changes instrument value only.

---

## 10. API tests

Verify the snapshot contains:

- true primary state;
- displayed/instrument values;
- commands;
- actual valve positions;
- per-stage calculations;
- driver load/power;
- fault state;
- alarm state;
- mass-balance explanation terms.

Do not break existing API fields without compatibility handling.

---

## 11. UI acceptance tests

### Overview

A user can identify package state, RPM, suction pressure, discharge pressure, flow, and alarm state without opening another page.

### Process

A user can click every major piece of equipment and open the contextual inspector.

### Trends

A user can add a process signal to a trend from the inspector.

### Why

A user can see the inflow/outflow/net-mass explanation for suction and discharge pressure behavior.

### Sequence

A user sees named startup/shutdown steps rather than only a numeric state.

### Faults

A user can inject and reset supported faults.

### Engineering

A user can see which parameters are CONFIGURED/FITTED/ASSUMED/CALCULATED.

### Scope

The UI clearly states that the model is not an OEM performance guarantee.

---

## 12. Build acceptance

Completion requires:

- backend tests pass;
- frontend build passes;
- existing tests are not casually deleted;
- desktop application launches through its real entry point;
- no console flood of repeated exceptions;
- no missing dependency errors;
- no NaN/inf in normal simulation;
- no obvious memory growth from unbounded frontend trend arrays;
- all added dependencies are persisted in the correct project files.

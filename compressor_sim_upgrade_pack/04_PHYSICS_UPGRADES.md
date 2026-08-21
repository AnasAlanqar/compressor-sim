# Practical Physics Upgrade Specification

## 1. Goal

Improve transient realism and engineering usefulness without pretending to be an OEM performance package.

The first upgraded release should remain understandable enough that a developer can trace every major pressure and flow result to a documented equation.

---

## 2. Dynamic mass inventories

### Current conceptual limitation

The existing model primarily treats suction and discharge as lumped dynamic volumes while intermediate stage pressures are substantially simplified.

### Upgrade

Add four primary gas inventories:

1. suction;
2. interstage 1;
3. interstage 2;
4. final discharge.

For each volume:

`dm/dt = sum(m_in) - sum(m_out)`

Update mass numerically:

`m_next = max(m_min, m + dt * net_mdot)`

Then derive pressure from:

`P = m * R_sp * T / V`

Use absolute SI units internally.

Document any minimum-pressure numerical clamp.

### Required invariant

Total modeled mass change must equal external source inflow minus pipeline/blowdown outflows, within numerical tolerance.

---

## 3. Stage compressor flow

The first implementation may use an equivalent reciprocating stage model.

Suggested basis:

`m_dot = V_disp_stage * rho_s * VE * rpm/60 * enabled_fraction`

Where VE includes a clearance/pressure-ratio effect and configured slip/leakage.

A typical simplified relation may be retained/adapted from the existing code rather than introducing an unverified new correlation.

### Important

Do not independently force every stage to the same mass flow during transients if dynamic interstage inventories are present.

At steady state, the stage flows should converge closely because mass is no longer accumulating in the interstage volumes.

If one equivalent compressor displacement is currently used for the whole machine, document how it maps to stage throughput.

---

## 4. Stage pressure ratios

Calculate pressure ratios from actual dynamic states:

`PR1 = P_interstage1 / P_suction`

`PR2 = P_interstage2 / P_interstage1`

`PR3 = P_discharge / P_interstage2`

Do not assign all stage ratios to an equal value after the dynamic-volume upgrade.

Protect equations from division by zero and nonphysical absolute pressures.

---

## 5. Compression temperature

Use the existing configured polytropic approach.

For an idealized stage:

`T2 = T1 * (P2/P1)^((n-1)/n)`

or the project's existing calibrated equivalent.

Keep any existing fitted temperature exponent only if it is intentionally part of the current model and document that choice.

Do not label predicted discharge temperature as OEM-certified.

---

## 6. Compressor power

Add estimated stage compression power.

A practical polytropic estimate is:

`Wdot = mdot * (n/(n-1)) * R_sp * T1 * ((P2/P1)^((n-1)/n) - 1)`

Use absolute pressure.

Add configurable mechanical/overall efficiency only if needed and clearly identify it as assumed/configured.

Expose:

- stage power W/kW/hp;
- total compressor power;
- total estimated torque at actual RPM.

At very low RPM, avoid torque singularity by using a safe threshold and report zero/not-available as appropriate.

---

## 7. Driver/load coupling

Implement a simple, transparent driver model rather than detailed CAT combustion.

Minimum behavior:

- driver has a commanded target RPM;
- acceleration/deceleration limits remain configurable;
- compressor power creates required shaft torque;
- driver load percentage = required power / configured available power at the current operating region;
- high load can introduce a small configurable RPM droop;
- governor response moves RPM back toward requested RPM with a configurable time constant/rate limit;
- trip removes driving torque and RPM coasts down.

Possible simplified form:

`rpm_target_effective = rpm_command - load_droop_rpm`

`load_droop_rpm = droop_gain * max(0, load_pct - load_threshold)`

Then use the existing rate-limited RPM dynamics toward the effective target.

This preserves numerical simplicity while making load visibly affect the driver.

### Not simulated

- combustion cycles;
- fuel flow;
- turbocharger;
- ignition;
- actual CAT torque curve;
- proprietary governor behavior.

---

## 8. Valve actuators

Separate command and actual position.

Recommended model:

`dx/dt = clamp((x_cmd - x_actual)/tau, -max_close_rate, +max_open_rate)`

or a pure rate-limited travel model if simpler.

Use actual position in the flow equation.

Fault modifiers:

- stuck position;
- reduced travel speed;
- failed open;
- failed closed.

Do not instantly teleport the valve position unless a valve is explicitly configured as instantaneous for compatibility.

---

## 9. Valve/process flow

The existing model uses tuned simplified coefficients. Preserve this as the default compatibility model unless a compressible-flow upgrade can be implemented and validated with tests.

At minimum:

- flow must use actual valve position;
- flow direction must be defined;
- no unintended reverse flow should occur unless explicitly supported;
- source and pipeline boundary pressures remain configurable;
- all flow units are kg/s internally.

### Optional moderate upgrade

Add a simplified choked-flow cap for large gas pressure ratios.

If implemented, document the formula and assumptions. Do not call tuned `K` values real manufacturer `Cv` values unless they actually are.

---

## 10. Cooler dynamics

For each intercooler/aftercooler, use a first-order target-temperature model.

Example:

`T_target = T_ambient + effectiveness_factor * (T_in - T_ambient)`

`dT_out/dt = (T_target - T_out) / tau`

Adjust effectiveness based on:

- fan on/off;
- degraded/fouled factor.

The actual parameterization can be adapted to preserve the existing design-point temperatures.

This model is only for dynamic thermal behavior, not exchanger design.

---

## 11. Instrument models

For each instrumented signal:

1. receive true value;
2. apply sensor lag;
3. apply bias;
4. apply optional deterministic/random noise;
5. apply fault state;
6. clamp to configured transmitter range if the existing PLC expects that behavior.

Suggested first-order lag:

`dy/dt = (x_true - y) / tau_sensor`

Fault modes:

- normal;
- bias;
- frozen;
- failed_high;
- failed_low.

Tests must disable random noise or use a fixed seed.

---

## 12. Fault implementation philosophy

Faults should modify a physical parameter or instrument behavior, not simply force an alarm bit.

Examples:

### Suction restriction

Reduce effective suction-flow coefficient.

### Discharge restriction

Reduce effective process-outlet coefficient.

### Recycle stuck open

Override actual recycle position toward the configured stuck position.

### Cooler fan trip

Reduce cooler effectiveness / change target temperature.

### Capacity degradation

Multiply compressor effective displacement or VE by a severity factor.

### Driver slow response

Reduce acceleration/governor response.

### Pressure transmitter frozen

Freeze instrument output while true pressure continues to evolve.

Alarms should arise from the resulting process or instrument conditions.

---

## 13. Numerical stability

- Keep internal units in SI.
- Convert to psig/degF/etc only at API/display boundaries where practical.
- Use one authoritative `dt`.
- Avoid hidden time-step assumptions in components.
- Clamp absolute pressure at a small physically safe minimum above zero.
- Prevent negative mass.
- Add conservation tests.
- Add assertions/logging for NaN or infinity in development/test mode.

---

## 14. Configuration additions

Add configuration sections for:

```yaml
volumes:
  suction_m3: ...
  interstage1_m3: ...
  interstage2_m3: ...
  discharge_m3: ...

actuators:
  suction_control:
    open_rate_pct_s: ...
    close_rate_pct_s: ...
  bypass:
    open_rate_pct_s: ...
    close_rate_pct_s: ...

driver_model:
  rated_power_kw: ...
  droop_gain_rpm_per_load_fraction: ...
  governor_time_constant_s: ...

coolers:
  stage1:
    time_constant_s: ...
    nominal_effectiveness: ...
  stage2: ...
  aftercooler: ...

instruments:
  PT_suction:
    lag_s: ...
    bias: 0
    noise_sigma: 0
```

Do not invent precise values and silently treat them as real equipment data. Use clearly marked defaults and tune only as needed to preserve a plausible design point.

# Implementation Architecture

## 1. General rule

Adapt to the existing repository rather than replacing it wholesale.

Before changing code, inspect at minimum:

- `backend/config.yaml`
- `backend/app/physics.py`
- existing backend models/state definitions;
- backend API/WebSocket code;
- `tests/test_design_point.py`
- other existing tests;
- `frontend/package.json`
- `frontend/src/`
- current Tailwind/shadcn setup;
- pywebview entry point;
- any existing trends, alarms, sequence, and HMI components.

If paths differ, locate the equivalent files.

---

## 2. Backend architecture target

Do not turn `physics.py` into one enormous function. Prefer logical model components while preserving a simple top-level simulation step.

Recommended conceptual structure:

```text
backend/app/
  physics.py                 # top-level simulation orchestration / compatibility entry point
  models/
    gas.py                   # density, ideal-gas helpers, unit conversions
    volume.py                # dynamic mass inventory / pressure state
    compressor.py            # flow, VE, stage work/power
    driver.py                # RPM/load/governor approximation
    valves.py                # actuator + flow behavior
    cooler.py                # first-order cooler model
    instruments.py           # lag/bias/noise/freeze
    faults.py                # fault state and fault application
  simulation/
    state.py                 # simulation state definitions
    engine.py                # simulation step coordination if useful
```

This is a preferred direction, not a forced rename. If the repository already has a better structure, integrate into it.

---

## 3. State separation

Maintain three different concepts.

### Command state

Examples:

- suction valve command;
- bypass command;
- speed reference;
- start command;
- ESD command.

### True physical state

Examples:

- actual valve position;
- true suction pressure;
- true interstage pressure;
- true discharge pressure;
- true gas temperature;
- true mass inventory;
- true compressor mass flow;
- true RPM.

### Instrument / PLC-visible state

Examples:

- PT-101 indicated pressure;
- TT-201 indicated temperature;
- valve position feedback;
- displayed RPM.

Do not use instrument noise or a failed sensor value inside the physical equations unless the real control logic is intentionally acting on that bad sensor.

---

## 4. Simulation tick order

Use one clearly documented update order. A recommended order is:

1. Read commands and fault configuration.
2. Update actuator actual positions.
3. Update driver/RPM state.
4. Calculate gas properties needed for this step.
5. Calculate stage compressor flows/capacity.
6. Calculate valve/process flows.
7. Calculate stage power and torque demand.
8. Update mass inventories in suction/interstage/discharge volumes.
9. Update pressures from inventories.
10. Update stage compression temperatures.
11. Update cooler outlet temperatures.
12. Apply physical safety clamps only where numerically necessary.
13. Update instrument models from true values.
14. Evaluate alarms/trips/permissives using the same signals the real PLC logic is intended to use.
15. Record historian/trend sample.

Document any unavoidable deviations.

---

## 5. Dynamic volumes

Create model states for at least:

```text
suction_volume
interstage_1_volume
interstage_2_volume
discharge_volume
```

Each volume should expose:

- `mass_kg`
- `pressure_pa`
- `temperature_k`
- `volume_m3`
- `m_in_kg_s`
- `m_out_kg_s`
- `net_mdot_kg_s`

Where practical, pressure should be derived from mass rather than independently integrated in a way that can drift from mass balance.

---

## 6. Compressor stages

Represent three stages explicitly.

Minimum runtime values per stage:

```text
stage[i].suction_pressure
stage[i].discharge_pressure
stage[i].suction_temperature
stage[i].discharge_temperature
stage[i].pressure_ratio
stage[i].mass_flow
stage[i].volumetric_efficiency
stage[i].power_w
stage[i].torque_nm
stage[i].enabled
```

The first implementation may use an equivalent-cylinder formulation rather than detailed individual cylinders.

---

## 7. Driver model

Minimum state:

```text
driver.state
driver.rpm_command
driver.rpm_actual
driver.rpm_error
driver.available_torque_nm
driver.required_torque_nm
driver.load_pct
driver.governor_output
driver.trip_active
```

Keep the model transparent and tunable through config.

---

## 8. API contract

Expose a stable UI-facing snapshot containing at least:

- package state;
- sequence step;
- alarms;
- commands;
- actual valve positions;
- all primary pressures and temperatures;
- mass flows;
- stage calculations;
- driver state;
- power/load estimate;
- mass-balance explanation terms;
- active faults;
- model confidence/source metadata where useful.

Avoid making the frontend recalculate process physics.

---

## 9. Why/explanation data

The backend should emit enough values for a deterministic explanation panel.

For suction:

```text
supply_in
bypass_return_in
compressor_out
blowdown_out
net_mdot
pressure_rate_or_trend
```

For discharge:

```text
compressor_in
pipeline_out
bypass_out
net_mdot
pressure_rate_or_trend
```

The frontend explanation should be generated from these values and rules, not from an LLM.

---

## 10. Backward compatibility

Where possible:

- preserve existing tag names;
- preserve existing API fields;
- add fields instead of deleting them;
- preserve design-point tests;
- provide migration aliases if a field must be renamed;
- keep existing PLC/SCADA interfaces functional.

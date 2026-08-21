# Simulation Scope and Truth Boundary

## 1. Product statement

The application is a **physics-based reciprocating compressor package simulator for PLC/HMI testing, operator training, control-sequence testing, troubleshooting, and engineering visualization**.

It is intentionally **not** described as an OEM-certified Ariel JGH/4 performance simulator, CAT G3516LE engine simulator, or plant-validated digital twin.

The UI, documentation, About screen, Engineering screen, and generated reports must use language consistent with this boundary.

---

## 2. What IS simulated in this upgrade

### Gas inventory and pressure dynamics

Simulate mass accumulation in finite volumes using:

`dm/dt = m_in - m_out`

and, for the default ideal-gas model:

`P = m * R * T / V`

or its time-domain equivalent.

The upgraded model should include separate dynamic inventories for at least:

- suction volume;
- interstage-1 volume;
- interstage-2 volume;
- final discharge volume.

This replaces the idea that all intermediate stage pressures are only algebraic equal-ratio values.

### Compressor throughput

Simulate compressor mass flow as a function of:

- displacement;
- suction density;
- RPM;
- volumetric efficiency;
- clearance;
- pressure ratio;
- configured slip/leakage;
- enabled/unloaded state.

The exact implementation may remain a simplified equivalent-cylinder model in this upgrade.

### Stage compression thermodynamics

For each stage, calculate:

- suction pressure;
- discharge pressure;
- pressure ratio;
- suction temperature;
- estimated discharge temperature;
- estimated compression work / power.

Use the configured polytropic model unless a more advanced model already exists in the repository.

### Driver dynamics

Simulate a simplified driver model containing:

- start / stop state;
- RPM target;
- acceleration and deceleration limits;
- idle / loaded speed behavior;
- estimated compressor torque demand;
- estimated driver load percentage;
- optional first-order RPM droop under increased compressor load;
- simple governor recovery toward target RPM.

This is a generic driver/load model with CAT-like tags and configured speed limits. It is not a CAT combustion model.

### Valve and actuator dynamics

Simulate separately:

- operator / PLC command;
- actual valve position;
- travel rate or first-order actuator response;
- optional stuck-position fault;
- optional slow-actuator fault;
- flow generated from actual position, not command alone.

### Process valves

Include at least:

- suction ESD;
- suction control valve;
- recycle/bypass valve;
- discharge ESD;
- blowdown valve.

Retain the project's existing bypass command convention unless deliberately migrated with backward compatibility.

### Cooler dynamics

Simulate a practical first-order cooler model using:

- gas inlet temperature;
- fan state;
- ambient/reference temperature;
- nominal cooling effectiveness or time constant;
- fouling / degraded-cooling factor.

The cooler model is for transient realism and fault response, not heat-exchanger sizing.

### Instruments

For selected pressure, temperature, flow, valve-position and RPM signals, distinguish:

1. true simulated process value;
2. transmitter/sensor dynamics;
3. displayed PLC/HMI value.

Support basic configurable effects:

- lag;
- bias;
- noise;
- frozen reading;
- failed high / failed low where useful.

Noise should be disabled by default in deterministic automated tests.

### Faults

Support at least the following practical faults:

- suction restriction;
- blocked/restricted discharge;
- recycle valve stuck open / stuck closed / stuck at position;
- cooler fan trip or degraded cooling;
- compressor capacity degradation;
- engine/driver trip;
- slow governor / RPM recovery;
- selected pressure transmitter frozen/bias;
- selected temperature transmitter frozen/bias.

### PLC / HMI interaction

Continue simulating:

- permissives;
- startup and shutdown sequence interaction;
- ESD conditions;
- alarms;
- trips;
- operator commands;
- process feedback.

---

## 3. What is NOT simulated in this upgrade

Do **not** claim or imply that the following are being accurately simulated:

- Ariel OEM capacity curves;
- Ariel cylinder-by-cylinder proprietary performance data;
- actual CAT G3516LE combustion;
- CAT ADEM fuel maps or proprietary governor maps;
- turbocharger maps;
- real fuel consumption;
- emissions;
- detailed torsional dynamics;
- crankshaft dynamics;
- rod load / crosshead load;
- piston rod reversal limits;
- bearing loads;
- valve plate dynamics;
- acoustic pulsation;
- piping vibration;
- API 618 pulsation analysis;
- relief-valve sizing;
- flare-system sizing;
- detailed blowdown-network sizing;
- phase equilibrium / condensation;
- full real-gas EOS unless explicitly implemented later;
- multi-component gas composition thermodynamics unless explicitly implemented later;
- mechanical wear prediction;
- remaining useful life;
- OEM performance guarantees.

If the UI contains an Ariel or CAT name, display it as **Reference Package / Tag Identity**, not as proof of OEM model validation.

---

## 4. Model confidence labels

Every engineering variable shown in Engineering mode should be able to expose a source category:

- `CONFIGURED` — user/config-file input.
- `FITTED` — tuned to achieve a target behavior.
- `ASSUMED` — engineering assumption used by the simulator.
- `CALCULATED` — derived from equations during runtime.
- `OEM_VERIFIED` — only allowed when a real documented OEM source is actually present and cited in the repository.

Never automatically mark a value `OEM_VERIFIED` because its equipment name contains Ariel or CAT.

---

## 5. Required disclaimer text

Use a short version in the UI:

> Physics-based training and controls simulator. Equipment names identify the reference package; model parameters include configured, fitted, and assumed values and are not an OEM performance guarantee.

Use the full scope page in Engineering / About.

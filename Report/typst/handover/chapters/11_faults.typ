#import "../../template.typ": *

= Fault Injection <sec-faults>

Every fault below is local to the application and never exposed on OPC UA — the PLC under test
cannot see or clear its own faults through the link, only through whatever effect the fault has
on the process tags it reads. A single *Clear all faults* control resets every fault at once (a
separate, explicit action from Reset).

#data-table(
  ([Fault], [Operator control], [Physical effect], [Expected PLC response]),
  (
    ([Low lube oil pressure], [Toggle], [Forces `P_oil` below its 35 psi trip threshold], [Trip on the low-lube-oil-pressure shutdown]),
    ([Slow lube build], [Toggle], [Sets the oil-pressure lag time constant to 900 s, pushing the 10 psi start permissive crossing well past a 120 s oil-permissive timer], [Trip on the Oil Permissive Pressure Fault timer]),
    ([Engine fails to start], [Toggle], [Clamps $N$ at 550 rpm, never reaching a running speed], [Trip on the Engine Failed to Start timer]),
    ([Mag pickup fault], [Toggle], [Forces reported `ST_1008` to 0 while the engine is actually running], [Detect a speed-signal/other-evidence mismatch, per the PLC's own logic]),
    ([Overspeed sensor bias], [Slider, rpm offset], [Adds a continuous offset to reported `ST_1008`], [Trip on overspeed at whatever threshold the PLC applies]),
    ([Blocked discharge], [Slider, 0-100%], [Reduces the effective $K_(p r o c)$ flow coefficient], [Trip or alarm on high discharge pressure]),
    ([Cylinder temp bias], [Slider per cylinder (1-4), °F], [Adds an offset to the corresponding `TT_2004`-`2007` reading], [Trip or alarm on high cylinder discharge temperature, per cylinder]),
    ([Valve stuck], [Per-valve select (bypass, suction, suction ESD, discharge ESD, blowdown)], [Freezes that valve's position regardless of command], [Trip on valve-misalignment timer (position feedback vs. command mismatch)]),
    ([Signal freeze], [Per analog tag (set)], [Holds the tag's last transmitted value], [Detect a stale/non-updating signal, per the PLC's own staleness logic]),
    ([Signal invalid], [Per analog tag (set)], [Drives the tag out of its transmitter range], [Detect an out-of-range / bad-quality signal]),
    ([Cooler motor trip], [Per motor (1, 2, or both)], [Drops `RS_4011`/`RS_4012` run feedback while the command stays commanded on], [Detect a run-feedback mismatch, per motor]),
    ([Link drop], [Toggle], [Suspends all OPC UA writes from the simulator], [Exercise the PLC's own watchdog against a stale/frozen link]),
    ([Tier 2 discrete faults], [Per-item toggles], [Drive the corresponding scrubber-level / vibration / oil-JW-level / fuel-gas / lubricator tag true], [Trip or alarm per the associated protective function]),
  )
)

== Where This Differs from the Predecessor Simulink Rig

A few of these faults are broader in scope than the earlier Simulink model: valve-stuck applies
to any of the five valves rather than bypass only, cooler motor trip is per-motor rather than
both fans together, signal freeze covers any analog tag rather than discharge pressure alone,
signal invalid is new, and cylinder temperature bias is independent per cylinder rather than one
shared value. Two numeric values also differ — the slow-lube-build time constant and the
engine-fails-to-start speed clamp — both chosen to exercise the same PLC permissive timers as the
original values did, just with different margins. Full detail is in `DISCREPANCIES.md`.

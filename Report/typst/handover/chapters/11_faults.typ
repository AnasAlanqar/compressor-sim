#import "../../template.typ": *

= Fault Injection <sec-faults>

Every fault below is local to the application and never exposed on OPC UA — the PLC under test
cannot see or clear its own faults through the link, only through whatever effect the fault has
on the process tags it reads. A single *Clear all faults* control resets every fault at once (a
separate, explicit action from Reset).

#note(label: "PROJECT-SPECIFIC PASS/FAIL CRITERIA")[
  The right-hand column below states the intended test objective for each fault — what the fault
  is meant to give the PLC's configured protection logic the opportunity to detect and act on. It
  is not a required PLC response defined by this document; the actual trip/alarm thresholds,
  timers, and actions remain project-specific / engineer-defined unless stated elsewhere in this
  report.
]

#data-table(
  ([Fault], [Operator control], [Physical effect], [Intended Test Objective / Project-Specific PLC Response]),
  (
    ([Low lube oil pressure], [Toggle], [Forces `P_oil` below its 35 psi trip threshold], [Project-specific — intended to exercise the PLC's configured low-lube-oil-pressure protection]),
    ([Slow lube build], [Toggle], [Sets the oil-pressure lag time constant to 900 s, pushing the 10 psi start permissive crossing well past a 120 s oil-permissive timer], [Project-specific — intended to exercise the PLC's configured Oil Permissive Pressure Fault timer]),
    ([Engine fails to start], [Toggle], [Clamps $N$ at 550 rpm, never reaching a running speed], [Project-specific — intended to exercise the PLC's configured Engine Failed to Start timer]),
    ([Mag pickup fault], [Toggle], [Forces reported `ST_1008` to 0 while the engine is actually running], [Project-specific — intended to exercise a speed-signal/other-evidence mismatch check, per the PLC's own logic]),
    ([Overspeed sensor bias], [Slider, rpm offset], [Adds a continuous offset to reported `ST_1008`], [Project-specific — intended to exercise the PLC's configured overspeed protection]),
    ([Blocked discharge], [Slider, 0-100%], [Reduces the effective $K_(p r o c)$ flow coefficient], [Project-specific — intended to exercise the PLC's configured high-discharge-pressure alarm/trip logic]),
    ([Cylinder temp bias], [Slider per cylinder (1-4), °F], [Adds an offset to the corresponding `TT_2004`-`2007` reading], [Project-specific — intended to exercise the PLC's configured high-cylinder-discharge-temperature alarm/trip logic, per cylinder]),
    ([Valve stuck], [Per-valve select (bypass, suction, suction ESD, discharge ESD, blowdown)], [Freezes that valve's position regardless of command], [Project-specific — intended to exercise a valve-misalignment check (position feedback vs. command mismatch), per the PLC's own logic]),
    ([Signal freeze], [Per analog tag (set)], [Holds the tag's last transmitted value], [Project-specific — intended to exercise a stale/non-updating signal check, per the PLC's own staleness logic]),
    ([Signal invalid], [Per analog tag (set)], [Drives the tag out of its transmitter range], [Project-specific — intended to exercise an out-of-range / bad-quality signal check]),
    ([Cooler motor trip], [Per motor (1, 2, or both)], [Drops `RS_4011`/`RS_4012` run feedback while the command stays commanded on], [Project-specific — intended to exercise a run-feedback mismatch check, per motor]),
    ([Link drop], [Toggle], [Suspends all OPC UA writes from the simulator], [Project-specific — intended to exercise the PLC's own watchdog against a stale/frozen link]),
    ([Tier 2 discrete faults], [Per-item toggles], [Drive the corresponding scrubber-level / vibration / oil-JW-level / fuel-gas / lubricator tag true], [Project-specific — intended to exercise the associated protective function]),
  )
)

== Where This Differs from the Predecessor Simulink Rig

A few of these faults are broader in scope than the earlier Simulink model: valve-stuck applies
to any of the five valves rather than bypass only, cooler motor trip is per-motor rather than
both fans together, signal freeze covers any analog tag rather than discharge pressure alone,
signal invalid is new, and cylinder temperature bias is independent per cylinder rather than one
shared value. Two numeric values also differ from the predecessor model — the slow-lube-build
time constant (90 s in the predecessor model, 900 s here) and the engine-fails-to-start speed
clamp (400 rpm in the predecessor model, 550 rpm here) — both chosen to exercise the same PLC
permissive timers as the original values did, just with different margins.

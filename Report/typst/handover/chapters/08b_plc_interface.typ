#import "../../template.typ": *

= PLC / Simulator Interface <sec-plc-interface>

This chapter is the practical reference for wiring up and coding against the simulator: which
tags matter for which subsystem, which ones have counter-intuitive polarity, what to expect in the
simulator after issuing a command, what "healthy" looks like at the design point, and how a normal
stop differs from an unconditional shutdown. The full, alphabetically-complete tag list with
ranges and fail values is Appendix A; this chapter groups the same tags by function instead.

== Command / Feedback Cheat Sheet

=== Engine

#data-table(
  ([Tag], [Direction], [Meaning]),
  (
    ([`SC_3001`], [PLC → Sim], [Speed command, 0-100%]),
    ([`CMD_4003`], [PLC → Sim], [Idle / rated speed select]),
    ([`CMD_4005`], [PLC → Sim], [CAT engine start command]),
    ([`CMD_4006`], [PLC → Sim], [CAT ESD, energised = healthy]),
    ([`CMD_4008`], [PLC → Sim], [Driven-equipment-ready]),
    ([`ST_1008`], [Sim → PLC], [Engine speed, 0-2000 rpm]),
    ([`ST_2010`], [Sim → PLC], [Engine running (> 300 rpm)]),
    ([`XA_6002`/`XS_6003`], [Sim → PLC], [CAT ADEM engine alarm / shutdown status]),
  )
)

=== Lubrication

#data-table(
  ([Tag], [Direction], [Meaning]),
  (
    ([`CMD_4001`], [PLC → Sim], [Auxiliary lube (prelube pump) solenoid]),
    ([`PT_1005`], [Sim → PLC], [Compressor oil pressure, 0-200 psig]),
    ([`PS_2009`], [Sim → PLC], [Oil pressure healthy (> 10 psig)]),
    ([`PT_1007`], [Sim → PLC], [Engine oil pressure, 0-150 psig]),
  )
)

=== Process Valves

#data-table(
  ([Tag], [Direction], [Meaning]),
  (
    ([`FC_3002`], [PLC → Sim], [Bypass valve command, 0-100%]),
    ([`FC_3003`], [PLC → Sim], [Suction valve command, 0-100%]),
    ([`CMD_4004`], [PLC → Sim], [Blowdown solenoid, energised = closed]),
    ([`CMD_4009`], [PLC → Sim], [Suction ESD solenoid, energised = open]),
    ([`CMD_4010`], [PLC → Sim], [Discharge ESD solenoid]),
    ([`ZS_2001`-`2008`], [Sim → PLC], [Valve open/closed limit switches (blowdown, bypass, suction ESD, discharge ESD)]),
  )
)

=== Cooling

#data-table(
  ([Tag], [Direction], [Meaning]),
  (
    ([`CMD_4011`/`4012`], [PLC → Sim], [Cooler motor 1 / 2 run command]),
    ([`RS_4011`/`4012`], [Sim → PLC], [Cooler motor 1 / 2 run feedback]),
    ([`TT_2013`], [Sim → PLC], [Aftercooler temperature]),
    ([`TT_2014`], [Sim → PLC], [Engine jacket-water temperature]),
  )
)

=== Process Measurements

#data-table(
  ([Tag], [Meaning]),
  (
    ([`PT_1001`], [Suction pressure]),
    ([`PT_1002`/`1003`/`1004`/`1006`], [Stage 1 / 2 / 3 / final discharge pressure]),
    ([`TT_2004`-`2007`], [Cylinder 1-4 discharge temperature]),
    ([`TT_2009`-`2012`], [Packing temperatures 1-4]),
  )
)

=== Communication

#data-table(
  ([Tag], [Meaning]),
  (
    ([`WD_6001`], [Heartbeat counter, increments every 500 ms --- see "Watchdog and Communication Supervision" below]),
  )
)

== Important: Command Polarity

#warn[
  Do not assume `TRUE` means "open" or "on" for every tag. Command meaning depends on the specific
  device and its fail-safe philosophy, and getting this backwards is one of the easiest ways for a
  new PLC engineer to write logic that looks correct but drives the package the wrong way.
]

#data-table(
  ([Tag], [Energised / commanded TRUE means], [Loss of command / de-energised means]),
  (
    ([`CMD_4004` (blowdown solenoid)], [Blowdown valve *closed*], [Blowdown valve *opens* --- fails open]),
    ([`CMD_4009` (suction ESD)], [Valve *open*], [Valve *closes* --- fails closed]),
    ([`CMD_4010` (discharge ESD)], [Valve open (by convention, matching the suction ESD)], [Valve *closes* --- fails closed]),
    ([`FC_3002` (bypass command)], [Higher % = more *closed*], [0% = valve fully *open* --- fails open]),
    ([`FC_3003` (suction valve command)], [Higher % = more *open*], [0% = valve fully *closed* --- fails closed]),
  )
)

The pattern to remember: every ESD-type and blowdown element is wired so that *losing signal
fails toward the safe, vented, isolated state* --- ESDs closed, blowdown open. `FC_3002` (bypass)
follows the same fail-open philosophy but is commanded as an analog percentage rather than a
discrete, so "0% commanded" and "signal lost" produce the same fully-open result. This mapping is
restated where it matters operationally in @opc-connection, "What Happens on Link Loss," and is
not re-derived each time it recurs below.

== What Should Happen When I Issue a Command?

=== Auxiliary Lube On (`CMD_4001`)

*Expect:* Compressor oil pressure (`PT_1005`) builds toward the 55 psig prelube target
(@sec-equations, eq. 15). `PS_2009` (oil pressure healthy) changes state once the modelled
pressure crosses its healthy threshold. The prelube ramp has a real time constant --- it does not
jump to target instantly.

=== Engine Start (`CMD_4005`, subject to its prerequisite commands)

*Expect:* Speed (`ST_1008`) progresses through cranking (0→200 rpm at +70 rpm/s), then
acceleration toward the idle reference (650 rpm) at +50 rpm/s, then tracks the rated-speed
reference once `CMD_4003` and `SC_3001` move it into the 850-1000 rpm range. See
@sec-quickstart and @sec-running for the full permissive chain this depends on.

=== Close Bypass / Load the Compressor (`FC_3002` toward 100%)

*Expect:* More compressor flow is routed toward discharge/process rather than recycling to
suction. Discharge pressures (`PT_1002`/`1003`/`1004`/`1006`) build stage over stage; the
suction/discharge pressure relationship shifts accordingly.

=== Open Bypass / Unload (`FC_3002` toward 0%)

*Expect:* Discharge gas recycles toward suction. Suction pressure (`PT_1001`) tends to rise;
discharge pressures tend to fall. The engine keeps running throughout --- this is the mechanism
for unloading without a full stop.

=== Blowdown (`CMD_4004` de-energised, or its permissives never asserted)

*Expect:* The *suction* volume vents toward atmosphere. Discharge pressure does *not* necessarily
collapse at the same time --- discharge-side mass can only leave through the bypass valve into
suction and then out the vent, so with the bypass closed, discharge pressure can remain high even
while suction is fully vented. This is not a model defect; it is the mass-accumulation asymmetry
explained in full in @sec-process and is the single most common point of confusion for a
first-time reader of this simulator's behaviour.

== Normal Operating Expectations ("What Good Looks Like")

The table below restates the design-point values from @sec-constants as a fast sanity check while
coding or commissioning. These are simulator design-point/reference values for a *generic*
package, not a guarantee of any specific real machine's performance (@sec-limitations).

#data-table(
  ([Quantity], [Design-point value]),
  (
    ([Suction pressure], [~29.8 psig]),
    ([Stage 1 discharge pressure], [~117.3 psig]),
    ([Stage 2 discharge pressure], [~377.2 psig]),
    ([Final discharge pressure], [~1149.0 psig]),
    ([Engine speed (rated)], [850-1000 rpm]),
    ([Compressor mass flow], [~0.945 kg/s]),
    ([Cylinder 1 / 2 discharge temperature], [~245.4 / 251.7 °F]),
  )
)

== Normal Stop vs. Unconditional Shutdown (USD)

Getting this distinction right is central to sequence design, because the simulator produces
visibly different pressure outcomes depending on command *ordering* --- and enforces none of that
ordering itself.

#data-table(
  ([], [Normal stop], [Unconditional shutdown / USD]),
  (
    ([Intent], [PLC deliberately unloads, isolates, and depressurises in a controlled order], [Shutdown actions occur immediately, per the PLC's own shutdown philosophy]),
    ([Simulator consequence], [If the PLC opens bypass and closes the ESDs before opening blowdown, discharge-side mass has already had a path back to suction, so final pressures settle lower and more evenly], [If blowdown opens immediately without that ordering, the suction volume vents fast while discharge pressure can remain high --- trapped behind a closed or partially-open bypass]),
  )
)

#warn[
  The simulator intentionally does not enforce the "correct" ordering of ESD closure, bypass
  opening, and blowdown opening. Whether a given shutdown sequence leaves the package in a
  sensible final pressure state is exactly what the PLC is being tested on -- see @sec-process for
  the underlying mass-accumulation mechanism and @sec-running for the reference walkthrough.
]

== Watchdog and Communication Supervision

`WD_6001` increments every 500 ms while the simulator is running and the link is healthy
(@opc-connection). A PLC can supervise this the same way it would supervise any heartbeat: confirm
the value is actually changing, not merely present. A stopped or stale `WD_6001` is evidence of a
simulator-side communication failure. What the PLC should *do* about that --- trip, alarm, hold
last state, or something else --- is a project-specific design decision this document does not
prescribe. @opc-connection, "What Happens on Link Loss," documents the simulator's own fail-value
behaviour on its side of a dropped link, which is the complementary half of this picture.

== PLC Sequence / State Reference Table

#note(label: "REFERENCE ONLY --- NOT ENFORCED BY SIMULATOR")[
  The predecessor rig's reference sequence names the phases below (@sec-running,
  @fig-hmi-running). The simulator implements none of these states, timers, or transitions --- it
  only responds to whatever commands are asserted at whatever time they are asserted. Any timer,
  threshold, or permissive not already stated elsewhere in this report is marked
  *project-specific* below rather than invented.
]

#data-table(
  ([Phase], [Likely PLC command], [Process response to observe], [Feedback to monitor], [Possible failure mode]),
  (
    ([READY], [Permissives asserted, no equipment commanded yet], [None --- package at rest], [ESD/blowdown limit switches, no active faults], [Project-specific / to be defined]),
    ([PURGE], [Not modelled by this simulator], [Not modelled --- no purge-gas system in this simulator], [Not applicable], [Not enforced by simulator]),
    ([BLOWDOWN], [`CMD_4004` de-energised (or never energised)], [Suction volume vents toward atmosphere (@sec-process); discharge pressure may remain elevated depending on bypass state], [`PT_1001` falling, blowdown limit switch], [Project-specific timer for "fully vented"]),
    ([PRELUBE], [`CMD_4001` energised], [`PT_1005` ramps toward the 55 psig prelube target (@sec-equations, eq. 15)], [`PT_1005`, `PS_2009`], [Low lube pressure fault, slow lube build fault (@sec-faults)]),
    ([CAT_START], [`CMD_4005` energised, with `CMD_4006`/`CMD_4008` asserted], [`ST_1008` ramps through cranking then acceleration toward idle], [`ST_1008`, `ST_2010`], [Engine-fails-to-start fault clamps speed at 550 rpm (@sec-faults)]),
    ([WARMUP], [Engine held at idle (650 rpm) before loading], [Speed steady near idle; oil/cylinder temperatures continue settling], [`ST_1008`, `TT_2001`], [Project-specific warmup duration --- not defined by simulator]),
    ([LOADING], [`CMD_4003` selected, `SC_3001` raised, `FC_3003` opened, `FC_3002` closed toward the load position], [Stage pressures build per @sec-equations eq. 2-3; flow ramps with speed and valve position], [`PT_1001`-`1006`, `ST_1008`], [Blocked discharge, valve-stuck faults (@sec-faults)]),
    ([RUNNING], [Steady rated-speed commands maintained], [Design-point values approached (see "Normal Operating Expectations" above)], [All process measurements], [Any Faults-tab condition (@sec-faults)]),
    ([UNLOADING], [`FC_3002` opened toward suction], [Discharge pressures fall, suction rises, engine keeps running (see "Open Bypass / Unload" above)], [`PT_1001`-`1006`], [Project-specific unload criteria]),
    ([COOLDOWN], [Engine run permissives de-asserted; speed coasts down ($tau = 6$ s)], [`ST_1008` decays toward zero per the coastdown time constant], [`ST_1008`], [Project-specific cooldown duration before next step]),
    ([NORMAL_STOP#linebreak()POSTLUBE], [`CMD_4001` may remain energised after engine stop], [`PT_1005` holds at the prelube target if lube stays commanded], [`PT_1005`], [Project-specific postlube duration]),
    ([SHUTDOWN / USD], [ESDs de-energised, blowdown de-energised immediately, without waiting for the normal-stop ordering], [Suction vents fast; discharge pressure state depends entirely on bypass position at the moment of trip (see "Normal Stop vs. USD" above)], [`PT_1001`-`1006`, ESD/blowdown limit switches], [Command ordering error --- trapped high discharge pressure is a symptom, not a simulator fault]),
  )
)

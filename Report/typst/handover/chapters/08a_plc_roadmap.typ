#import "../../template.typ": *

= PLC Development Roadmap <sec-roadmap>

A recommended order of work for building the PLC application against this simulator, from first
communications to a fully validated sequence. Nothing here is enforced by the simulator — it is a
suggested path through the work, not a requirement.

== Stage 1 --- Establish Communications

+ Install the simulator (@installation).
+ Start (or configure) the CODESYS runtime and confirm it is actually running the application, not
  just downloaded (@opc-connection).
+ Publish the CODESYS Symbol Configuration so the compressor tags are visible over OPC UA
  (@opc-connection, Symbol Publishing and Device Security Settings).
+ Connect the simulator to the runtime and confirm "Connected" in the header (@opc-connection).
+ Force one safe PLC tag (e.g. `CMD_4005`) and observe the corresponding response in the
  simulator (@verify-link).
+ Confirm simulator feedback (a measurement tag) reaches the PLC side, closing the loop in both
  directions.

This is expanded into a repeatable procedure in @sec-commissioning, "First PLC Commissioning
Test" --- treat that as Stage 1's acceptance test.

== Stage 2 --- Create the I/O Mapping

Map every tag in Appendix A into the PLC project: commands (speed, valve, engine, cooler),
process measurements (pressures, temperatures), limit switches, engine-running feedback,
oil-pressure-healthy, cooler run feedback, the watchdog counter, and the always-live
operator/ECU pushbuttons. @sec-plc-interface groups these by function rather than tag number, to
make this mapping pass faster.

== Stage 3 --- Implement Equipment-Level Logic

Individual output logic for each piece of equipment, independent of sequencing: valve open/close
commands, auxiliary lube on/off, engine start/stop, cooler motor commands, speed reference,
recycle/bypass positioning. @sec-plc-interface's "What Should Happen When I Issue a Command?"
section states the expected simulator response for each.

== Stage 4 --- Implement Permissives

#note(label: "RECOMMENDED SOFTWARE STRUCTURE, NOT SIMULATOR-ENFORCED")[
  The simulator does not require, check, or enforce any permissive. Everything in this stage is a
  recommended engineering practice, not a behaviour the simulator will validate for you.
]

Typical permissives to consider: communications healthy (watchdog, @sec-plc-interface); ESD
healthy; driven-equipment-ready; correct valve state before a transition; lubrication pressure
healthy; and whatever process conditions the project requires before a step proceeds. Do not
invent thresholds or timers the project has not specified --- mark them
*project-specific / to be defined* rather than guessing a realistic-looking number.

== Stage 5 --- Implement the Sequence

Develop the startup/run/stop/shutdown state machine. @sec-running's reference sequence and
@sec-plc-interface's sequence/state reference table are a starting point, not a specification ---
see "The Predecessor Sequence" note in @sec-plc-interface.

== Stage 6 --- Add Alarm and Trip Evaluation

Evaluate alarms and trips against the simulator's measurement and fault-affected tags. The
simulator never evaluates alarms itself (@sec-purpose); anything coloured on the P&ID or drawn as
a dashed line on a trend is a display convenience only, not a live alarm the PLC can read.

== Stage 7 --- Fault-Test the PLC

Work through the Faults tab (@sec-faults) systematically, confirming each fault produces its
documented tag-level effect and that the PLC logic under test reacts as intended.

== Stage 8 --- Validate Stop, Shutdown, and Recovery Behaviour

Exercise normal stop, unconditional/emergency shutdown, a failed start, lube failure, cooling
failure, blocked discharge, instrument faults, an OPC UA link loss, and restart/reset behaviour
after each. @sec-commissioning's Acceptance Test Checklist is organised around exactly these
cases.

== Recommended PLC Software Architecture

#note(label: "RECOMMENDED ENGINEERING ORGANISATION, NOT A SIMULATOR REQUIREMENT")[
  The decomposition below is one reasonable way to organise a PLC application against this
  interface. The simulator has no opinion on program structure, POU naming, or coding style ---
  only on the tag values it reads and writes.
]

```text
PLC Application
|
+-- IO Mapping
|
+-- Communication Supervision (watchdog / link health)
|
+-- Equipment Control
|   +-- Engine
|   +-- Auxiliary Lube
|   +-- Suction ESD
|   +-- Discharge ESD
|   +-- Blowdown
|   +-- Suction Control Valve
|   +-- Bypass Valve
|   +-- Coolers
|
+-- Permissives
|
+-- Compressor Sequence
|
+-- Alarm / Trip Evaluation
|
+-- Shutdown Management
|
+-- Diagnostics / HMI
```

If IEC 61131-3 organisation is useful: a GVL for the OPC UA-mapped tags, one function block per
equipment item, an enum-driven state machine for the sequence, and structures for grouping related
permissive/alarm bits are all reasonable choices --- none of this is dictated by the simulator, and
an existing CODESYS project's established style should take precedence over any suggestion here.

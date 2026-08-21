#import "../../template.typ": *

= PLC Validation and Commissioning Tests <sec-commissioning>

== First PLC Commissioning Test

A small, safe, deterministic test to prove the complete signal path end to end before attempting
the full compressor sequence. This is the same tag-forcing mechanism demonstrated in
@opc-connection, "Verifying the Link," generalised into a repeatable first-commissioning step.

+ Establish the OPC UA connection (@opc-connection) and confirm "Connected" in the header.
+ Verify `WD_6001` is incrementing and that expected feedback tags (e.g. `PS_2009`, `ST_2010`) are
  present and at their expected at-rest values.
+ From the PLC, command one safe output --- `CMD_4005` is a convenient choice, since it drives a
  visible indicator on the P&ID and has no destructive effect on its own without the rest of the
  start permissive chain also being asserted.
+ Observe the corresponding response in the simulator HMI (or the Tags tab, @sec-interface).
+ Remove the command from the PLC side.
+ Confirm the feedback returns to its prior state.
+ Confirm the PLC is receiving the simulator's process measurements (e.g. `PT_1001`) and that they
  read plausible values for the current state (@sec-plc-interface, "Normal Operating
  Expectations").
+ Compare the tag table on both sides --- the PLC's symbol/watch view and the simulator's Tags tab
  (@sec-interface) --- to confirm no tag is silently missing or mismatched.

Passing this test proves the wiring, addressing, and OPC UA plumbing are correct. It does *not*
prove the PLC's sequence logic is correct --- that is a separate validation step, below.

== Acceptance Test Checklist

#note(label: "PROJECT-SPECIFIC PASS/FAIL CRITERIA")[
  This checklist states what to *observe*, not what the "correct" PLC response must be in every
  case --- most of that is a project requirement this document has no authority to define. Where a
  specific response is not documented elsewhere in this report, the expected-response column says
  so explicitly rather than inventing one.
]

=== Communications

#data-table(
  ([Check], [Expected observation]),
  (
    ([Simulator connects to the OPC UA server], [Header shows "Connected"; `app.log` records a successful connect (@opc-connection)]),
    ([PLC command changes appear in the simulator], [Forcing a command tag from CODESYS is reflected in the HMI within one update cycle (@verify-link)]),
    ([Simulator feedback appears in the PLC], [Measurement tags update in the PLC's watch view as the process changes]),
    ([Watchdog supervision works], [`WD_6001` increments continuously; a stalled value is detectable by the PLC (@sec-plc-interface)]),
    ([Reconnect works after a CODESYS download], [Reconnecting (or restarting the simulator) re-discovers tags rather than holding stale node references (@opc-connection)]),
  )
)

=== Start Sequence

#data-table(
  ([Check], [Expected observation]),
  (
    ([Prelube is commanded], [`CMD_4001` asserted; `PT_1005` ramps toward 55 psig]),
    ([Oil-pressure permissive is respected], [Project-specific / engineer-defined --- the simulator only reports `PT_1005`/`PS_2009`, it does not decide when a start may proceed]),
    ([Engine start sequence works], [`ST_1008` progresses through cranking then acceleration once `CMD_4005` and its prerequisites are asserted]),
    ([Speed reaches idle], [`ST_1008` approaches 650 rpm]),
    ([Rated transition works], [`ST_1008` moves into the 850-1000 rpm range once `CMD_4003` and `SC_3001` command it]),
    ([Valves reach expected positions], [`FC_3002`/`FC_3003` and their limit switches (`ZS_2001`-`2008`) track the commanded position, rate-limited per @sec-equations eq. 13]),
    ([Compressor loads correctly], [Stage pressures build per "Close Bypass / Load the Compressor" in @sec-plc-interface]),
  )
)

=== Running

#data-table(
  ([Check], [Expected observation]),
  (
    ([Stage pressures rise correctly], [Monotonic staging matching @sec-plc-interface's "Normal Operating Expectations" table]),
    ([Cooler status works], [`RS_4011`/`4012` track `CMD_4011`/`4012`; temperatures respond per @sec-equations eq. 16]),
    ([Trends display expected process behaviour], [Engineering Trends (@sec-interface) show smooth, physically plausible transients, not step discontinuities]),
    ([Unload/reload works], [Opening/closing `FC_3002` produces the response documented under "Open/Close Bypass" in @sec-plc-interface]),
  )
)

=== Normal Stop

#data-table(
  ([Check], [Expected observation]),
  (
    ([Machine unloads correctly], [Bypass opens before ESDs close, per the PLC's own sequence]),
    ([Engine stops], [`ST_1008` coasts down toward zero, $tau = 6$ s]),
    ([Isolation occurs], [ESDs close per the PLC's commanded order]),
    ([Depressurisation behaviour is understood], [Final pressure state matches the "Normal Stop vs. USD" explanation in @sec-plc-interface, not assumed to be fully vented on both sides]),
  )
)

=== Shutdown

#data-table(
  ([Check], [Expected observation]),
  (
    ([Immediate trip handling works], [ESDs and blowdown respond to the PLC's shutdown outputs without waiting for a normal-stop sequence]),
    ([Safe output commands occur], [Command tags reach their documented fail-safe direction (@sec-plc-interface, "Command Polarity")]),
    ([Restart is inhibited until correct reset/recovery], [Project-specific / engineer-defined --- the simulator does not itself gate restart on any reset philosophy]),
  )
)

=== Fault Injection

#data-table(
  ([Fault family], [Expected PLC response]),
  (
    ([Low lube pressure / slow lube build], [Project-specific / engineer-defined]),
    ([Engine fails to start], [Project-specific / engineer-defined]),
    ([Speed-signal fault (mag pickup) / overspeed], [Project-specific / engineer-defined]),
    ([Blocked discharge], [Project-specific / engineer-defined]),
    ([Stuck valve], [Project-specific / engineer-defined]),
    ([Cylinder-temperature bias], [Project-specific / engineer-defined]),
    ([Cooler trip], [Project-specific / engineer-defined]),
    ([Tier 2 discrete conditions (scrubber level, vibration, oil/JW level, fuel-gas pressure, lubricator no-flow)], [Project-specific / engineer-defined]),
    ([Signal freeze / invalid / lag / noise], [Project-specific / engineer-defined]),
    ([OPC UA link drop], [Project-specific / engineer-defined --- see "Watchdog and Communication Supervision," @sec-plc-interface]),
  )
)

Each row's simulator-side mechanism is fully documented in @sec-faults; this table exists only to
organise validation, not to prescribe a required PLC response the project has not itself defined.

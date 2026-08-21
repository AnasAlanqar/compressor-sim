#import "../../template.typ": *

= Running the Simulator <sec-running>

This walkthrough uses the real tags described in @sec-interface and Appendix A. Sequencing —
deciding what order to assert these commands in, and how long to wait between them — is the job
of the connected PLC; this application supplies no sequencer of its own (@sec-purpose).
Everything below describes what the operator (through a real PLC, or by hand via the Overrides
dock when no PLC is connected) does, and what the simulator does in response. This differs from
the earlier Simulink/CODESYS model, which bundled its own reference sequencer for standalone
demonstration — without a PLC attached, this application will not run a startup sequence on its
own.

#fig("/images/11_plc_sequencer_state_diagram.png",
  [The predecessor Simulink/CODESYS rig's reference sequencer state diagram (READY -- PURGE --
   BLOWDOWN -- PRELUBE -- CAT_START -- WARMUP -- LOADING -- RUNNING, with COOLDOWN /
   NORMAL_STOP_POSTLUBE and SHUTDOWN / USD exit paths). Shown for context only -- this
   application implements none of these states, timers, or transitions itself; every step below
   is something a connected PLC's own sequencer (which may follow this same state machine, or a
   different one) must decide and command.])

+ *Launch and confirm the link.* Start the app (@installation); connect to the target PLC
  (@opc-connection) and confirm the header shows "Connected." With no PLC connected, the same
  sequence can be driven by hand from the Overrides dock for a demonstration, since every command
  tile there maps to the same tag the PLC would otherwise drive.

+ *Bring the package from stopped to running.* The PLC (or the operator, via Overrides) asserts
  the permissive chain: `CMD_4009` (suction ESD, energised = open) and `CMD_4010` (discharge ESD)
  open; `CMD_4006` (CAT ESD healthy) and `CMD_4008` (driven-equipment-ready) are asserted;
  `CMD_4001` (auxiliary lube) commands the prelube pump, and `PT_1005`/`PS_2009`
  (oil-pressure-healthy) is watched as it builds toward the 55 psig prelube target
  (@sec-equations, eq. 15). Once oil pressure is healthy, `CMD_4005` (CAT engine start) is
  asserted: speed ramps through cranking (0→200 rpm at +70 rpm/s), then accelerates toward the
  idle reference (650 rpm) at +50 rpm/s. Selecting `CMD_4003` (idle/rated) and driving `SC_3001`
  up moves the reference into the 850–1000 rpm rated range; `FC_3003` (suction valve) opens and
  `FC_3002` (bypass) closes off the 100%-open failed-safe position to route flow toward the
  process.

+ *Observe the transients.* Watch `PT_1001`/`1002`/`1003`/`1006` build stage over stage as the
  equal-ratio staging (@sec-equations, eq. 2–3) takes effect, and `TT_2004`/`2005` rise toward
  their polytropic targets (eq. 11–12) as compression begins — this is the same running state
  shown in @fig-hmi-running. The oil and cooling lags (eq. 14) mean pressures and flow respond
  quickly (seconds) while oil and cylinder temperatures settle over tens of seconds to minutes,
  exactly as @sec-process's mass-accumulation framing predicts.

+ *Unload via bypass.* Opening `FC_3002` (bypass) recycles discharge gas back to suction without
  stopping the engine — `PT_1001` rises and `PT_1002`–`1006` fall as flow diverts, the same
  recycle path used to test unload/reload logic without a full shutdown.

+ *Stop.* A normal stop de-asserts the run permissives; the ESDs close and speed coasts down
  ($tau = 6$ s, @sec-equations eq. 12 phase table). Only once the ESDs are closed does
  de-asserting `CMD_4004` open the blowdown valve, venting the _suction_ volume — discharge
  pressure holds nearly constant through this because it has no path to lose mass except back
  through the (now-closed or still-recycling) bypass valve, exactly the asymmetry described in
  @sec-process. This is why a normal stop and an unconditional shutdown (blowdown opens
  immediately, without waiting for the ESDs) leave the package in different states, and why a
  PLC's stop sequence needs to get that ordering right independent of anything this simulator
  enforces — it enforces nothing.

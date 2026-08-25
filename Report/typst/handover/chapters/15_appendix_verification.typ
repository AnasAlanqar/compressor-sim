#import "../../template.typ": *

#heading(numbering: none, outlined: true)[Appendix C --- Verification Detail] <app-verification>

#note(label: "SOFTWARE VERIFICATION, NOT PHYSICAL VALIDATION")[
  The checks below verify the implemented model against the configured design-point acceptance
  criteria and software invariants. They confirm the simulator does what this
  report says it does; they are not a comparison against measured performance of a physical
  compressor (@sec-purpose, "Basis and Validation Status").
]

The Design-Point Verification Suite (18 automated checks) checks the implemented model
against the configured design-point acceptance criteria, from a pressurised initial
condition run for 600 s of simulated time: all eight design-point values (@sec-constants) against
their stated tolerances; mass-balance closure on both vessels under $1 times 10^(-3)$ kg/s (the
primary acceptance criterion); supply flow equals delivery flow at steady state; all three stage
ratios equal to within $10^(-6)$ relative; pressures rise monotonically through the stages; all
pressures remain at or above atmospheric; gas is heated by compression, never cooled; no NaN or
Inf appears anywhere in state or algebraic outputs; valve positions stay within 0-100%; all flows
are non-negative; and steady-state drift stays under 2 psi over the final 50 s of a 600 s run.

*The Transient / Dynamic Verification Suite* (27 automated checks) covers, among other checks: cold
start stays at atmospheric while stopped; pressurisation toward the source boundary never exceeds
it; bypass and blowdown valve open/close timing against their configured rates (within a few
percent); speed ramp rates in both directions, including a case-specific note on why the average
rate over a full second undercounts the rate-limit during the final approach to setpoint;
coastdown reaching approximately 37% of initial speed after one time constant; load/unload
direction checks (bypass, speed, suction valve); blowdown venting toward atmosphere and doing so
gradually rather than instantly; prelube and oil-permissive-crossing timing, both healthy and
under the "slow lube build" fault; fault behaviour for mag-pickup, overspeed bias, blocked
discharge, and stuck-valve; recovery to the design point after a fault clears; ESD-closed
compression stoppage and post-ESD cylinder cooling; cooler-loss temperature rise; a
400-iteration / 800 s randomised-transient invariant-violation sweep (no NaN, no inverted stage
ordering, no negative pressures, no sub-1.0 stage ratio, no cooling-by-compression, no
out-of-range valve positions); and a final check that the converged final discharge pressure is
insensitive (spread under 1.0 psi) to integration timestep across 5/20/50 ms.

*The remaining five suites* cover: fault injection (each fault in @sec-faults actually produces
its documented tag-level effect); tag mapping (the conversion between internal SI process-model
units and psig/°F transmitter values, including range clamping); the OPC UA link (connection, disconnection,
watchdog timeout, and fail-value application, @opc-connection); and command-locking behaviour
(Overrides tiles correctly becoming read-only once a PLC is connected, and correctly reverting to
editable on disconnect).

The process model itself integrates at a fixed 20 ms step using fourth-order Runge-Kutta; the
timestep-insensitivity check above is the direct evidence that this choice does not materially
affect the converged values reported elsewhere in this document.

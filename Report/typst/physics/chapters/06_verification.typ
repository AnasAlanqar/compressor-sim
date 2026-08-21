#import "../../template.typ": *

= Verification <sec-verification>

The physics module is exercised by two pytest suites, `tests/test_design_point.py` (18 tests)
and `tests/test_transient.py` (27 tests), plus five further suites covering fault injection,
tag mapping, the OPC UA link, and command-locking behaviour — *86 tests total*. All 86 passed
at the time of this report (338.9 s runtime, `pytest tests/ -q`).

*Design-point acceptance* (`test_design_point.py`) verifies, from a pressurised initial
condition run for 600 s of simulated time: all eight design-point values in @sec-constants's
table against their stated tolerances; mass-balance closure on both vessels under
$1 times 10^(-3)$ kg/s (the primary acceptance criterion); supply flow equals delivery flow at
steady state; all three stage ratios equal to within $10^(-6)$ relative; pressures rise
monotonically through the stages; all pressures remain at or above atmospheric; gas is heated
by compression, never cooled; no NaN or Inf appears anywhere in state or algebraic outputs;
valve positions stay within 0–100%; all flows are non-negative; and steady-state drift stays
under 2 psi over the final 50 s of a 600 s run.

*Transient / dynamic validation* (`test_transient.py`) covers, among other checks: cold start
stays at atmospheric while stopped; pressurisation toward the source boundary never exceeds it;
bypass and blowdown valve open/close timing against their configured rates (within a few
percent); speed ramp rates in both directions, including a case-specific note on why the
average rate over a full second undercounts the rate-limit during the final approach to
setpoint; coastdown reaching approximately 37% of initial speed after one time constant;
load/unload direction checks (bypass, speed, suction valve); blowdown venting toward
atmosphere and doing so gradually rather than instantly; prelube and oil-permissive-crossing
timing, both healthy and under the "slow lube build" fault; fault behaviour for mag-pickup,
overspeed bias, blocked discharge, and stuck-valve; recovery to the design point after a fault
clears; ESD-closed compression stoppage and post-ESD cylinder cooling; cooler-loss temperature
rise; a 400-iteration / 800 s randomised-transient invariant-violation sweep (no NaN, no
inverted stage ordering, no negative pressures, no sub-1.0 stage ratio, no
cooling-by-compression, no out-of-range valve positions); and a final check that the converged
final discharge pressure is insensitive (spread under 1.0 psi) to integration timestep across
5/20/50 ms.

The physics loop itself integrates at a fixed 20 ms step using fourth-order Runge-Kutta; the
timestep-insensitivity test above is the direct evidence that this choice does not materially
affect the converged values reported elsewhere in this document.

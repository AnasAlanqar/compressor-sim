#import "../../template.typ": *

= Verification Summary <sec-verification>

The physics module is exercised by *86 automated tests* across seven suites: design-point
acceptance (18), transient/dynamic behaviour (27), and five further suites covering fault
injection, tag mapping, the OPC UA link, and command-locking behaviour. All 86 passed as of this
report (`pytest tests/ -q`).

#data-table(
  ([Category], [What it checks], [Result]),
  (
    ([Design-point acceptance],
     [All 8 design-point values (@sec-constants) within tolerance; mass-balance closure
      $< 1 times 10^(-3)$ kg/s on both vessels; stage ratios equal to $10^(-6)$; monotonic
      staging; no negative pressure/NaN/Inf; steady-state drift $< 2$ psi over 50 s],
     [Pass, 18/18]),
    ([Transient / dynamic validation],
     [Valve/speed ramp-rate timing; coastdown time constant; load/unload direction; blowdown
      venting profile; oil-permissive timing (healthy and faulted); fault behaviour recovery;
      ESD-closed cooling; cooler-loss response],
     [Pass, 27/27]),
    ([Randomised invariant sweep],
     [400 iterations / 800 s simulated of randomised commands: no NaN, no inverted staging, no
      negative pressure, no sub-1.0 stage ratio, no cooling-by-compression, no out-of-range valve
      position],
     [Pass]),
    ([Timestep insensitivity],
     [Converged final discharge pressure compared across 5/20/50 ms integration steps],
     [Spread $< 1.0$ psi]),
    ([Fault injection, tag mapping, OPC UA link, command locking],
     [Remaining five suites],
     [Pass]),
  )
)

The physics loop integrates at a fixed 20 ms step using fourth-order Runge-Kutta; the
timestep-insensitivity result is the direct evidence this choice does not materially affect the
converged values reported in @sec-constants. The exhaustive per-test narrative is in
Appendix C.

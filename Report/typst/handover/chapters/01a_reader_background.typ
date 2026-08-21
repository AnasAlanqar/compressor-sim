#import "../../template.typ": *

= Reader Background and Common Ground <sec-background>

This report assumes the reader is a technically competent automation/controls engineer: fluent
in PLC programming, digital and analog I/O, permissives, interlocks, alarms, trips, state
machines/sequencers, timers, industrial instrumentation, OPC UA, and general process-control
terminology. None of that is re-taught here.

What this report does *not* assume is that the reader has worked on this specific compressor
package before. This section is the minimum, compressor-specific common ground needed to
interpret everything that follows — not a course in reciprocating-compressor engineering.

- This is a *three-stage reciprocating gas compressor* (@sec-process) — a positive-displacement
  machine, not a curve-lookup rotodynamic one.
- Gas enters at *suction*, and pressure rises across *three compression stages* in series.
- *Intercooling* occurs between stages, and an *aftercooler* conditions the final discharge.
- Final compressed gas leaves toward the *process/pipeline*.
- The *bypass (recycle) valve* routes discharge gas back toward suction, unloading the compressor
  without stopping it.
- The *blowdown valve* depressurises the modelled *suction-side* volume — not the discharge side
  (@sec-process explains why that distinction matters).
- *ESD valves* (suction and discharge) isolate the compressor package.
- *Auxiliary lubrication / prelube* must build oil pressure before engine and compressor
  operation are meaningful.
- *Cooler* operation (fan count) directly affects simulated temperatures.
- An *engine* drives the compressor through a shared speed reference.
- *The PLC, not the simulator, decides how all of the above is sequenced* — permissives, timers,
  interlocks, and the startup/shutdown order are entirely the connected PLC's responsibility.
  @sec-quickstart makes this division explicit.

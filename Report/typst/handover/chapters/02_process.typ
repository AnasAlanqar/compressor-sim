#import "../../template.typ": *

#part[Part I --- Design Basis]

= Process Description <sec-process>

A reciprocating compressor raises the pressure of a gas by drawing it into a cylinder through a
suction valve, reducing the cylinder volume with a piston driven by a crankshaft, and expelling
the compressed gas through a discharge valve — a positive-displacement machine, in contrast to a
centrifugal machine whose flow varies continuously with pressure ratio. Gas enters through a
suction scrubber, passes through the suction ESD and suction control valves into the first-stage
cylinder, through an intercooler to the second-stage cylinder, through a second intercooler to
the third-stage cylinder, and out through an aftercooler and the discharge ESD to the pipeline. A
bypass (recycle) valve returns discharge gas to suction to unload the machine without stopping
it; a blowdown valve vents the suction volume to atmosphere for depressurisation. The model lumps
all discharge-side volume (second and third stage plus the discharge separator) into a single
discharge volume — it does not model the discharge separator as a distinct dynamic element.

== What This Means for the PLC

Being a *positive-displacement, staged, reciprocating* machine (rather than a rotodynamic one)
has direct consequences for control logic:

- Compressor flow is fundamentally tied to *displacement and speed* (@sec-equations, eq. 5), not
  a pressure-ratio performance curve — there is no "compressor map" to operate against.
- *Bypass/recycle* is the mechanism for unloading and recycling flow without stopping the engine.
- *Staged compression* raises pressure progressively, stage by stage, not in one jump.
- *Intercooling* directly affects the temperature seen at each downstream stage.
- *Lubrication and prelube permissives* matter — the compressor should not be expected to run
  without healthy oil pressure first.
- *Engine and compressor sequencing is discrete/state-driven* (crank, accelerate, run, coast down)
  rather than continuous.
- *Pressure response is dynamic, not instant* (see below) — permissive checks need timeout logic,
  not instantaneous comparisons.
- *Blowdown/recycle path configuration matters during stopping and shutdown* — see the
  mass-accumulation asymmetry below, and @sec-plc-interface for the normal-stop-versus-USD
  consequence.

#let flowbox(body) = box(
  stroke: 0.6pt + rule-color, inset: 6pt, radius: 2pt,
  align(center)[#text(size: 8.5pt, body)],
)
#let arrow = box(inset: (x: 3pt))[→]

#figure(
  align(center)[
    #stack(dir: ltr, spacing: 0pt,
      flowbox[30 psig \ Suction \ Scrubber], arrow,
      flowbox[Stage 1 \ Cylinder], arrow,
      flowbox[Intercooler], arrow,
      flowbox[Stage 2 \ Cylinder], arrow,
      flowbox[Aftercooler], arrow,
      flowbox[Stage 3 / \ Disch. Sep.], arrow,
      flowbox[1150 psig \ → Process],
    )
    #v(6pt)
    #text(size: 8pt, style: "italic")[
      Bypass (recycle) valve returns discharge gas to suction, upstream of the suction scrubber;
      a blowdown valve vents the suction volume to atmosphere. Both omitted above for layout —
      see @fig-hmi-stopped for the full P&ID.
    ]
  ],
  caption: [Process flow of the three-stage reciprocating compressor package. Stage pressures
    correspond to the model design point.],
) <fig-process-flow>

*Why the package is staged.* As the pressure ratio across a single cylinder increases, discharge
temperature rises, rod loading increases, and volumetric efficiency falls (an effect that
worsens sharply with ratio — @sec-equations, eq. 4). Compressing this package's full
30 → 1150 psig range in one stage would produce an impractically high discharge temperature and
an impractically low volumetric efficiency. Multistage compression splits a large overall ratio
across several cylinders in series with intercooling between them. For a fixed overall ratio
split across $k$ stages, distributing the ratio equally across all stages — each stage taking the
$k$-th root of the total ratio — minimises total compression work, and is standard multistage
design practice; this is why this package's three stages each take the cube root of the total
ratio rather than an arbitrary split.

== Pressure as a Consequence of Mass Accumulation

This is the conceptual core of the whole model, stated here once for the rest of the document to
cross-reference. Pressure is not an independent input that drives flow — it is the opposite:
pressure is the integrated *result* of mass accumulating in, or draining from, a fixed volume.
Gas flows in and out of a vessel for other reasons (valve positions, upstream/downstream pressure
differences), and whatever net mass imbalance results is what raises or lowers the pressure. This
follows from the ideal gas law: at fixed volume and temperature, $P = m R_(s p) T \/ V$, so
pressure is directly proportional to contained mass, and $(d P)\/(d t) = (R_(s p) T\/V) sum
dot(m)$ — the rate of pressure change is proportional to net mass flow rate (this is exactly
@eq-massbalance in @sec-equations). If inflow exceeds outflow, pressure rises; if outflow exceeds
inflow, pressure falls; if they balance, pressure holds steady regardless of how large either
flow is.

Operationally, this is why blowdown and shutdown take real time rather than happening instantly,
and why a PLC's pressure-permissive checks (minimum purge pressure, maximum start pressure) need
timeout timers rather than instantaneous checks. It is also why the model exhibits a specific,
repeatable asymmetry: *blowdown vents the suction volume, not the discharge volume.* The
discharge side can only lose mass through the bypass valve into suction and then out the vent, so
venting with the bypass closed collapses suction pressure toward atmospheric while discharge
pressure barely moves — there is no path for discharge-side mass to leave. This single mechanism
explains why an unconditional shutdown (blowdown opens immediately) and a normal stop (bypass
opens first) leave the package in very different pressure states, and it applies identically
wherever this document discusses blowdown, USD, or bypass behaviour below (in particular
@sec-running) — it is not re-derived each time it recurs.


#import "../../template.typ": *

= Process Description

A reciprocating compressor raises the pressure of a gas by drawing it into a cylinder through
a suction valve, reducing the cylinder volume with a piston driven by a crankshaft, and
expelling the compressed gas through a discharge valve. It is a positive-displacement machine:
for a given cylinder geometry and running speed, the volume of gas moved per unit time is
fixed by the swept volume of the piston, in contrast to a centrifugal machine whose flow varies
continuously along a characteristic curve with pressure ratio. This makes reciprocating
compressors the standard choice for gas gathering, gas lift, gas injection, and pipeline
transport applications where high pressure ratios and stable throughput at varying discharge
pressure are required.

*Why the package is staged.* A single compression stage is limited in the pressure ratio it
can practically achieve: as the ratio across one cylinder increases, discharge temperature
rises, mechanical (rod) loading increases, and volumetric efficiency falls, because a larger
fraction of the cylinder's swept volume is consumed by clearance-gas re-expansion — an effect
that worsens sharply as pressure ratio increases (@eq-ve in @sec-equations). Compressing this
package's full 30 psig to 1150 psig range in a single stage would produce an impractically
high discharge temperature and an impractically low volumetric efficiency. Multistage
compression avoids this by splitting a large overall pressure ratio across several cylinders
in series, with intercooling between stages to remove the heat of compression before the gas
enters the next stage. For a fixed overall ratio split across $k$ stages, distributing the
ratio equally across all stages — so each stage takes the $k$-th root of the total ratio —
minimizes the total compression work summed across all stages, and is the standard design
practice for multistage reciprocating machines; this is why this package's three stages each
take the cube root of the total ratio rather than an arbitrary split.

*Process flow.* Gas enters through a suction scrubber, passes through the suction ESD and
suction control valves into the first-stage cylinder, through an intercooler to the
second-stage cylinder, through a second intercooler to the third-stage cylinder, and out
through an aftercooler and the discharge ESD to the pipeline. A bypass (recycle) valve returns
discharge gas to suction to unload the machine without stopping it; a blowdown valve vents the
suction volume to atmosphere for depressurisation. The model lumps all discharge-side volume
(second and third stage plus the discharge separator) into a single discharge volume; it does
not model the discharge separator as a distinct dynamic element, so a schematic showing it as a
separate vessel should not be read as implying the model has more vessels than it does.

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
      Bypass (recycle) valve returns discharge gas to suction, upstream of the suction
      scrubber; a blowdown valve vents the suction volume to atmosphere. Both omitted above
      for layout — see the desktop application's own P&ID for the full schematic.
    ]
  ],
  caption: [Process flow of the three-stage reciprocating compressor package, showing the main
    gas path. Stage pressures correspond to the model design point.],
) <fig-process-flow>

== Pressure as a Consequence of Mass Accumulation

This is the conceptual core of the whole model. Pressure is not an independent input that
drives flow — it is the opposite: pressure is the integrated *result* of mass accumulating in,
or draining from, a fixed volume. A vessel does not "have" a pressure that then pushes gas
around; gas flows in and out for other reasons (valve positions, upstream/downstream pressure
differences), and whatever net mass imbalance results is what raises or lowers the pressure.

This follows directly from the ideal gas law. At fixed volume $V$ and temperature $T$,
$P = m R_(s p) T \/ V$ says pressure is directly proportional to the mass of gas contained.
Differentiating with respect to time, with $V$ and $T$ held fixed, gives
$(d P)\/(d t) = (R_(s p) T\/V) sum dot(m)$ — the rate of pressure change is proportional to
the net mass flow rate into the volume. If inflow exceeds outflow, pressure rises. If outflow
exceeds inflow, pressure falls. If they balance, pressure holds steady regardless of how large
either flow is. This is exactly @eq-massbalance in @sec-equations.

Operationally, this is why blowdown and shutdown take real time rather than happening
instantly, and why a PLC's pressure-permissive checks (a minimum purge pressure, a maximum
start pressure) need timeout timers rather than instantaneous checks — the logic must wait for
a physical process to finish, and must fault if it does not finish in the expected time.

A concrete illustration, drawn from the model's own structure: blowdown vents the *suction*
volume, not the discharge volume. The discharge side can only lose mass through the bypass
valve into suction and then out the vent. Therefore, holding blowdown open with the bypass
closed drops suction pressure substantially while discharge pressure barely falls — the
discharge volume has no path for mass to leave. This is a direct, observable consequence of
"pressure follows mass," and it is also the mechanism behind the USD-versus-normal-stop
asymmetry discussed in @sec-equations.

The package modeled in this report is a generic three-stage reciprocating compressor,
parameterized to represent a package nominally based on an Ariel JGH/4-class machine driven by
a CAT G3516LE-class gas engine. @sec-equations discusses why this generic framing, rather than
a claim of machine-specific fidelity, is the accurate one.

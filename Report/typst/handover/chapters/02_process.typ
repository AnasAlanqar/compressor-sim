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

== Worked Example --- From 60 psig Source to 1149 psig Discharge <sec-worked-example>

The previous section stated the principle — pressure follows mass. This section walks that
principle through the model's own design point (@sec-constants), end to end, so that
@sec-equations reads as the formalisation of something already understood rather than as the
first encounter with it. Everything below describes *how the implemented simulator model
behaves*, not a claim about what a real compressor package would do — see @sec-purpose for the
validation status that applies to every number here.

#note(label: "WORKED-EXAMPLE OPERATING STATE")[
  1000 rpm; bypass closed (75% AO); suction control 45%; suction/discharge ESDs open; blowdown
  closed; both coolers running — the full driving command state is in @sec-constants.
]

=== The Process Path

#let flowbox2(body) = box(
  stroke: 0.6pt + rule-color, inset: 6pt, radius: 2pt,
  align(center)[#text(size: 8pt, body)],
)
#let darrow = align(center)[#text(size: 9pt)[↓]]

#figure(
  align(center)[
    #grid(
      columns: 1, row-gutter: 2pt,
      flowbox2[Source boundary \ $P_(s r c) = $ 60 psig], darrow,
      flowbox2[Suction ESD], darrow,
      flowbox2[Suction control valve], darrow,
      flowbox2[Suction volume \ $approx$ 29.8 psig], darrow,
      flowbox2[Stage 1 \ $approx$ 117.3 psig], darrow,
      flowbox2[Intercooler], darrow,
      flowbox2[Stage 2 \ $approx$ 377.2 psig], darrow,
      flowbox2[Intercooler], darrow,
      flowbox2[Stage 3 / final discharge \ $approx$ 1149.0 psig], darrow,
      flowbox2[Aftercooler / discharge ESD], darrow,
      flowbox2[Pipeline / process boundary \ $P_(p r o c) = $ 1050 psig],
    )
  ],
  caption: [The process path at the model's converged design point, source boundary to pipeline
    boundary. Values are the implemented model's steady-state result, not independent inputs.],
) <fig-worked-path>

Two of these boxes are *boundary conditions* — fixed inputs to the model, defined in the
simulator configuration and not themselves computed: the 60 psig source and the 1050 psig
pipeline. Every
other value on the path — suction, all three stage pressures, and final discharge — is a
*computed result* of the mass-balance and compression equations in @sec-equations, evaluated at
the design point's commanded valve positions and speed (@sec-constants). The rest of this section
explains how each of those results is arrived at.

=== Source Pressure Is Not Suction Pressure

$P_(s r c) = 60$ psig is the upstream boundary condition representing the gas supply available
before the simulated compressor package — it is a configured input, not a measured tag. It does
*not* directly set `PT_1001` (suction pressure) to 60 psig, and reading it as "suction pressure"
is the single most common misreading of this design point on first encounter.

Gas flows from the source toward the suction volume only when $P_(s r c) > P_s$ and the suction
ESD and suction control valve provide an open path — the same simplified orifice relationship as
every other flow in the model (@eq-orifice; see @sec-valve-flow-brief below), driven by the source-to-suction
pressure difference, the source gas density $rho_(s r c)$, the suction control valve position,
and the suction ESD position. At the design point that flow settles to an equilibrium far below
60 psig, for the reasons given below (@sec-worked-example, "Why Suction Settles Near 30 psig") —
the 60 psig figure only ever appears as the driving pressure on the supply side of that
calculation.

=== Pipeline Pressure Is a Downstream Boundary, Not a Compressor Output

The pipeline pressure is the downstream boundary pressure already present in the receiving
process. In the model it represents the backpressure into which the compressor delivers gas; it
is not generated by the compressor itself and is not a state the model integrates — like the
source pressure, it is a fixed configured input ($P_(p r o c) = 1050$ psig).

For gas to flow forward into the pipeline at all, the simplified process-flow equation
(@eq-orifice, applied to $dot(m)_(p r o c)$) needs $P_d > P_(p r o c)$: discharge must sit above
the pipeline boundary. At the design point, final discharge converges to approximately 1149 psig
against a 1050 psig pipeline boundary — a driving difference of roughly
$1149 - 1050 approx 99$ psi. That 99 psi is not a value anything requires; it is what the
implemented mass balance and the configured process-flow coefficient $K_(p r o c)$ (@sec-constants)
converge to once compressor mass flow and process off-take reach equilibrium (see "Why Discharge
Settles Near 1149 psig" below). A different $K_(p r o c)$ or a different pipeline boundary would
converge to a different driving difference — nothing in the model treats 99 psi as a target.

=== Compressor Mass Flow

Mass flow rate answers a simple question: how many kilograms of gas pass through the compressor
per second? At the design point, $dot(m)_(c o m p) approx 0.945$ kg/s. The implemented compressor
equation (@eq-mcomp) is:

#{
  set math.equation(numbering: none)
  $ dot(m)_(c o m p) = V_(d i s p) dot rho_s dot V E dot N/60 dot "gate" $
}

- *$V_(d i s p)$* — the configured swept displacement per revolution (stage 1, double-acting).
- *$rho_s$* — suction gas density, computed from suction pressure and temperature (@eq-density).
- *$V E$* — volumetric efficiency (defined below).
- *$N$* — compressor/engine speed.
- *gate* — compression is enabled only when the implemented running conditions are satisfied:
  speed above 200 rpm and the suction ESD open beyond 2% (@eq-gate).

The cause-and-effect reading: higher speed moves more mass per second; higher suction density
means more mass is packed into the same swept volume; higher $V E$ means more of that swept
volume is actually fresh gas rather than re-expanded clearance gas; and a closed suction ESD or
insufficient speed drives compressor mass flow to exactly zero in the implemented model — there
is no partial-flow fallback. No compressor performance curve is used; flow is a direct product of
displacement, density, efficiency, and speed.

=== Three Terms That Are Easy to Conflate

#note(label: "MASS FLOW vs. VOLUMETRIC FLOW vs. VOLUMETRIC EFFICIENCY")[
  #data-table(
    ([Term], [Units], [Meaning]),
    (
      ([Mass flow rate], [kg/s], [Amount of gas *mass* passing a point per unit time. This is
        what @eq-mcomp and @eq-orifice compute directly.]),
      ([Volumetric flow rate], [m³/s, m³/h, …], [Physical gas *volume* passing per unit time:
        $dot(V) = dot(m) \/ rho$. Because gas density changes strongly with pressure and
        temperature, the same mass flow occupies a much smaller actual volume at discharge
        conditions than at suction conditions.]),
      ([Volumetric efficiency ($V E$)], [dimensionless / %], [The *fraction* of theoretical
        swept cylinder volume effectively filled with fresh suction gas after clearance
        re-expansion and modelled leakage (@eq-ve). At the design point, $V E approx 0.854$
        (85.4%). It is a ratio, not a flow — it scales @eq-mcomp, it does not report one.]),
    )
  )
]

Standard-condition volumetric flow (e.g. MMSCFD) is deliberately not reported anywhere in this
document: doing so rigorously would require a defined standard condition and gas composition that
were not supplied for this project (@sec-limitations), and an invented figure would misrepresent
the model as more complete than it is.

=== Why Suction Settles Near 30 psig

This is the most important individual result in this walkthrough, because it is the one first-
time readers most often expect to just equal the source pressure. It does not, and the reason is
the same mass-balance principle from the previous section, applied to the suction volume
specifically (@eq-ps):

#{
  set math.equation(numbering: none)
  $ (d P_s)/(d t) prop dot(m)_(s u p) + dot(m)_(b y p) - dot(m)_(c o m p) - dot(m)_(b d v) $
}

In plain terms: gas *enters* the suction volume from the source supply flow ($dot(m)_(s u p)$)
and from bypass/recycle flow returning from discharge ($dot(m)_(b y p)$); gas *leaves* the suction
volume as compressor flow ($dot(m)_(c o m p)$) and blowdown flow ($dot(m)_(b d v)$, zero when the
blowdown valve is closed). If inflow exceeds outflow, suction pressure rises; if outflow exceeds
inflow, it falls; when the two balance, it holds steady — regardless of how large either flow is
individually.

At the design point's configured combination — 60 psig source, the design-point suction valve
and ESD positions, the resulting compressor draw at 1000 rpm, and the model's configured flow
coefficients ($K_(s u c)$, @sec-constants) — that balance settles at an equilibrium suction
pressure of approximately 29.8 psig. It is important not to describe this the other way around:
*the simulator does not set suction pressure to 29.8 psig.* Nothing in the model writes that
number anywhere. It is the steady-state output that this particular combination of inflows and
outflows converges to; changing the suction valve position, the source pressure, or the
compressor draw would converge to a different number through the same mechanism.

=== Valve Mass Flow, Briefly <sec-valve-flow-brief>

Every flow referenced above — supply, bypass, process, blowdown — uses the same simplified
orifice relationship (@eq-orifice):

#{
  set math.equation(numbering: none)
  $ dot(m) = K dot Z/100 dot sqrt(rho dot max(Delta P, 0)) $
}

More valve opening means more available flow area and therefore more flow, all else equal.
Greater upstream/downstream pressure difference means greater calculated forward flow. A fully
closed valve gives zero flow regardless of pressure difference. A zero or reversed pressure
difference gives zero flow too — the $max(Delta P, 0)$ term is what prevents the model from ever
computing a reverse flow through these valves. This is explicitly the simulator's simplified
orifice implementation, not a detailed compressible-flow valve-sizing model (@sec-limitations).

=== The Key Valves, Together

#data-table(
  ([Valve], [Physical/package role], [Simulator role]),
  (
    ([Suction ESD], [Isolation of the compressor inlet], [Enables or blocks the inlet/compression
      path — closing it drives compressor mass flow to zero via the gate condition in @eq-mcomp]),
    ([Suction control valve], [Controls/restricts gas entering the suction side], [Modulates
      source-to-suction supply flow, $dot(m)_(s u p)$, in @eq-orifice]),
    ([Bypass / recycle valve], [Routes discharge gas back toward suction for unloading/recycle],
     [Transfers mass directly from the discharge volume to the suction volume — $dot(m)_(b y p)$
      appears with opposite signs in @eq-ps and @eq-pd]),
    ([Discharge ESD], [Isolation between the compressor package and the downstream process],
     [Its commanded position (@eq-valve) *is* the $Z$ term in the process-flow orifice equation
      (@eq-orifice) for $dot(m)_(p r o c)$ — a closed discharge ESD directly zeroes process flow,
      not just an isolation state layered on top of it]),
    ([Blowdown valve], [Depressurisation path], [Removes gas mass from the modelled *suction*
      volume to atmosphere — not an independently modelled discharge inventory. See the
      mass-accumulation asymmetry discussed above]),
  )
)

=== Bypass / Recycle Behaviour

*Bypass closed, compressor loaded:* more of the compressor's flow remains on the discharge side.
Discharge pressure tends to rise, and process delivery increases according to the implemented
model.

*Bypass open, compressor unloaded:* part of the discharge gas is transferred back toward suction.
This subtracts mass from the discharge balance and adds it to the suction balance in the same
step (@eq-pd, @eq-ps) — it tends to raise suction pressure, tends to reduce discharge pressure,
reduces net process delivery, and lets the engine/compressor keep running without stopping.

The command polarity is unchanged from @sec-plc-interface: a higher `FC_3002` command corresponds
to the bypass valve being more closed, and `FC_3002` = 0% corresponds to the bypass fully open in
the implemented command mapping.

=== Why Discharge Settles Near 1149 psig

The discharge-side mass balance (@eq-pd) is:

#{
  set math.equation(numbering: none)
  $ (d P_d)/(d t) prop dot(m)_(c o m p) - dot(m)_(p r o c) - dot(m)_(b y p) $
}

The compressor adds mass to the discharge volume; process/pipeline off-take and bypass both
remove it. When compressor inflow exceeds the combined outflow, discharge pressure rises; when
outflow exceeds inflow, it falls; when they balance, discharge pressure stabilises. At the design
point, compressor mass flow of approximately 0.945 kg/s and the configured pipeline boundary of
1050 psig converge to a final discharge pressure of approximately 1149 psig — the pressure at
which $dot(m)_(p r o c)$ (driven by the 99 psi difference above) removes mass from the discharge
volume at the same rate the compressor is adding it. 1149 psig is not required by any real
compressor; it is this configured model's equilibrium for this combination of inputs.

=== How 117 and 377 psig Are Obtained

It matters which of these numbers are *dynamically simulated* and which are *algebraically
calculated* from other simulated values. The model dynamically integrates exactly two pressure
inventories — suction and discharge (@eq-ps, @eq-pd) — via the mass-balance principle throughout
this section. It does *not* separately integrate three interstage vessel mass balances.

The two intermediate stage pressures are instead derived algebraically from the current suction
and discharge pressures, using the equal-stage-ratio assumption (@eq-ratio, @eq-interstage):

#{
  set math.equation(numbering: none)
  $ r_(t o t) = P_d / P_s, quad r_(s t g) = r_(t o t)^(1/3) $
}

At the design point this gives the path already shown in @fig-worked-path: 29.8 → 117.3 → 377.2
→ 1149.0 psig, each stage taking the cube root of the total ratio. Stage 1 and Stage 2 pressures
are therefore *derived model outputs* of the equal-ratio assumption applied to the two integrated
states, not independently validated interstage pressure predictions.

=== Temperature, Briefly

Gas temperature rises through compression according to the implemented polytropic relationship
(@eq-td, @sec-equations item 7): a higher compression ratio produces a higher calculated
discharge temperature. Intercooling reduces the inlet temperature seen by each downstream stage.
Cooler behaviour itself is simplified to configured fan-count temperature targets filtered by a
first-order lag, not a detailed heat-exchanger model — see @sec-equations items 7 and 11 for the
full treatment.

=== Mental Model

#note(label: "SUMMARY")[
  The gas side of the simulator reduces to two dynamic mass inventories:

  *Suction:* source supply $+$ recycle $-$ compressor draw $-$ blowdown

  *Discharge:* compressor draw $-$ process delivery $-$ recycle

  Positive net accumulation raises pressure; negative net accumulation lowers it; near-zero net
  accumulation holds it steady. Every other equation in @sec-equations exists to compute one of
  the terms feeding these two balances — gas density, compressor capacity, stage-pressure
  distribution, temperature, and valve position — or to convert the resulting suction/discharge
  pressures into the tags the PLC reads.
]


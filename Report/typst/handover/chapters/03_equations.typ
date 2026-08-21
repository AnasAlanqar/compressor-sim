#import "../../template.typ": *

= Governing Equations <sec-equations>

This section states the equations actually implemented in `backend/app/physics.py`, not what a
textbook first-principles treatment would ideally use. Every simplification made relative to a
rigorous treatment is stated explicitly, with its justification, in @sec-limitations. All
pressures below are absolute Pa unless noted gauge; all temperatures are Kelvin; all mass
flows are kg/s, with no exceptions, at the physics-module boundary (`tags.py` converts to
psig/°F only at the instrumentation boundary that crosses to the PLC).

== Symbols

#data-table(
  ([Symbol], [Meaning], [Value / units]),
  (
    ([$R_(s p)$], [Specific gas constant], [345.5 J/(kg·K)]),
    ([$n$], [Polytropic exponent], [1.2693]),
    ([$e_T$], [$(n-1)\/n$], [0.2122]),
    ([$V_(d i s p)$], [Swept volume per revolution (stage 1, double-acting)], [0.023258 #h(2pt) m³/rev]),
    ([$C$], [Clearance fraction], [0.078 (fitted — see @sec-constants)]),
    ([$L_(s l i p)$], [Slip / leakage loss fraction], [0.04]),
    ([$V_s$, $V_d$], [Suction, discharge vessel volumes], [3.0, 4.5 m³]),
    ([$N$], [Engine speed], [rpm]),
    ([$Z$], [Valve position], [0–100 %]),
    ([$P_(a t m)$], [Atmospheric pressure], [101325 Pa]),
  )
)

== 1. Gas density — ideal gas law

$ rho = P / (R_(s p) T) $ <eq-density>

Applied at three points: suction ($rho_s$), discharge ($rho_d$, using the aftercooler
temperature $T_(a c)$), and the supply source ($rho_(s r c)$).

*Simplification: compressibility factor $Z=1$.* A real natural gas at 1150 psig and 245 °F has
$Z approx 0.85$–0.90, so densities computed by @eq-density are optimistic by roughly 10–15% at
the discharge end relative to a real-gas treatment. This is acceptable because the model's
purpose is PLC logic testing, not a performance guarantee — and because no gas composition
analysis was supplied to compute an actual $Z$-factor.

== 2. Stage pressure distribution — equal ratio

$ r_(t o t) = P_d / P_s, quad r_(s t g) = r_(t o t)^(1/3) $ <eq-ratio>

$ P_1 = min(P_s dot r_(s t g),  P_d), quad P_2 = min(P_1 dot r_(s t g),  P_d) $ <eq-interstage>

At the design point: $r_(t o t) = 26.1$, $r_(s t g) = 2.969$, giving 30 → 117 → 377 → 1149 psig.

*Code guard not present in the reference implementation.* The $min(dot.c, P_d)$ clamp on $P_1$
and $P_2$ is a deviation this application makes from both its own internal lite reference
(`docs/compressor_lite_reference.py`) and the predecessor Simulink model, neither of which
clamps the interstage pressures. It exists only to prevent interstage readings from briefly
exceeding final discharge during startup or blowdown transients, and has no effect at steady
state. $r_(t o t)$ is separately clamped to $[1, 30]$.

== 3. Volumetric efficiency — clearance re-expansion

$ V E = 1 - C(r_(s t g)^(1/n) - 1) - L_(s l i p) $ <eq-ve>

The classical reciprocating-compressor volumetric-efficiency equation: gas trapped in the
clearance volume at discharge pressure must re-expand back to suction pressure before the
suction valve can open, so the cylinder never fills completely, and a higher ratio means more
re-expansion and less fresh gas drawn in. At the design point, $r_(s t g)^(1/n) =
2.969^(1/1.2693) = 2.357$, so $V E = 1 - 0.078(1.357) - 0.04 = 0.854$. Clamped to $[0, 1]$.

$C = 0.078$ was back-solved to close the design point, because no vendor performance data was
available to source it from. This is the model's single biggest fitted parameter, and it is
precisely why this package is framed throughout this document as a _generic_ three-stage
reciprocating compressor, not a validated reproduction of a specific real machine's performance.

== 4. Compressor mass flow — positive displacement

$ dot(m)_(c o m p) = V_(d i s p) dot rho_s dot V E dot N/60 dot "gate" $ <eq-mcomp>

$ "gate" = cases(
  1 & "if" N > 200 "rpm and" Z_(s e s d) > 2%,
  0 & "otherwise",
) $ <eq-gate>

Swept volume per revolution × suction density × volumetric efficiency × revolutions per
second, giving kg/s.

The gate is what makes the compressor a _positive-displacement_ machine rather than a curve
lookup: flow is proportional to speed and independent of pressure ratio except through $V E$.
The $Z_(s e s d)$ term means a closed suction ESD dead-heads the cylinder — no fresh gas,
therefore no flow and no compression heat.

== 5. Valve mass flow — simplified orifice

$ dot(m) = K dot Z/100 dot sqrt(rho dot max(Delta P,  0)) $ <eq-orifice>

Derived from the incompressible orifice equation $dot(m) = C_d A sqrt(2 rho Delta P)$, with the
discharge coefficient, the flow area, and the factor of 2 all folded into a single lumped
constant $K$ per valve. A linear valve characteristic is assumed (position % maps linearly to
flow area). $max(Delta P, 0)$ prevents both reverse flow and a square root of a negative
number.

#data-table(
  ([Flow], [Driving $Delta P$], [Density], [$K$]),
  (
    ([$dot(m)_(s u p)$ (supply into suction)], [$P_(s r c) - P_s$], [$rho_(s r c)$], [$2.10 times 10^(-3)$]),
    ([$dot(m)_(b y p)$ (discharge → suction, recycle)], [$P_d - P_s$], [$rho_d$], [$1.50 times 10^(-3)$]),
    ([$dot(m)_(p r o c)$ (discharge → pipeline)], [$P_d - P_(p r o c)$], [$rho_d$], [$1.335 times 10^(-4)$]),
    ([$dot(m)_(b d v)$ (suction → atmosphere, vent)], [$P_s - P_(a t m)$], [$rho_s$], [$4.00 times 10^(-3)$]),
  )
)

$dot(m)_(s u p)$ is additionally gated by both valves in series: $(Z_(s u c)\/100) dot (Z_(s e s d)\/100)$.

*Simplification: no choked-flow model.* At the blowdown valve venting 1150 psig to atmosphere,
the real flow would choke (reach sonic velocity at the throat, capping the mass flow rate
below what the subsonic orifice equation above predicts). Vent rates during blowdown and
unconditional shutdown are therefore approximate — likely faster in the model than a real
choked vent, though this has not been quantified.

== 6. Vessel pressure dynamics — mass balance at constant volume

This is the most important equation pair in the model. From the ideal gas law at fixed volume
and temperature, differentiating gives:

$ (d P)/(d t) = (R_(s p) T)/V sum dot(m) $ <eq-massbalance>

*Suction volume:*

$ (d P_s)/(d t) = (R_(s p) T_(s u c))/V_s (dot(m)_(s u p) + dot(m)_(b y p) - dot(m)_(c o m p) - dot(m)_(b d v)) $ <eq-ps>

with $R_(s p) T_(s u c) \/ V_s = 345.5 times 310.93 \/ 3.0 = 35"," 809$ — the model computes
this implicitly by evaluating the expression each step rather than as a pre-multiplied gain
constant.

*Discharge volume:*

$ (d P_d)/(d t) = (R_(s p) T_(a c))/V_d (dot(m)_(c o m p) - dot(m)_(p r o c) - dot(m)_(b y p)) $ <eq-pd>

with $R_(s p)\/V_d = 345.5\/4.5 = 76.78$, matching the predecessor Simulink model's
`Gain(76.78)` block exactly.

Note $dot(m)_(b y p)$ (the recycle flow) appears in *both* equations with opposite signs — it
is a direct transfer of mass from the discharge volume to the suction volume, not a
sink-and-independent-source pair. Both derivatives are clamped to not drive pressure below
atmospheric when already at atmospheric.

*Note: blowdown vents the suction volume, not the discharge volume.* The discharge side can
only lose mass through the bypass valve into suction and then out the vent. This is a direct,
observable consequence of "pressure follows mass" (@sec-equations, and the process description
in the previous chapter), and it is the mechanism behind the USD-versus-normal-stop asymmetry
noted below.

== 7. Discharge temperature — polytropic compression

$ T_d = T_(i n) dot r_(s t g)^(e_T), quad e_T = (n-1)/n = 0.2693/1.2693 = 0.2122 $ <eq-td>

Applied per cylinder with different inlet temperatures — the model tracks two
discharge-temperature lag states, covering the first stage and lumping the second and third
stages together:

#data-table(
  ([State], [Inlet source], [Why], [PLC tags fed]),
  (
    ([$T_(d 1)$], [$T_(s u c)$], [draws from the suction scrubber], [`TT_2004` (Cyl 1)]),
    ([$T_(d 2)$], [$T_(i n t e r)$], [draws from the intercooler outlet], [`TT_2005`, `2006`, `2007` (Cyls 2–4)]),
  )
)

$ T_d = "gate" dot (T_(i n) r_(s t g)^(e_T)) + (1 - "gate") dot T_(a m b) $ <eq-td-full>

When not running, both targets relax to ambient — this is why cylinder 2 (fed by the
intercooler) is the one that visibly trips on cooler loss, while cylinder 1 barely moves, since
only $T_(i n t e r)$ depends on fan count.

*Simplification: these are algebraic targets, not thermal states.* No cylinder metal mass or
thermal inertia is modelled directly at this equation — discharge temperature responds to a
ratio change algebraically. Thermal lag is added downstream (@eq-lag, below) as a first-order
filter on this algebraic target, not as a physically-derived thermal-mass model; a real
cylinder's discharge temperature lags a ratio change by tens of seconds due to actual metal and
gas thermal mass, which this two-stage abstraction (algebraic target → generic lag)
approximates but does not derive from first principles.

*Cylinders 3 and 4 read identically to cylinder 2.* Because the model has only two
discharge-temperature lag states covering three compression stages, `TT_2006` and `TT_2007`
would read bit-for-bit identical to `TT_2005` without an added static per-cylinder calibration
offset (`config.yaml`: `instrumentation.cyl_temp_offset_F`, currently 0, 0, +3, −2 °F for
cylinders 1–4) applied at the instrumentation boundary — no two real transmitters on nominally
identical cylinders agree that closely. This offset is cosmetic realism, not a modelled
physical difference between the cylinders.

== 8. Valve position dynamics — rate-limited actuator

$ (d Z)/(d t) = "sat"(K_(v a l v e)(Z_(t a r g e t) - Z),  -R_(c l o s e),  +R_(o p e n)), quad 0 <= Z <= 100 $ <eq-valve>

$K_(v a l v e) = 20$ (a proportional gain on position error, matching the predecessor Simulink
model's `gain(20)` block) feeding a rate limiter: for any error larger than
$R\/K_(v a l v e)$, the valve moves at the constant rate limit — a true constant-velocity slew —
while for small errors near the target, the gain term falls below the rate limit and the
approach is smooth rather than a hard stop exactly at the target.

#data-table(
  ([Valve], [$R_(o p e n)$ (%/s)], [$R_(c l o s e)$ (%/s)], [Initial condition], [Target], [Fail direction]),
  (
    ([Bypass], [5], [15], [100 (open)], [$100(1 - "ao_byp"\/75)$], [fails *open*]),
    ([Suction control], [5], [5], [0 (closed)], [ao_suc], [fails *closed*]),
    ([Suction ESD], [20], [20], [0 (closed)], [$100 dot "CMD_sesd"$], [fails *closed*]),
    ([Discharge ESD], [20], [20], [0 (closed)], [$100 dot "CMD_desd"$], [fails *closed*]),
    ([Blowdown], [50], [50], [100 (open unless reset "pressurised")], [$100(1-"CMD_bdv")$], [fails *open*]),
  )
)

The fail-open/fail-closed initial conditions are the safety design: on loss of instrument air
or signal, the ESDs shut and the blowdown opens, venting the package. This is why an
unconditional shutdown and a normal stop end in completely different physical states.

== 9. First-order lag states

$ (d x)/(d t) = (x_(t a r g e t) - x)/tau $ <eq-lag>

Used for every quantity with real thermal or hydraulic inertia:

#data-table(
  ([State], [Target], [$tau$ (s)], [Initial condition]),
  (
    ([$P_(o i l)$ (compressor lube oil)], [see @eq-oiltarget], [3], [0 psig gauge]),
    ([$T_(e o i l)$ (engine oil temperature)], [190 °F running, else ambient], [400], [ambient]),
    ([$T_(a c)$ (aftercooler outlet)], [fan-count lookup if running, else ambient], [60], [ambient]),
    ([$T_(o i l)$ (compressor oil temperature)], [fan-count lookup if running, else ambient], [300], [ambient]),
  )
)

== 10. Lubrication pressure target

$ P_(o i l","t a r g e t) = cases(
  P_(o i l","r u n) dot min(1,  N/850) & N > 200 "rpm",
  P_(o i l","p r e l u b e) & "prelube pump commanded",
  0 & "otherwise",
) $ <eq-oiltarget>

120 psig at rated speed ($P_(o i l","r u n)$), 55 psig on the prelube pump
($P_(o i l","p r e l u b e)$), 0 psig (relative) when off. Pressure scales linearly with speed
up to 850 rpm, then saturates — a pressure-relief-valve characteristic.

*Consequence: a real transient dip during startup crossover.* Once $N$ exceeds 200 rpm, the
running branch takes over at $8.27 times 10^5 "Pa" dot N\/850$, which is momentarily *below*
the 55 psig prelube target until speed builds — a real package shows the same dip, and it is
why the sequencer's oil-pressure permissive check must wait on a genuine physical transient
rather than a simple threshold-crossing at $t=0$.

A separate fault-injection path ("slow lube build") multiplies the effective time constant on
this lag from 3 s to 900 s to deliberately delay the prelube permissive past a PLC's
oil-pressure fault timer — see the companion `DISCREPANCIES.md` for how this value differs
from the predecessor model.

== 11. Cooling — fan-count lookup

$ n_(f a n s) = "CMD"_(c o o l e r 1) + "CMD"_(c o o l e r 2) in {0, 1, 2} $ <eq-fans>

Three discrete lookups indexed by fan count:

#data-table(
  ([Target], [0 fans], [1 fan], [2 fans]),
  (
    ([$T_(i n t e r)$], [140 °F], [120 °F], [105 °F]),
    ([$T_(a c","t a r g e t)$], [175 °F], [130 °F], [110 °F]),
    ([$T_(o i l","t a r g e t)$], [200 °F], [200 °F], [160 °F]),
  )
)

*Simplification: no heat-exchanger model.* No UA (overall heat-transfer coefficient), no
air-side flow, no approach temperature. Cooler outlet is a step function of how many fans are
running, filtered only by the generic first-order lag of @eq-lag. Acceptable because the PLC
only ever sees fan status (on/off) and outlet temperature; the physics in between does not
affect the logic under test.

== 12. Engine speed model

Ramp-rate limited toward a commanded reference, with distinct rates by phase:

#data-table(
  ([Phase], [Condition], [Rate]),
  (
    ([Coastdown], [not (cat_start and driven_ready and not cat_esd)], [first-order, $tau = 6$ s]),
    ([Cranking], [$N < 200$ rpm], [+70 rpm/s]),
    ([Acceleration], [$N gt.eq 200$ rpm, below reference], [+50 rpm/s]),
    ([Deceleration], [$N gt.eq 200$ rpm, above reference], [−75 rpm/s]),
  )
)

The running reference is $N_("idle") = 650$ rpm unless "idle/rated" is commanded, in which case
$N_("ref") = 850 + ("ao_speed"\/100) times (1000-850)$ rpm.

*Simplification: no engine torque or load coupling.* No governor droop, no load feedback.
Speed is a commanded trajectory tracked by rate limits, not a result of torque balance against
compressor load. A real engine with a governor would droop under load; this model does not
represent that.

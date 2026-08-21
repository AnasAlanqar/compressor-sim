#import "../../template.typ": *

= Symbols, Constants, and Design Point <sec-constants>

== Design Point

Converged, ~600 s simulated from a pressurised initial condition.

#data-table(
  ([Quantity], [Value], [Test tolerance]),
  (
    ([Suction pressure], [29.8 psig], [± 0.5 psi]),
    ([ST1 discharge pressure], [117.3 psig], [± 2 psi]),
    ([ST2 discharge pressure], [377.2 psig], [± 5 psi]),
    ([Final discharge pressure], [1149.0 psig], [± 10 psi]),
    ([Stage ratio (each of 3 stages)], [2.97], [± 0.02]),
    ([Compressor mass flow], [0.945 kg/s], [± 0.005]),
    ([Cylinder 1 discharge temp], [245.4 °F], [± 2 °F]),
    ([Cylinder 2 discharge temp], [251.7 °F], [± 2 °F]),
  )
)

Driving command state at the design point: 1000 rpm (100% speed command, idle/rated selected),
bypass closed (75% AO), suction valve at 45%, both coolers running, both ESDs open, blowdown
closed. All mass flows balance to under $1 times 10^(-3)$ kg/s at this point — the model's
primary acceptance criterion (@sec-verification).

== Constants — full parameter set (`backend/config.yaml`)

#data-table(
  ([Constant], [Value], [Meaning]),
  (
    ([$R_(s p)$], [345.5 J/(kg·K)], [Specific gas constant]),
    ([$n$], [1.2693], [Polytropic exponent]),
    ([$e_T$], [0.2122], [$(n-1)\/n$]),
    ([$V_(d i s p)$], [0.023258 m³/rev], [Stage 1 swept volume, double-acting]),
    ([$C$ (clearance)], [0.078], [*Fitted* — back-solved to close the design point (@eq-ve)]),
    ([$L_(s l i p)$], [0.04], [Slip/leakage loss fraction]),
    ([$V_s$], [3.0 m³], [Suction vessel volume]),
    ([$V_d$], [4.5 m³], [Discharge vessel volume (lumped)]),
    ([$K_(s u c)$], [$2.10 times 10^(-3)$], [Supply → suction flow coefficient]),
    ([$K_(b y p)$], [$1.50 times 10^(-3)$], [Discharge → suction (recycle) flow coefficient]),
    ([$K_(p r o c)$], [$1.335 times 10^(-4)$], [Discharge → pipeline flow coefficient]),
    ([$K_(b d v)$], [$4.00 times 10^(-3)$], [Suction → atmosphere (vent) flow coefficient]),
    ([$P_(s r c)$], [60 psig], [Source boundary pressure]),
    ([$P_(p r o c)$], [1050 psig], [Pipeline boundary pressure]),
    ([$T_(s u c)$], [100 °F], [Inlet gas temperature]),
    ([$T_(a m b)$], [90 °F], [Ambient temperature]),
    ([$N_("crank term")$], [200 rpm], [Crank-terminate / compression-gate threshold]),
    ([$N_("idle")$], [650 rpm], [Idle speed setpoint]),
    ([$N_("min load")$], [850 rpm], [Minimum-load speed setpoint]),
    ([$N_("max load")$], [1000 rpm], [Maximum-load speed setpoint]),
    ([Speed ramp rates], [+50 / −75 / +70 rpm/s], [Accel / decel / crank]),
    ([$tau_("coast")$], [6 s], [Coastdown first-order time constant]),
    ([$K_(v a l v e)$], [20], [Valve position-error gain]),
    ([Valve rates], [see the table under @eq-valve], [Open/close rates, %/s, per valve]),
    ([$P_(o i l","r u n)$], [120 psig], [Running lube oil pressure target]),
    ([$P_(o i l","p r e l u b e)$], [55 psig], [Prelube pressure target]),
    ([$P_(o i l","f a u l t)$], [25 psig], [Forced value under the "low lube oil" fault]),
    ([$tau_(o i l","p)$], [3 s], [Lube oil pressure lag time constant]),
    ([$tau_(o i l","s l o w)$], [900 s], [Slow-lube-build fault time constant — differs from the predecessor model, see `DISCREPANCIES.md`]),
    ([$tau_(e o i l)$], [400 s], [Engine oil temperature lag time constant]),
    ([$T_(e o i l","r u n)$], [190 °F], [Running engine oil temperature target]),
    ([Cooling lookup tables], [see the table under @eq-fans], [Fan-count → target temperature, 3 tables]),
    ([$tau_(T","c y l)$], [45 s], [Cylinder discharge temperature lag]),
    ([$tau_(T","o i l)$], [300 s], [Compressor oil temperature lag]),
    ([$tau_(T","a c)$], [60 s], [Aftercooler outlet temperature lag]),
    ([`cyl_temp_offset_F`], [0, 0, +3, −2 °F], [Static per-cylinder calibration offset (Cyls 1–4), cosmetic]),
    ([`status_feedback_tau_s`], [1.0 s], [Cooler run-status feedback lag (contactor pickup/dropout stand-in)]),
    ([`jw_offset_F`], [−15 °F], [Engine jacket-water temp offset from engine oil temp]),
    ([`engine.oil_run_psig`], [60 psig], [CAT ADEM engine oil pressure at rated speed]),
    ([`watchdog_timeout_s`], [2.0 s], [OPC UA link watchdog timeout]),
  )
)

== Transmitter Ranges (instrumentation boundary, `tags.py`)

#data-table(
  ([Tag], [Range]),
  (
    ([`PT_1001` (suction)], [0–60 psig]),
    ([`PT_1002` (ST1 discharge)], [0–300 psig]),
    ([`PT_1003` (ST2 discharge)], [0–1000 psig]),
    ([`PT_1004`/`PT_1006` (ST3/final discharge)], [0–2000 psig]),
    ([`PT_1005` (compressor oil)], [0–200 psig]),
    ([`PT_1007` (engine oil)], [0–150 psig]),
    ([`ST_1008` (speed)], [0–2000 rpm]),
    ([`TT_2001`, `TT_2004`–`2013` (temperatures)], [0–500 °F]),
    ([`TT_2014` (jacket water)], [0–300 °F]),
  )
)

Every analog value is clamped to its transmitter range before being written to the PLC — a
blocked discharge can drive the internal model well past 2000 psig, but the PLC sees a
saturated 2000, exactly as a real transmitter would report.

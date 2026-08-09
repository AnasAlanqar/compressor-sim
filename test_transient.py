"""Transient / dynamic validation of the lite compressor model."""
import numpy as np
import compressor_lite as cl

P = cl.P
S, L = cl.S, cl.L
DT = 0.02

def run(y, cmd, flt, p, seconds, record=None):
    """Advance the model, optionally recording measurements each 0.1 s."""
    log = []
    n = int(seconds / DT)
    for i in range(n):
        y, a = cl.step(y, cmd, flt, p, DT)
        if record and i % 5 == 0:
            m = cl.meas(y, cmd, p, flt)
            log.append({**{k: m[k] for k in record}, 't': i * DT})
    return y, log

def base_cmd(**kw):
    c = cl.Cmd(cat_start=True, driven_ready=True, idle_rated=True, ao_speed=100.,
               ao_byp=75., ao_suc=45., sesd_solenoid=True, desd_solenoid=True,
               bdv_solenoid=True, cooler_1=True, cooler_2=True)
    for k, v in kw.items():
        setattr(c, k, v)
    return c

def settle(p=None, seconds=600):
    p = p or P()
    y = cl.init(p, pressurised=True)
    y, _ = run(y, base_cmd(), cl.Flt(), p, seconds)
    return y, p

RESULTS = []
def check(name, ok, detail=''):
    RESULTS.append((name, ok, detail))
    print(f"{'PASS' if ok else 'FAIL'}  {name:<52} {detail}")


# ---------------------------------------------------------------- 1. cold start
print("\n=== 1. COLD START FROM BLOWN DOWN ===")
p = P()
y = cl.init(p, pressurised=False)
# stopped, blowdown open, ESDs shut
y, _ = run(y, cl.Cmd(), cl.Flt(), p, 30)
m = cl.meas(y, cl.Cmd(), p)
check("stays at atmosphere while stopped", abs(m['PT_1001_suction_psig']) < 0.5,
      f"suction={m['PT_1001_suction_psig']:.2f} psig")
check("speed zero while stopped", m['ST_1008_speed_rpm'] < 1,
      f"N={m['ST_1008_speed_rpm']:.1f}")

# open suction ESD + close blowdown -> should pressurise from source
cmd = cl.Cmd(sesd_solenoid=True, bdv_solenoid=True, ao_suc=100.)
y, _ = run(y, cmd, cl.Flt(), p, 120)
m = cl.meas(y, cmd, p)
check("pressurises toward source with ESD open", m['PT_1001_suction_psig'] > 50,
      f"suction={m['PT_1001_suction_psig']:.1f} psig (src=60)")
check("does not exceed source pressure", m['PT_1001_suction_psig'] <= 60.5,
      f"suction={m['PT_1001_suction_psig']:.1f} psig")


# ------------------------------------------------------------ 2. valve timing
print("\n=== 2. VALVE STROKE TIMING ===")
y, p = settle()
# bypass: ao_byp 75 -> 0 commands valve OPEN (100%), measure time
cmd = base_cmd(ao_byp=0.)
t_open = None
yy = y.copy()
for i in range(int(60 / DT)):
    yy, _ = cl.step(yy, cmd, cl.Flt(), p, DT)
    if yy[S['Z_byp']] > 99.0 and t_open is None:
        t_open = i * DT
        break
check("bypass full open ~20 s (5 %/s)", t_open and 18 < t_open < 22,
      f"{t_open:.1f} s")

cmd = base_cmd(ao_byp=75.)
t_close = None
for i in range(int(60 / DT)):
    yy, _ = cl.step(yy, cmd, cl.Flt(), p, DT)
    if yy[S['Z_byp']] < 1.0 and t_close is None:
        t_close = i * DT
        break
check("bypass full close ~7 s (15 %/s)", t_close and 5.5 < t_close < 8.5,
      f"{t_close:.1f} s")

# blowdown valve 50 %/s -> 2 s
yy = y.copy()
cmd = base_cmd(bdv_solenoid=False)
t_bdv = None
for i in range(int(20 / DT)):
    yy, _ = cl.step(yy, cmd, cl.Flt(), p, DT)
    if yy[S['Z_bdv']] > 99.0:
        t_bdv = i * DT
        break
check("blowdown valve full open ~2 s (50 %/s)", t_bdv and 1.5 < t_bdv < 3.0,
      f"{t_bdv:.1f} s")


# ------------------------------------------------------------ 3. speed ramps
print("\n=== 3. ENGINE SPEED RAMP RATES ===")
y, p = settle()
# drop speed demand 1000 -> 850, rate limit 75 rpm/s down => 2 s
yy = y.copy()
cmd = base_cmd(ao_speed=0.)
n0 = yy[S['N']]
yy, _ = run(yy, cmd, cl.Flt(), p, 1.0)
rate_dn = (n0 - yy[S['N']]) / 1.0
check("speed down-rate limited to 75 rpm/s", 70 < rate_dn <= 76,
      f"{rate_dn:.1f} rpm/s")

cmd = base_cmd(ao_speed=100.)
n0 = yy[S['N']]
yy, _ = run(yy, cmd, cl.Flt(), p, 1.0)
rate_up = (yy[S['N']] - n0) / 1.0
check("speed up-rate limited to 50 rpm/s", 45 < rate_up <= 51,
      f"{rate_up:.1f} rpm/s")

# coast down after stop
yy = y.copy()
cmd = base_cmd(cat_start=False)
yy, _ = run(yy, cmd, cl.Flt(), p, 6.0)
check("coasts to ~37 % speed after 1 tau (6 s)",
      0.30 * 1000 < yy[S['N']] < 0.45 * 1000, f"N={yy[S['N']]:.0f} rpm")


# --------------------------------------------------------- 4. load / unload
print("\n=== 4. LOAD / UNLOAD DIRECTIONAL RESPONSE ===")
y, p = settle()
m0 = cl.meas(y, base_cmd(), p)

# open bypass -> suction UP, discharge DOWN
yy, _ = run(y.copy(), base_cmd(ao_byp=0.), cl.Flt(), p, 120)
m1 = cl.meas(yy, base_cmd(ao_byp=0.), p)
check("bypass open raises suction",
      m1['PT_1001_suction_psig'] > m0['PT_1001_suction_psig'],
      f"{m0['PT_1001_suction_psig']:.1f} -> {m1['PT_1001_suction_psig']:.1f}")
check("bypass open lowers final discharge",
      m1['PT_1006_final_psig'] < m0['PT_1006_final_psig'],
      f"{m0['PT_1006_final_psig']:.0f} -> {m1['PT_1006_final_psig']:.0f}")

# reduce speed -> discharge DOWN
yy, _ = run(y.copy(), base_cmd(ao_speed=0.), cl.Flt(), p, 120)
m2 = cl.meas(yy, base_cmd(ao_speed=0.), p)
check("lower speed lowers final discharge",
      m2['PT_1006_final_psig'] < m0['PT_1006_final_psig'],
      f"{m0['PT_1006_final_psig']:.0f} -> {m2['PT_1006_final_psig']:.0f}")
check("lower speed raises suction",
      m2['PT_1001_suction_psig'] > m0['PT_1001_suction_psig'],
      f"{m0['PT_1001_suction_psig']:.1f} -> {m2['PT_1001_suction_psig']:.1f}")

# close suction control valve -> suction DOWN
yy, _ = run(y.copy(), base_cmd(ao_suc=5.), cl.Flt(), p, 180)
m3 = cl.meas(yy, base_cmd(ao_suc=5.), p)
check("closing suction valve starves suction",
      m3['PT_1001_suction_psig'] < m0['PT_1001_suction_psig'],
      f"{m0['PT_1001_suction_psig']:.1f} -> {m3['PT_1001_suction_psig']:.1f}")


# ---------------------------------------------------------------- 5. blowdown
print("\n=== 5. BLOWDOWN ===")
y, p = settle()
cmd = base_cmd(bdv_solenoid=False, cat_start=False)
yy, log = run(y.copy(), cmd, cl.Flt(), p, 300, record=['PT_1001_suction_psig'])
m = cl.meas(yy, cmd, p)
check("blowdown vents suction to near atmosphere",
      m['PT_1001_suction_psig'] < 2.0, f"{m['PT_1001_suction_psig']:.2f} psig")
# time to fall below 10 psig (PLC max-start-pressure style check)
t10 = next((r['t'] for r in log if r['PT_1001_suction_psig'] < 10.), None)
check("blowdown is gradual, not instant", t10 and t10 > 3.0,
      f"reached 10 psig at t={t10:.1f} s")


# ------------------------------------------------------------------- 6. oil
print("\n=== 6. OIL PRESSURE DYNAMICS ===")
p = P()
y = cl.init(p, pressurised=True)
cmd = cl.Cmd(aux_lube=True)
yy, log = run(y.copy(), cmd, cl.Flt(), p, 30, record=['PT_1005_oil_psig'])
m = cl.meas(yy, cmd, p)
check("prelube reaches ~55 psi target", 50 < m['PT_1005_oil_psig'] < 57,
      f"{m['PT_1005_oil_psig']:.1f} psi")
t10psi = next((r['t'] for r in log if r['PT_1005_oil_psig'] > 10.), None)
check("oil crosses 10 psi permissive quickly when healthy",
      t10psi is not None and t10psi < 5.0, f"t={t10psi:.1f} s")

# slow lube fault
yy, log = run(y.copy(), cmd, cl.Flt(lube_slow=True), p, 400,
              record=['PT_1005_oil_psig'])
t10slow = next((r['t'] for r in log if r['PT_1005_oil_psig'] > 10.), None)
check("lube_slow delays 10 psi permissive past PLC 120 s timer",
      t10slow is not None and t10slow > 120.0, f"t={t10slow:.1f} s")

# low lube fault
yy, _ = run(y.copy(), cmd, cl.Flt(lube_low=True), p, 60)
m = cl.meas(yy, cmd, p, cl.Flt(lube_low=True))
check("lube_low pins oil below 40 psi low alarm", m['PT_1005_oil_psig'] < 40,
      f"{m['PT_1005_oil_psig']:.1f} psi")


# ------------------------------------------------------------------ 7. faults
print("\n=== 7. FAULT RESPONSES ===")
y, p = settle()
m0 = cl.meas(y, base_cmd(), p)

f = cl.Flt(mag_pickup=True)
m = cl.meas(y, base_cmd(), p, f)
check("mag_pickup reads 0 rpm while machine still turns",
      m['ST_1008_speed_rpm'] == 0 and y[S['N']] > 900, "0 rpm reported")

f = cl.Flt(overspeed_offset=250.)
m = cl.meas(y, base_cmd(), p, f)
check("overspeed offset biases speed reading", m['ST_1008_speed_rpm'] > 1200,
      f"{m['ST_1008_speed_rpm']:.0f} rpm")

f = cl.Flt(disch_blocked=0.8)
yy, _ = run(y.copy(), base_cmd(), f, p, 200)
m = cl.meas(yy, base_cmd(), p, f)
check("blocked discharge raises final pressure",
      m['PT_1006_final_psig'] > m0['PT_1006_final_psig'] + 20,
      f"{m0['PT_1006_final_psig']:.0f} -> {m['PT_1006_final_psig']:.0f} psig")
check("blocked discharge raises cylinder temps",
      m['TT_2004_cyl1_F'] > m0['TT_2004_cyl1_F'],
      f"{m0['TT_2004_cyl1_F']:.0f} -> {m['TT_2004_cyl1_F']:.0f} F")

f = cl.Flt(valve_stuck='byp')
yy, _ = run(y.copy(), base_cmd(ao_byp=0.), f, p, 60)
check("valve_stuck freezes bypass position",
      abs(yy[S['Z_byp']] - y[S['Z_byp']]) < 0.1,
      f"held at {yy[S['Z_byp']]:.1f} %")

# fault recovery
yy, _ = run(y.copy(), base_cmd(), cl.Flt(disch_blocked=0.8), p, 200)
yy, _ = run(yy, base_cmd(), cl.Flt(), p, 600)
m = cl.meas(yy, base_cmd(), p)
check("recovers to design point after fault cleared",
      abs(m['PT_1006_final_psig'] - 1149.) < 15,
      f"{m['PT_1006_final_psig']:.0f} psig")


# ------------------------------------------------------------------ 8. ESD
print("\n=== 8. ESD / GATING ===")
y, p = settle()
cmd = base_cmd(sesd_solenoid=False, desd_solenoid=False)
yy, _ = run(y.copy(), cmd, cl.Flt(), p, 60)
a = cl.algebra(yy, cmd, p)
check("suction ESD closed stops compression", a['m_comp'] < 1e-9,
      f"m_comp={a['m_comp']:.2e} kg/s")
m = cl.meas(yy, cmd, p)
check("cyl temps fall toward ambient after ESD", m['TT_2004_cyl1_F'] < 200,
      f"{m['TT_2004_cyl1_F']:.0f} F")


# ---------------------------------------------------------------- 9. coolers
print("\n=== 9. COOLER FAN EFFECT ===")
y, p = settle()
m2f = cl.meas(y, base_cmd(), p)
yy, _ = run(y.copy(), base_cmd(cooler_1=False, cooler_2=False), cl.Flt(), p, 600)
m0f = cl.meas(yy, base_cmd(cooler_1=False, cooler_2=False), p)
check("losing both fans raises aftercooler temp",
      m0f['TT_2013_aftercooler_F'] > m2f['TT_2013_aftercooler_F'] + 30,
      f"{m2f['TT_2013_aftercooler_F']:.0f} -> {m0f['TT_2013_aftercooler_F']:.0f} F")
check("losing both fans raises stage 2 cyl temp",
      m0f['TT_2005_cyl2_F'] > m2f['TT_2005_cyl2_F'],
      f"{m2f['TT_2005_cyl2_F']:.0f} -> {m0f['TT_2005_cyl2_F']:.0f} F")
check("no-fan aftercooler exceeds 147 F high alarm",
      m0f['TT_2013_aftercooler_F'] > 147,
      f"{m0f['TT_2013_aftercooler_F']:.0f} F vs 147 alarm")


# --------------------------------------------- 10. invariants under thrashing
print("\n=== 10. INVARIANTS UNDER AGGRESSIVE TRANSIENTS ===")
y, p = settle()
rng = np.random.default_rng(0)
viol = {'nan': 0, 'order': 0, 'neg': 0, 'ratio': 0, 'cool': 0, 'valve': 0}
yy = y.copy()
for k in range(400):   # 400 x 2 s = 800 s of random operation
    cmd = base_cmd(ao_byp=rng.uniform(0, 75), ao_speed=rng.uniform(0, 100),
                   ao_suc=rng.uniform(10, 100),
                   cooler_1=bool(rng.integers(2)), cooler_2=bool(rng.integers(2)),
                   sesd_solenoid=bool(rng.integers(0, 2) or 1),
                   bdv_solenoid=bool(rng.integers(2)))
    flt = cl.Flt(disch_blocked=float(rng.choice([0., 0., 0.5])))
    yy, _ = run(yy, cmd, flt, p, 2.0)
    m = cl.meas(yy, cmd, p, flt)
    a = cl.algebra(yy, cmd, p)
    v = list(m.values())
    if any(isinstance(x, float) and (np.isnan(x) or np.isinf(x)) for x in v):
        viol['nan'] += 1
    ps, p1, p2, pd = (m['PT_1001_suction_psig'], m['PT_1002_st1_disch_psig'],
                      m['PT_1003_st2_disch_psig'], m['PT_1004_st3_disch_psig'])
    if not (ps - 0.01 <= p1 <= p2 + 0.01 <= pd + 0.02):
        viol['order'] += 1
    if ps < -0.01 or m['PT_1005_oil_psig'] < -0.01:
        viol['neg'] += 1
    if a['r_stg'] < 0.999:
        viol['ratio'] += 1
    if a['gate'] and m['TT_2004_cyl1_F'] < 99.9:      # T_suc = 100 F
        viol['cool'] += 1
    if not all(0 <= yy[S[k2]] <= 100 for k2 in
               ['Z_byp', 'Z_suc', 'Z_sesd', 'Z_desd', 'Z_bdv']):
        viol['valve'] += 1

check("no NaN/Inf over 800 s random operation", viol['nan'] == 0,
      f"{viol['nan']} violations")
check("stage pressure ordering never inverts", viol['order'] == 0,
      f"{viol['order']} violations")
check("no negative pressures", viol['neg'] == 0, f"{viol['neg']} violations")
check("stage ratio never below 1.0", viol['ratio'] == 0,
      f"{viol['ratio']} violations")
check("gas never cooled by compression", viol['cool'] == 0,
      f"{viol['cool']} violations")
check("valve positions stay 0-100 %", viol['valve'] == 0,
      f"{viol['valve']} violations")


# --------------------------------------------------- 11. integrator accuracy
print("\n=== 11. INTEGRATOR / TIMESTEP SENSITIVITY ===")
res = {}
for dt in [0.005, 0.02, 0.05]:
    p = P(); yy = cl.init(p, pressurised=True); c = base_cmd()
    for i in range(int(600 / dt)):
        yy, _ = cl.step(yy, c, cl.Flt(), p, dt)
    res[dt] = cl.meas(yy, c, p)['PT_1006_final_psig']
spread = max(res.values()) - min(res.values())
check("final pressure insensitive to timestep (5-50 ms)", spread < 1.0,
      f"spread={spread:.4f} psi over dt 5/20/50 ms")


print("\n" + "=" * 72)
npass = sum(1 for _, ok, _ in RESULTS if ok)
print(f"TRANSIENT SUITE: {npass}/{len(RESULTS)} passed")
for n, ok, d in RESULTS:
    if not ok:
        print(f"   FAILED: {n}  ({d})")

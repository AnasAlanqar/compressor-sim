"""
Compressor Process Simulator - LITE reference model
Ariel JGH/4 three-stage, CAT G3516LE driver

10 integrator states instead of 17. Everything else is algebra.

The rule applied: a signal is a state only if the PLC makes a decision based on
it changing. Everything else is computed instantly from the states.

Interface is IDENTICAL to the full model, so the internals can be upgraded later
without touching CODESYS or the OPC UA layer.

Written flat and explicit so it maps one-to-one onto Simulink blocks.
"""
import numpy as np
from dataclasses import dataclass

P_ATM = 101325.0
def pa_to_psig(p): return (p - P_ATM) / 6894.757
def psig_to_pa(p): return p * 6894.757 + P_ATM
def k_to_f(t):     return (t - 273.15) * 9.0 / 5.0 + 32.0
def f_to_k(t):     return (t - 32.0) * 5.0 / 9.0 + 273.15


@dataclass
class P:
    # gas
    R_sp: float = 345.5
    n_exp: float = 1.2693           # polytropic exponent
    e_T: float = 0.2122             # (n-1)/n

    # compressor - stage 1 sets throughput for the whole train
    V_disp: float = 0.023258        # m3/rev, 13.5 in bore, 5 in stroke
    clearance: float = 0.078
    L_slip: float = 0.04
    K_cap: float = 1.0

    # volumes
    V_s: float = 3.0
    V_d: float = 4.5                # whole discharge side lumped

    # flow coefficients
    K_suc:  float = 2.10e-3
    K_byp:  float = 1.50e-3
    K_proc: float = 1.335e-4
    K_bdv:  float = 4.00e-3

    # boundaries
    P_src:  float = psig_to_pa(60.0)
    P_proc: float = psig_to_pa(1050.0)
    T_suc:  float = f_to_k(100.0)
    T_amb:  float = f_to_k(90.0)

    # speed
    N_crank_term: float = 200.0
    N_idle: float = 650.0
    N_min_load: float = 850.0
    N_max_load: float = 1000.0
    rate_N_up: float = 50.0
    rate_N_dn: float = 75.0
    rate_crank: float = 70.0
    tau_coast: float = 6.0

    # valves  (open rate, close rate) %/s
    rate_byp: tuple = (5.0, 15.0)
    rate_suc: tuple = (5.0, 5.0)
    rate_esd: tuple = (20.0, 20.0)
    rate_bdv: tuple = (50.0, 50.0)
    K_valve: float = 20.0

    # oil
    P_oil_run: float = 8.27e5
    P_oil_prelube: float = 3.79e5
    P_oil_fault: float = 1.72e5
    tau_oil_p: float = 3.0
    tau_eoil: float = 400.0
    T_eoil_run: float = f_to_k(190.0)

    # cooling - algebraic targets, lagged in the instrument block
    T_inter_fans: tuple = (f_to_k(140.), f_to_k(120.), f_to_k(105.))
    T_ac_fans:    tuple = (f_to_k(175.), f_to_k(130.), f_to_k(110.))
    T_oil_fans:   tuple = (f_to_k(200.), f_to_k(200.), f_to_k(160.))
    tau_T_cyl: float = 45.0
    tau_T_oil: float = 300.0
    tau_T_ac:  float = 60.0


# ---- 10 states -------------------------------------------------------------
S = {n: i for i, n in enumerate(
    ['N', 'P_oil', 'T_eoil', 'P_s', 'P_d',
     'Z_byp', 'Z_suc', 'Z_sesd', 'Z_desd', 'Z_bdv'])}
# ---- 4 instrument lag states (these replace process thermal inertia) --------
L = {n: i + 10 for i, n in enumerate(['T_d1', 'T_d2', 'T_oil', 'T_ac'])}
NST = 14


def init(p: P, pressurised=False):
    y = np.zeros(NST)
    y[S['P_s']] = psig_to_pa(30.) if pressurised else P_ATM
    y[S['P_d']] = psig_to_pa(1150.) if pressurised else P_ATM
    y[S['Z_byp']] = 100.0          # fail open
    y[S['Z_bdv']] = 0.0 if pressurised else 100.0
    for k in L:
        y[L[k]] = p.T_amb
    y[S['T_eoil']] = p.T_amb
    return y


@dataclass
class Cmd:
    ao_speed: float = 0.0
    ao_byp: float = 0.0
    ao_suc: float = 0.0
    aux_lube: bool = False
    idle_rated: bool = False
    bdv_solenoid: bool = False     # energised = closed
    cat_start: bool = False
    cat_esd: bool = False
    driven_ready: bool = False
    sesd_solenoid: bool = False
    desd_solenoid: bool = False
    cooler_1: bool = False
    cooler_2: bool = False


@dataclass
class Flt:
    lube_low: bool = False
    lube_slow: bool = False
    mag_pickup: bool = False
    overspeed_offset: float = 0.0
    disch_blocked: float = 0.0
    valve_stuck: str = ''


def orifice(K, frac, rho, dP):
    if dP <= 0.0 or frac <= 0.0:
        return 0.0
    return K * frac * np.sqrt(max(rho, 1e-6) * dP)


def algebra(y, cmd: Cmd, p: P):
    """everything computed instantly from the 10 states - no integrators"""
    P_s = max(y[S['P_s']], P_ATM)
    P_d = max(y[S['P_d']], P_ATM)
    N = max(y[S['N']], 0.0)

    n_fans = int(cmd.cooler_1) + int(cmd.cooler_2)
    T_inter = p.T_inter_fans[n_fans]

    # --- pressure ratio and the two interstage pressures, pure algebra ---
    r_tot = float(np.clip(P_d / P_s, 1.0, 30.0))
    r_stg = r_tot ** (1.0 / 3.0)
    P_1 = P_s * r_stg
    P_2 = P_1 * r_stg

    # --- capacity: stage 1 sets throughput for the whole train ---
    VE = float(np.clip(1.0 - p.clearance * (r_stg ** (1.0 / p.n_exp) - 1.0)
                       - p.L_slip, 0.0, 1.0))
    rho_s = P_s / (p.R_sp * p.T_suc)
    gate = 1.0 if (N > p.N_crank_term and y[S['Z_sesd']] > 2.0) else 0.0
    # NOTE: the suction control valve throttles the SUPPLY into the suction
    # volume, not the machine's displacement. It appears in m_sup, not here.
    m_comp = p.K_cap * p.V_disp * rho_s * VE * (N / 60.0) * gate

    # --- temperature targets, pure algebra ---
    T_d1_t = p.T_suc * r_stg ** p.e_T
    T_d2_t = T_inter * r_stg ** p.e_T
    T_ac_t = p.T_ac_fans[n_fans] if gate else p.T_amb
    T_oil_t = p.T_oil_fans[n_fans] if N > p.N_crank_term else p.T_amb
    if not gate:
        T_d1_t = T_d2_t = p.T_amb

    return dict(P_1=P_1, P_2=P_2, r_tot=r_tot, r_stg=r_stg, VE=VE,
                m_comp=m_comp, rho_s=rho_s, n_fans=n_fans, gate=gate,
                T_d1_t=T_d1_t, T_d2_t=T_d2_t, T_ac_t=T_ac_t, T_oil_t=T_oil_t)


def deriv(y, cmd: Cmd, flt: Flt, p: P):
    d = np.zeros(NST)
    a = algebra(y, cmd, p)
    P_s = max(y[S['P_s']], P_ATM)
    P_d = max(y[S['P_d']], P_ATM)
    N = max(y[S['N']], 0.0)

    rho_d = P_d / (p.R_sp * y[L['T_ac']])
    rho_src = p.P_src / (p.R_sp * p.T_suc)

    m_sup = orifice(p.K_suc, (y[S['Z_suc']] / 100.) * (y[S['Z_sesd']] / 100.),
                    rho_src, p.P_src - P_s)
    m_byp = orifice(p.K_byp, y[S['Z_byp']] / 100., rho_d, P_d - P_s)
    m_proc = orifice(p.K_proc, (y[S['Z_desd']] / 100.) * (1 - flt.disch_blocked),
                     rho_d, P_d - p.P_proc)
    m_bdv = orifice(p.K_bdv, y[S['Z_bdv']] / 100., rho_s := P_s / (p.R_sp * p.T_suc),
                    P_s - P_ATM)

    # --- 2 pressure states ---
    d[S['P_s']] = (p.R_sp * p.T_suc / p.V_s) * (m_sup + m_byp - a['m_comp'] - m_bdv)
    d[S['P_d']] = (p.R_sp * y[L['T_ac']] / p.V_d) * (a['m_comp'] - m_proc - m_byp)
    for k in ['P_s', 'P_d']:
        if y[S[k]] <= P_ATM and d[S[k]] < 0:
            d[S[k]] = 0.0

    # --- engine speed ---
    run = cmd.cat_start and cmd.driven_ready and not cmd.cat_esd
    if not run:
        d[S['N']] = -N / p.tau_coast
    elif N < p.N_crank_term:
        d[S['N']] = p.rate_crank
    else:
        N_ref = (p.N_min_load + cmd.ao_speed / 100. *
                 (p.N_max_load - p.N_min_load)) if cmd.idle_rated else p.N_idle
        d[S['N']] = float(np.clip(N_ref - N, -p.rate_N_dn, p.rate_N_up))

    # --- 5 valves ---
    tgt = {'Z_byp': np.clip(100. * (1 - cmd.ao_byp / 75.), 0, 100),
           'Z_suc': np.clip(cmd.ao_suc, 0, 100),
           'Z_sesd': 100. if cmd.sesd_solenoid else 0.,
           'Z_desd': 100. if cmd.desd_solenoid else 0.,
           'Z_bdv': 0. if cmd.bdv_solenoid else 100.}
    rates = {'Z_byp': p.rate_byp, 'Z_suc': p.rate_suc, 'Z_sesd': p.rate_esd,
             'Z_desd': p.rate_esd, 'Z_bdv': p.rate_bdv}
    short = {'Z_byp': 'byp', 'Z_suc': 'suc', 'Z_sesd': 'sesd',
             'Z_desd': 'desd', 'Z_bdv': 'bdv'}
    for k, t in tgt.items():
        if flt.valve_stuck == short[k]:
            d[S[k]] = 0.0
        else:
            up, dn = rates[k]
            d[S[k]] = float(np.clip(p.K_valve * (t - y[S[k]]), -dn, up))

    # --- oil ---
    tau = 90.0 if flt.lube_slow else p.tau_oil_p
    if flt.lube_low:
        t_oil = p.P_oil_fault
    elif N > p.N_crank_term:
        t_oil = p.P_oil_run * min(1.0, N / p.N_min_load)
    elif cmd.aux_lube:
        t_oil = p.P_oil_prelube
    else:
        t_oil = 0.0
    d[S['P_oil']] = (t_oil - y[S['P_oil']]) / tau
    d[S['T_eoil']] = ((p.T_eoil_run if N > p.N_crank_term else p.T_amb)
                      - y[S['T_eoil']]) / p.tau_eoil

    # --- 4 thermal lags standing in for process inertia ---
    d[L['T_d1']] = (a['T_d1_t'] - y[L['T_d1']]) / p.tau_T_cyl
    d[L['T_d2']] = (a['T_d2_t'] - y[L['T_d2']]) / p.tau_T_cyl
    d[L['T_oil']] = (a['T_oil_t'] - y[L['T_oil']]) / p.tau_T_oil
    d[L['T_ac']] = (a['T_ac_t'] - y[L['T_ac']]) / p.tau_T_ac

    return d, a


def step(y, cmd, flt, p, dt):
    k1, a = deriv(y, cmd, flt, p)
    k2, _ = deriv(y + .5 * dt * k1, cmd, flt, p)
    k3, _ = deriv(y + .5 * dt * k2, cmd, flt, p)
    k4, _ = deriv(y + dt * k3, cmd, flt, p)
    y = y + dt / 6. * (k1 + 2 * k2 + 2 * k3 + k4)
    y[S['P_s']] = max(y[S['P_s']], P_ATM)
    y[S['P_d']] = max(y[S['P_d']], P_ATM)
    y[S['N']] = max(y[S['N']], 0.0)
    y[S['P_oil']] = max(y[S['P_oil']], 0.0)
    for k in ['Z_byp', 'Z_suc', 'Z_sesd', 'Z_desd', 'Z_bdv']:
        y[S[k]] = np.clip(y[S[k]], 0.0, 100.0)
    return y, a


def meas(y, cmd, p, flt=Flt()):
    """identical tag set to the full model"""
    a = algebra(y, cmd, p)
    z = lambda k: y[S[k]]
    return {
        'PT_1001_suction_psig':   pa_to_psig(y[S['P_s']]),
        'PT_1002_st1_disch_psig': pa_to_psig(a['P_1']),
        'PT_1003_st2_disch_psig': pa_to_psig(a['P_2']),
        'PT_1004_st3_disch_psig': pa_to_psig(y[S['P_d']]),
        'PT_1006_final_psig':     pa_to_psig(y[S['P_d']]),
        'PT_1005_oil_psig':       y[S['P_oil']] / 6894.757,
        'ST_1008_speed_rpm':      0. if flt.mag_pickup
                                  else y[S['N']] + flt.overspeed_offset,
        'TT_2001_oil_F':          k_to_f(y[L['T_oil']]),
        'TT_2004_cyl1_F':         k_to_f(y[L['T_d1']]),
        'TT_2005_cyl2_F':         k_to_f(y[L['T_d2']]),
        'TT_2006_cyl3_F':         k_to_f(y[L['T_d2']]),
        'TT_2007_cyl4_F':         k_to_f(y[L['T_d2']]),
        'TT_2013_aftercooler_F':  k_to_f(y[L['T_ac']]),
        'TT_2009_packing_F':      k_to_f(y[L['T_oil']]) + 14.,
        'engine_oil_temp_F':      k_to_f(y[S['T_eoil']]),
        'ZS_byp_open':   z('Z_byp') > 98, 'ZS_byp_closed':  z('Z_byp') < 2,
        'ZS_sesd_open':  z('Z_sesd') > 98, 'ZS_sesd_closed': z('Z_sesd') < 2,
        'ZS_desd_open':  z('Z_desd') > 98, 'ZS_desd_closed': z('Z_desd') < 2,
        'ZS_bdv_open':   z('Z_bdv') > 98,  'ZS_bdv_closed':  z('Z_bdv') < 2,
        'ZT_byp_pct': z('Z_byp'), 'ZT_suc_pct': z('Z_suc'),
    }

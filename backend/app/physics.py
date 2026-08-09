"""
Compressor process simulator physics.

Faithful port of docs/compressor_lite_reference.py, per APP_SPEC.md section 3.
Deviations from the lite reference are marked [SPEC OVERRIDES LITE] and are
the only permitted deviations.

10 integrator states plus 4 first-order thermal lag states. Everything else
is algebra recomputed every step. Contains no control logic — see
APP_SPEC.md section 1 and section 9.
"""
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import yaml

P_ATM = 101325.0


def pa_to_psig(p):
    return (p - P_ATM) / 6894.757


def psig_to_pa(p):
    return p * 6894.757 + P_ATM


def k_to_f(t):
    return (t - 273.15) * 9.0 / 5.0 + 32.0


def f_to_k(t):
    return (t - 32.0) * 5.0 / 9.0 + 273.15


@dataclass
class P:
    """Physical parameters, in SI units, loaded from config.yaml."""
    R_sp: float
    n_exp: float
    e_T: float

    V_disp: float
    clearance: float
    L_slip: float
    K_cap: float

    V_s: float
    V_d: float

    K_suc: float
    K_byp: float
    K_proc: float
    K_bdv: float

    P_src: float
    P_proc: float
    T_suc: float
    T_amb: float

    N_crank_term: float
    N_idle: float
    N_min_load: float
    N_max_load: float
    rate_N_up: float
    rate_N_dn: float
    rate_crank: float
    tau_coast: float

    rate_byp: tuple
    rate_suc: tuple
    rate_esd: tuple
    rate_bdv: tuple
    K_valve: float

    P_oil_run: float
    P_oil_prelube: float
    P_oil_fault: float
    tau_oil_p: float
    tau_oil_slow: float
    tau_eoil: float
    T_eoil_run: float

    T_inter_fans: tuple
    T_ac_fans: tuple
    T_oil_fans: tuple
    tau_T_cyl: float
    tau_T_oil: float
    tau_T_ac: float


def load_params(path) -> P:
    """Load parameters from a config.yaml (APP_SPEC.md section 9: no
    hardcoded parameters in physics.py)."""
    with open(path) as f:
        c = yaml.safe_load(f)

    return P(
        R_sp=c['gas']['R_sp'],
        n_exp=c['gas']['n_exp'],
        e_T=c['gas']['e_T'],

        V_disp=c['compressor']['V_disp'],
        clearance=c['compressor']['clearance'],
        L_slip=c['compressor']['L_slip'],
        K_cap=c['compressor']['K_cap'],

        V_s=c['volumes']['V_s'],
        V_d=c['volumes']['V_d'],

        K_suc=c['flow_coefficients']['K_suc'],
        K_byp=c['flow_coefficients']['K_byp'],
        K_proc=c['flow_coefficients']['K_proc'],
        K_bdv=c['flow_coefficients']['K_bdv'],

        P_src=psig_to_pa(c['boundaries']['P_src_psig']),
        P_proc=psig_to_pa(c['boundaries']['P_proc_psig']),
        T_suc=f_to_k(c['boundaries']['T_suc_F']),
        T_amb=f_to_k(c['boundaries']['T_amb_F']),

        N_crank_term=c['speed']['N_crank_term'],
        N_idle=c['speed']['N_idle'],
        N_min_load=c['speed']['N_min_load'],
        N_max_load=c['speed']['N_max_load'],
        rate_N_up=c['speed']['rate_N_up'],
        rate_N_dn=c['speed']['rate_N_dn'],
        rate_crank=c['speed']['rate_crank'],
        tau_coast=c['speed']['tau_coast'],

        rate_byp=tuple(c['valves']['rate_byp']),
        rate_suc=tuple(c['valves']['rate_suc']),
        rate_esd=tuple(c['valves']['rate_esd']),
        rate_bdv=tuple(c['valves']['rate_bdv']),
        K_valve=c['valves']['K_valve'],

        P_oil_run=psig_to_pa(c['oil']['P_oil_run_psig']) - P_ATM,
        P_oil_prelube=psig_to_pa(c['oil']['P_oil_prelube_psig']) - P_ATM,
        P_oil_fault=psig_to_pa(c['oil']['P_oil_fault_psig']) - P_ATM,
        tau_oil_p=c['oil']['tau_oil_p'],
        tau_oil_slow=c['oil']['tau_oil_slow'],
        tau_eoil=c['oil']['tau_eoil'],
        T_eoil_run=f_to_k(c['oil']['T_eoil_run_F']),

        T_inter_fans=tuple(f_to_k(t) for t in c['cooling']['T_inter_fans_F']),
        T_ac_fans=tuple(f_to_k(t) for t in c['cooling']['T_ac_fans_F']),
        T_oil_fans=tuple(f_to_k(t) for t in c['cooling']['T_oil_fans_F']),
        tau_T_cyl=c['cooling']['tau_T_cyl'],
        tau_T_oil=c['cooling']['tau_T_oil'],
        tau_T_ac=c['cooling']['tau_T_ac'],
    )


DEFAULT_CONFIG = Path(__file__).resolve().parent.parent / 'config.yaml'


# ---- 10 states -------------------------------------------------------------
S = {n: i for i, n in enumerate(
    ['N', 'P_oil', 'T_eoil', 'P_s', 'P_d',
     'Z_byp', 'Z_suc', 'Z_sesd', 'Z_desd', 'Z_bdv'])}
# ---- 4 instrument lag states (stand in for process thermal inertia) -------
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
    # [SPEC OVERRIDES LITE] not in compressor_lite_reference.py's Flt.
    # section 5: "prevents N exceeding 550 rpm" — the REMVue running permit,
    # below the 650 rpm idle setpoint, so the engine hangs short of a normal
    # start and the PLC's Engine Failed To Start timer trips.
    engine_fail_start: bool = False


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
    # [SPEC OVERRIDES LITE] clamp interstage pressures to the final discharge.
    # Not present in compressor_lite_reference.py — prevents interstage
    # readings above final discharge during startup/blowdown.
    P_1 = min(P_s * r_stg, P_d)
    P_2 = min(P_1 * r_stg, P_d)

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
    rho_s = P_s / (p.R_sp * p.T_suc)

    m_sup = orifice(p.K_suc, (y[S['Z_suc']] / 100.) * (y[S['Z_sesd']] / 100.),
                    rho_src, p.P_src - P_s)
    m_byp = orifice(p.K_byp, y[S['Z_byp']] / 100., rho_d, P_d - P_s)
    m_proc = orifice(p.K_proc, (y[S['Z_desd']] / 100.) * (1 - flt.disch_blocked),
                     rho_d, P_d - p.P_proc)
    m_bdv = orifice(p.K_bdv, y[S['Z_bdv']] / 100., rho_s,
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
        if flt.engine_fail_start:
            N_ref = min(N_ref, 550.0)
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
    tau = p.tau_oil_slow if flt.lube_slow else p.tau_oil_p
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


def meas(y, cmd, p, flt=None):
    """Internal tag set — names here are private to physics.py. tags.py maps
    these to canonical PLC tag names; nothing else may reference them
    (APP_SPEC.md section 4)."""
    if flt is None:
        flt = Flt()
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

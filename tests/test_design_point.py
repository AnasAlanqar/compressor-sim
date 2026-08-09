"""
Design point acceptance test — APP_SPEC.md section 3.5.

This must pass before any other code (server, UI, OPC UA) is written.
APP_SPEC.md section 7: "physics.py with the design point test passing.
Nothing else until this works."
"""
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app import physics as ph

DT = 0.020          # 20 ms fixed step, per APP_SPEC.md section 2.2
SIM_SECONDS = 600.0


def run_to_design_point():
    p = ph.load_params(ph.DEFAULT_CONFIG)
    y = ph.init(p, pressurised=True)

    cmd = ph.Cmd(
        ao_speed=100.0,       # -> N_ref = N_max_load = 1000 rpm
        ao_byp=75.0,          # -> Z_byp target 0 (closed)
        ao_suc=45.0,          # suction valve 45%
        idle_rated=True,
        bdv_solenoid=True,    # energised = closed
        cat_start=True,
        cat_esd=False,
        driven_ready=True,
        sesd_solenoid=True,   # energised = open
        desd_solenoid=True,   # energised = open
        cooler_1=True,
        cooler_2=True,
    )
    flt = ph.Flt()

    n_steps = int(round(SIM_SECONDS / DT))
    last_a = None
    history = []
    for i in range(n_steps):
        y, last_a = ph.step(y, cmd, flt, p, DT)
        if i >= n_steps - int(50 / DT):
            history.append(y.copy())
    return y, last_a, p, cmd, flt, history


@pytest.fixture(scope='module')
def design_point():
    return run_to_design_point()


def test_suction_pressure(design_point):
    y, a, p, cmd, flt, hist = design_point
    assert ph.pa_to_psig(y[ph.S['P_s']]) == pytest.approx(29.8, abs=0.5)


def test_st1_discharge(design_point):
    y, a, p, cmd, flt, hist = design_point
    assert ph.pa_to_psig(a['P_1']) == pytest.approx(117.3, abs=2)


def test_st2_discharge(design_point):
    y, a, p, cmd, flt, hist = design_point
    assert ph.pa_to_psig(a['P_2']) == pytest.approx(377.2, abs=5)


def test_final_discharge(design_point):
    y, a, p, cmd, flt, hist = design_point
    assert ph.pa_to_psig(y[ph.S['P_d']]) == pytest.approx(1149.0, abs=10)


def test_stage_ratio(design_point):
    y, a, p, cmd, flt, hist = design_point
    assert a['r_stg'] == pytest.approx(2.97, abs=0.02)


def test_mass_flow(design_point):
    y, a, p, cmd, flt, hist = design_point
    assert a['m_comp'] == pytest.approx(0.945, abs=0.005)


def test_cyl1_discharge_temp(design_point):
    y, a, p, cmd, flt, hist = design_point
    assert ph.k_to_f(y[ph.L['T_d1']]) == pytest.approx(245.4, abs=2)


def test_cyl2_discharge_temp(design_point):
    y, a, p, cmd, flt, hist = design_point
    assert ph.k_to_f(y[ph.L['T_d2']]) == pytest.approx(251.7, abs=2)


def test_mass_balance_closure(design_point):
    """All mass flows must balance to under 1e-3 kg/s — the primary test."""
    y, a, p, cmd, flt, hist = design_point
    d, _ = ph.deriv(y, cmd, flt, p)
    assert abs(d[ph.S['P_s']]) < 1e-3 * (p.R_sp * p.T_suc / p.V_s) + 1e-6
    # direct flow balance
    P_s = max(y[ph.S['P_s']], ph.P_ATM)
    P_d = max(y[ph.S['P_d']], ph.P_ATM)
    rho_d = P_d / (p.R_sp * y[ph.L['T_ac']])
    rho_src = p.P_src / (p.R_sp * p.T_suc)
    rho_s = P_s / (p.R_sp * p.T_suc)
    m_sup = ph.orifice(p.K_suc, (y[ph.S['Z_suc']] / 100.) * (y[ph.S['Z_sesd']] / 100.),
                        rho_src, p.P_src - P_s)
    m_byp = ph.orifice(p.K_byp, y[ph.S['Z_byp']] / 100., rho_d, P_d - P_s)
    m_proc = ph.orifice(p.K_proc, (y[ph.S['Z_desd']] / 100.) * (1 - flt.disch_blocked),
                         rho_d, P_d - p.P_proc)
    m_bdv = ph.orifice(p.K_bdv, y[ph.S['Z_bdv']] / 100., rho_s, P_s - ph.P_ATM)

    suction_balance = m_sup + m_byp - a['m_comp'] - m_bdv
    discharge_balance = a['m_comp'] - m_proc - m_byp
    assert abs(suction_balance) < 1e-3
    assert abs(discharge_balance) < 1e-3


def test_supply_equals_delivery_at_steady_state(design_point):
    y, a, p, cmd, flt, hist = design_point
    P_s = max(y[ph.S['P_s']], ph.P_ATM)
    P_d = max(y[ph.S['P_d']], ph.P_ATM)
    rho_d = P_d / (p.R_sp * y[ph.L['T_ac']])
    rho_src = p.P_src / (p.R_sp * p.T_suc)
    m_sup = ph.orifice(p.K_suc, (y[ph.S['Z_suc']] / 100.) * (y[ph.S['Z_sesd']] / 100.),
                        rho_src, p.P_src - P_s)
    m_proc = ph.orifice(p.K_proc, (y[ph.S['Z_desd']] / 100.) * (1 - flt.disch_blocked),
                         rho_d, P_d - p.P_proc)
    assert abs(m_sup - m_proc) < 1e-3


def test_stage_ratios_equal(design_point):
    y, a, p, cmd, flt, hist = design_point
    P_s = max(y[ph.S['P_s']], ph.P_ATM)
    P_d = max(y[ph.S['P_d']], ph.P_ATM)
    r1 = a['P_1'] / P_s
    r2 = a['P_2'] / a['P_1']
    r3 = P_d / a['P_2']
    assert r1 == pytest.approx(r2, rel=1e-6)
    assert r2 == pytest.approx(r3, rel=1e-6)


def test_pressures_rise_monotonically(design_point):
    y, a, p, cmd, flt, hist = design_point
    P_s = max(y[ph.S['P_s']], ph.P_ATM)
    P_d = max(y[ph.S['P_d']], ph.P_ATM)
    assert P_s < a['P_1'] < a['P_2'] < P_d


def test_pressures_above_atmospheric(design_point):
    y, a, p, cmd, flt, hist = design_point
    assert y[ph.S['P_s']] >= ph.P_ATM
    assert y[ph.S['P_d']] >= ph.P_ATM
    assert a['P_1'] >= ph.P_ATM
    assert a['P_2'] >= ph.P_ATM


def test_gas_heated_never_cooled(design_point):
    y, a, p, cmd, flt, hist = design_point
    assert a['T_d1_t'] >= p.T_suc
    assert a['T_d2_t'] >= p.T_amb


def test_no_nan_or_inf(design_point):
    y, a, p, cmd, flt, hist = design_point
    assert np.all(np.isfinite(y))
    for v in a.values():
        assert np.all(np.isfinite(v))


def test_valve_positions_in_range(design_point):
    y, a, p, cmd, flt, hist = design_point
    for k in ['Z_byp', 'Z_suc', 'Z_sesd', 'Z_desd', 'Z_bdv']:
        assert 0.0 <= y[ph.S[k]] <= 100.0


def test_flows_non_negative(design_point):
    y, a, p, cmd, flt, hist = design_point
    P_s = max(y[ph.S['P_s']], ph.P_ATM)
    P_d = max(y[ph.S['P_d']], ph.P_ATM)
    rho_d = P_d / (p.R_sp * y[ph.L['T_ac']])
    rho_src = p.P_src / (p.R_sp * p.T_suc)
    rho_s = P_s / (p.R_sp * p.T_suc)
    m_sup = ph.orifice(p.K_suc, (y[ph.S['Z_suc']] / 100.) * (y[ph.S['Z_sesd']] / 100.),
                        rho_src, p.P_src - P_s)
    m_byp = ph.orifice(p.K_byp, y[ph.S['Z_byp']] / 100., rho_d, P_d - P_s)
    m_proc = ph.orifice(p.K_proc, (y[ph.S['Z_desd']] / 100.) * (1 - flt.disch_blocked),
                         rho_d, P_d - p.P_proc)
    m_bdv = ph.orifice(p.K_bdv, y[ph.S['Z_bdv']] / 100., rho_s, P_s - ph.P_ATM)
    assert m_sup >= 0 and m_byp >= 0 and m_proc >= 0 and m_bdv >= 0
    assert a['m_comp'] >= 0


def test_steady_state_drift_under_2psi(design_point):
    y, a, p, cmd, flt, hist = design_point
    psig = [ph.pa_to_psig(h[ph.S['P_d']]) for h in hist]
    assert max(psig) - min(psig) < 2.0

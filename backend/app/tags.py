"""
Canonical PLC tag map — the one naming boundary the UI and (later)
opcua_link.py may cross. APP_SPEC.md section 4.

Naming authority: tag names here (PT_1001, ZS_2003, CMD_4004, ...) are
canonical. physics.py's meas() dict uses internal names private to that
module — nothing outside physics.py may reference them; this module is the
only translator.

Clamping location: range clamping happens here, at the instrumentation
boundary, not in physics.py (section 4, "Clamping location"). physics.py
may internally exceed transmitter ranges; the outside world never sees
that — a blocked discharge drives the model past 2000 psig, the PLC must
see a saturated 2000, exactly as a real transmitter would.
"""
import dataclasses

import numpy as np
import yaml

from . import physics as ph


def _clamp(v, lo, hi):
    # float(...) matters: max(lo, min(hi, v)) returns whichever operand
    # "won" the comparison untouched, so a value that lands exactly on an
    # int-literal bound (e.g. clamping 0.0 against a range tuple like (0,
    # 60)) silently comes back as a Python int, not a float. Harmless over
    # JSON (the websocket path), but a hard failure over OPC UA — Double
    # nodes reject an int write with BadTypeMismatch, and this range hits
    # exactly the "everything's at zero/atmospheric" reset state.
    return float(max(lo, min(hi, v)))


def load_alarms(path) -> dict:
    """Section 4.5 display-only alarm/trip setpoints, psig/°F. Not a
    control tag map — used only to colour gauges and draw trend lines."""
    with open(path) as f:
        c = yaml.safe_load(f)
    return c.get('alarms', {})


def load_instrumentation_config(path) -> dict:
    with open(path) as f:
        c = yaml.safe_load(f)
    instr = c.get('instrumentation', {})
    return {
        'cyl_temp_offset_F': instr.get('cyl_temp_offset_F', [0.0, 0.0, 0.0, 0.0]),
        'status_feedback_tau_s': instr.get('status_feedback_tau_s', 1.0),
    }


def load_engine_extra_config(path) -> dict:
    with open(path) as f:
        c = yaml.safe_load(f)
    eng = c.get('engine', {})
    return {
        'jw_offset_F': eng.get('jw_offset_F', -15.0),
        'oil_run_psig': eng.get('oil_run_psig', 60.0),
    }


_INSTR_CFG = load_instrumentation_config(ph.DEFAULT_CONFIG)
_ENGINE_CFG = load_engine_extra_config(ph.DEFAULT_CONFIG)
# static per-cylinder calibration offset, keyed like the fault-driven
# temp_bias dict below so both merge through the same code path.
_CYL_CAL_OFFSET_F = dict(zip(['cyl1', 'cyl2', 'cyl3', 'cyl4'], _INSTR_CFG['cyl_temp_offset_F']))


# ---- 4.1 Analog inputs to PLC — app writes these ---------------------------
# tag -> (meas() key, range)
_AI_MAP = {
    'PT_1001': ('PT_1001_suction_psig', (0, 60)),
    'PT_1002': ('PT_1002_st1_disch_psig', (0, 300)),
    'PT_1003': ('PT_1003_st2_disch_psig', (0, 1000)),
    'PT_1004': ('PT_1004_st3_disch_psig', (0, 2000)),
    'PT_1005': ('PT_1005_oil_psig', (0, 200)),
    'PT_1006': ('PT_1006_final_psig', (0, 2000)),
    'ST_1008': ('ST_1008_speed_rpm', (0, 2000)),
    'TT_2001': ('TT_2001_oil_F', (0, 500)),
    'TT_2004': ('TT_2004_cyl1_F', (0, 500)),
    'TT_2005': ('TT_2005_cyl2_F', (0, 500)),
    'TT_2006': ('TT_2006_cyl3_F', (0, 500)),
    'TT_2007': ('TT_2007_cyl4_F', (0, 500)),
    'TT_2013': ('TT_2013_aftercooler_F', (0, 500)),
    'TT_2009': ('TT_2009_packing_F', (0, 500)),
    'TT_2010': ('TT_2009_packing_F', (0, 500)),
    'TT_2011': ('TT_2009_packing_F', (0, 500)),
    'TT_2012': ('TT_2009_packing_F', (0, 500)),
}

# ---- 4.2 Discrete inputs to PLC — app writes these -------------------------
_DI_MAP = {
    'ZS_2001': 'ZS_bdv_closed',
    'ZS_2002': 'ZS_bdv_open',
    'ZS_2003': 'ZS_byp_open',
    'ZS_2004': 'ZS_byp_closed',
    'ZS_2005': 'ZS_sesd_open',
    'ZS_2006': 'ZS_sesd_closed',
    'ZS_2007': 'ZS_desd_open',
    'ZS_2008': 'ZS_desd_closed',
}

# ---- 4.3 Analog outputs from PLC — app reads these -------------------------
_AO_MAP = {
    'SC_3001': 'ao_speed',
    'FC_3002': 'ao_byp',
    'FC_3003': 'ao_suc',
}

# ---- 4.4 Discrete outputs from PLC — app reads these -----------------------
# direct pass-through; CMD_4006 is handled separately (inverted, see below)
_DO_MAP = {
    'CMD_4001': 'aux_lube',
    'CMD_4003': 'idle_rated',
    'CMD_4004': 'bdv_solenoid',
    'CMD_4005': 'cat_start',
    'CMD_4008': 'driven_ready',
    'CMD_4009': 'sesd_solenoid',
    'CMD_4010': 'desd_solenoid',
    'CMD_4011': 'cooler_1',
    'CMD_4012': 'cooler_2',
}


# ---- Tier 1 missing I/O: operator pushbuttons and engine-ECU status -------
# Not in PN17481_IO_List_5.xls as summarised in APP_SPEC.md section 4 (which
# only covers the compressor-skid signals) — these are the panel-mounted
# operator controls and the CAT ADEM controller's own status outputs. Both
# are discrete inputs TO the PLC (app writes, section 4.2's direction
# convention), and neither is control logic: the app has none (section 1),
# it only relays whatever the operator/test bench sets. They stay live
# regardless of OPC UA connection state — real pushbuttons and a real ECU's
# status relays are wired directly into the PLC's I/O, never overridden by
# an upstream OPC UA command the way SC_3001/FC_3002/etc. are.
@dataclasses.dataclass
class HmiInputs:
    usd_pb: bool = False       # PB_5001, unit shutdown pushbutton, momentary
    remote_esd: bool = False   # ESD_5002, maintained signal from a remote system
    stop_local: bool = False   # PB_5003, local stop pushbutton, momentary
    stop_remote: bool = False  # PB_5004, remote stop pushbutton, momentary
    cat_alarm: bool = False    # XA_6002, CAT ADEM engine alarm output
    cat_shutdown: bool = False  # XS_6003, CAT ADEM engine failure shutdown output


_HMI_MAP = {
    'PB_5001': 'usd_pb',
    'ESD_5002': 'remote_esd',
    'PB_5003': 'stop_local',
    'PB_5004': 'stop_remote',
    'XA_6002': 'cat_alarm',
    'XS_6003': 'cat_shutdown',
}


def hmi_fields_from_tags(tags: dict) -> dict:
    return {field_name: bool(tags[tag]) for tag, field_name in _HMI_MAP.items() if tag in tags}


def hmi_to_tags(hmi: HmiInputs) -> dict:
    return {tag: getattr(hmi, field_name) for tag, field_name in _HMI_MAP.items()}


# ---- Tier 2 discrete fault inputs, driven from the fault panel ------------
# Simple "true while armed" level/vibration/pressure switches — no dynamics,
# section 5's pattern for cooler_trip/valve_stuck-style faults, just more of
# them. Numbers invented (not in the source I/O list) but follow the same
# ISA-style prefixes already used elsewhere in the tag map.
_SCRUBBER_TAGS = {1: 'LSH_7001', 2: 'LSH_7002', 3: 'LSH_7003', 4: 'LSH_7004'}
_VIBRATION_TAGS = {1: 'VSH_7011', 2: 'VSH_7012', 3: 'VSH_7013'}
_LEVEL_TAGS = {1: 'LSL_7021', 2: 'LSL_7022', 3: 'LSL_7023'}
_LUBRICATOR_TAGS = {1: 'FSL_7041', 2: 'FSL_7042'}


def tier2_fault_tags(flt) -> dict:
    out = {}
    for n, tag in _SCRUBBER_TAGS.items():
        out[tag] = n in (getattr(flt, 'scrubber_level_hi', None) or ())
    for n, tag in _VIBRATION_TAGS.items():
        out[tag] = n in (getattr(flt, 'vibration_trip', None) or ())
    for n, tag in _LEVEL_TAGS.items():
        out[tag] = n in (getattr(flt, 'oil_jw_level_lo', None) or ())
    for n, tag in _LUBRICATOR_TAGS.items():
        out[tag] = n in (getattr(flt, 'lubricator_no_flow', None) or ())
    out['PSL_7031'] = bool(getattr(flt, 'fuel_gas_press_lo', False))
    return out


def engine_extra_tags(y, p) -> dict:
    """Engine JW temp and engine oil pressure — Tier 1 I/O with no
    dedicated integrator state (section 3 tracks T_eoil, engine oil
    TEMPERATURE, and P_oil is the compressor's own PT_1005, a separate
    lube circuit). Both derived algebraically from those existing dynamic
    states rather than adding new ones, so they inherit realistic startup/
    shutdown lag for free without touching the validated 14-state
    integrator."""
    jw_F = ph.k_to_f(y[ph.S['T_eoil']]) + _ENGINE_CFG['jw_offset_F']
    oil_frac = y[ph.S['P_oil']] / max(p.P_oil_run, 1.0)
    eng_oil_psig = oil_frac * _ENGINE_CFG['oil_run_psig']
    return {
        'TT_2014': round(_clamp(jw_F, 0, 300), 3),
        'PT_1007': round(_clamp(eng_oil_psig, 0, 150), 3),
    }


_CYL_BIAS_TAG = {'cyl1': 'TT_2004', 'cyl2': 'TT_2005', 'cyl3': 'TT_2006', 'cyl4': 'TT_2007'}


def analog_inputs(y, cmd, p, flt) -> dict:
    m = ph.meas(y, cmd, p, flt)
    # Two additive offsets merge here before clamping: a static per-
    # cylinder calibration constant (config.yaml instrumentation.
    # cyl_temp_offset_F — the lite model's 2 discharge-temp lag states
    # cover 3 stages, so without this TT_2006/2007 read identical to
    # TT_2005) and the section 5 temp_bias fault on top of it.
    bias = {tag: 0.0 for tag in _AI_MAP}
    for cyl, offset in _CYL_CAL_OFFSET_F.items():
        tag = _CYL_BIAS_TAG.get(cyl)
        if tag:
            bias[tag] += offset
    for cyl, offset in (getattr(flt, 'temp_bias', None) or {}).items():
        tag = _CYL_BIAS_TAG.get(cyl)
        if tag:
            bias[tag] += offset
    return {tag: round(_clamp(float(m[key]) + bias[tag], lo, hi), 3)
            for tag, (key, (lo, hi)) in _AI_MAP.items()}


def effective_cmd(cmd, flt):
    """Command-interpretation-layer fault (section 5): a tripped cooler
    motor drops its run status even though the PLC still commands it. Used
    wherever cmd feeds physics or measurement, never mutates the stored
    cmd — the PLC's own command tags must read back unchanged."""
    trip = getattr(flt, 'cooler_trip', None)
    if not trip:
        return cmd
    changes = {}
    if 1 in trip:
        changes['cooler_1'] = False
    if 2 in trip:
        changes['cooler_2'] = False
    return dataclasses.replace(cmd, **changes) if changes else cmd


def discrete_inputs(y, cmd, p, flt, ai: dict) -> dict:
    """ai is the already-clamped analog_inputs() dict — PS_2009/ST_2010
    read off it rather than raw state, matching what a real transmitter
    chain would present."""
    m = ph.meas(y, cmd, p, flt)
    out = {tag: bool(m[key]) for tag, key in _DI_MAP.items()}
    out['PS_2009'] = ai['PT_1005'] > 10.0
    out['ST_2010'] = ai['ST_1008'] > 300.0
    return out


def heartbeat(sim_time: float) -> int:
    """WD_6001 — increments every 500 ms, rolls at 32767 (section 4.7)."""
    return int(sim_time / 0.5) % 32768


def state_to_tags(y, cmd, p, flt, sim_time: float) -> dict:
    ai = analog_inputs(y, cmd, p, flt)
    di = discrete_inputs(y, cmd, p, flt, ai)
    return {**ai, **di, 'WD_6001': heartbeat(sim_time)}


def valve_positions(y) -> dict:
    """Continuous valve position, 0-100% — for the P&ID and trends only
    (section 6.2/6.3). Not a control tag: the real I/O list only has
    open/closed limit switches for the ESD/bypass/blowdown valves (section
    4.2), no continuous position transmitter, so this never crosses the
    OPC UA boundary."""
    return {
        'Z_byp': float(y[ph.S['Z_byp']]),
        'Z_suc': float(y[ph.S['Z_suc']]),
        'Z_sesd': float(y[ph.S['Z_sesd']]),
        'Z_desd': float(y[ph.S['Z_desd']]),
        'Z_bdv': float(y[ph.S['Z_bdv']]),
    }


def flow_diagnostics(y, cmd, p, flt) -> dict:
    """Mass flows, kg/s — for P&ID flow-arrow animation only. Not a PLC tag
    (section 4's tag map has no flow meters); recomputed independently here
    with physics.py's own orifice() so this stays read-only and never
    influences the integrator."""
    a = ph.algebra(y, cmd, p)
    P_s = max(y[ph.S['P_s']], ph.P_ATM)
    P_d = max(y[ph.S['P_d']], ph.P_ATM)
    rho_d = P_d / (p.R_sp * y[ph.L['T_ac']])
    rho_src = p.P_src / (p.R_sp * p.T_suc)
    rho_s = P_s / (p.R_sp * p.T_suc)
    return {
        'm_sup': ph.orifice(p.K_suc, (y[ph.S['Z_suc']] / 100.) * (y[ph.S['Z_sesd']] / 100.),
                             rho_src, p.P_src - P_s),
        'm_byp': ph.orifice(p.K_byp, y[ph.S['Z_byp']] / 100., rho_d, P_d - P_s),
        'm_proc': ph.orifice(p.K_proc, (y[ph.S['Z_desd']] / 100.) * (1 - flt.disch_blocked),
                              rho_d, P_d - p.P_proc),
        'm_bdv': ph.orifice(p.K_bdv, y[ph.S['Z_bdv']] / 100., rho_s, P_s - ph.P_ATM),
        'm_comp': a['m_comp'],
    }


def sim_insight_tags(cmd, p) -> dict:
    """Model-internal temperatures with no corresponding transmitter on the
    real unit — PN17481_IO_List_5.xls has no TTs between stages, only
    TT_2004/2005/2006/2007 at the cylinders and TT_2013 at the aftercooler.
    T_suc and T_inter exist only as physics.py inputs (boundary condition /
    fan-count lookup); exposed here, separately from the canonical tag map,
    so the UI can show them as simulator insight without implying the PLC
    can see them."""
    n_fans = int(cmd.cooler_1) + int(cmd.cooler_2)
    return {
        'T_suc_F': ph.k_to_f(p.T_suc),
        'T_inter_F': ph.k_to_f(p.T_inter_fans[n_fans]),
    }


def cmd_to_tags(cmd) -> dict:
    """Reverse of cmd_fields_from_tags — the current Cmd as canonical
    tags, for the UI's read-only indicators once OPC UA is driving
    (section 6.4) and for P&ID animation (cooler run status, section 6.2).
    Callers pass tags.effective_cmd()'s result to fold in command-
    interpretation faults such as cooler trip."""
    out = {tag: getattr(cmd, field_name) for tag, field_name in _AO_MAP.items()}
    out.update({tag: getattr(cmd, field_name) for tag, field_name in _DO_MAP.items()})
    out['CMD_4006'] = not cmd.cat_esd
    return out


def cmd_fields_from_tags(tags: dict) -> dict:
    """Translate a (possibly partial) canonical tag dict into physics.Cmd
    field updates. Unknown tags (Remote Status relay, Panel Air Cooler,
    etc.) are accepted and ignored, never errored on — section 4.4."""
    fields = {}
    for tag, field_name in _AO_MAP.items():
        if tag in tags:
            fields[field_name] = float(tags[tag])
    for tag, field_name in _DO_MAP.items():
        if tag in tags:
            fields[field_name] = bool(tags[tag])
    if 'CMD_4006' in tags:
        # energised = healthy; cat_esd is the trip flag, so it's inverted.
        fields['cat_esd'] = not bool(tags['CMD_4006'])
    return fields


_ANALOG_RANGES = {tag: rng for tag, (_, rng) in _AI_MAP.items()}


class Instrumentation:
    """Presentation-layer effects at the instrumentation boundary, applied
    to the already-clamped analog_inputs() dict. Two purposes:

    - section 5 signal freeze/invalid faults (per canonical AI tag)
    - section 7 build-order step 8: optional per-signal first-order lag
      (0.3-2 s) and Gaussian noise, off by default, toggled from the UI

    Stateful (freeze needs to remember the value at the moment the fault
    was armed; lag needs the previous sample) so it lives on SimState, one
    instance per running simulation, not as a pure function.
    """

    def __init__(self):
        self.lag_enabled = False
        self.noise_enabled = False
        self._frozen: dict = {}
        self._lag: dict = {}
        self._status: dict = {}

    @staticmethod
    def _tau(tag: str) -> float:
        # deterministic per-tag spread across the spec's 0.3-2s band, so
        # "per-signal" lag doesn't mean one shared time constant.
        return 0.3 + (hash(tag) % 1000) / 1000.0 * 1.7

    def apply(self, ai: dict, flt, dt: float) -> dict:
        freeze = getattr(flt, 'signal_freeze', None) or ()
        invalid = getattr(flt, 'signal_invalid', None) or ()
        out = {}
        for tag, v in ai.items():
            if tag in freeze:
                v = self._frozen.setdefault(tag, v)
            else:
                self._frozen.pop(tag, None)
            if tag in _ANALOG_RANGES:
                if self.lag_enabled:
                    prev = self._lag.get(tag, v)
                    alpha = dt / (self._tau(tag) + dt)
                    v = prev + alpha * (v - prev)
                self._lag[tag] = v
                if self.noise_enabled:
                    lo, hi = _ANALOG_RANGES[tag]
                    v = v + np.random.normal(0.0, (hi - lo) * 0.002)
                if tag in invalid:
                    lo, hi = _ANALOG_RANGES[tag]
                    v = hi + max(1.0, (hi - lo) * 0.1)
            out[tag] = round(float(v), 3)
        return out

    def status_feedback(self, tag: str, cmd_on: bool, dt: float, tau: float) -> bool:
        """Tier 1 cooler run status feedback (RS_4011/4012): a first-order
        lag on the commanded state, standing in for contactor pickup/
        dropout time, so the feedback doesn't snap instantly with the
        command. Callers pass the fault-aware effective command (section
        5's cooler_trip already forces it off), so a tripped motor's
        feedback lags down to off exactly like the fans it's reporting on.
        """
        prev = self._status.get(tag, 1.0 if cmd_on else 0.0)
        target = 1.0 if cmd_on else 0.0
        alpha = dt / (tau + dt)
        v = prev + alpha * (target - prev)
        self._status[tag] = v
        return v > 0.5

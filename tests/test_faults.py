"""
Fault injection tests — APP_SPEC.md section 5, build order step 7.

Covers the fields faults.Flt adds on top of physics.Flt's subset
(lube_low/lube_slow/mag_pickup/overspeed_offset/disch_blocked/valve_stuck
are already exercised implicitly by compressor_lite parity elsewhere) and
the layers each is implemented at per section 5's implementation note.
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app import faults as flts
from backend.app import physics as ph
from backend.app import tags as tg

DT = 0.020


def run(cmd, flt, p=None, seconds=10.0, pressurised=True):
    p = p or ph.load_params(ph.DEFAULT_CONFIG)
    y = ph.init(p, pressurised=pressurised)
    for _ in range(int(seconds / DT)):
        y, a = ph.step(y, cmd, flt, p, DT)
    return y, a, p


RUNNING_CMD = dict(
    ao_speed=100.0, ao_byp=75.0, ao_suc=45.0, idle_rated=True,
    bdv_solenoid=True, cat_start=True, cat_esd=False, driven_ready=True,
    sesd_solenoid=True, desd_solenoid=True, cooler_1=True, cooler_2=True,
)


def test_engine_fail_start_caps_speed_at_550():
    cmd = ph.Cmd(**RUNNING_CMD)
    flt = flts.Flt(engine_fail_start=True)
    y, a, p = run(cmd, flt, seconds=60.0)
    assert y[ph.S['N']] == pytest.approx(550.0, abs=1.0)


def test_engine_fail_start_off_reaches_idle():
    cmd = ph.Cmd(**{**RUNNING_CMD, 'idle_rated': False})
    flt = flts.Flt()
    y, a, p = run(cmd, flt, seconds=60.0)
    assert y[ph.S['N']] == pytest.approx(650.0, abs=1.0)


def test_cooler_trip_reduces_effective_fans():
    cmd = ph.Cmd(**RUNNING_CMD)
    flt = flts.Flt(cooler_trip={1, 2})
    eff = tg.effective_cmd(cmd, flt)
    assert eff.cooler_1 is False and eff.cooler_2 is False
    # the stored command is untouched — the PLC's own tag reads back unchanged
    assert cmd.cooler_1 is True and cmd.cooler_2 is True


def test_cooler_trip_partial():
    cmd = ph.Cmd(**RUNNING_CMD)
    flt = flts.Flt(cooler_trip={1})
    eff = tg.effective_cmd(cmd, flt)
    assert eff.cooler_1 is False
    assert eff.cooler_2 is True


def test_cylinder_temp_bias_applied_and_clamped():
    p = ph.load_params(ph.DEFAULT_CONFIG)
    y, a, p = run(ph.Cmd(**RUNNING_CMD), flts.Flt(), p=p, seconds=120.0)
    baseline = tg.analog_inputs(y, ph.Cmd(**RUNNING_CMD), p, flts.Flt())['TT_2004']

    biased_flt = flts.Flt(temp_bias={'cyl1': 40.0})
    biased = tg.analog_inputs(y, ph.Cmd(**RUNNING_CMD), p, biased_flt)['TT_2004']
    assert biased == pytest.approx(baseline + 40.0, abs=0.01)

    pinned_flt = flts.Flt(temp_bias={'cyl1': 10_000.0})
    pinned = tg.analog_inputs(y, ph.Cmd(**RUNNING_CMD), p, pinned_flt)['TT_2004']
    assert pinned == 500.0  # clamped to the transmitter's range, section 4.1


def test_signal_freeze_holds_last_value():
    p = ph.load_params(ph.DEFAULT_CONFIG)
    y = ph.init(p, pressurised=True)
    cmd = ph.Cmd(**RUNNING_CMD)
    flt = flts.Flt(signal_freeze={'PT_1001'})
    instr = tg.Instrumentation()

    ai1 = instr.apply(tg.analog_inputs(y, cmd, p, flt), flt, DT)
    frozen_value = ai1['PT_1001']

    for _ in range(200):
        y, _ = ph.step(y, cmd, flt, p, DT)
    ai2 = instr.apply(tg.analog_inputs(y, cmd, p, flt), flt, DT)
    assert ai2['PT_1001'] == frozen_value

    flt.signal_freeze = set()
    ai3 = instr.apply(tg.analog_inputs(y, cmd, p, flt), flt, DT)
    assert ai3['PT_1001'] != frozen_value


def test_signal_invalid_drives_out_of_range():
    p = ph.load_params(ph.DEFAULT_CONFIG)
    y = ph.init(p, pressurised=True)
    cmd = ph.Cmd(**RUNNING_CMD)
    flt = flts.Flt(signal_invalid={'PT_1001'})
    instr = tg.Instrumentation()
    ai = instr.apply(tg.analog_inputs(y, cmd, p, flt), flt, DT)
    assert ai['PT_1001'] > 60.0  # PT_1001's transmitter range is 0-60 psig


def test_instrumentation_off_by_default_is_a_passthrough():
    p = ph.load_params(ph.DEFAULT_CONFIG)
    y = ph.init(p, pressurised=True)
    cmd = ph.Cmd(**RUNNING_CMD)
    flt = flts.Flt()
    instr = tg.Instrumentation()
    raw = tg.analog_inputs(y, cmd, p, flt)
    out = instr.apply(raw, flt, DT)
    assert out == raw


def test_faults_flt_extends_physics_flt_fields():
    physics_fields = set(ph.Flt().__dataclass_fields__)
    fault_fields = set(flts.Flt().__dataclass_fields__)
    assert physics_fields <= fault_fields


def test_clear_resets_every_field():
    flt = flts.Flt(
        lube_low=True, engine_fail_start=True, temp_bias={'cyl1': 5.0},
        signal_freeze={'PT_1001'}, cooler_trip={1}, link_drop=True,
    )
    flt.clear()
    assert flt == flts.Flt()

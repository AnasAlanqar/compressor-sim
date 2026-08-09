"""
tags.py regression tests — a bug found while first driving opcua_link.py
against tools/mock_plc.py.

`_clamp(v, lo, hi) = max(lo, min(hi, v))` returns whichever operand won
the comparison untouched. When the range tuple in _AI_MAP is written with
int literals (e.g. `(0, 60)`) and the clamped value lands exactly on that
bound — which is exactly what happens at the "everything's at zero" blown
down reset state — the result comes back as a Python `int`, not `float`.
That's silently harmless over JSON (the websocket path the UI uses,
concealing the bug for months of otherwise-working development) but a
hard BadTypeMismatch over OPC UA, whose Double nodes reject an int write.
Fixed by having _clamp always return float(...).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app import faults as flts
from backend.app import physics as ph
from backend.app import tags as tg


def test_clamp_always_returns_float():
    assert isinstance(tg._clamp(0.0, 0, 60), float)
    assert isinstance(tg._clamp(5.0, 0, 60), float)
    assert isinstance(tg._clamp(100.0, 0, 60), float)  # clamped to hi=60 too
    assert isinstance(tg._clamp(-5.0, 0, 60), float)   # clamped to lo=0


def test_analog_inputs_are_all_float_at_the_zeroed_reset_state():
    p = ph.load_params(ph.DEFAULT_CONFIG)
    y = ph.init(p, pressurised=False)  # blown down: pressures at atmospheric -> 0 psig
    ai = tg.analog_inputs(y, ph.Cmd(), p, flts.Flt())
    for tag, value in ai.items():
        assert isinstance(value, float), f"{tag} = {value!r} ({type(value).__name__}), want float"


def test_engine_extra_tags_are_float_at_the_zeroed_reset_state():
    p = ph.load_params(ph.DEFAULT_CONFIG)
    y = ph.init(p, pressurised=False)
    extra = tg.engine_extra_tags(y, p)
    for tag, value in extra.items():
        assert isinstance(value, float), f"{tag} = {value!r} ({type(value).__name__}), want float"

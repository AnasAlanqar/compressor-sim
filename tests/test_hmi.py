"""
Tier 1 HMI operator/ECU input tests — APP_SPEC.md section 4.8.

Confirms the point raised in review: USD pushbutton (PB_5001) and remote
ESD (ESD_5002) are independent inputs, not one signal under two names. The
REMVue Operating Philosophy gives them different PLC behaviour — ESD opens
the blowdown valve and skips postlube, USD does not — and the app has no
control logic to enforce that distinction itself (section 1), so the PLC
under test needs to see two independently-settable tags to exercise both
paths. These tests are the "testable" half of that: proving the app's tag
layer keeps them separate. The PLC-side behavioural difference itself is
out of scope here, same as every other alarm/permissive decision (section
1's "the app produces a temperature of 280F; deciding it's an alarm is the
PLC's job").
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app import tags as tg


def test_usd_and_remote_esd_are_distinct_fields():
    hmi = tg.HmiInputs()
    assert hasattr(hmi, 'usd_pb')
    assert hasattr(hmi, 'remote_esd')
    # not aliases of the same underlying attribute
    hmi.usd_pb = True
    assert hmi.remote_esd is False
    hmi.usd_pb = False
    hmi.remote_esd = True
    assert hmi.usd_pb is False


def test_usd_and_remote_esd_map_to_distinct_tags():
    assert tg._HMI_MAP['PB_5001'] == 'usd_pb'
    assert tg._HMI_MAP['ESD_5002'] == 'remote_esd'
    assert 'PB_5001' != 'ESD_5002'


def test_setting_usd_via_tags_leaves_remote_esd_unset():
    hmi = tg.HmiInputs()
    for k, v in tg.hmi_fields_from_tags({'PB_5001': True}).items():
        setattr(hmi, k, v)
    out = tg.hmi_to_tags(hmi)
    assert out['PB_5001'] is True
    assert out['ESD_5002'] is False


def test_setting_remote_esd_via_tags_leaves_usd_unset():
    hmi = tg.HmiInputs()
    for k, v in tg.hmi_fields_from_tags({'ESD_5002': True}).items():
        setattr(hmi, k, v)
    out = tg.hmi_to_tags(hmi)
    assert out['ESD_5002'] is True
    assert out['PB_5001'] is False


def test_both_can_be_set_independently_and_simultaneously():
    hmi = tg.HmiInputs()
    fields = tg.hmi_fields_from_tags({'PB_5001': True, 'ESD_5002': True})
    for k, v in fields.items():
        setattr(hmi, k, v)
    out = tg.hmi_to_tags(hmi)
    assert out['PB_5001'] is True
    assert out['ESD_5002'] is True


def test_stop_local_and_stop_remote_are_also_distinct():
    hmi = tg.HmiInputs()
    fields = tg.hmi_fields_from_tags({'PB_5003': True})
    for k, v in fields.items():
        setattr(hmi, k, v)
    out = tg.hmi_to_tags(hmi)
    assert out['PB_5003'] is True
    assert out['PB_5004'] is False


def test_hmi_tags_land_in_the_broadcast_state_message():
    # section 4.8 lists these as discrete inputs the app writes — confirm
    # they actually cross into the tag map's output shape, not just live
    # on the dataclass.
    hmi = tg.HmiInputs(remote_esd=True, usd_pb=False)
    out = tg.hmi_to_tags(hmi)
    assert set(out.keys()) == {'PB_5001', 'ESD_5002', 'PB_5003', 'PB_5004', 'XA_6002', 'XS_6003'}

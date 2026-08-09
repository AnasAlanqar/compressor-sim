"""
SimState._cmd_lock_until regression test — found live, killing
tools/mock_plc.py mid-connection.

opcua_link.disconnect() resets state.cmd to fail-safe defaults, but a
stray command write was observed landing ~250ms *after* that reset,
silently undoing it (the unit kept running at full commanded speed for
30+ seconds with the OPC UA status already showing disconnected). The
exact source was never fully pinned down — asyncua 2.0.1's client kept
individual read/write calls "succeeding" with stale cached data for 10+
seconds after the peer died in a way that didn't reliably unwind via
task.cancel() either, and something downstream of that appears to survive
disconnect() completing. A short post-disconnect rejection window on
apply_cmd() closes the race regardless of its exact source, without
permanently blocking the operator from taking manual control back
afterward (section 6.4).
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app import opcua_link
from backend.app import physics as ph
from backend.app.server import SimState


def test_apply_cmd_rejected_during_lock_window():
    state = SimState()
    state.apply_cmd({'ao_speed': 10.0})
    assert state.cmd.ao_speed == 10.0  # sanity: normally applies

    state._cmd_lock_until = time.monotonic() + 5.0
    state.apply_cmd({'ao_speed': 99.0})
    assert state.cmd.ao_speed == 10.0, "write during the lock window must be rejected"


def test_apply_cmd_resumes_after_lock_window_expires():
    state = SimState()
    state._cmd_lock_until = time.monotonic() - 0.001  # already expired
    state.apply_cmd({'ao_speed': 55.0})
    assert state.cmd.ao_speed == 55.0


def test_apply_cmd_rejects_stale_generation_regardless_of_lock_window():
    """The generation guard is the real fix (see SimState._generation's
    docstring) — it must reject a stale write even once the old time-based
    lock window has long since expired, unlike the timing-only defence
    this replaces."""
    state = SimState()
    state.apply_cmd({'ao_speed': 10.0}, generation=state._generation)
    assert state.cmd.ao_speed == 10.0  # sanity: matching generation applies

    stale_generation = state._generation
    state._generation += 1  # a new connection superseded this one
    state._cmd_lock_until = time.monotonic() - 30.0  # old window expired ages ago
    state.apply_cmd({'ao_speed': 99.0}, generation=stale_generation)
    assert state.cmd.ao_speed == 10.0, "a write tagged with a superseded generation must be rejected"

    # a write tagged with the *current* generation still applies
    state.apply_cmd({'ao_speed': 55.0}, generation=state._generation)
    assert state.cmd.ao_speed == 55.0


def test_apply_cmd_with_no_generation_is_never_generation_gated():
    """Manual/UI writes (ws_endpoint) pass no generation — only OPC UA
    writes are subject to the connection generation guard."""
    state = SimState()
    state._generation = 7
    state.apply_cmd({'ao_speed': 33.0})  # no generation kwarg, as ws_endpoint calls it
    assert state.cmd.ao_speed == 33.0


def test_disconnect_bumps_generation_and_rejects_a_stale_opcua_write_after_the_old_lock_window():
    """Regression for the race that motivated the generation guard: a
    stray OPC UA write from the just-superseded connection landing well
    after CMD_LOCK_GRACE_S has already expired (unlike the ~250ms observed
    live) — the old time-window-only defence would let it through, this
    must not."""
    import asyncio

    state = SimState()
    state.cmd.ao_speed = 42.0
    link = opcua_link.OpcuaLink(state, endpoint="opc.tcp://example:4840",
                                 namespace_uri="urn:test", browse_path_prefix=[])
    link.generation = state._generation  # as connect() would have set it
    asyncio.run(link.disconnect())
    assert state.cmd == ph.Cmd()

    # simulate the old lock window having long since expired (well past
    # what CMD_LOCK_GRACE_S would have covered)
    state._cmd_lock_until = time.monotonic() - 30.0
    state.apply_cmd({'ao_speed': 77.0}, generation=link.generation)
    assert state.cmd.ao_speed == 0.0, "stale write must be rejected by generation, not by the timer"


def test_disconnect_sets_the_lock_window():
    import asyncio

    state = SimState()
    state.cmd.ao_speed = 42.0
    link = opcua_link.OpcuaLink(state, endpoint="opc.tcp://example:4840",
                                 namespace_uri="urn:test", browse_path_prefix=[])
    before = time.monotonic()
    asyncio.run(link.disconnect())
    assert state.cmd == ph.Cmd()
    assert state._cmd_lock_until > before  # a grace window was armed

    # and it actually blocks a write attempted immediately after
    state.apply_cmd({'ao_speed': 77.0})
    assert state.cmd.ao_speed == 0.0  # ph.Cmd()'s default, not 77.0

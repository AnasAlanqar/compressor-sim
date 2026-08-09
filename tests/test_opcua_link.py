"""
opcua_link.py tag-translation tests — build order step 6.

No live CODESYS server in this environment, so these check the parts that
don't require a network connection: the read/write tag sets match the
canonical tag map exactly (section 4.1-4.4, plus section 4.8's extended
tags), and status() reports sensibly before any connection is attempted.
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from asyncua import ua

from backend.app import opcua_link, physics as ph, tags as tg


def test_write_tags_cover_all_analog_and_discrete_inputs():
    expected = (
        set(tg._AI_MAP) | set(tg._DI_MAP) | {'PS_2009', 'ST_2010', 'WD_6001'}
        | set(tg._HMI_MAP) | {'RS_4011', 'RS_4012', 'TT_2014', 'PT_1007'}
        | set(tg._SCRUBBER_TAGS.values()) | set(tg._VIBRATION_TAGS.values())
        | set(tg._LEVEL_TAGS.values()) | set(tg._LUBRICATOR_TAGS.values())
        | {'PSL_7031'}
    )
    assert set(opcua_link.WRITE_TAGS) == expected


def test_write_tags_cover_section_4_8_extended_tags():
    section_4_8 = {
        'PB_5001', 'ESD_5002', 'PB_5003', 'PB_5004', 'XA_6002', 'XS_6003',
        'RS_4011', 'RS_4012', 'TT_2014', 'PT_1007',
        'LSH_7001', 'LSH_7002', 'LSH_7003', 'LSH_7004',
        'VSH_7011', 'VSH_7012', 'VSH_7013',
        'LSL_7021', 'LSL_7022', 'LSL_7023',
        'PSL_7031', 'FSL_7041', 'FSL_7042',
    }
    assert section_4_8 <= set(opcua_link.WRITE_TAGS)


def test_read_tags_cover_all_plc_outputs():
    expected = set(tg._AO_MAP) | set(tg._DO_MAP) | {'CMD_4006'}
    assert set(opcua_link.READ_TAGS) == expected


def test_read_write_tags_disjoint():
    # a tag is either something the PLC commands or something the app
    # measures, never both (section 4's direction is stated from the
    # PLC's point of view and each tag has exactly one direction).
    assert set(opcua_link.READ_TAGS).isdisjoint(opcua_link.WRITE_TAGS)


def test_status_before_connect():
    class FakeState:
        pass

    link = opcua_link.OpcuaLink(FakeState(), endpoint="opc.tcp://example:4840",
                                 namespace_uri="urn:test", browse_path_prefix=[])
    st = link.status()
    assert st['connected'] is False
    assert st['endpoint'] is None


def test_disconnect_without_connect_is_safe_and_resets_cmd():
    import asyncio

    class FakeState:
        def __init__(self):
            self.cmd = ph.Cmd(ao_speed=42.0)
            self._generation = 0

    state = FakeState()
    link = opcua_link.OpcuaLink(state, endpoint="opc.tcp://example:4840",
                                 namespace_uri="urn:test", browse_path_prefix=[])
    asyncio.run(link.disconnect())
    assert state.cmd == ph.Cmd()  # fail-safe defaults, section 4.3/4.4


def test_disconnect_resets_cmd_even_when_called_from_its_own_task():
    """Regression: found live against tools/mock_plc.py. _loop() calls
    self.disconnect() on itself when a read/write cycle fails — at that
    point self._task *is* the running task. The old code called
    self._task.cancel() before resetting state.cmd; cancelling your own
    task doesn't raise immediately, it schedules a CancelledError at the
    next await point, which was `await self.client.disconnect()` a few
    lines later — aborting disconnect() before the fail-safe Cmd() reset
    ever ran. The OPC UA status correctly went to disconnected, but the
    unit kept running on the last commands it had. Fixed by resetting
    state.cmd synchronously, before any cancellation or await."""
    import asyncio

    class FakeState:
        def __init__(self):
            self.cmd = ph.Cmd(ao_speed=42.0)
            self._generation = 0

    class FakeClient:
        async def disconnect(self):
            pass

    async def scenario():
        state = FakeState()
        link = opcua_link.OpcuaLink(state, endpoint="opc.tcp://example:4840",
                                     namespace_uri="urn:test", browse_path_prefix=[])
        link.client = FakeClient()

        async def self_call():
            link._task = asyncio.current_task()  # simulate _loop() calling this on itself
            await link.disconnect()

        await self_call()
        assert state.cmd == ph.Cmd()

    asyncio.run(scenario())


def test_watchdog_forces_failsafe_even_if_loop_never_unwinds():
    """Regression: found live against tools/mock_plc.py. Killing the mock
    mid-connection, asyncua's client (2.0.1) kept read_value() returning
    the last-known cached value as if it succeeded for 10+ seconds, and
    per-call asyncio.wait_for(timeout=watchdog_timeout_s) around _loop()'s
    read/write didn't reliably unwind the stuck call once it did fail —
    physics kept running at full commanded speed for 30+s with the OPC UA
    status already showing disconnected, nowhere near watchdog_timeout_s's
    promise. _watchdog() is a second, independent task whose only job is
    comparing wall-clock time against _last_ok and forcing disconnect()
    regardless of what _loop() is doing — this proves it does that without
    needing a real client or a real stuck call, by starting it against an
    already-stale _last_ok."""
    import asyncio
    import time

    class FakeState:
        def __init__(self):
            self.cmd = ph.Cmd(ao_speed=42.0)
            self._generation = 0

    async def scenario():
        state = FakeState()
        link = opcua_link.OpcuaLink(state, endpoint="opc.tcp://example:4840",
                                     namespace_uri="urn:test", browse_path_prefix=[],
                                     watchdog_timeout_s=0.2)
        link._connected = True
        link._last_ok = time.monotonic() - 10.0  # already far past the timeout
        await asyncio.wait_for(link._watchdog(), timeout=2.0)
        assert link._connected is False
        assert state.cmd == ph.Cmd()

    asyncio.run(scenario())


def test_watchdog_detects_stale_but_successful_reads():
    """The exact blind spot the module docstring's "Watchdog liveness
    signal" note describes: a read that keeps "succeeding" (no exception)
    but returns the same frozen value forever, the way asyncua (2.0.1) was
    observed returning a dead peer's last-known cached value. A watchdog
    that trusted "did the call raise?" would never notice; this one must,
    because it requires the server-time readback to actually change."""
    import asyncio

    class FrozenServerTimeNode:
        async def read_value(self):
            return "same-cached-value-forever"  # never advances, always "succeeds"

    class FakeState:
        def __init__(self):
            self.cmd = ph.Cmd(ao_speed=42.0)
            self._generation = 0

    async def scenario():
        state = FakeState()
        link = opcua_link.OpcuaLink(state, endpoint="opc.tcp://example:4840",
                                     namespace_uri="urn:test", browse_path_prefix=[],
                                     watchdog_timeout_s=0.2)
        link._connected = True
        link._server_time_node = FrozenServerTimeNode()
        # _last_ok being fresh must NOT save it — liveness proof comes only
        # from the server-time readback actually changing.
        link._last_ok = time.monotonic()
        await asyncio.wait_for(link._watchdog(), timeout=2.0)
        assert link._connected is False
        assert state.cmd == ph.Cmd()

    asyncio.run(scenario())


def test_watchdog_stays_connected_while_server_time_keeps_advancing():
    """Complement of the stale-read test above: a server-time readback that
    genuinely changes every poll must NOT trip the watchdog."""
    import asyncio

    class TickingServerTimeNode:
        def __init__(self):
            self.n = 0

        async def read_value(self):
            self.n += 1
            return self.n

    class FakeState:
        def __init__(self):
            self.cmd = ph.Cmd(ao_speed=42.0)
            self._generation = 0

    async def scenario():
        state = FakeState()
        link = opcua_link.OpcuaLink(state, endpoint="opc.tcp://example:4840",
                                     namespace_uri="urn:test", browse_path_prefix=[],
                                     watchdog_timeout_s=0.2)
        link._connected = True
        link._server_time_node = TickingServerTimeNode()
        task = asyncio.create_task(link._watchdog())
        await asyncio.sleep(0.6)  # several watchdog_timeout_s windows
        assert link._connected is True, "advancing server time must not trip the watchdog"
        link._connected = False  # let _watchdog() exit on its own
        await asyncio.wait_for(task, timeout=1.0)

    asyncio.run(scenario())


def test_resolve_node_id_builds_codesys_style_string_nodeid():
    pattern = "ns={ns};s=|var|Device.Application.GVL_PLC.{tag}"
    assert (opcua_link.resolve_node_id(pattern, 4, "PT_1001")
            == "ns=4;s=|var|Device.Application.GVL_PLC.PT_1001")


def test_tag_types_config_builds_variant_type_overrides():
    class FakeState:
        pass

    link = opcua_link.OpcuaLink(FakeState(), endpoint="opc.tcp://example:4840",
                                 namespace_uri="urn:test", browse_path_prefix=[],
                                 tag_types={'PT_1001': 'Float', 'WD_6001': 'Int32',
                                            'bogus_tag': 'NotARealType'})
    assert link._variant_types['PT_1001'] is ua.VariantType.Float
    assert link._variant_types['WD_6001'] is ua.VariantType.Int32
    assert 'bogus_tag' not in link._variant_types  # unknown type name silently dropped


def test_write_measurements_applies_configured_variant_type_override():
    """CODESYS REAL is Float, not this app's implicit Double default —
    _write_measurements() must send an explicit ua.Variant with the
    configured type rather than letting asyncua infer one from the Python
    float, which would default to Double and raise BadTypeMismatch against
    a real CODESYS Float node."""
    import asyncio

    class FakeState:
        pass

    class RecordingNode:
        def __init__(self):
            self.written = None

        async def write_value(self, value):
            self.written = value

    async def scenario():
        link = opcua_link.OpcuaLink(FakeState(), endpoint="opc.tcp://example:4840",
                                     namespace_uri="urn:test", browse_path_prefix=[],
                                     tag_types={'PT_1001': 'Float'})
        float_node = RecordingNode()
        double_node = RecordingNode()
        link._nodes = {'PT_1001': float_node, 'PT_1002': double_node}
        await link._write_measurements({'PT_1001': 12.5, 'PT_1002': 30.0})
        assert isinstance(float_node.written, ua.Variant)
        assert float_node.written.VariantType is ua.VariantType.Float
        assert float_node.written.Value == 12.5
        # no override configured for PT_1002 — unchanged legacy behaviour,
        # the raw Python value goes straight to write_value().
        assert double_node.written == 30.0

    asyncio.run(scenario())


def test_codesys_mode_end_to_end_against_mock_plc(monkeypatch):
    """Integration check for build order step 8 / task 3: spin up
    tools/mock_plc.py's real asyncua Server in --codesys mode (string
    NodeIds, Float analogs) and connect a real OpcuaLink at it with
    node_addressing: "node_id" — the exact combination meant to be proven
    here before it's ever pointed at a real CODESYS runtime."""
    import asyncio
    from tools import mock_plc

    endpoint = "opc.tcp://127.0.0.1:48941/mock_plc_test/"
    monkeypatch.setattr(mock_plc, "ENDPOINT", endpoint)

    class FakeState:
        def __init__(self):
            self.cmd = ph.Cmd()
            self.last_msg = None
            self.flt = type('F', (), {'link_drop': False})()
            self._generation = 0

        def apply_cmd(self, fields, generation=None):
            if generation is not None and generation != self._generation:
                return
            for k, v in fields.items():
                if hasattr(self.cmd, k):
                    setattr(self.cmd, k, v)

    async def scenario():
        server, nodes = await mock_plc.build_server(codesys=True)
        async with server:
            state = FakeState()
            link = opcua_link.OpcuaLink(
                state, endpoint=endpoint, namespace_uri=mock_plc.NAMESPACE_URI,
                browse_path_prefix=[], node_addressing="node_id",
                node_id_pattern=mock_plc.CODESYS_NODE_ID_PATTERN,
                tag_types={'PT_1001': 'Float'})
            await link.connect()
            try:
                assert link._connected
                # A Float-typed write through the link must reach the
                # CODESYS-style Float node without a BadTypeMismatch.
                await link._write_measurements({'PT_1001': 12.5})
                assert abs(await nodes['PT_1001'].read_value() - 12.5) < 1e-3
                # And a PLC-output tag set directly on the mock (as CODESYS
                # ladder logic would) must be readable back through the
                # link's own node_id-resolved node.
                await mock_plc._write_value(nodes['SC_3001'], 'SC_3001', 77.0, codesys=True)
                cmd_tags = await link._read_commands()
                assert cmd_tags['SC_3001'] == 77.0
            finally:
                await link.disconnect()

    asyncio.run(scenario())


def test_loop_ignores_a_stale_success_that_arrives_after_disconnect():
    """Regression: found live against tools/mock_plc.py, and the reason
    _watchdog() alone wasn't enough. task.cancel() on _loop()'s task
    didn't reliably unwind it once asyncua's client was wedged — the
    stuck read eventually resolved successfully anyway (asyncua kept
    returning the dead PLC's last-known cached values for 10+ seconds
    rather than raising promptly), and _loop() applied that stale command,
    silently undoing whatever _watchdog() had just reset. _loop() must
    check self._connected right after such a call returns and bail out
    without touching state.cmd if a disconnect happened while it was in
    flight."""
    import asyncio

    class FakeState:
        def __init__(self):
            self.cmd = ph.Cmd(ao_speed=0.0)
            self._generation = 0

    async def scenario():
        state = FakeState()
        link = opcua_link.OpcuaLink(state, endpoint="opc.tcp://example:4840",
                                     namespace_uri="urn:test", browse_path_prefix=[])
        link._connected = True

        async def stale_read_commands():
            await asyncio.sleep(0.15)
            return {'CMD_4005': True}  # the "dead PLC's last-known value"

        link._read_commands = stale_read_commands
        loop_task = asyncio.create_task(link._loop())

        await asyncio.sleep(0.05)  # let the stale read start
        # what _watchdog() would have done, without waiting for it
        link._connected = False
        state.cmd = ph.Cmd()

        await asyncio.wait_for(loop_task, timeout=1.0)
        assert state.cmd == ph.Cmd(), "the stale read must not have reapplied cat_start etc."

    asyncio.run(scenario())

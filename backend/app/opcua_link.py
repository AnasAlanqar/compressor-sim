"""
OPC UA client — APP_SPEC.md section 2.1/6, build order step 6.

The app connects TO CODESYS's built-in OPC UA server; it is never the
server (section 2.1 — CODESYS's OPC UA *client* requires licensing in some
versions, so the sim being the client is the pragmatic direction, and this
is not to be "fixed" by inverting it). This is the only module permitted
to import asyncua — tags.py owns tag names, scaling, and clamping, and
this is one consumer of it, keeping the door open for a Modbus or
remote-I/O gateway later without touching physics or the UI.

Watchdog note: section 4.7 describes both sides incrementing a counter
every 500ms and declaring the link failed if the PLC's counter stalls for
2s. The tag map (section 4) defines the app's own outgoing counter
(WD_6001) but no distinct named tag for a PLC-side counter read back by
the app. Absent that, link health here is judged pragmatically by write
success: fail-safe applies if a read/write cycle fails or blocks for
longer than watchdog_timeout_s. This is a deliberate, documented reading
of an underspecified corner of section 4.7 — not a deviation from any
stated requirement.

Watchdog implementation note, found by actually killing a mock PLC mid-
connection (tools/mock_plc.py) rather than assuming asyncua would behave:
wrapping each read/write in asyncio.wait_for(timeout=watchdog_timeout_s)
is NOT sufficient on its own. When the peer dies without a clean TCP
close, asyncua's client (2.0.1) kept returning the last-known cached
value as if the read succeeded for 10+ seconds, and once it did notice,
the failing call sometimes didn't unwind even when wait_for tried to
cancel it — so a per-call timeout inside _loop() could itself hang past
its own deadline. _watchdog() runs as a second, independent task whose
only job is comparing wall-clock time against _last_ok and forcing
disconnect() regardless of what _loop()'s current call is doing. That
guarantees the fail-safe engages within watchdog_timeout_s even if
_loop()'s task never unwinds on its own (it's left to die whenever the
stuck call eventually does resolve, harmless since state is already
reset).

Watchdog liveness signal, hardening pass after the above: _last_ok used to
be set purely by _loop()'s own read/write success, which shares the exact
blind spot the note above describes — a stale-but-"successful" read from a
dead peer would keep _last_ok fresh forever, since _loop() has no way to
tell a cached value from a live one. _watchdog() now proves liveness
itself, independent of _loop(), by polling the OPC UA server's own
standard ServerStatus.CurrentTime node (ns=0;i=2258 — present on any
compliant server, including tools/mock_plc.py's asyncua Server, without
needing a dedicated app tag) and requiring the returned timestamp to
actually *advance* between polls. A truly dead/frozen peer cannot advance
its own clock no matter what asyncua's client-side cache returns, so this
closes the blind spot the old "did the call raise?" check couldn't.
_last_ok is still updated on this proof (kept for status()'s display), but
the force-disconnect decision below is gated on the server-time proof
alone, not on _loop()'s read/write success.
"""
import asyncio
import logging
import time
from collections import deque

from asyncua import Client, ua

from . import physics as ph
from . import tags as tg

log = logging.getLogger("compressor_sim.opcua_link")

# Standard OPC UA address space, present on any compliant server (used by
# _watchdog() as an independent liveness proof — see the module docstring's
# "Watchdog liveness signal" note).
SERVER_CURRENT_TIME_NODEID = ua.NodeId(2258, 0)  # Server_ServerStatus_CurrentTime

# Per-tag OPC UA variant type override, e.g. {"PT_1001": "Float"} for a
# CODESYS REAL node (32-bit Float, not this app's implicit Double default —
# see tags.py's _clamp() comment on the same class of int/float mismatch).
# Keyed by config.yaml's opcua.tag_types section.
_VARIANT_TYPE_MAP = {
    'Boolean': ua.VariantType.Boolean,
    'Float': ua.VariantType.Float,
    'Double': ua.VariantType.Double,
    'Int16': ua.VariantType.Int16,
    'Int32': ua.VariantType.Int32,
    'Int64': ua.VariantType.Int64,
}


def resolve_node_id(pattern: str, ns: int, tag: str) -> str:
    """Build a CODESYS-style string NodeId from config.yaml's
    opcua.node_id_pattern, e.g. "ns={ns};s=|var|Device.Application.
    GVL_PLC.{tag}" -> "ns=4;s=|var|Device.Application.GVL_PLC.PT_1001"."""
    return pattern.format(ns=ns, tag=tag)


READ_WRITE_INTERVAL = 0.100  # section 2.2
# See SimState._cmd_lock_until's docstring (server.py) — a stray command
# write can arrive shortly after disconnect() resets state.cmd. 1.5s is a
# generous margin over the ~250ms observed live, short enough not to
# meaningfully delay an operator taking manual control back afterward.
CMD_LOCK_GRACE_S = 1.5

# Tags read from the PLC (its outputs are our inputs) vs written to the PLC
# (our measurements are its inputs) — section 4.3/4.4 vs 4.1/4.2, plus
# section 4.8's extended tags (all app-writes, no new PLC-output tags).
READ_TAGS = list(tg._AO_MAP) + list(tg._DO_MAP) + ['CMD_4006']
WRITE_TAGS = (
    list(tg._AI_MAP) + list(tg._DI_MAP) + ['PS_2009', 'ST_2010', 'WD_6001']
    + list(tg._HMI_MAP) + ['RS_4011', 'RS_4012', 'TT_2014', 'PT_1007']
    + list(tg._SCRUBBER_TAGS.values()) + list(tg._VIBRATION_TAGS.values())
    + list(tg._LEVEL_TAGS.values()) + list(tg._LUBRICATOR_TAGS.values())
    + ['PSL_7031']
)

# The WRITE_TAGS subset that's a plain float (psig/degF/rpm/%) rather than
# boolean or the WD_6001 int counter — i.e. the tags that need config.yaml's
# opcua.tag_types: Float override on a real CODESYS target, whose REAL type
# is 32-bit (this app's implicit default is Double) and rejects a Double
# write with BadTypeMismatch. Mirrors tools/mock_plc.py's own _BOOL_TAGS/
# _INT_TAGS split, kept here so the Settings panel's "CODESYS REAL tags"
# convenience toggle (server.py) doesn't need its own copy of this list.
FLOAT_WRITE_TAGS = set(tg._AI_MAP) | {'TT_2014', 'PT_1007'}

# Same story as FLOAT_WRITE_TAGS but for WD_6001 (section 4.7's heartbeat):
# CODESYS's plain INT is 16-bit — this app's implicit default is Int64 —
# and heartbeat() (tags.py) already rolls the counter at 32768 specifically
# to fit a signed Int16, so Int16 (not UInt16) is the correct override.
# Found live against a real CODESYS Symbol Set export: FLOAT_WRITE_TAGS
# alone silently left WD_6001 mismatched since it's neither float nor bool.
CODESYS_TAG_TYPES = {tag: 'Float' for tag in FLOAT_WRITE_TAGS} | {'WD_6001': 'Int16'}


class OpcuaLink:
    """One instance per connection attempt, owned by server.py's SimState.
    connect() is called from the UI's Connect action, disconnect() from
    Disconnect or on an unrecoverable link failure. While connected, this
    both drives state.cmd from the PLC's outputs (superseding the manual
    override panel, section 6.4) and writes state's measurements out."""

    def __init__(self, state, endpoint: str, namespace_uri: str,
                 browse_path_prefix, watchdog_timeout_s: float = 2.0,
                 node_addressing: str = "browse", node_id_pattern: str = None,
                 tag_types: dict = None):
        self.state = state
        self.endpoint = endpoint
        self._namespace_uri = namespace_uri
        self._browse_path_prefix = browse_path_prefix
        self._watchdog_timeout = watchdog_timeout_s
        # "browse" walks browse_path_prefix then each tag's own browse name
        # (this project's own mock_plc.py, any freeopcua-style server).
        # "node_id" instead builds each tag's NodeId directly from
        # node_id_pattern, for servers that expose symbols by string NodeId
        # rather than a walkable Objects tree — CODESYS's own convention is
        # ns=4;s=|var|Device.Application.GVL_Name.TAG.
        self._node_addressing = node_addressing
        self._node_id_pattern = node_id_pattern
        self._variant_types = {
            tag: _VARIANT_TYPE_MAP[type_name]
            for tag, type_name in (tag_types or {}).items()
            if type_name in _VARIANT_TYPE_MAP
        }
        self.client = None
        self._nodes = {}
        self._server_time_node = None
        self._connected = False
        self._last_ok = 0.0
        # Set by connect() to the SimState's post-increment _generation —
        # this connection's own generation ID (see server.py's SimState._
        # generation docstring). _loop() tags every apply_cmd() call with
        # it so a stale write from a since-superseded connection is
        # rejected outright, without relying on timing.
        self.generation = None
        self._task = None
        self._watchdog_task = None
        self._error = None

    def status(self) -> dict:
        watchdog_ok = (self._connected
                        and (time.monotonic() - self._last_ok) < self._watchdog_timeout)
        return {
            'connected': self._connected,
            'endpoint': self.endpoint if self._connected else None,
            'watchdog_ok': watchdog_ok if self._connected else None,
            'error': self._error,
        }

    async def _autolocate_nodes(self, client) -> dict:
        """Find every canonical tag by name anywhere in the server's Objects
        tree, so a user never has to supply a namespace URI or browse path —
        the app already knows exactly which tag names it needs (section 4),
        so it can go find them itself. Breadth-first, one round trip per
        container (get_children_descriptions), bounded by a visit/depth
        budget so a pathological tree can't hang the connect. Groups hits by
        namespace and returns the namespace that holds the most, filling any
        stragglers from other namespaces — handles a server that splits
        symbols oddly without any config."""
        targets = set(READ_TAGS) | set(WRITE_TAGS)
        found: dict[int, dict] = {}
        seen = set()
        queue = deque([(client.get_objects_node(), 0)])
        visited = 0
        while queue and visited < 5000:
            node, depth = queue.popleft()
            try:
                descs = await node.get_children_descriptions()
            except Exception:
                continue
            visited += 1
            for d in descs:
                name = d.BrowseName.Name
                if d.NodeClass == ua.NodeClass.Variable and name in targets:
                    found.setdefault(d.BrowseName.NamespaceIndex, {})[name] = client.get_node(d.NodeId)
                elif d.NodeClass == ua.NodeClass.Object and depth < 10:
                    key = d.NodeId.to_string()
                    if key not in seen:
                        seen.add(key)
                        queue.append((client.get_node(d.NodeId), depth + 1))
        if not found:
            return {}
        best = max(found, key=lambda k: len(found[k]))
        nodes = dict(found[best])
        for ns_tags in found.values():
            for tag, node in ns_tags.items():
                nodes.setdefault(tag, node)
        return nodes

    async def connect(self):
        client = Client(url=self.endpoint)
        await client.connect()
        try:
            nodes = {}
            if self._node_addressing == "auto":
                nodes = await self._autolocate_nodes(client)
                missing = (set(READ_TAGS) | set(WRITE_TAGS)) - set(nodes)
                if missing:
                    raise RuntimeError(
                        "couldn't find the compressor tags on this server "
                        f"({len(missing)} missing, e.g. {', '.join(sorted(missing)[:3])}). "
                        "Is this the right PLC, and is its Symbol Configuration published?"
                        if nodes else
                        "no compressor tags found on this server — is this the right PLC, "
                        "and does its CODESYS project have a published Symbol Configuration?")
            elif self._node_addressing == "node_id":
                ns_idx = await client.get_namespace_index(self._namespace_uri)
                for tag in set(READ_TAGS) | set(WRITE_TAGS):
                    node_id = resolve_node_id(self._node_id_pattern, ns_idx, tag)
                    nodes[tag] = client.get_node(node_id)
                # get_node() is lazy and never touches the network — read
                # one tag now so a bad node_id_pattern/config typo fails
                # here, not silently in the first _loop() tick.
                await nodes['WD_6001'].read_value()
            else:
                ns_idx = await client.get_namespace_index(self._namespace_uri)
                base = client.get_objects_node()
                # "{ns}:Name" segments resolve against ns_idx at connect
                # time, same as node_id_pattern's {ns} — so config.yaml's
                # shipped default doesn't hardcode a specific server's
                # namespace *index* (which varies by CODESYS version/which
                # companion namespaces it registers), only the namespace
                # *URI*, which is what's actually stable across installs.
                for part in self._browse_path_prefix:
                    base = await base.get_child(part.replace("{ns}", str(ns_idx)))
                for tag in set(READ_TAGS) | set(WRITE_TAGS):
                    nodes[tag] = await base.get_child(f"{ns_idx}:{tag}")
        except Exception:
            await client.disconnect()
            raise
        # Auto-detect each measurement tag's real OPC UA data type from the
        # server so writes match what the PLC actually declares — a CODESYS
        # REAL is a 32-bit Float and writing a Double to it raises
        # BadTypeMismatch — with zero manual configuration. An explicit
        # tag_types override (config.yaml / Settings) still wins: it's
        # already in _variant_types from __init__, so this only fills tags
        # left unspecified. A read that fails just falls back to asyncua's
        # default value-typing, exactly as before this existed.
        for tag in WRITE_TAGS:
            if tag in self._variant_types:
                continue
            node = nodes.get(tag)
            if node is None:
                continue
            try:
                self._variant_types[tag] = await node.read_data_type_as_variant_type()
            except Exception:
                pass
        self.client = client
        self._nodes = nodes
        self._server_time_node = client.get_node(SERVER_CURRENT_TIME_NODEID)
        self._connected = True
        self._error = None
        self._last_ok = time.monotonic()
        self.state._generation += 1
        self.generation = self.state._generation
        self._task = asyncio.create_task(self._loop(), name="opcua_link")
        self._watchdog_task = asyncio.create_task(self._watchdog(), name="opcua_link_watchdog")

    async def disconnect(self):
        self._connected = False
        # A dropped link must not leave the PLC's last commands latched in
        # forever — fall back to the fail-safe Cmd() defaults (section
        # 4.3/4.4's "Fail value" column), same as a real hardwired I/O
        # loss would present. Done first, synchronously, before any await:
        # _loop() and _watchdog() both call this on themselves, so one of
        # the two tasks cancelled below can be *this very coroutine's own
        # task* — task.cancel() schedules a CancelledError at the next
        # await point, which would otherwise abort this method before
        # reaching here. The generation bump (SimState._generation) is the
        # real guard against a stray in-flight write landing just after
        # this — apply_cmd() rejects any write tagged with a generation
        # other than the current one, regardless of timing. The lock
        # window (CMD_LOCK_GRACE_S) is kept as belt-and-braces on top of
        # it, not as the sole defence.
        self.state.cmd = ph.Cmd()
        self.state._generation += 1
        self.state._cmd_lock_until = time.monotonic() + CMD_LOCK_GRACE_S
        current = asyncio.current_task()
        for attr in ('_task', '_watchdog_task'):
            task = getattr(self, attr)
            setattr(self, attr, None)
            if task is not None and task is not current:
                task.cancel()
        if self.client is not None:
            try:
                await self.client.disconnect()
            except Exception:
                log.exception("opcua disconnect failed")
            self.client = None
        self._nodes = {}

    async def _watchdog(self):
        """Independent of _loop()'s own per-call timeouts and of _loop()'s
        read/write success — see the module docstring's "Watchdog liveness
        signal" note. Polls the server's own ServerStatus.CurrentTime node
        and requires it to actually advance; a call "succeeding" with a
        frozen or stale-cached value (the bug that motivated this) doesn't
        count as proof of life. Forces the fail-safe within
        watchdog_timeout_s of the last proven-live poll, even if _loop()'s
        current read/write call never unwinds on its own."""
        last_value = None
        last_change = time.monotonic()
        poll_interval = min(0.25, self._watchdog_timeout / 4)
        while True:
            await asyncio.sleep(poll_interval)
            if not self._connected:
                return
            try:
                value = await asyncio.wait_for(
                    self._server_time_node.read_value(), timeout=self._watchdog_timeout)
            except Exception:
                value = None
            now = time.monotonic()
            if value is not None and value != last_value:
                last_value = value
                last_change = now
                self._last_ok = now
            if now - last_change > self._watchdog_timeout:
                log.error("opcua watchdog: peer's server time hasn't advanced in over %.1fs, "
                          "forcing fail-safe", self._watchdog_timeout)
                self._error = "watchdog timeout"
                await self.disconnect()
                return

    async def _read_commands(self) -> dict:
        vals = {}
        for tag in READ_TAGS:
            node = self._nodes.get(tag)
            if node is None:
                continue
            vals[tag] = await node.read_value()
        return vals

    async def _write_measurements(self, tags: dict):
        for tag, value in tags.items():
            node = self._nodes.get(tag)
            if node is None:
                continue
            vt = self._variant_types.get(tag)
            if vt is not None:
                await node.write_value(ua.Variant(value, vt))
            else:
                await node.write_value(value)

    async def _loop(self):
        """Fixed 100ms read/write (section 2.2). Writes reuse state.last_msg
        — the same message the websocket push just built, so this loop
        never re-runs instrumentation lag/noise/freeze a second time on an
        independent schedule. link_drop (section 5) suspends writes only,
        including WD_6001 — from the PLC's point of view our heartbeat
        stalls, exercising its watchdog detection, while we keep reading
        its commands so the fault doesn't also mask what the PLC is doing.
        """
        start = time.monotonic()
        tick = 0
        while True:
            target = start + tick * READ_WRITE_INTERVAL
            delay = target - time.monotonic()
            if delay > 0:
                await asyncio.sleep(delay)
            tick += 1
            try:
                cmd_tags = await asyncio.wait_for(
                    self._read_commands(), timeout=self._watchdog_timeout)
                if not self._connected:
                    # _watchdog() forced a disconnect while this read was
                    # in flight — asyncua (2.0.1) doesn't reliably unwind
                    # a call via task.cancel() once the peer has actually
                    # died, so this "success" can arrive well after the
                    # fail-safe already engaged, still carrying the dead
                    # PLC's last-known values. Applying it now would
                    # silently undo the watchdog's reset.
                    return
                self.state.apply_cmd(tg.cmd_fields_from_tags(cmd_tags), generation=self.generation)
                if not self.state.flt.link_drop and self.state.last_msg is not None:
                    await asyncio.wait_for(
                        self._write_measurements(self.state.last_msg),
                        timeout=self._watchdog_timeout)
                    if not self._connected:
                        return
                self._last_ok = time.monotonic()
                self._error = None
            except Exception as exc:
                log.exception("opcua link failed, applying fail values")
                self._error = str(exc)
                await self.disconnect()
                return

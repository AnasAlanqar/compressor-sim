"""
tools/mock_plc.py — a stand-in CODESYS OPC UA SERVER for loop-testing
backend/app/opcua_link.py without real hardware or a CODESYS runtime.

APP_SPEC.md section 2.1: the app is the OPC UA *client*; something has to
play the server for opcua_link.py to connect to during development. This
exposes the full canonical tag set (section 4.1-4.7) plus the section 4.8
extended tags — but under this tool's own namespace/tree shape (a plain
"PLC_PRG" object, printed on startup), not config.yaml's shipped default,
which targets a real CODESYS Control Win V3 server's actual symbol-set
namespace instead. Either edit config.yaml (or the app's Settings panel)
to match what this prints on startup, or pass --codesys for the other
addressing mode config.yaml's node_id_pattern comment documents.

Run alongside the sim, in two terminals from the repo root:

    # terminal 1 — the sim backend
    uvicorn backend.app.server:app --port 8000

    # terminal 2 — this mock PLC
    python tools/mock_plc.py

Then either click Connect on the HMI top bar (http://localhost:5173,
default endpoint opc.tcp://localhost:4840 is prefilled) or:

    curl -X POST http://localhost:8000/api/opcua/connect

Interactive commands at the `mock_plc>` prompt (see `help`):
    set <tag> <value>   drive one of the PLC's own outputs (section 4.3/
                         4.4 AO/DO tags) — cat_start, driven_ready, valve
                         solenoids, cooler motors, speed/valve AO%, etc.
                         Booleans accept true/false/1/0/on/off/yes/no.
    get <tag>           read back any tag's current value
    cmds                list every PLC-output tag (what you can `set`)
    meas                list every measurement tag the sim is writing
    startup             convenience macro: a typical run-permit sequence
    stop                convenience macro: drop cat_start/driven_ready
    quit                stop the mock server

Running with stdin that isn't a terminal (a background job, a service
manager, CI) skips the REPL and just serves — there's nothing to read
commands from. Drive it instead with a second, short-lived invocation
that connects as a client to the already-running mock and exits:

    python tools/mock_plc.py --set cat_start=true driven_ready=true \\
        sesd=true desd=true cooler_1=true cooler_2=true \\
        idle_rated=true ao_speed=100 ao_byp=75 ao_suc=45
    python tools/mock_plc.py --get PT_1001 PT_1006 ST_1008

Pass --codesys to serve tags under CODESYS-style string NodeIds
(ns=N;s=|var|Device.Application.GVL_PLC.TAG, config.yaml's
opcua.node_id_pattern default) with analog tags typed Float instead of
Double, instead of this tool's own default browsable PLC_PRG object with
Double analogs. Point opcua_link.py at it with config.yaml's
node_addressing: "node_id" (and a tag_types override per analog tag if you
want to prove the Float typing end to end) — this is the way to exercise
CODESYS-shaped addressing and the Double/Float mismatch before touching a
real PLC. --set/--get also take --codesys, to drive a mock already running
in that mode.

Ctrl-C / Ctrl-D also stops the interactive REPL. Killing this process
mid-connection is the
intended way to test the app's watchdog/fail-safe path (section 4.7) — the
sim's opcua_link read/write cycle will start failing, and after
watchdog_timeout_s (config.yaml, default 2s) it disconnects itself and
falls back to physics.Cmd()'s fail-safe defaults.
"""
import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from asyncua import Client, Server, ua

from backend.app import opcua_link, tags as tg

ENDPOINT = "opc.tcp://0.0.0.0:4840/freeopcua/server/"
CLIENT_ENDPOINT = "opc.tcp://localhost:4840/freeopcua/server/"
NAMESPACE_URI = "urn:codesys:plc"
BROWSE_PATH_PREFIX = ["PLC_PRG"]  # namespace index resolved at connect time

# CODESYS-mode addressing (--codesys): matches config.yaml's opcua.
# node_id_pattern default exactly, so opcua_link.py needs zero code changes
# beyond node_addressing: "node_id" to talk to this in that mode.
CODESYS_NODE_ID_PATTERN = "ns={ns};s=|var|Device.Application.GVL_PLC.{tag}"

# Tag -> OPC UA variant type, from section 4/4.8's own units — everything
# not listed here is a plain float (psig/°F/rpm/%).
_BOOL_TAGS = (
    set(tg._DO_MAP) | {'CMD_4006'} | set(tg._DI_MAP) | {'PS_2009', 'ST_2010'}
    | set(tg._HMI_MAP) | {'RS_4011', 'RS_4012'}
    | set(tg._SCRUBBER_TAGS.values()) | set(tg._VIBRATION_TAGS.values())
    | set(tg._LEVEL_TAGS.values()) | set(tg._LUBRICATOR_TAGS.values())
    | {'PSL_7031'}
)
_INT_TAGS = {'WD_6001'}

# Friendly aliases for the CLI, matching physics.Cmd's own field names —
# the tag numbers are easy to mistype and hard to remember.
ALIASES = {
    'cat_start': 'CMD_4005',
    'driven_ready': 'CMD_4008',
    'idle_rated': 'CMD_4003',
    'ao_speed': 'SC_3001',
    'ao_byp': 'FC_3002',
    'ao_suc': 'FC_3003',
    'sesd': 'CMD_4009',
    'desd': 'CMD_4010',
    'bdv': 'CMD_4004',
    'aux_lube': 'CMD_4001',
    'cat_esd_healthy': 'CMD_4006',
    'cooler_1': 'CMD_4011',
    'cooler_2': 'CMD_4012',
}

HELP = """
Commands:
  set <tag> <value>   write a PLC-output tag (bool: true/false/1/0/on/off,
                       numeric: e.g. 45). aliases: cat_start, driven_ready,
                       idle_rated, ao_speed, ao_byp, ao_suc, sesd, desd,
                       bdv, aux_lube, cooler_1, cooler_2, cat_esd_healthy
  get <tag>           read back any tag's current value (command or
                       measurement)
  cmds                list every PLC-output tag (section 4.3/4.4) and its
                       current value
  meas                list every measurement tag (section 4.1/4.2/4.8) and
                       its current value
  startup             convenience macro: cat_start/driven_ready on, both
                       ESDs open, both coolers on, idle_rated + ao_speed
                       100%, bypass/suction valve at the design point
  stop                convenience macro: drop cat_start and driven_ready
  help                show this again
  quit                stop the mock server
""".strip()


def _variant_type(tag: str, codesys: bool = False) -> ua.VariantType:
    if tag in _BOOL_TAGS:
        return ua.VariantType.Boolean
    if tag in _INT_TAGS:
        return ua.VariantType.Int64
    # CODESYS REAL is a 32-bit Float, not this app's implicit Double
    # default (config.yaml's opcua.tag_types comment) — --codesys mode
    # exercises that mismatch here rather than first against real hardware.
    return ua.VariantType.Float if codesys else ua.VariantType.Double


def _parse_value(tag: str, raw: str, codesys: bool = False):
    vt = _variant_type(tag, codesys)
    if vt is ua.VariantType.Boolean:
        return raw.strip().lower() in ('1', 'true', 't', 'on', 'yes')
    if vt is ua.VariantType.Int64:
        return int(float(raw))
    return float(raw)


async def build_server(codesys: bool = False):
    server = Server()
    await server.init()
    server.set_endpoint(ENDPOINT)
    server.set_server_name("mock REMVue 500S")

    idx = await server.register_namespace(NAMESPACE_URI)
    objects = server.get_objects_node()

    # Every node is client-writable. For WRITE_TAGS (section 4.1/4.2/4.8
    # measurements) that's because opcua_link.py itself writes them over
    # the wire. For READ_TAGS (section 4.3/4.4 PLC outputs) it's because
    # this whole tool exists to be driven externally — the REPL sets them
    # via a direct in-process node handle either way, but the --set/--get
    # one-shot mode is itself just another OPC UA client and would hit the
    # exact same BadUserAccessDenied a real PLC should (correctly) throw
    # at the sim if it tried. This mock intentionally doesn't model that
    # access-control boundary; opcua_link.py's own code never attempts to
    # write a READ_TAGS node regardless of what the server would allow.
    nodes = {}
    if codesys:
        # CODESYS-style string NodeIds (config.yaml's opcua.node_id_pattern
        # default) instead of a walkable browse path — the client resolves
        # these directly via get_node(), never browsing Objects/PLC_PRG.
        for tag in opcua_link.READ_TAGS + opcua_link.WRITE_TAGS:
            vt = _variant_type(tag, codesys=True)
            init = False if vt is ua.VariantType.Boolean else (0 if vt is ua.VariantType.Int64 else 0.0)
            node_id = opcua_link.resolve_node_id(CODESYS_NODE_ID_PATTERN, idx, tag)
            node = await objects.add_variable(node_id, tag, init, varianttype=vt)
            await node.set_writable()
            nodes[tag] = node
        print(f"registered namespace '{NAMESPACE_URI}' at index {idx}, CODESYS-style node IDs")
        print("config.yaml should read:")
        print(f"  node_addressing: \"node_id\"")
        print(f"  node_id_pattern: \"{CODESYS_NODE_ID_PATTERN}\"")
    else:
        plc_prg = await objects.add_object(idx, "PLC_PRG")
        for tag in opcua_link.READ_TAGS + opcua_link.WRITE_TAGS:
            vt = _variant_type(tag)
            init = False if vt is ua.VariantType.Boolean else (0 if vt is ua.VariantType.Int64 else 0.0)
            node = await plc_prg.add_variable(idx, tag, init, varianttype=vt)
            await node.set_writable()
            nodes[tag] = node
        print(f"registered namespace '{NAMESPACE_URI}' at index {idx}")
        print(f"config.yaml's opcua.browse_path_prefix should read [\"{idx}:PLC_PRG\"]")
    return server, nodes


async def _print_table(nodes, tags):
    rows = [(t, await nodes[t].read_value()) for t in sorted(tags)]
    width = max((len(t) for t, _ in rows), default=0)
    for t, v in rows:
        print(f"  {t:<{width}}  {v}")


async def _write_value(node, tag: str, value, codesys: bool = False):
    # asyncua's write_value(value) infers the wire type from the Python
    # value's own type (float -> Double, regardless of what the target
    # node actually declares) rather than negotiating against the node —
    # exactly the int/Double mismatch tags.py's _clamp() comment documents,
    # and the same bug class --codesys mode exists to catch for Float. An
    # explicit ua.Variant sidesteps the inference entirely.
    await node.write_value(ua.Variant(value, _variant_type(tag, codesys)))


async def _apply(nodes, fields: dict, codesys: bool = False):
    for tag, value in fields.items():
        await _write_value(nodes[tag], tag, value, codesys)


async def repl(nodes, codesys: bool = False):
    loop = asyncio.get_running_loop()
    print(HELP)
    while True:
        try:
            line = await loop.run_in_executor(None, input, "mock_plc> ")
        except (EOFError, KeyboardInterrupt):
            print()
            return
        parts = line.strip().split()
        if not parts:
            continue
        cmd, *args = parts
        try:
            if cmd in ('quit', 'exit'):
                return
            elif cmd == 'help':
                print(HELP)
            elif cmd == 'set' and len(args) == 2:
                tag = ALIASES.get(args[0], args[0])
                if tag not in nodes:
                    print(f"unknown tag: {args[0]}")
                    continue
                await _write_value(nodes[tag], tag, _parse_value(tag, args[1], codesys), codesys)
                print(f"{tag} = {await nodes[tag].read_value()}")
            elif cmd == 'get' and len(args) == 1:
                tag = ALIASES.get(args[0], args[0])
                if tag not in nodes:
                    print(f"unknown tag: {args[0]}")
                    continue
                print(f"{tag} = {await nodes[tag].read_value()}")
            elif cmd == 'cmds':
                await _print_table(nodes, opcua_link.READ_TAGS)
            elif cmd == 'meas':
                await _print_table(nodes, opcua_link.WRITE_TAGS)
            elif cmd == 'startup':
                await _apply(nodes, {
                    'CMD_4005': True, 'CMD_4006': True, 'CMD_4008': True,
                    'CMD_4009': True, 'CMD_4010': True,
                    'CMD_4011': True, 'CMD_4012': True,
                    'CMD_4003': True, 'SC_3001': 100.0,
                    'FC_3002': 75.0, 'FC_3003': 45.0,
                }, codesys)
                print("applied: cat_start/driven_ready/ESD solenoids/coolers on, "
                      "idle_rated + ao_speed=100%, bypass/suction at design point")
            elif cmd == 'stop':
                await _apply(nodes, {'CMD_4005': False, 'CMD_4008': False}, codesys)
                print("cat_start and driven_ready dropped")
            else:
                print("unrecognised command — try `help`")
        except Exception as exc:
            print(f"error: {exc}")


async def serve(codesys: bool = False):
    server, nodes = await build_server(codesys)
    async with server:
        print(f"mock PLC serving at {ENDPOINT}")
        if sys.stdin.isatty():
            await repl(nodes, codesys)
        else:
            print("stdin is not a terminal — skipping the REPL, serving headlessly.")
            print("drive it with: python tools/mock_plc.py --set tag=value ...")
            await asyncio.Event().wait()  # serve forever until killed
    print("mock PLC stopped")


async def _resolve_plc_prg(client: Client):
    idx = await client.get_namespace_index(NAMESPACE_URI)
    node = client.get_objects_node()
    for part in BROWSE_PATH_PREFIX:
        node = await node.get_child(f"{idx}:{part}")
    return node, idx


async def _get_node(client: Client, idx: int, plc_prg, tag: str, codesys: bool):
    if codesys:
        return client.get_node(opcua_link.resolve_node_id(CODESYS_NODE_ID_PATTERN, idx, tag))
    return await plc_prg.get_child(f"{idx}:{tag}")


async def one_shot(sets: list, gets: list, endpoint: str, codesys: bool = False):
    """Connect as a short-lived client to an already-running mock PLC and
    set/get tags, then disconnect — how to drive this tool's PLC-output
    tags when stdin isn't a terminal (a background job, a second script)."""
    client = Client(url=endpoint)
    await client.connect()
    try:
        idx = await client.get_namespace_index(NAMESPACE_URI)
        plc_prg = None if codesys else (await _resolve_plc_prg(client))[0]
        for item in sets:
            if '=' not in item:
                print(f"skipping malformed --set argument: {item!r} (want TAG=VALUE)")
                continue
            raw_tag, raw_value = item.split('=', 1)
            tag = ALIASES.get(raw_tag, raw_tag)
            node = await _get_node(client, idx, plc_prg, tag, codesys)
            await _write_value(node, tag, _parse_value(tag, raw_value, codesys), codesys)
            print(f"{tag} = {await node.read_value()}")
        for raw_tag in gets:
            tag = ALIASES.get(raw_tag, raw_tag)
            node = await _get_node(client, idx, plc_prg, tag, codesys)
            print(f"{tag} = {await node.read_value()}")
    finally:
        await client.disconnect()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--endpoint", default=CLIENT_ENDPOINT,
                         help="only used with --set/--get, to reach an already-running mock PLC")
    parser.add_argument("--set", nargs="+", default=[], metavar="TAG=VALUE",
                         help="one-shot: write tags on an already-running mock PLC, then exit")
    parser.add_argument("--get", nargs="+", default=[], metavar="TAG",
                         help="one-shot: read tags from an already-running mock PLC, then exit")
    parser.add_argument("--codesys", action="store_true",
                         help="serve (or, with --set/--get, address) tags CODESYS-style: "
                              "string NodeIds (config.yaml's opcua.node_id_pattern default) "
                              "instead of a browsable PLC_PRG object, and Float instead of "
                              "Double for analog tags — matches node_addressing: \"node_id\" "
                              "+ tag_types overrides, to test that combination before real "
                              "hardware")
    args = parser.parse_args()

    if args.set or args.get:
        asyncio.run(one_shot(args.set, args.get, args.endpoint, args.codesys))
    else:
        asyncio.run(serve(args.codesys))

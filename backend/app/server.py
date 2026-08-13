"""
FastAPI application: physics loop, websocket state push, trivial diagnostic
page, fault/boundary edits, and the OPC UA link lifecycle.

No control logic lives here — see APP_SPEC.md section 1 and section 9. This
module only steps the physics model and moves tag values to a websocket.
Only tags.py's canonical names cross this boundary (section 4); nothing
here may reference physics.py's internal meas() names directly.
"""
import asyncio
import logging
import time

import yaml
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from .. import paths
from . import faults as flts
from . import opcua_link
from . import physics as ph
from . import tags as tg

log = logging.getLogger("compressor_sim.server")

DT = 0.020              # fixed physics step, APP_SPEC.md section 2.2
WS_PUSH_INTERVAL = 0.100

_wall_start = time.monotonic()


# Fault fields whose JSON wire form (a JS array — there's no set type) needs
# converting back to the Python set faults.Flt actually holds.
_INT_SET_FAULT_FIELDS = {'cooler_trip', 'scrubber_level_hi', 'vibration_trip',
                          'oil_jw_level_lo', 'lubricator_no_flow'}
_STR_SET_FAULT_FIELDS = {'signal_freeze', 'signal_invalid'}


class SimState:
    def __init__(self):
        self.p = ph.load_params(ph.DEFAULT_CONFIG)
        self.cmd = ph.Cmd()
        self.flt = flts.Flt()
        self.hmi = tg.HmiInputs()
        self.instr = tg.Instrumentation()
        # Default reset condition: blown down / cold start, APP_SPEC.md 6.1.
        self.y = ph.init(self.p, pressurised=False)
        self.last_a = ph.algebra(self.y, self.cmd, self.p)
        self.sim_time = 0.0
        self.running = True
        self.opcua = None  # set by opcua_link.py's connect lifecycle
        self.last_msg = None  # last built state message, section 2.2 shared 100ms tick
        self._last_msg_time = time.monotonic()
        # Found live, killing tools/mock_plc.py mid-connection: a stray
        # command write can land shortly *after* opcua_link.py's
        # disconnect() has already reset self.cmd to its fail-safe
        # defaults, silently undoing the reset (observed ~250ms post-
        # disconnect, cause not fully pinned down — asyncua 2.0.1's client
        # kept individual calls "succeeding" with stale cached data for
        # 10+ seconds after the peer died, in a way that didn't reliably
        # unwind via task.cancel() either; some remnant of that appears to
        # land after disconnect() has already run). A short rejection
        # window closes the race without permanently blocking manual
        # control once the operator legitimately takes over post-
        # disconnect (section 6.4).
        self._cmd_lock_until = 0.0
        # Connection generation guard, the real fix for the race above: each
        # OPC UA connection (opcua_link.OpcuaLink.connect()) increments this
        # and remembers its own post-increment value as link.generation.
        # apply_cmd() rejects any call tagged with a generation other than
        # the current one, so a write from a superseded connection is
        # rejected whether it lands 250ms or 30s late — no timing
        # assumption. disconnect() also bumps it, immediately invalidating
        # in-flight writes from the connection just torn down. Manual/UI
        # writes (ws_endpoint) pass no generation and are never subject to
        # this check.
        self._generation = 0

    def reset(self, pressurised: bool):
        self.y = ph.init(self.p, pressurised=pressurised)
        self.sim_time = 0.0

    def eff_cmd(self):
        """Cmd with command-interpretation-layer faults folded in (section
        5) — cooler trip today. Recomputed each use rather than cached:
        cheap dataclasses.replace, and faults can change between ticks."""
        return tg.effective_cmd(self.cmd, self.flt)

    def apply_cmd(self, fields: dict, generation: int | None = None):
        # generation is only passed by opcua_link.py's _loop() (see
        # SimState._generation's docstring) — a stale connection's write is
        # rejected outright, not just during the post-disconnect timing
        # window. The manual override panel (ws_endpoint) always passes
        # None and is never subject to this check.
        if generation is not None and generation != self._generation:
            return
        if time.monotonic() < self._cmd_lock_until:
            return
        for k, v in fields.items():
            if hasattr(self.cmd, k):
                setattr(self.cmd, k, v)

    def apply_hmi(self, fields: dict):
        for k, v in fields.items():
            if hasattr(self.hmi, k):
                setattr(self.hmi, k, v)

    def apply_flt(self, fields: dict):
        for k, v in fields.items():
            if not hasattr(self.flt, k):
                continue
            # arrays over the wire — the UI has no set type — normalise
            # back to the set faults.Flt actually holds.
            if k in _INT_SET_FAULT_FIELDS:
                v = {int(x) for x in v}
            elif k in _STR_SET_FAULT_FIELDS:
                v = set(v)
            setattr(self.flt, k, v)

    def apply_boundary(self, fields: dict):
        """Section 6.5 — the two ends of the system, psig/degF over the
        wire, converted to the SI units physics.py's P dataclass holds."""
        if 'P_src_psig' in fields:
            self.p.P_src = ph.psig_to_pa(float(fields['P_src_psig']))
        if 'P_proc_psig' in fields:
            self.p.P_proc = ph.psig_to_pa(float(fields['P_proc_psig']))
        if 'T_suc_F' in fields:
            self.p.T_suc = ph.f_to_k(float(fields['T_suc_F']))
        if 'T_amb_F' in fields:
            self.p.T_amb = ph.f_to_k(float(fields['T_amb_F']))


class ConnectionManager:
    def __init__(self):
        self.active: set[WebSocket] = set()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.add(ws)

    def disconnect(self, ws: WebSocket):
        self.active.discard(ws)

    async def broadcast(self, message: dict):
        dead = []
        # Snapshot: send_json() awaits, and a concurrent disconnect (e.g. a
        # browser refresh) mutating self.active mid-iteration would raise
        # "Set changed size during iteration" and permanently kill this task.
        for ws in list(self.active):
            try:
                await ws.send_json(message)
            except Exception:
                log.exception("websocket broadcast failed, dropping connection")
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


state = SimState()
manager = ConnectionManager()
app = FastAPI()


def build_state_message() -> dict:
    now = time.monotonic()
    dt = now - state._last_msg_time
    state._last_msg_time = now
    eff_cmd = state.eff_cmd()
    ai = tg.analog_inputs(state.y, eff_cmd, state.p, state.flt)
    ai = state.instr.apply(ai, state.flt, dt)
    ai.update(tg.engine_extra_tags(state.y, state.p))  # Tier 1: TT_2014, PT_1007
    di = tg.discrete_inputs(state.y, eff_cmd, state.p, state.flt, ai)
    di.update(tg.hmi_to_tags(state.hmi))         # Tier 1 operator/ECU inputs
    di.update(tg.tier2_fault_tags(state.flt))    # Tier 2 discrete fault inputs
    status_tau = tg._INSTR_CFG['status_feedback_tau_s']
    di['RS_4011'] = state.instr.status_feedback('RS_4011', eff_cmd.cooler_1, dt, status_tau)
    di['RS_4012'] = state.instr.status_feedback('RS_4012', eff_cmd.cooler_2, dt, status_tau)
    msg = {**ai, **di, 'WD_6001': tg.heartbeat(state.sim_time)}
    msg['sim_time_s'] = round(state.sim_time, 3)
    msg['wall_time_s'] = round(time.monotonic() - _wall_start, 3)
    msg['running'] = state.running
    # UI-only diagnostics, not canonical tags (section 4 has no flow meters
    # or continuous valve position transmitters) — for P&ID animation and
    # trends only.
    msg['flows'] = {k: round(float(v), 5)
                     for k, v in tg.flow_diagnostics(state.y, eff_cmd, state.p, state.flt).items()}
    msg['valves'] = {k: round(v, 2) for k, v in tg.valve_positions(state.y).items()}
    # Section 6.4 read-only indicators once OPC UA drives, and section 6.2
    # cooler animation — folds in command-interpretation faults (cooler
    # trip), so a tripped motor's run status reads back off even though
    # the PLC still commands it on.
    msg['cmd_echo'] = tg.cmd_to_tags(eff_cmd)
    # Simulator-only insight: model-internal temperatures with no real
    # transmitter (section 4's I/O list has no interstage TTs) — kept out
    # of the canonical tag map so it can never be mistaken for PLC data.
    msg['sim_insight'] = {k: round(v, 2) for k, v in tg.sim_insight_tags(eff_cmd, state.p).items()}
    msg['boundary'] = {
        'P_src_psig': round(ph.pa_to_psig(state.p.P_src), 2),
        'P_proc_psig': round(ph.pa_to_psig(state.p.P_proc), 2),
        'T_suc_F': round(ph.k_to_f(state.p.T_suc), 2),
        'T_amb_F': round(ph.k_to_f(state.p.T_amb), 2),
    }
    msg['opcua'] = state.opcua.status() if state.opcua else {'connected': False, 'endpoint': None}
    return msg


async def physics_loop():
    """Fixed 20 ms RK4 step, paced to wall-clock real time with drift
    compensation (APP_SPEC.md section 2.2). Target ticks are computed from
    an absolute start time, not accumulated via repeated sleep(dt) calls, so
    step compute time never causes the loop to fall behind real time."""
    start = time.monotonic()
    step = 0
    while True:
        target = start + step * DT
        delay = target - time.monotonic()
        if delay > 0:
            await asyncio.sleep(delay)
        if state.running:
            state.y, state.last_a = ph.step(state.y, state.eff_cmd(), state.flt, state.p, DT)
            state.sim_time += DT
        step += 1


async def broadcast_loop():
    """The single 100ms tick that builds the state message (section 2.2).
    Always runs, even with no websocket clients, so opcua_link's write
    loop (which reuses state.last_msg rather than rebuilding it) always
    has fresh data once a PLC is connected."""
    start = time.monotonic()
    tick = 0
    while True:
        target = start + tick * WS_PUSH_INTERVAL
        delay = target - time.monotonic()
        if delay > 0:
            await asyncio.sleep(delay)
        try:
            state.last_msg = build_state_message()
            if manager.active:
                await manager.broadcast(state.last_msg)
        except Exception:
            # One bad tick must not permanently stop the push loop for
            # every other connected client.
            log.exception("broadcast_loop tick failed, continuing")
        tick += 1


def _log_task_exception(task: asyncio.Task):
    if not task.cancelled() and task.exception() is not None:
        log.error("background task %s died", task.get_name(), exc_info=task.exception())


@app.on_event("startup")
async def on_startup():
    for coro, name in [(physics_loop(), "physics_loop"), (broadcast_loop(), "broadcast_loop")]:
        t = asyncio.create_task(coro, name=name)
        t.add_done_callback(_log_task_exception)


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    """Single channel for state push and inbound commands (APP_SPEC.md
    section 5's transport note — faults and boundary edits ride the same
    connection as the state push, never REST, never OPC UA). Message
    types:
      {"type": "cmd", "tags": {...}}       manual override panel, 4.3/4.4,
                                            plus Tier 1 HMI operator inputs
                                            (unknown tags ignored either way)
      {"type": "cmd", "running": bool}     run/pause
      {"type": "fault", "faults": {...}}   fault panel toggles/sliders
      {"type": "fault", "clear": true}     clear every fault
      {"type": "boundary", "boundary": {...}}  section 6.5 edits
      {"type": "instrument", ...}          lag/noise toggles, step 8
    """
    await manager.connect(ws)
    try:
        while True:
            msg = await ws.receive_json()
            mtype = msg.get("type")
            if mtype == "cmd":
                tags = msg.get("tags", {})
                state.apply_cmd(tg.cmd_fields_from_tags(tags))
                state.apply_hmi(tg.hmi_fields_from_tags(tags))
                if "running" in msg:
                    state.running = bool(msg["running"])
            elif mtype == "fault":
                if msg.get("clear"):
                    state.flt.clear()
                else:
                    state.apply_flt(msg.get("faults", {}))
            elif mtype == "boundary":
                state.apply_boundary(msg.get("boundary", {}))
            elif mtype == "instrument":
                if "lag_enabled" in msg:
                    state.instr.lag_enabled = bool(msg["lag_enabled"])
                if "noise_enabled" in msg:
                    state.instr.noise_enabled = bool(msg["noise_enabled"])
    except WebSocketDisconnect:
        manager.disconnect(ws)


@app.post("/api/reset")
async def api_reset(mode: str = "blown_down"):
    """One-shot REST action, APP_SPEC.md section 5 and 6.1."""
    state.reset(pressurised=(mode == "pressurised"))
    return {"ok": True, "mode": mode}


_alarms = tg.load_alarms(ph.DEFAULT_CONFIG)
with open(ph.DEFAULT_CONFIG) as _f:
    _opcua_cfg = yaml.safe_load(_f).get("opcua", {})


@app.get("/api/config")
async def api_config():
    """Display-only config the UI needs but shouldn't hardcode — section 4.5
    alarm/trip setpoints and the default OPC UA endpoint (section 6.1's top
    bar). A different compressor package is a different config.yaml, not a
    frontend code change."""
    return {"alarms": _alarms, "opcua_default_endpoint": _opcua_cfg.get("endpoint")}


@app.post("/api/opcua/connect")
async def api_opcua_connect(endpoint: str | None = None):
    """One-shot REST action (section 5's transport note reserves REST for
    reset/config-reload-style one-shots; connect/disconnect is the same
    kind of action, not a fault or boundary edit)."""
    if state.opcua is not None and state.opcua.status()["connected"]:
        return {"ok": False, "error": "already connected", **state.opcua.status()}
    if state.opcua is not None:
        # Tear down any not-currently-connected leftover before replacing
        # it — otherwise its _loop() task (if for any reason still alive)
        # is orphaned: nothing but this object held a reference to it, but
        # an asyncio Task keeps running once created regardless of whether
        # anything still references its parent object.
        await state.opcua.disconnect()
    link = opcua_link.OpcuaLink(
        state,
        endpoint=endpoint or _opcua_cfg.get("endpoint", "opc.tcp://localhost:4840"),
        namespace_uri=_opcua_cfg.get("namespace_uri", ""),
        browse_path_prefix=_opcua_cfg.get("browse_path_prefix", []),
        watchdog_timeout_s=_opcua_cfg.get("watchdog_timeout_s", 2.0),
        node_addressing=_opcua_cfg.get("node_addressing", "browse"),
        node_id_pattern=_opcua_cfg.get("node_id_pattern"),
        tag_types=_opcua_cfg.get("tag_types"),
    )
    try:
        await link.connect()
    except Exception as exc:
        log.exception("opcua connect failed")
        return {"ok": False, "error": str(exc)}
    state.opcua = link
    return {"ok": True, **link.status()}


@app.post("/api/opcua/disconnect")
async def api_opcua_disconnect():
    if state.opcua is not None:
        await state.opcua.disconnect()
    return {"ok": True}


TRIVIAL_PAGE = """<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>compressor-sim raw state</title>
<style>
  body { background: #0d1117; color: #c9d1d9; font-family: monospace; padding: 1rem; }
  table { border-collapse: collapse; }
  td { padding: 2px 12px 2px 0; }
  #status { color: #8b949e; margin-bottom: 1rem; }
</style>
</head>
<body>
<h3>compressor-sim &mdash; raw physics state (step 2 diagnostic page)</h3>
<div id="status">connecting...</div>
<table id="rows"></table>
<script>
const status = document.getElementById('status');
const rows = document.getElementById('rows');
const ws = new WebSocket(`ws://${location.host}/ws`);
ws.onopen = () => status.textContent = 'connected';
ws.onclose = () => status.textContent = 'disconnected';
ws.onmessage = (ev) => {
  const data = JSON.parse(ev.data);
  const keys = Object.keys(data).sort();
  rows.innerHTML = keys.map(k =>
    `<tr><td>${k}</td><td>${JSON.stringify(data[k])}</td></tr>`).join('');
};
</script>
</body>
</html>
"""


FRONTEND_DIR = paths.frontend_dist_path()

if FRONTEND_DIR.exists():
    # Production/desktop: the built React app, served by this same process
    # (packaging spec Part A1). Registered last so it never shadows the
    # /api, /ws routes above — Starlette matches routes in registration
    # order, first match wins.
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        return FileResponse(FRONTEND_DIR / "index.html")
else:
    # Dev without a frontend build (npm run build not yet run): fall back
    # to the raw-state diagnostic page instead of a 404 on "/".
    @app.get("/", response_class=HTMLResponse)
    async def index():
        return TRIVIAL_PAGE

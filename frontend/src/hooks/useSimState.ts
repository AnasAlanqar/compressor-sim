import { useCallback, useEffect, useRef, useState } from 'react';

// Canonical tag values pushed by the backend, APP_SPEC.md section 4.1/4.2,
// plus a few housekeeping fields the websocket adds on top.
export type TagValue = number | boolean;
export interface SimTags {
  [tag: string]: TagValue;
}

export interface Flows {
  m_sup: number;
  m_byp: number;
  m_proc: number;
  m_bdv: number;
  m_comp: number;
}

export interface ValvePositions {
  Z_byp: number;
  Z_suc: number;
  Z_sesd: number;
  Z_desd: number;
  Z_bdv: number;
}

export interface BoundaryConditions {
  P_src_psig: number;
  P_proc_psig: number;
  T_suc_F: number;
  T_amb_F: number;
}

// Model-internal temperatures with no real transmitter (no interstage TTs
// in the I/O list) — simulator insight only, kept separate from SimTags so
// it can never be displayed as if the PLC could see it.
export interface SimInsight {
  T_suc_F: number;
  T_inter_F: number;
}

export interface OpcuaStatus {
  connected: boolean;
  endpoint: string | null;
  watchdog_ok?: boolean | null;
  error?: string | null;
}

export type SimMessage = SimTags & {
  sim_time_s: number;
  wall_time_s: number;
  running: boolean;
  flows: Flows;
  valves: ValvePositions;
  cmd_echo: SimTags;
  boundary: BoundaryConditions;
  sim_insight: SimInsight;
  opcua: OpcuaStatus;
};

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

const EMPTY_FLOWS: Flows = { m_sup: 0, m_byp: 0, m_proc: 0, m_bdv: 0, m_comp: 0 };
const EMPTY_VALVES: ValvePositions = { Z_byp: 0, Z_suc: 0, Z_sesd: 0, Z_desd: 0, Z_bdv: 0 };
const EMPTY_BOUNDARY: BoundaryConditions = { P_src_psig: 60, P_proc_psig: 1050, T_suc_F: 100, T_amb_F: 90 };
const EMPTY_SIM_INSIGHT: SimInsight = { T_suc_F: 100, T_inter_F: 100 };
const EMPTY_OPCUA: OpcuaStatus = { connected: false, endpoint: null };

export interface UseSimState {
  status: ConnectionStatus;
  tags: SimTags;
  flows: Flows;
  valves: ValvePositions;
  cmdEcho: SimTags;
  boundary: BoundaryConditions;
  simInsight: SimInsight;
  opcua: OpcuaStatus;
  simTime: number;
  running: boolean;
  sendCmd: (tags: Record<string, TagValue>) => void;
  sendRun: (running: boolean) => void;
  /** Raw escape hatch for message shapes beyond {type:"cmd", tags}, e.g.
   * fault toggles (section 5) once faults.py exists. */
  sendRaw: (msg: Record<string, unknown>) => void;
  /** High-frequency subscription (every ~100ms tick) for consumers that keep
   * their own buffers (e.g. TrendChart) and shouldn't force a full React
   * re-render of the tree on every tick. */
  subscribe: (cb: (msg: SimMessage) => void) => () => void;
}

function wsUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/ws`;
}

export function useSimState(): UseSimState {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [tags, setTags] = useState<SimTags>({});
  const [flows, setFlows] = useState<Flows>(EMPTY_FLOWS);
  const [valves, setValves] = useState<ValvePositions>(EMPTY_VALVES);
  const [cmdEcho, setCmdEcho] = useState<SimTags>({});
  const [boundary, setBoundary] = useState<BoundaryConditions>(EMPTY_BOUNDARY);
  const [simInsight, setSimInsight] = useState<SimInsight>(EMPTY_SIM_INSIGHT);
  const [opcua, setOpcua] = useState<OpcuaStatus>(EMPTY_OPCUA);
  const [simTime, setSimTime] = useState(0);
  const [running, setRunning] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const subscribers = useRef(new Set<(msg: SimMessage) => void>());

  useEffect(() => {
    let cancelled = false;
    let socket: WebSocket;
    let retryTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      if (cancelled) return;
      setStatus('connecting');
      socket = new WebSocket(wsUrl());
      wsRef.current = socket;

      socket.onopen = () => setStatus('connected');
      socket.onclose = () => {
        setStatus('disconnected');
        retryTimer = setTimeout(connect, 1000);
      };
      socket.onerror = () => socket.close();
      socket.onmessage = (ev) => {
        const data = JSON.parse(ev.data) as SimMessage;
        setTags(data);
        setFlows(data.flows ?? EMPTY_FLOWS);
        setValves(data.valves ?? EMPTY_VALVES);
        setCmdEcho(data.cmd_echo ?? {});
        setBoundary(data.boundary ?? EMPTY_BOUNDARY);
        setSimInsight(data.sim_insight ?? EMPTY_SIM_INSIGHT);
        setOpcua(data.opcua ?? EMPTY_OPCUA);
        setSimTime(data.sim_time_s);
        setRunning(Boolean(data.running));
        subscribers.current.forEach((cb) => cb(data));
      };
    };

    connect();
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      wsRef.current?.close();
    };
  }, []);

  const sendCmd = useCallback((cmdTags: Record<string, TagValue>) => {
    wsRef.current?.readyState === WebSocket.OPEN &&
      wsRef.current.send(JSON.stringify({ type: 'cmd', tags: cmdTags }));
  }, []);

  const sendRun = useCallback((value: boolean) => {
    wsRef.current?.readyState === WebSocket.OPEN &&
      wsRef.current.send(JSON.stringify({ type: 'cmd', running: value }));
  }, []);

  const subscribe = useCallback((cb: (msg: SimMessage) => void) => {
    subscribers.current.add(cb);
    return () => subscribers.current.delete(cb);
  }, []);

  const sendRaw = useCallback((msg: Record<string, unknown>) => {
    wsRef.current?.readyState === WebSocket.OPEN && wsRef.current.send(JSON.stringify(msg));
  }, []);

  return {
    status, tags, flows, valves, cmdEcho, boundary, simInsight, opcua, simTime, running,
    sendCmd, sendRun, sendRaw, subscribe,
  };
}

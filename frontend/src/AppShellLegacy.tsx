import { useEffect, useState } from 'react';
import { useSimState } from './hooks/useSimState';
import FaultPanel from './components/FaultPanel';
import ManualOverridePanel from './components/ManualOverridePanel';
import OpcuaSettingsModal from './components/OpcuaSettingsModal';
import PidDiagramLegacy from './components/PidDiagramLegacy';
import Tabs from './components/Tabs';
import TagTable from './components/TagTable';
import TrendChart from './components/TrendChart';
import type { AlarmTable } from './lib/pid';

// Frozen snapshot of the pre-restyle app shell, captured 2026-08-18
// (hmi-baseline-20260818) so Ctrl+Shift+L has a true old-app comparison.
// Do not edit to match new features — extend AppShellNew.tsx instead.

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'connected'
      ? 'bg-emerald-500'
      : status === 'connecting'
        ? 'bg-amber-500'
        : 'bg-red-500';
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />;
}

// The four headline numbers — the "read it from across the room" summary.
// Deliberately the largest text anywhere in the app; every other readout
// (P&ID gauges, tag table, per-stage badges) is secondary to these.
function Readout({ label, value, unit, alarm }: { label: string; value: string; unit: string; alarm?: boolean }) {
  return (
    <div className="flex flex-col items-start">
      <span className="text-xs uppercase tracking-widest text-neutral-500">{label}</span>
      <span className={`tabular text-5xl font-semibold leading-tight ${alarm ? 'text-red-400' : 'text-neutral-50'}`}>
        {value}
        <span className="ml-1.5 text-base font-normal text-neutral-500">{unit}</span>
      </span>
    </div>
  );
}

export default function AppShellLegacy() {
  const {
    status, tags, flows, valves, cmdEcho, boundary, simInsight, opcua, simTime, running,
    sendCmd, sendRun, sendRaw, subscribe,
  } = useSimState();
  const [resetMode, setResetMode] = useState<'blown_down' | 'pressurised'>('blown_down');
  const [alarms, setAlarms] = useState<AlarmTable>({});
  const [opcEndpoint, setOpcEndpoint] = useState('');
  const [opcBusy, setOpcBusy] = useState(false);
  const [opcSettingsOpen, setOpcSettingsOpen] = useState(false);

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((c) => {
        setAlarms(c.alarms ?? {});
        if (c.opcua_default_endpoint) setOpcEndpoint(c.opcua_default_endpoint);
      })
      .catch(() => {});
  }, []);

  const doReset = async () => {
    await fetch(`/api/reset?mode=${resetMode}`, { method: 'POST' });
  };

  const doOpcConnect = async () => {
    setOpcBusy(true);
    try {
      await fetch('/api/opcua/connect', { method: 'POST' });
    } finally {
      setOpcBusy(false);
    }
  };

  const doOpcDisconnect = async () => {
    setOpcBusy(true);
    try {
      await fetch('/api/opcua/disconnect', { method: 'POST' });
    } finally {
      setOpcBusy(false);
    }
  };

  const num = (tag: string) => (typeof tags[tag] === 'number' ? (tags[tag] as number) : 0);

  const opcConnected = opcua.connected;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-panel text-neutral-200">
      <header className="flex flex-wrap items-center gap-4 border-b border-neutral-800 bg-neutral-950 px-4 py-2">
        <div className="flex items-center gap-2 text-sm">
          <StatusDot status={status} />
          <span className="text-neutral-400">{status}</span>
        </div>
        <div className="tabular text-sm text-neutral-400">sim t={simTime.toFixed(1)}s</div>
        <button
          onClick={() => sendRun(!running)}
          className="rounded border border-neutral-700 bg-neutral-800 px-3 py-1 text-sm hover:bg-neutral-700"
        >
          {running ? 'Pause' : 'Run'}
        </button>
        <div className="flex items-center gap-2">
          <select
            value={resetMode}
            onChange={(e) => setResetMode(e.target.value as 'blown_down' | 'pressurised')}
            className="rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm"
          >
            <option value="blown_down">Reset — blown down</option>
            <option value="pressurised">Reset — pressurised</option>
          </select>
          <button
            onClick={doReset}
            className="rounded border border-neutral-700 bg-neutral-800 px-3 py-1 text-sm hover:bg-neutral-700"
          >
            Reset
          </button>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className={`h-2 w-2 rounded-full ${opcConnected ? 'bg-emerald-500' : 'bg-neutral-600'}`} />
          <span className="max-w-[16rem] truncate text-xs text-neutral-400" title={opcEndpoint}>
            {opcEndpoint || 'no endpoint configured'}
          </span>
          <button
            onClick={() => setOpcSettingsOpen(true)}
            title="OPC UA connection settings"
            className="rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700"
          >
            ⚙
          </button>
          {opcConnected ? (
            <button
              onClick={doOpcDisconnect}
              disabled={opcBusy}
              className="rounded border border-neutral-700 bg-neutral-800 px-3 py-1 text-sm hover:bg-neutral-700 disabled:opacity-50"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={doOpcConnect}
              disabled={opcBusy}
              className="rounded border border-neutral-700 bg-neutral-800 px-3 py-1 text-sm hover:bg-neutral-700 disabled:opacity-50"
            >
              Connect
            </button>
          )}
          {opcConnected && opcua.watchdog_ok === false && (
            <span className="text-xs text-red-400">watchdog stale</span>
          )}
          {opcua.error && <span className="text-xs text-red-400">{opcua.error}</span>}
        </div>
        <span className="ml-auto text-xs text-neutral-600">compressor-sim</span>
      </header>

      <main className="grid min-h-0 flex-1 grid-rows-[minmax(420px,3fr)_minmax(260px,2fr)] gap-4 overflow-y-auto p-4">
        <div className="flex min-h-[420px] flex-col overflow-hidden rounded border border-neutral-800 bg-neutral-900/60 p-3">
          <PidDiagramLegacy tags={tags} flows={flows} valves={valves} alarms={alarms} cmdEcho={cmdEcho} simInsight={simInsight} />
        </div>

        <div className="flex min-h-[260px] flex-col overflow-hidden rounded border border-neutral-800 bg-neutral-900/60 p-3">
          <Tabs
            tabs={[
              {
                key: 'overrides',
                label: 'Overrides',
                content: (
                  <ManualOverridePanel
                    disabled={opcConnected}
                    onChange={sendCmd}
                    readback={cmdEcho}
                    liveTags={tags}
                  />
                ),
              },
              { key: 'trends', label: 'Trends', content: <TrendChart subscribe={subscribe} alarms={alarms} /> },
              { key: 'faults', label: 'Faults', content: <FaultPanel onFault={sendRaw} boundary={boundary} /> },
              { key: 'tags', label: 'Tags', content: <TagTable tags={tags} /> },
            ]}
          />
        </div>
      </main>

      <footer className="flex flex-wrap items-center gap-x-12 gap-y-2 border-t border-neutral-800 bg-neutral-950 px-6 py-4">
        <Readout label="Suction" value={num('PT_1001').toFixed(1)} unit="psig" />
        <Readout label="Final discharge" value={num('PT_1006').toFixed(0)} unit="psig" />
        <Readout label="Speed" value={num('ST_1008').toFixed(0)} unit="rpm" />
        <Readout label="Flow" value={flows.m_comp.toFixed(2)} unit="kg/s" />
      </footer>

      {opcSettingsOpen && (
        <OpcuaSettingsModal
          connected={opcConnected}
          onClose={() => setOpcSettingsOpen(false)}
          onSaved={(endpoint) => setOpcEndpoint(endpoint)}
        />
      )}
    </div>
  );
}

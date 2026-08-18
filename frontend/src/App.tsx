import { useEffect, useState } from 'react';
import { useSimState } from './hooks/useSimState';
import { useTheme } from './hooks/useTheme';
import AppShellLegacy from './AppShellLegacy';
import FaultPanel from './components/FaultPanel';
import ManualOverridePanel from './components/ManualOverridePanel';
import OpcuaSettingsModal from './components/OpcuaSettingsModal';
import PidDiagram from './components/PidDiagram';
import Tabs from './components/Tabs';
import TagTable from './components/TagTable';
import TrendChart from './components/TrendChart';
import type { AlarmTable } from './lib/pid';
import { formatTag, formatValue } from './lib/engUnits';

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'connected' ? 'var(--text-value)' : status === 'connecting' ? 'var(--alm-p3)' : 'var(--alm-p2)';
  return <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />;
}

// The four headline numbers — the "read it from across the room" summary.
// Deliberately the largest text anywhere in the app; every other readout
// (P&ID gauges, tag table, per-stage badges) is secondary to these.
function Readout({ label, value, unit, alarm }: { label: string; value: string; unit: string; alarm?: boolean }) {
  return (
    <div className="flex flex-col items-start">
      <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-tag)' }}>{label}</span>
      <span
        className="tabular text-5xl font-medium leading-tight"
        style={{ color: alarm ? 'var(--alm-p1)' : 'var(--text-value)' }}
      >
        {value}
        <span className="ml-1.5 text-base font-normal" style={{ color: 'var(--text-tag)' }}>{unit}</span>
      </span>
    </div>
  );
}

// New (ISA-101) shell. Currently still the pre-Phase-6 layout, retokenized —
// Phase 6 replaces the JSX below with the titlebar/alarm-banner/dock
// restructure while AppShellLegacy.tsx (a frozen copy) stays untouched, so
// Ctrl+Shift+L keeps comparing against the true pre-restyle app throughout.
function AppShellNew() {
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
    <div
      className="flex h-screen flex-col overflow-hidden"
      style={{ backgroundColor: 'var(--hmi-canvas)', color: 'var(--text-value)' }}
    >
      <header
        className="flex flex-wrap items-center gap-4 px-4 py-2"
        style={{
          borderBottom: 'var(--w-hairline) solid var(--hmi-rule)',
          backgroundColor: 'var(--hmi-chrome)',
        }}
      >
        <div className="flex items-center gap-2 text-sm">
          <StatusDot status={status} />
          <span style={{ color: 'var(--text-tag)' }}>{status}</span>
        </div>
        <div className="tabular text-sm" style={{ color: 'var(--text-tag)' }}>sim t={simTime.toFixed(1)}s</div>
        <button onClick={() => sendRun(!running)} className="hmi-btn">
          {running ? 'Pause' : 'Run'}
        </button>
        <div className="flex items-center gap-2">
          <select
            value={resetMode}
            onChange={(e) => setResetMode(e.target.value as 'blown_down' | 'pressurised')}
            className="hmi-btn"
          >
            <option value="blown_down">Reset — blown down</option>
            <option value="pressurised">Reset — pressurised</option>
          </select>
          <button onClick={doReset} className="hmi-btn">
            Reset
          </button>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span
            className="h-2 w-2"
            style={{ backgroundColor: opcConnected ? 'var(--text-value)' : 'var(--hmi-surface-sunken)' }}
          />
          <span className="max-w-[16rem] truncate text-xs" style={{ color: 'var(--text-tag)' }} title={opcEndpoint}>
            {opcEndpoint || 'no endpoint configured'}
          </span>
          <button
            onClick={() => setOpcSettingsOpen(true)}
            title="OPC UA connection settings"
            className="hmi-btn text-xs"
          >
            ⚙
          </button>
          {opcConnected ? (
            <button onClick={doOpcDisconnect} disabled={opcBusy} className="hmi-btn disabled:opacity-50">
              Disconnect
            </button>
          ) : (
            <button onClick={doOpcConnect} disabled={opcBusy} className="hmi-btn disabled:opacity-50">
              Connect
            </button>
          )}
          {opcConnected && opcua.watchdog_ok === false && (
            <span className="text-xs" style={{ color: 'var(--alm-p1)' }}>watchdog stale</span>
          )}
          {opcua.error && <span className="text-xs" style={{ color: 'var(--alm-p1)' }}>{opcua.error}</span>}
        </div>
        <span className="ml-auto text-xs" style={{ color: 'var(--text-disabled)' }}>compressor-sim</span>
      </header>

      <main className="grid min-h-0 flex-1 grid-rows-[minmax(420px,3fr)_minmax(260px,2fr)] gap-4 overflow-y-auto p-4">
        <div
          className="flex min-h-[420px] flex-col overflow-hidden p-3"
          style={{ border: 'var(--w-hairline) solid var(--hmi-rule)', backgroundColor: 'var(--hmi-surface)' }}
        >
          <PidDiagram tags={tags} flows={flows} valves={valves} alarms={alarms} cmdEcho={cmdEcho} simInsight={simInsight} />
        </div>

        <div
          className="flex min-h-[260px] flex-col overflow-hidden p-3"
          style={{ border: 'var(--w-hairline) solid var(--hmi-rule)', backgroundColor: 'var(--hmi-surface)' }}
        >
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

      <footer
        className="flex flex-wrap items-center gap-x-12 gap-y-2 px-6 py-4"
        style={{ borderTop: 'var(--w-hairline) solid var(--hmi-rule)', backgroundColor: 'var(--hmi-chrome)' }}
      >
        <Readout label="Suction" value={formatTag('PT_1001', num('PT_1001')).text} unit={formatTag('PT_1001', num('PT_1001')).unit} />
        <Readout label="Final discharge" value={formatTag('PT_1006', num('PT_1006')).text} unit={formatTag('PT_1006', num('PT_1006')).unit} />
        <Readout label="Speed" value={formatValue('speed', num('ST_1008')).text} unit={formatValue('speed', num('ST_1008')).unit} />
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

export default function App() {
  const [theme] = useTheme();
  return theme === 'legacy' ? <AppShellLegacy /> : <AppShellNew />;
}

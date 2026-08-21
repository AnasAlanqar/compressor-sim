import { useEffect, useState } from 'react';
import { useSimState } from './hooks/useSimState';
import { useTheme, type Theme } from './hooks/useTheme';
import AppShellLegacy from './AppShellLegacy';
import OpcuaSettingsModal from './components/OpcuaSettingsModal';
import PidDiagram from './components/PidDiagram';
import StageDetailStrip from './components/StageDetailStrip';
import Titlebar from './components/Titlebar';
import TrendWorkspace from './components/TrendWorkspace';
import Toolbar from './components/Toolbar';
import DriverStrip from './components/DriverStrip';
import RightDock from './components/RightDock';
import type { AlarmTable } from './lib/pid';

// New (ISA-101) shell: custom titlebar, toolbar, mimic +
// right dock, driver strip (§9). AppShellLegacy.tsx (frozen) is the true
// pre-restyle comparison behind Ctrl+Shift+L.
function AppShellNew({ theme, setTheme }: { theme: Theme; setTheme: (t: Theme) => void }) {
  const {
    status, tags, flows, valves, cmdEcho, boundary, opcua, simTime, running,
    sendCmd, sendRun, sendRaw, subscribe,
  } = useSimState();
  const [resetMode, setResetMode] = useState<'blown_down' | 'pressurised'>('blown_down');
  const [alarms, setAlarms] = useState<AlarmTable>({});
  const [opcEndpoint, setOpcEndpoint] = useState('');
  const [opcBusy, setOpcBusy] = useState(false);
  const [opcSettingsOpen, setOpcSettingsOpen] = useState(false);
  const [trendsOpen, setTrendsOpen] = useState(false);

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

  const opcConnected = opcua.connected;

  return (
    <div
      className="flex h-screen flex-col overflow-hidden"
      style={{ backgroundColor: 'var(--hmi-canvas)', color: 'var(--text-value)' }}
    >
      <Titlebar />
      <Toolbar
        status={status}
        simTime={simTime}
        running={running}
        onToggleRun={() => sendRun(!running)}
        resetMode={resetMode}
        onResetModeChange={setResetMode}
        onReset={doReset}
        opcConnected={opcConnected}
        opcEndpoint={opcEndpoint}
        opcBusy={opcBusy}
        onOpcSettings={() => setOpcSettingsOpen(true)}
        onOpcConnect={doOpcConnect}
        onOpcDisconnect={doOpcDisconnect}
        watchdogStale={opcConnected && opcua.watchdog_ok === false}
        opcError={opcua.error ?? null}
        theme={theme}
        onCycleTheme={() => setTheme(theme === 'light' ? 'cool' : theme === 'cool' ? 'dark' : 'light')}
        onOpenTrends={() => setTrendsOpen(true)}
      />

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* mimic pane / detail strip: 60/40 split (§9 restyle Task 3) —
              the strip is a fixed-height reservation off the bottom, not a
              flex-basis fight, so it can't get squeezed by mimic content. */}
          <div className="min-h-0 overflow-hidden p-2" style={{ flex: '3 1 0' }}>
            <PidDiagram tags={tags} flows={flows} valves={valves} cmdEcho={cmdEcho} />
          </div>
          <div className="min-h-0 overflow-hidden" style={{ flex: '2 1 0', borderTop: 'var(--w-hairline) solid var(--hmi-rule)' }}>
            <StageDetailStrip tags={tags} cmdEcho={cmdEcho} alarms={alarms} stale={status !== 'connected'} />
          </div>
        </div>
        <RightDock
          sendCmd={sendCmd}
          readback={cmdEcho}
          liveTags={tags}
          opcConnected={opcConnected}
          onFault={sendRaw}
          boundary={boundary}
          tags={tags}
        />
      </div>

      <DriverStrip tags={tags} alarms={alarms} stale={status !== 'connected'} />

      {opcSettingsOpen && (
        <OpcuaSettingsModal
          connected={opcConnected}
          onClose={() => setOpcSettingsOpen(false)}
          onSaved={(endpoint) => setOpcEndpoint(endpoint)}
        />
      )}
      {trendsOpen && <TrendWorkspace subscribe={subscribe} limits={alarms} onClose={() => setTrendsOpen(false)} />}
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useTheme();
  return theme === 'legacy' ? <AppShellLegacy /> : <AppShellNew theme={theme} setTheme={setTheme} />;
}

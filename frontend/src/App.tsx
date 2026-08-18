import { useEffect, useState } from 'react';
import { useSimState } from './hooks/useSimState';
import { useTheme } from './hooks/useTheme';
import { useAlarmEvents } from './hooks/useAlarmEvents';
import AppShellLegacy from './AppShellLegacy';
import OpcuaSettingsModal from './components/OpcuaSettingsModal';
import PidDiagram from './components/PidDiagram';
import Titlebar from './components/Titlebar';
import AlarmBanner from './components/AlarmBanner';
import Toolbar from './components/Toolbar';
import DriverStrip from './components/DriverStrip';
import RightDock from './components/RightDock';
import type { AlarmTable } from './lib/pid';

// New (ISA-101) shell: custom titlebar, alarm banner, toolbar, mimic +
// right dock, driver strip (§9). AppShellLegacy.tsx (frozen) is the true
// pre-restyle comparison behind Ctrl+Shift+L.
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

  const { summary, unackedCount, highestUnacked, ack } = useAlarmEvents(tags, alarms, simTime);

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
      <AlarmBanner highest={highestUnacked} unackedCount={unackedCount} onAck={ack} />
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
      />

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-hidden p-2">
          <PidDiagram
            tags={tags} flows={flows} valves={valves} alarms={alarms} cmdEcho={cmdEcho} simInsight={simInsight}
            stale={status !== 'connected'}
          />
        </div>
        <RightDock
          summary={summary}
          ack={ack}
          subscribe={subscribe}
          alarms={alarms}
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
    </div>
  );
}

export default function App() {
  const [theme] = useTheme();
  return theme === 'legacy' ? <AppShellLegacy /> : <AppShellNew />;
}

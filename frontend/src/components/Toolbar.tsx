interface Props {
  status: string;
  simTime: number;
  running: boolean;
  onToggleRun: () => void;
  resetMode: 'blown_down' | 'pressurised';
  onResetModeChange: (m: 'blown_down' | 'pressurised') => void;
  onReset: () => void;
  opcConnected: boolean;
  opcEndpoint: string;
  opcBusy: boolean;
  onOpcSettings: () => void;
  onOpcConnect: () => void;
  onOpcDisconnect: () => void;
  watchdogStale: boolean;
  opcError: string | null;
  theme: 'light' | 'dark' | 'cool' | 'legacy';
  onCycleTheme: () => void;
  onOpenTrends: () => void;
}

// 36px toolbar (§9 [C]) — connection state is a 6px square, not a circle,
// and never green: filled --text-value when connected, hollow --alm-p2
// when not (§7's "connection status" example of the green-for-everything
// problem this restyle exists to fix).
export default function Toolbar({
  status,
  simTime,
  running,
  onToggleRun,
  resetMode,
  onResetModeChange,
  onReset,
  opcConnected,
  opcEndpoint,
  opcBusy,
  onOpcSettings,
  onOpcConnect,
  onOpcDisconnect,
  watchdogStale,
  opcError,
  theme,
  onCycleTheme,
  onOpenTrends,
}: Props) {
  return (
    <div
      className="flex h-9 shrink-0 items-center gap-4 px-3"
      style={{ backgroundColor: 'var(--hmi-surface)', borderBottom: 'var(--w-hairline) solid var(--hmi-rule)' }}
    >
      <div className="flex items-center gap-2">
        <svg width={6} height={6}>
          <rect
            width={6}
            height={6}
            fill={status === 'connected' ? 'var(--text-value)' : 'none'}
            stroke={status === 'connected' ? 'none' : 'var(--alm-p2)'}
            strokeWidth={1}
          />
        </svg>
        <span style={{ fontSize: 'var(--fs-tag)', color: 'var(--text-tag)' }}>{status}</span>
      </div>
      <span className="tabular" style={{ fontFamily: 'var(--font-value)', fontSize: 'var(--fs-tag)', color: 'var(--text-tag)' }}>
        sim t={simTime.toFixed(1)}s
      </span>
      <button type="button" onClick={onToggleRun} className="hmi-btn">
        {running ? 'Pause' : 'Run'}
      </button>
      <select
        value={resetMode}
        onChange={(e) => onResetModeChange(e.target.value as 'blown_down' | 'pressurised')}
        className="hmi-btn"
      >
        <option value="blown_down">Reset — blown down</option>
        <option value="pressurised">Reset — pressurised</option>
      </select>
      <button type="button" onClick={onReset} className="hmi-btn">
        Reset
      </button>
      <button type="button" onClick={onOpenTrends} className="hmi-btn">
        Engineering Trends
      </button>

      <div className="ml-auto flex items-center gap-2">
        <svg width={6} height={6}>
          <rect
            width={6}
            height={6}
            fill={opcConnected ? 'var(--text-value)' : 'none'}
            stroke={opcConnected ? 'none' : 'var(--alm-p2)'}
            strokeWidth={1}
          />
        </svg>
        <span
          className="max-w-[16rem] truncate tabular"
          style={{ fontFamily: 'var(--font-value)', fontSize: 'var(--fs-tag)', color: 'var(--text-tag)' }}
          title={opcEndpoint}
        >
          {opcEndpoint || 'no endpoint configured'}
        </span>
        <button type="button" onClick={onOpcSettings} title="OPC UA connection settings" className="hmi-btn">
          ⚙
        </button>
        {opcConnected ? (
          <button type="button" onClick={onOpcDisconnect} disabled={opcBusy} className="hmi-btn">
            Disconnect
          </button>
        ) : (
          <button type="button" onClick={onOpcConnect} disabled={opcBusy} className="hmi-btn">
            Connect
          </button>
        )}
        {watchdogStale && <span style={{ fontSize: 'var(--fs-tag)', color: 'var(--alm-p1)' }}>watchdog stale</span>}
        {opcError && <span style={{ fontSize: 'var(--fs-tag)', color: 'var(--alm-p1)' }}>{opcError}</span>}
        <button
          type="button"
          onClick={onCycleTheme}
          title="Cycle theme (light / cool / dark). Ctrl+Shift+L for legacy A/B."
          className="hmi-btn"
        >
          theme: {theme}
        </button>
      </div>
    </div>
  );
}

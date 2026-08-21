import type { UseSimState } from '../hooks/useSimState';
import type { AlarmTable } from '../lib/pid';
import TrendChart from './TrendChart';

export default function TrendWorkspace({
  subscribe,
  limits,
  onClose,
}: {
  subscribe: UseSimState['subscribe'];
  limits: AlarmTable;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ backgroundColor: 'var(--hmi-canvas)', color: 'var(--text-value)' }}>
      <header className="flex h-14 shrink-0 items-center gap-5 px-5" style={{ backgroundColor: 'var(--hmi-surface)', borderBottom: '1px solid var(--hmi-rule-strong)' }}>
        <div>
          <div className="text-sm font-semibold tracking-[0.12em]">ENGINEERING TRENDS</div>
          <div className="text-xs" style={{ color: 'var(--text-tag)' }}>10 Hz acquisition · 30 minute rolling buffer · simulation time base</div>
        </div>
        <div className="ml-auto text-xs" style={{ color: 'var(--text-tag)' }}>
          Dashed lines are configured engineering limits, not simulator alarms.
        </div>
        <button type="button" className="hmi-btn" onClick={onClose}>CLOSE TRENDS</button>
      </header>
      <main className="min-h-0 flex-1 p-5">
        <TrendChart subscribe={subscribe} alarms={limits} height="workspace" />
      </main>
    </div>
  );
}

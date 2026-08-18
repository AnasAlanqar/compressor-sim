import type { AlarmEvent } from '../hooks/useAlarmEvents';

// 28px, always present (§9 [B]) — a banner that appears/disappears causes
// layout shift and trains operators to ignore it, so "no active alarms"
// is a steady state, not an absence of the component.
export default function AlarmBanner({
  highest,
  unackedCount,
  onAck,
}: {
  highest: AlarmEvent | undefined;
  unackedCount: number;
  onAck: (id: string) => void;
}) {
  const color = highest ? (highest.priority === 'p1' ? 'var(--alm-p1)' : 'var(--alm-p2)') : 'transparent';
  return (
    <div
      className="flex h-7 shrink-0 items-center gap-3 pr-3"
      style={{ backgroundColor: 'var(--hmi-surface)', borderBottom: 'var(--w-hairline) solid var(--hmi-rule)' }}
    >
      <div className="h-full" style={{ width: 4, backgroundColor: color }} />
      {highest ? (
        <>
          <span className="tabular text-xs" style={{ fontFamily: 'var(--font-value)', color: 'var(--text-tag)' }}>
            t={highest.simTime.toFixed(1)}s
          </span>
          <span className="text-xs" style={{ fontFamily: 'var(--font-value)', color: 'var(--text-value)' }}>
            {highest.tag}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-value)' }}>
            {highest.description}
          </span>
          <span className="ml-auto text-xs" style={{ color: 'var(--text-tag)' }}>
            {unackedCount} UNACK
          </span>
          <button type="button" onClick={() => onAck(highest.id)} className="hmi-btn text-xs">
            ACK
          </button>
        </>
      ) : (
        <span className="text-xs" style={{ color: 'var(--text-tag)' }}>NO ACTIVE ALARMS</span>
      )}
    </div>
  );
}

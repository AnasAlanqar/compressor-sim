import { useEffect, useRef, useState } from 'react';
import type { UseSimState, SimMessage } from '../hooks/useSimState';
import type { AlarmBand } from '../lib/pid';
import { formatTag } from '../lib/engUnits';

const W = 216;
const H = 32;
const N = 60;

// §9 [F] TRENDS: 60-sample rolling buffer, 1px polyline, no axes/gridlines/
// fill — deliberately not the full uPlot TrendChart (that stays as the
// interactive multi-pen tool); this is a glance-only dock miniature.
export default function Sparkline({
  tag,
  label,
  subscribe,
  band,
}: {
  tag: string;
  label: string;
  subscribe: UseSimState['subscribe'];
  band?: AlarmBand;
}) {
  const buf = useRef<number[]>([]);
  const [, force] = useState(0);

  useEffect(() => {
    const unsub = subscribe((msg: SimMessage) => {
      const v = msg[tag];
      if (typeof v !== 'number') return;
      buf.current = [...buf.current, v].slice(-N);
      force((n) => n + 1);
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tag]);

  const data = buf.current;
  const current = data[data.length - 1] ?? 0;
  const [loSd, , , hiSd] = band ?? [null, null, null, null];
  const lo = loSd ?? Math.min(...data, current, 0);
  const hi = hiSd ?? Math.max(...data, current, 1);
  const span = hi - lo || 1;
  const toY = (v: number) => H - ((v - lo) / span) * H;
  const points = data.map((v, i) => `${(i / Math.max(1, N - 1)) * W},${toY(v).toFixed(1)}`).join(' ');
  const formatted = formatTag(tag, current);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span style={{ fontSize: 'var(--fs-tag)', color: 'var(--text-tag)', letterSpacing: '0.08em' }}>{label}</span>
        <span className="tabular" style={{ fontFamily: 'var(--font-value)', fontSize: 'var(--fs-value-sm)', color: 'var(--text-value)' }}>
          {formatted.text}
          <span style={{ fontSize: 'var(--fs-tag)', color: 'var(--text-tag)', marginLeft: 3 }}>{formatted.unit}</span>
        </span>
      </div>
      <svg width={W} height={H} shapeRendering="crispEdges">
        {loSd !== null && <line x1={0} x2={W} y1={toY(loSd)} y2={toY(loSd)} stroke="var(--alm-p1)" strokeWidth={0.5} />}
        {hiSd !== null && <line x1={0} x2={W} y1={toY(hiSd)} y2={toY(hiSd)} stroke="var(--alm-p1)" strokeWidth={0.5} />}
        {data.length > 1 && <polyline points={points} fill="none" stroke="var(--text-value)" strokeWidth={1} />}
      </svg>
    </div>
  );
}

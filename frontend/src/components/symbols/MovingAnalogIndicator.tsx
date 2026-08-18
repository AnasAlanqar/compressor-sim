import type { AlarmBand } from '../../lib/pid';

// §8: "the single highest-value addition in the whole redesign" — a
// 104x4px track showing where a live value sits relative to its
// configured alarm limits, so operators read position-relative-to-limit
// instead of parsing a number against a setpoint they have to remember.
const TRACK_W = 104;
const TRACK_H = 4;

function engRange(band: AlarmBand): [number, number] {
  const [loSd, loAlarm, hiAlarm, hiSd] = band;
  const lo = loSd ?? loAlarm ?? 0;
  const hi = hiSd ?? hiAlarm ?? lo + 100;
  const span = hi - lo || 1;
  const margin = span * 0.15;
  return [lo - margin, hi + margin];
}

export default function MovingAnalogIndicator({
  x,
  y,
  value,
  band,
  state,
}: {
  x: number;
  y: number;
  value: number;
  band: AlarmBand;
  state: 'normal' | 'amber' | 'red';
}) {
  const [lo, hiRange] = engRange(band);
  const span = hiRange - lo || 1;
  const pos = (v: number) => Math.min(TRACK_W, Math.max(0, ((v - lo) / span) * TRACK_W));
  const [loSd, loAlarm, hiAlarm, hiSd] = band;
  const markColor = state === 'red' ? 'var(--alm-p1)' : state === 'amber' ? 'var(--alm-p2)' : 'var(--text-value)';
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={0} y={0} width={TRACK_W} height={TRACK_H} fill="var(--hmi-surface-sunken)" />
      {loAlarm !== null && hiAlarm !== null && (
        <rect x={pos(loAlarm)} y={0} width={Math.max(0, pos(hiAlarm) - pos(loAlarm))} height={TRACK_H} fill="var(--hmi-surface)" />
      )}
      {loSd !== null && <rect x={pos(loSd) - 0.5} y={-3} width={1} height={TRACK_H + 6} fill="var(--alm-p1)" />}
      {hiSd !== null && <rect x={pos(hiSd) - 0.5} y={-3} width={1} height={TRACK_H + 6} fill="var(--alm-p1)" />}
      {loAlarm !== null && <rect x={pos(loAlarm) - 0.5} y={-3} width={1} height={TRACK_H + 6} fill="var(--alm-p2)" />}
      {hiAlarm !== null && <rect x={pos(hiAlarm) - 0.5} y={-3} width={1} height={TRACK_H + 6} fill="var(--alm-p2)" />}
      <rect x={pos(value) - 1.5} y={-1} width={3} height={TRACK_H + 2} fill={markColor} />
    </g>
  );
}

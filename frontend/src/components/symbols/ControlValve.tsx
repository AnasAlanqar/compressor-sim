import { formatValue } from '../../lib/engUnits';

// ISA-5.1 control valve: bowtie body, stem to a diaphragm actuator (dome).
// Shows position as a tabular percent, unlike GateValve/BlowdownValve
// (discrete CMD_ tags, no numeric readout). Used for FC_3002 (bypass) and
// FC_3003 (suction control).
export default function ControlValve({
  x,
  y,
  pct,
  label,
  orientation = 'h',
  scale = 1,
  minUnits = 0,
}: {
  x: number;
  y: number;
  pct: number;
  label: string;
  orientation?: 'h' | 'v';
  /** Uniform size multiplier on the glyph body only — see GateValve's
   * `scale`. */
  scale?: number;
  /** Typography floor (Task 4) — see GateValve's `minUnits`. */
  minUnits?: number;
}) {
  const closed = pct < 2;
  const open = pct > 98;
  const transit = !closed && !open;
  const fill = closed ? 'var(--equip-fill)' : open ? 'var(--hmi-canvas)' : 'var(--equip-fill-active)';
  const stroke = 'var(--equip-stroke)';
  const rot = orientation === 'v' ? 90 : 0;
  const stateWord = closed ? 'CLOSED' : open ? 'OPEN' : 'MOVING';
  const formatted = formatValue('FC', pct);
  return (
    <g transform={`translate(${x},${y})`}>
      <g transform={`scale(${scale})`}>
        <g transform={`rotate(${rot})`}>
          <line x1={0} y1={0} x2={0} y2={-46} stroke={stroke} strokeWidth={2} />
          {/* diaphragm actuator dome */}
          <path d="M-16,-64 A16,16 0 0 1 16,-64 Z" fill="var(--hmi-canvas)" stroke={stroke} strokeWidth={1.5} />
          <path d="M-46,-32 L-46,32 L0,0 Z M46,-32 L46,32 L0,0 Z" fill={fill} stroke={stroke} strokeWidth={1.5} />
          {transit && (
            <line x1={-46} y1={0} x2={46} y2={0} stroke="var(--alm-p2)" strokeWidth={1.5} strokeDasharray="4 4" />
          )}
        </g>
      </g>
      <text
        y={-104 * scale}
        textAnchor="middle"
        fontSize={Math.max(24 * scale, minUnits)}
        fontFamily="var(--font-value)"
        fontWeight={500}
        fill="var(--text-value)"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {formatted.text}
        <tspan fontFamily="var(--font-label)" fill="var(--text-tag)"> {formatted.unit}</tspan>
      </text>
      <text y={-84 * scale} textAnchor="middle" fontSize={Math.max(13 * scale, minUnits)} fontWeight={500} letterSpacing={0.5} fill="var(--text-label)">
        {stateWord}
      </text>
      <text y={52 * scale} textAnchor="middle" fontSize={Math.max(19 * scale, minUnits)} fill="var(--text-label)">
        {label}
      </text>
    </g>
  );
}

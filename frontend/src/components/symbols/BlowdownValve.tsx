// ISA-5.1 blowdown valve: bowtie body, outlet leg pointing to a vent
// (open chevron) with an "ATM" rule. Used for CMD_4004 — discrete, no
// numeric readout, oriented vertically (suction -> atmosphere).
export default function BlowdownValve({
  x,
  y,
  pct,
  label,
  tag,
}: {
  x: number;
  y: number;
  pct: number;
  label: string;
  tag: string;
}) {
  const closed = pct < 2;
  const open = pct > 98;
  const transit = !closed && !open;
  const fill = closed ? 'var(--equip-fill)' : open ? 'var(--hmi-canvas)' : 'var(--equip-fill-active)';
  const stroke = 'var(--equip-stroke)';
  const stateWord = closed ? 'CLOSED' : open ? 'OPEN' : 'MOVING';
  return (
    <g transform={`translate(${x},${y})`}>
      <g transform="rotate(90)">
        <path d="M-46,-32 L-46,32 L0,0 Z M46,-32 L46,32 L0,0 Z" fill={fill} stroke={stroke} strokeWidth={1.5} />
        {closed && <rect x={-10} y={-36} width={20} height={72} fill="var(--hmi-canvas)" stroke={stroke} strokeWidth={1.5} />}
        {transit && <line x1={-46} y1={0} x2={46} y2={0} stroke="var(--alm-p2)" strokeWidth={1.5} strokeDasharray="4 4" />}
      </g>
      <text y={-70} textAnchor="middle" fontSize={14} fontWeight={500} letterSpacing={0.6} fill="var(--text-label)">
        {stateWord}
      </text>
      <text y={54} textAnchor="middle" fontSize={19} fill="var(--text-label)">
        {label}
      </text>
      <text y={75} textAnchor="middle" fontSize={15} fill="var(--text-tag)">
        {tag}
      </text>
    </g>
  );
}

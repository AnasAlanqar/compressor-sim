// ISA-5.1 gate/block valve: bowtie body, stem to an actuator block. ESD
// valves get a filled actuator block; ordinary gate valves an open one.
// Position (not color) carries state — see tokens.css / THEME.md "normal
// state carries no color". Used for Suction ESD (CMD_4009) and Discharge
// ESD (CMD_4010).
export default function GateValve({
  x,
  y,
  pct,
  label,
  tag,
  esd = true,
  orientation = 'h',
}: {
  x: number;
  y: number;
  pct: number;
  label: string;
  tag: string;
  esd?: boolean;
  orientation?: 'h' | 'v';
}) {
  const closed = pct < 2;
  const open = pct > 98;
  const transit = !closed && !open;
  const fill = closed ? 'var(--equip-fill)' : open ? 'var(--hmi-canvas)' : 'var(--equip-fill-active)';
  const stroke = 'var(--equip-stroke)';
  const rot = orientation === 'v' ? 90 : 0;
  const stateWord = closed ? 'CLOSED' : open ? 'OPEN' : 'MOVING';
  return (
    <g transform={`translate(${x},${y})`}>
      <g transform={`rotate(${rot})`}>
        <line x1={0} y1={0} x2={0} y2={-46} stroke={stroke} strokeWidth={2} />
        <rect x={-11} y={-64} width={22} height={18} fill={esd ? stroke : 'var(--hmi-canvas)'} stroke={stroke} strokeWidth={1.5} />
        <path d="M-46,-32 L-46,32 L0,0 Z M46,-32 L46,32 L0,0 Z" fill={fill} stroke={stroke} strokeWidth={1.5} />
        {closed && <rect x={-10} y={-36} width={20} height={72} fill="var(--hmi-canvas)" stroke={stroke} strokeWidth={1.5} />}
        {transit && (
          <line x1={-46} y1={0} x2={46} y2={0} stroke="var(--alm-p2)" strokeWidth={1.5} strokeDasharray="4 4" />
        )}
      </g>
      <text y={-88} textAnchor="middle" fontSize={14} fontWeight={500} letterSpacing={0.6} fill="var(--text-label)">
        {stateWord}
      </text>
      <text y={52} textAnchor="middle" fontSize={19} fill="var(--text-label)">
        {label}
      </text>
      <text y={73} textAnchor="middle" fontSize={15} fill="var(--text-tag)">
        {tag}
      </text>
    </g>
  );
}

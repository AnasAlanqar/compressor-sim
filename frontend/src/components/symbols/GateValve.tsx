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
  esd = true,
  orientation = 'h',
  scale = 1,
  minUnits = 0,
}: {
  x: number;
  y: number;
  pct: number;
  label: string;
  esd?: boolean;
  orientation?: 'h' | 'v';
  /** Uniform size multiplier on the glyph body only (not its labels — see
   * minUnits) — the pipe budget (PidDiagram's fixed 40-unit runs) needs
   * this narrower than the valve's native ~92-unit bowtie width on the
   * main process line. */
  scale?: number;
  /** Typography floor (Task 4): the label/state text sit in their own
   * unscaled group (not inside the `scale` transform above) specifically
   * so this floor — computed by PidDiagram from the live container-to-
   * viewBox ratio — can guarantee >=11px effective text independent of
   * how small `scale` has shrunk the glyph body. 0 = no floor applied. */
  minUnits?: number;
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
      <g transform={`scale(${scale})`}>
        <g transform={`rotate(${rot})`}>
          <line x1={0} y1={0} x2={0} y2={-46} stroke={stroke} strokeWidth={2} />
          <rect x={-11} y={-64} width={22} height={18} fill={esd ? stroke : 'var(--hmi-canvas)'} stroke={stroke} strokeWidth={1.5} />
          <path d="M-46,-32 L-46,32 L0,0 Z M46,-32 L46,32 L0,0 Z" fill={fill} stroke={stroke} strokeWidth={1.5} />
          {closed && <rect x={-10} y={-36} width={20} height={72} fill="var(--hmi-canvas)" stroke={stroke} strokeWidth={1.5} />}
          {transit && (
            <line x1={-46} y1={0} x2={46} y2={0} stroke="var(--alm-p2)" strokeWidth={1.5} strokeDasharray="4 4" />
          )}
        </g>
      </g>
      <text y={-88 * scale} textAnchor="middle" fontSize={Math.max(14 * scale, minUnits)} fontWeight={500} letterSpacing={0.6} fill="var(--text-label)">
        {stateWord}
      </text>
      <text y={52 * scale} textAnchor="middle" fontSize={Math.max(19 * scale, minUnits)} fill="var(--text-label)">
        {label}
      </text>
    </g>
  );
}

// ISA-5.1 blowdown valve: bowtie body, outlet leg pointing to a vent
// (open chevron) with an "ATM" rule. Used for CMD_4004 — discrete, no
// numeric readout, oriented vertically (suction -> atmosphere).
export default function BlowdownValve({
  x,
  y,
  pct,
  label,
  scale = 1,
  minUnits = 0,
}: {
  x: number;
  y: number;
  pct: number;
  label: string;
  /** Size multiplier on the glyph body only (labels are floored by
   * minUnits) — the native bowtie is ~92 units, far bigger than the
   * scaled-down process valves it sits among; keep it in proportion. */
  scale?: number;
  /** Typography floor (Task 4) — see GateValve's `minUnits`. */
  minUnits?: number;
}) {
  const closed = pct < 2;
  const open = pct > 98;
  const transit = !closed && !open;
  const fill = closed ? 'var(--equip-fill)' : open ? 'var(--hmi-canvas)' : 'var(--equip-fill-active)';
  const stroke = 'var(--equip-stroke)';
  const stateWord = closed ? 'CLOSED' : open ? 'OPEN' : 'MOVING';
  // The rotated bowtie is 64 wide (x = -32..32); labels tuck just left of it.
  const labelX = -(32 * scale + 8);
  return (
    <g transform={`translate(${x},${y})`}>
      <g transform={`scale(${scale})`}>
        <g transform="rotate(90)">
          <path d="M-46,-32 L-46,32 L0,0 Z M46,-32 L46,32 L0,0 Z" fill={fill} stroke={stroke} strokeWidth={1.5} />
          {closed && <rect x={-10} y={-36} width={20} height={72} fill="var(--hmi-canvas)" stroke={stroke} strokeWidth={1.5} />}
          {transit && <line x1={-46} y1={0} x2={46} y2={0} stroke="var(--alm-p2)" strokeWidth={1.5} strokeDasharray="4 4" />}
        </g>
      </g>
      {/* Labels sit to the LEFT of the valve, not stacked above/below it:
          this is a vertical valve (suction -> atmosphere), so its inlet
          pipe, outlet pipe and vent plume all run straight down the center
          line — a name/state label centered under it lands right on top of
          them. The blowdown branch has open canvas to its left at this
          height (the process-line equipment all sits well above), so the
          labels tuck there cleanly. */}
      <text x={labelX} y={-3} textAnchor="end" fontSize={Math.max(17, minUnits)} fill="var(--text-label)">
        {label}
      </text>
      <text x={labelX} y={15} textAnchor="end" fontSize={Math.max(13, minUnits)} fontWeight={500} letterSpacing={0.6} fill="var(--text-label)">
        {stateWord}
      </text>
    </g>
  );
}

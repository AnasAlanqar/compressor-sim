// ISA-5.1-flavored reciprocating compressor cylinder: cooling ribs, a
// piston-rod stub on the crank end, suction/discharge valve nubs. Used for
// ST1/ST2/ST3.
export default function ReciprocatingCylinder({
  x,
  y,
  label,
  rpm,
  width = 144,
  height = 134,
  minUnits = 0,
}: {
  x: number;
  y: number;
  label: string;
  rpm: number;
  width?: number;
  height?: number;
  /** Typography floor (Task 4) — see GateValve's `minUnits`. */
  minUnits?: number;
}) {
  const running = rpm > 5;
  const w = width;
  const h = height;
  const stroke = running ? 'var(--equip-stroke)' : 'var(--equip-stroke-idle)';
  const sw = running ? 1.5 : 1;
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={running ? 'var(--equip-fill-active)' : 'var(--equip-fill)'} stroke={stroke} strokeWidth={sw} />
      {/* cooling ribs */}
      {[-1, 0, 1].map((i) => (
        <line key={i} x1={i * (w / 5)} x2={i * (w / 5)} y1={-h / 2 + 8} y2={h / 2 - 8} stroke="var(--equip-hatch)" strokeWidth={1} />
      ))}
      {/* piston-rod stub, crank (left) end */}
      <line x1={-w / 2 - 22} x2={-w / 2} y1={0} y2={0} stroke={stroke} strokeWidth={sw} />
      <rect x={-w / 2 - 26} y={-6} width={8} height={12} fill="var(--equip-fill)" stroke={stroke} strokeWidth={sw} />
      {/* suction (top) / discharge (bottom) valve nubs */}
      <path d={`M${-14},${-h / 2} L${14},${-h / 2} L${8},${-h / 2 - 12} L${-8},${-h / 2 - 12} Z`} fill="var(--equip-fill)" stroke={stroke} strokeWidth={1} />
      <path d={`M${-14},${h / 2} L${14},${h / 2} L${8},${h / 2 + 12} L${-8},${h / 2 + 12} Z`} fill="var(--equip-fill)" stroke={stroke} strokeWidth={1} />
      <text y={-10} textAnchor="middle" fontSize={Math.max(28, minUnits)} fontWeight={500} fill="var(--text-label)">
        {label}
      </text>
      <text y={26} textAnchor="middle" fontSize={Math.max(17, minUnits)} fontWeight={500} letterSpacing={0.6} fill="var(--text-label)">
        {running ? 'RUN' : 'OFF'}
      </text>
      <text y={101} textAnchor="middle" fontSize={Math.max(15, minUnits)} fill="var(--text-tag)">
        cylinder
      </text>
    </g>
  );
}

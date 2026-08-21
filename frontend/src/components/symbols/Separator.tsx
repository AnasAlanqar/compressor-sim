// ISA-5.1 vertical scrubber: dished-head vessel, demister pad, liquid boot.
// Used for Suc. scrub., ST2 scrub., ST3 scrub. `level` is 0-1 (boot liquid
// fraction); omit for vessels with no modeled level (draws an empty boot).
export default function Separator({
  x,
  y,
  label,
  width = 76,
  height = 134,
  energized = true,
  level,
  minUnits = 0,
}: {
  x: number;
  y: number;
  label: string;
  width?: number;
  height?: number;
  energized?: boolean;
  level?: number;
  /** Typography floor (Task 4) — see GateValve's `minUnits`. */
  minUnits?: number;
}) {
  const w = width;
  const h = height;
  const rx = w / 2;
  const ry = 8;
  const bootH = 22;
  const stroke = energized ? 'var(--equip-stroke)' : 'var(--equip-stroke-idle)';
  const sw = energized ? 1.5 : 1;
  const demisterY0 = -h / 2 + h * 0.16;
  return (
    <g transform={`translate(${x},${y})`}>
      {/* body, capped with dished (elliptical) heads top and bottom */}
      <path
        d={`M${-rx},${-h / 2 + ry} A${rx},${ry} 0 0 1 ${rx},${-h / 2 + ry}
            L${rx},${h / 2 - ry}
            A${rx},${ry} 0 0 1 ${-rx},${h / 2 - ry} Z`}
        fill="var(--equip-fill)"
        stroke={stroke}
        strokeWidth={sw}
      />
      <ellipse cx={0} cy={-h / 2 + ry} rx={rx} ry={ry} fill="none" stroke={stroke} strokeWidth={sw} />
      {/* demister pad, upper third */}
      {[0, 1, 2, 3, 4].map((i) => (
        <line
          key={i}
          x1={-rx * 0.62}
          x2={rx * 0.62}
          y1={demisterY0 + i * 6}
          y2={demisterY0 + i * 6}
          stroke="var(--equip-hatch)"
          strokeWidth={1}
        />
      ))}
      {/* boot + liquid level */}
      <rect x={-rx * 0.35} y={h / 2 - ry} width={rx * 0.7} height={bootH} fill="var(--equip-fill)" stroke={stroke} strokeWidth={sw} />
      {level !== undefined && level > 0 && (
        <line
          x1={-rx * 0.35}
          x2={rx * 0.35}
          y1={h / 2 - ry + bootH * (1 - Math.min(1, Math.max(0, level)))}
          y2={h / 2 - ry + bootH * (1 - Math.min(1, Math.max(0, level)))}
          stroke="var(--pipe-signal)"
          strokeWidth={1.5}
        />
      )}
      <text y={h / 2 + bootH + 18} textAnchor="middle" fontSize={Math.max(15, minUnits)} fill="var(--text-label)">
        {label}
      </text>
    </g>
  );
}

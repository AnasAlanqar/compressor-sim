// ISA-5.1 air cooler: tube bundle (horizontal lines) over N fan circles,
// each fan an outline circle with 3 arc blades. Fans are static (§8: only
// permitted animation is the 1Hz unack blink) — run state is stroke
// weight/color only, never rotation. Used for Intercool. 1/2, Aftercooler.
export default function AirCooler({
  x,
  y,
  label,
  fansOn,
  fanCount = 2,
  width = 120,
  height = 108,
}: {
  x: number;
  y: number;
  label: string;
  fansOn: number;
  fanCount?: number;
  width?: number;
  height?: number;
}) {
  const running = fansOn > 0;
  const w = width;
  const h = height;
  const stroke = running ? 'var(--equip-stroke)' : 'var(--equip-stroke-idle)';
  const sw = running ? 1.5 : 1;
  const tubeCount = 6;
  const spacing = w / (fanCount + 1);
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={running ? 'var(--equip-fill-active)' : 'var(--equip-fill)'} stroke={stroke} strokeWidth={sw} />
      {Array.from({ length: tubeCount }, (_, i) => {
        const ty = -h / 2 + ((i + 1) * h) / (tubeCount + 1);
        return <line key={i} x1={-w / 2 + 6} x2={w / 2 - 6} y1={ty} y2={ty} stroke="var(--equip-hatch)" strokeWidth={1} />;
      })}
      {Array.from({ length: fanCount }, (_, i) => {
        const fx = -w / 2 + spacing * (i + 1);
        const on = fansOn > i;
        const fStroke = on ? 'var(--equip-stroke)' : 'var(--equip-stroke-idle)';
        return (
          <g key={i} transform={`translate(${fx},0)`}>
            <circle r={22} fill="var(--hmi-canvas)" stroke={fStroke} strokeWidth={on ? 1.5 : 1} />
            {[0, 120, 240].map((deg) => (
              <path
                key={deg}
                d="M0,0 A14,14 0 0 1 12,7"
                transform={`rotate(${deg})`}
                fill="none"
                stroke={fStroke}
                strokeWidth={on ? 1.5 : 1}
                strokeLinecap="butt"
              />
            ))}
          </g>
        );
      })}
      <text y={h / 2 + 20} textAnchor="middle" fontSize={15} fill="var(--text-label)">
        {label}
      </text>
      <text y={h / 2 + 39} textAnchor="middle" fontSize={14} fontWeight={500} letterSpacing={0.5} fill="var(--text-label)">
        {`${fansOn}/${fanCount} FANS ${running ? 'ON' : 'OFF'}`}
      </text>
    </g>
  );
}

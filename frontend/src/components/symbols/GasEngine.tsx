// ISA-5.1-flavored gas engine glyph: crankshaft circle, 16 tick marks
// along the top edge (G3516 = V16), coupling to the driven train as two
// parallel short strokes. No rotation — motion is reserved for the 1Hz
// unack-alarm blink only (§8).
export default function GasEngine({ x, y, running, size = 64 }: { x: number; y: number; running: boolean; size?: number }) {
  const r = size / 2;
  const stroke = running ? 'var(--equip-stroke)' : 'var(--equip-stroke-idle)';
  const sw = running ? 1.5 : 1;
  return (
    <g transform={`translate(${x},${y})`}>
      <circle r={r} fill="var(--hmi-surface-sunken)" stroke={stroke} strokeWidth={sw} />
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
        const inner = r - 4;
        const outer = r + 4;
        return (
          <line
            key={i}
            x1={Math.cos(a) * inner}
            y1={Math.sin(a) * inner}
            x2={Math.cos(a) * outer}
            y2={Math.sin(a) * outer}
            stroke={stroke}
            strokeWidth={1}
          />
        );
      })}
      <line x1={0} y1={0} x2={r - 7} y2={0} stroke={stroke} strokeWidth={sw} strokeLinecap="butt" />
      <circle r={4} fill={stroke} />
      {/* coupling to the driven train */}
      <line x1={r + 6} y1={-6} x2={r + 26} y2={-6} stroke="var(--equip-hatch)" strokeWidth={1} />
      <line x1={r + 6} y1={6} x2={r + 26} y2={6} stroke="var(--equip-hatch)" strokeWidth={1} />
    </g>
  );
}

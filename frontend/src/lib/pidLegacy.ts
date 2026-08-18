// Color helpers used only by the frozen PidDiagramLegacy.tsx. The restyled
// mimic (PidDiagram.tsx) does not color-code pressure or valve position —
// see tokens.css and THEME.md ("normal state is gray and quiet").

export const STATE_COLOR: Record<'normal' | 'amber' | 'red', string> = {
  normal: '#10b981', // emerald-500
  amber: '#f59e0b', // amber-500
  red: '#ef4444', // red-500
};

export function pressureToColor(psig: number): string {
  const v = Math.max(0, Math.min(2000, psig));
  const t = Math.sqrt(v / 2000);
  const hue = 206 - t * 206;
  const sat = 32 + t * 55;
  const light = 30 + t * 24;
  return `hsl(${hue.toFixed(1)} ${sat.toFixed(0)}% ${light.toFixed(0)}%)`;
}

export function valveColor(pct: number): string {
  if (pct > 98) return '#10b981';
  if (pct < 2) return '#6b7280';
  return '#f59e0b';
}

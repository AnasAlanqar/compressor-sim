// Categorical palette for distinguishing up to 12 simultaneous trend pens.
// This is a data-identity palette (which line is which tag), not a state
// color — ISA-101's "color only means abnormal" rule (see tokens.css)
// governs equipment/alarm state, not chart series identity, so these stay
// as a fixed palette rather than resolving through tokens.css. Kept in one
// file, away from component code, so it's still the single place to edit.
export const CHART_PEN_COLORS: Record<string, string> = {
  PT_1001: '#38bdf8',
  PT_1002: '#818cf8',
  PT_1003: '#a78bfa',
  PT_1006: '#f472b6',
  TT_2004: '#fb923c',
  TT_2005: '#f59e0b',
  ST_1008: '#60a5fa',
  'valves.Z_byp': '#2dd4bf',
  PT_1005: '#818cf8',
  TT_2001: '#f87171',
  TT_2013: '#fbbf24',
  'flows.m_comp': '#c084fc',
};

export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

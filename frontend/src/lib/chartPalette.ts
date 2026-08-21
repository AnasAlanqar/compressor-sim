// Categorical palette for distinguishing up to 12 simultaneous trend pens.
// This is a data-identity palette (which line is which tag), not a state
// color — ISA-101's "color only means abnormal" rule (see tokens.css)
// governs equipment/alarm state, not chart series identity, so these stay
// as a fixed palette rather than resolving through tokens.css. Kept in one
// file, away from component code, so it's still the single place to edit.
export const CHART_PEN_COLORS: Record<string, string> = {
  PT_1001: '#0057D9',
  PT_1002: '#D00000',
  PT_1003: '#00833D',
  PT_1006: '#7A28A8',
  TT_2004: '#D14900',
  TT_2005: '#A05A00',
  ST_1008: '#007C91',
  'valves.Z_byp': '#007A6E',
  PT_1005: '#C0007F',
  TT_2001: '#8F1D21',
  TT_2013: '#695C00',
  'flows.m_comp': '#3347B0',
};

export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

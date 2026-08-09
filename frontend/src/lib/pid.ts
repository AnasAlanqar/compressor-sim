// Shared visual helpers for the P&ID and gauges — APP_SPEC.md section 6.1.1
// (colour reserved for state) and section 6.2 (pipe pressure ramp, gauge
// alarm colouring).

export type AlarmBand = [number | null, number | null, number | null, number | null];
// [low_sd, low_alarm, high_alarm, high_sd]

export type AlarmTable = Record<string, AlarmBand>;

export type GaugeState = 'normal' | 'amber' | 'red';

export function gaugeState(tag: string, value: number, alarms: AlarmTable): GaugeState {
  const band = alarms[tag];
  if (!band) return 'normal';
  const [loSd, loAlarm, hiAlarm, hiSd] = band;
  if ((loSd !== null && value <= loSd) || (hiSd !== null && value >= hiSd)) return 'red';
  if ((loAlarm !== null && value <= loAlarm) || (hiAlarm !== null && value >= hiAlarm)) return 'amber';
  return 'normal';
}

export const STATE_COLOR: Record<GaugeState, string> = {
  normal: '#10b981', // emerald-500
  amber: '#f59e0b', // amber-500
  red: '#ef4444', // red-500
};

// Continuous dim-blue (atmospheric) -> hot-red (2000 psig) ramp for pipe
// colouring (section 6.2: "a continuous colour ramp, blue at atmospheric
// through to red at 2000 psig. The staircase from suction to final discharge
// should be visible at a glance.")
//
// A linear 0-2000 ramp buries the whole plant in the bottom quarter of the
// scale: design-point pressures are ~30 / 117 / 377 / 1150 psig (suction ->
// ST1 -> ST2 -> final), and only the 2000 psig fault ceiling reaches the hot
// end. sqrt-compressing the scale spreads that real operating range across
// the full hue sweep instead, so each stage reads as a visibly different
// colour even under normal running conditions; saturation and lightness ramp
// alongside hue so low pressure genuinely looks dim/inert and high pressure
// looks hot, not just differently hued.
export function pressureToColor(psig: number): string {
  const v = Math.max(0, Math.min(2000, psig));
  const t = Math.sqrt(v / 2000);
  const hue = 206 - t * 206; // 206 dim blue -> 0 red
  const sat = 32 + t * 55; // 32% dim -> 87% vivid
  const light = 30 + t * 24; // 30% dim -> 54% hot
  return `hsl(${hue.toFixed(1)} ${sat.toFixed(0)}% ${light.toFixed(0)}%)`;
}

export function valveColor(pct: number): string {
  if (pct > 98) return '#10b981'; // open — green
  if (pct < 2) return '#6b7280'; // closed — neutral grey
  return '#f59e0b'; // in transit — amber
}

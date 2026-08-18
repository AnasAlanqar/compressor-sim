// Shared alarm-band logic for the P&ID and gauges. Visual mapping of
// GaugeState to a token lives in each renderer (PidDiagram.tsx uses
// tokens.css; PidDiagramLegacy.tsx uses tokens.legacy.css via pidLegacy.ts).

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

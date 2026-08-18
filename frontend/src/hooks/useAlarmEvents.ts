import { useEffect, useRef, useState } from 'react';
import type { AlarmTable } from '../lib/pid';
import { gaugeState, type GaugeState } from '../lib/pid';
import type { SimTags } from './useSimState';

export type AlarmPriority = 'p1' | 'p2';

export interface AlarmEvent {
  id: string;
  tag: string;
  priority: AlarmPriority;
  description: string;
  simTime: number;
  unacked: boolean;
}

const MAX_EVENTS = 50;
const SUMMARY_LEN = 8;

function describe(tag: string, value: number, band: [number | null, number | null, number | null, number | null]) {
  const [loSd, loAlarm, hiAlarm, hiSd] = band;
  if (loSd !== null && value <= loSd) return `${tag} LOW LOW`;
  if (hiSd !== null && value >= hiSd) return `${tag} HIGH HIGH`;
  if (loAlarm !== null && value <= loAlarm) return `${tag} LOW`;
  if (hiAlarm !== null && value >= hiAlarm) return `${tag} HIGH`;
  return `${tag} NORMAL`;
}

/**
 * Derives an alarm event log + acknowledgment state entirely client-side by
 * watching gaugeState transitions tag by tag. There is no backend alarm
 * history/ack model (only static limit config) — this is a deliberate
 * restyle-scope simplification, not a real historian: the log is empty on
 * every fresh page load and only reflects transitions seen while this HMI
 * instance has been open.
 */
export function useAlarmEvents(tags: SimTags, alarms: AlarmTable, simTime: number) {
  const [events, setEvents] = useState<AlarmEvent[]>([]);
  const prevState = useRef<Record<string, GaugeState>>({});

  useEffect(() => {
    const next: AlarmEvent[] = [];
    for (const tag of Object.keys(alarms)) {
      const v = tags[tag];
      if (typeof v !== 'number') continue;
      const state = gaugeState(tag, v, alarms);
      const was = prevState.current[tag] ?? 'normal';
      if (state !== was && state !== 'normal') {
        next.push({
          id: `${tag}-${simTime}-${Math.random().toString(36).slice(2, 7)}`,
          tag,
          priority: state === 'red' ? 'p1' : 'p2',
          description: describe(tag, v, alarms[tag]),
          simTime,
          unacked: true,
        });
      }
      prevState.current[tag] = state;
    }
    if (next.length > 0) {
      setEvents((prev) => [...next.reverse(), ...prev].slice(0, MAX_EVENTS));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tags, alarms]);

  const ack = (id: string) => setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, unacked: false } : e)));
  const ackAll = () => setEvents((prev) => prev.map((e) => ({ ...e, unacked: false })));

  const unackedCount = events.filter((e) => e.unacked).length;
  const highestUnacked = events.find((e) => e.unacked && e.priority === 'p1') ?? events.find((e) => e.unacked);

  return {
    events,
    summary: events.slice(0, SUMMARY_LEN),
    unackedCount,
    highestUnacked,
    ack,
    ackAll,
  };
}

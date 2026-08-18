import type { AlarmEvent } from '../hooks/useAlarmEvents';
import type { UseSimState, TagValue } from '../hooks/useSimState';
import type { AlarmTable } from '../lib/pid';
import Sparkline from './Sparkline';
import Tabs from './Tabs';
import ManualOverridePanel from './ManualOverridePanel';
import FaultPanel from './FaultPanel';
import TagTable from './TagTable';

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 'var(--fs-header)',
        color: 'var(--text-tag)',
        letterSpacing: '0.12em',
        padding: '8px 12px 4px',
      }}
    >
      {children}
    </div>
  );
}

function AlarmRow({ event, onAck }: { event: AlarmEvent; onAck: (id: string) => void }) {
  const color = event.priority === 'p1' ? 'var(--alm-p1)' : 'var(--alm-p2)';
  return (
    <div
      className="flex items-center gap-2 px-3 py-1"
      style={{ outline: event.unacked ? '1px solid var(--alm-unack-ring)' : 'none', outlineOffset: -1 }}
    >
      <div style={{ width: 3, alignSelf: 'stretch', backgroundColor: color }} />
      <span className="tabular" style={{ fontSize: 'var(--fs-tag)', fontFamily: 'var(--font-value)', color: 'var(--text-tag)' }}>
        {event.simTime.toFixed(0)}s
      </span>
      <span style={{ fontSize: 'var(--fs-tag)', fontFamily: 'var(--font-value)', color: 'var(--text-value)' }}>{event.tag}</span>
      <span className="flex-1 truncate" style={{ fontSize: 'var(--fs-tag)', color: 'var(--text-label)' }}>
        {event.description}
      </span>
      {event.unacked && (
        <button type="button" onClick={() => onAck(event.id)} className="hmi-btn" style={{ fontSize: 'var(--fs-tag)', padding: '1px 6px' }}>
          ACK
        </button>
      )}
    </div>
  );
}

// 240px right dock (§9 [F]): ALARM SUMMARY + TRENDS as specified, plus a
// TOOLS section (Overrides/Faults/Tags) — the spec's layout doesn't name a
// slot for the pre-existing override/fault-injection/tag-table panels, and
// dropping that functionality isn't an option for a HIL test tool, so it
// lives here as the dock's third section rather than invented real estate.
export default function RightDock({
  summary,
  ack,
  subscribe,
  alarms,
  sendCmd,
  readback,
  liveTags,
  opcConnected,
  onFault,
  boundary,
  tags,
}: {
  summary: AlarmEvent[];
  ack: (id: string) => void;
  subscribe: UseSimState['subscribe'];
  alarms: AlarmTable;
  sendCmd: UseSimState['sendCmd'];
  readback: Record<string, TagValue>;
  liveTags: Record<string, TagValue>;
  opcConnected: boolean;
  onFault: UseSimState['sendRaw'];
  boundary: unknown;
  tags: UseSimState['tags'];
}) {
  return (
    <div
      className="flex w-[240px] shrink-0 flex-col overflow-y-auto"
      style={{ backgroundColor: 'var(--hmi-surface)', borderLeft: 'var(--w-hairline) solid var(--hmi-rule)' }}
    >
      <SectionHeader>ALARM SUMMARY</SectionHeader>
      <div style={{ borderBottom: 'var(--w-hairline) solid var(--hmi-rule)' }}>
        {summary.length === 0 ? (
          <div className="px-3 py-2" style={{ fontSize: 'var(--fs-tag)', color: 'var(--text-tag)' }}>
            no events
          </div>
        ) : (
          summary.map((e) => <AlarmRow key={e.id} event={e} onAck={ack} />)
        )}
      </div>

      <SectionHeader>TRENDS</SectionHeader>
      <div className="flex flex-col gap-3 px-3 pb-3" style={{ borderBottom: 'var(--w-hairline) solid var(--hmi-rule)' }}>
        <Sparkline tag="PT_1001" label="SUCTION PRESSURE" subscribe={subscribe} band={alarms.PT_1001} />
        <Sparkline tag="PT_1002" label="ST1 DISCH PRESSURE" subscribe={subscribe} band={alarms.PT_1002} />
        <Sparkline tag="PT_1004" label="ST3 DISCH PRESSURE" subscribe={subscribe} band={alarms.PT_1004} />
        <Sparkline tag="TT_2013" label="DISCHARGE TEMP" subscribe={subscribe} band={alarms.TT_2013} />
      </div>

      <SectionHeader>TOOLS</SectionHeader>
      {/* ManualOverridePanel/FaultPanel assume the old full-width
          main-content slot: a responsive CSS-columns split (columns-1
          sm:columns-2 xl:columns-3) plus 2-3 col grids inside each section,
          with some tiles (sliders) explicitly col-span-2 to fill a row.
          At 240px the columns split alone was cramming three sections
          (ENGINE/COOLERS/STATUS) side by side into ~70px slivers — force
          the outer column count and the inner grids to 1. Forcing the grid
          to 1 column while a child still asks for col-span-2 makes Grid
          fabricate an implicit 2nd (auto-width) column to satisfy the
          span, splitting the row again — so col-span-2 is neutralized too. */}
      <div className="flex-1 px-2 pb-2 [&_.columns-1]:!columns-1 [&_.grid-cols-2]:!grid-cols-1 [&_.grid-cols-3]:!grid-cols-1 [&_.col-span-2]:!col-span-1">
        <Tabs
          tabs={[
            {
              key: 'overrides',
              label: 'Overrides',
              content: <ManualOverridePanel disabled={opcConnected} onChange={sendCmd} readback={readback} liveTags={liveTags} />,
            },
            { key: 'faults', label: 'Faults', content: <FaultPanel onFault={onFault} boundary={boundary as never} /> },
            { key: 'tags', label: 'Tags', content: <TagTable tags={tags} /> },
          ]}
        />
      </div>
    </div>
  );
}

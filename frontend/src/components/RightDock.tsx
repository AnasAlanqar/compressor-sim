import type { UseSimState, TagValue } from '../hooks/useSimState';
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

// 240px right dock (§9 [F]): ALARM SUMMARY + TRENDS as specified, plus a
// TOOLS section (Overrides/Faults/Tags) — the spec's layout doesn't name a
// slot for the pre-existing override/fault-injection/tag-table panels, and
// dropping that functionality isn't an option for a HIL test tool, so it
// lives here as the dock's third section rather than invented real estate.
export default function RightDock({
  sendCmd,
  readback,
  liveTags,
  opcConnected,
  onFault,
  boundary,
  tags,
}: {
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
      className="flex w-[260px] shrink-0 flex-col overflow-y-auto"
      style={{ backgroundColor: 'var(--hmi-surface)', borderLeft: 'var(--w-hairline) solid var(--hmi-rule)' }}
    >
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

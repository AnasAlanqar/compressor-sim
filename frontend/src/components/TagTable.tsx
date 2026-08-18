import type { SimTags } from '../hooks/useSimState';
import { formatTag } from '../lib/engUnits';

export default function TagTable({ tags }: { tags: SimTags }) {
  return (
    <div className="text-xs">
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Object.entries(tags)
          .filter(([k]) => !['flows', 'valves', 'cmd_echo', 'boundary', 'opcua'].includes(k))
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => {
            const formatted = typeof v === 'number' ? formatTag(k, v) : { text: String(v), unit: '' };
            return (
              <div key={k} className="tabular flex justify-between gap-2">
                <span className="text-[var(--text-tag)]">{k}</span>
                <span>
                  {formatted.text}
                  {formatted.unit && <span className="ml-1 text-[var(--text-tag)]">{formatted.unit}</span>}
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
}

import type { SimTags } from '../hooks/useSimState';

export default function TagTable({ tags }: { tags: SimTags }) {
  return (
    <div className="text-xs">
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Object.entries(tags)
          .filter(([k]) => !['flows', 'valves', 'cmd_echo', 'boundary', 'opcua'].includes(k))
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => (
            <div key={k} className="tabular flex justify-between gap-2">
              <span className="text-neutral-500">{k}</span>
              <span>{typeof v === 'number' ? v.toFixed(2) : String(v)}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

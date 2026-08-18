import { useState, type ReactNode } from 'react';

interface Tab {
  key: string;
  label: string;
  content: ReactNode;
}

export default function Tabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.key);
  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-1 border-b border-[var(--hmi-rule)]">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`px-3 py-1.5 text-sm ${
              active === t.key
                ? 'border-b-2 border-[var(--hmi-rule-strong)] text-[var(--text-value)]'
                : 'text-[var(--text-tag)] hover:text-[var(--text-label)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto pt-3">{tabs.find((t) => t.key === active)?.content}</div>
    </div>
  );
}

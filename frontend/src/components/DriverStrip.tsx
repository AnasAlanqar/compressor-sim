import { formatValue, formatTag } from '../lib/engUnits';
import type { AlarmTable } from '../lib/pid';
import { gaugeState } from '../lib/pid';
import type { SimTags } from '../hooks/useSimState';

// 72px driver strip (§9 [E]) — CAT G3516LE data pulled out of the mimic
// into its own row, replacing the large empty rectangle the old engine
// card sat inside. Only readouts this simulator actually models are
// shown: no jacket-water-temp/fuel-gas-pressure/load% tags exist in
// config.yaml's alarm table or the OPC UA tag set, so they're omitted
// rather than fabricated.
function Field({ label, value, unit, large }: { label: string; value: string; unit: string; large?: boolean }) {
  return (
    <div className="flex flex-col items-end justify-center">
      <span style={{ fontSize: 'var(--fs-tag)', color: 'var(--text-tag)', letterSpacing: '0.08em' }}>{label}</span>
      <span
        className="tabular"
        style={{
          fontFamily: 'var(--font-value)',
          fontSize: large ? 'var(--fs-value-lg)' : 'var(--fs-value)',
          color: 'var(--text-value)',
        }}
      >
        {value}
        <span style={{ fontSize: 'var(--fs-tag)', color: 'var(--text-tag)', marginLeft: 4 }}>{unit}</span>
      </span>
    </div>
  );
}

export default function DriverStrip({ tags, alarms, stale = false }: { tags: SimTags; alarms: AlarmTable; stale?: boolean }) {
  const rpm = typeof tags.ST_1008 === 'number' ? tags.ST_1008 : 0;
  const oilP = typeof tags.PT_1005 === 'number' ? tags.PT_1005 : 0;
  const oilT = typeof tags.TT_2001 === 'number' ? tags.TT_2001 : 0;
  const running = rpm > 5;
  const speed = formatValue('speed', rpm, stale);
  const oilPf = formatTag('PT_1005', oilP, stale);
  const oilTf = formatTag('TT_2001', oilT, stale);
  const oilPState = gaugeState('PT_1005', oilP, alarms);
  const oilTState = gaugeState('TT_2001', oilT, alarms);
  return (
    <div
      className="flex h-[72px] shrink-0 items-center gap-8 px-6"
      style={{ backgroundColor: 'var(--hmi-surface)', borderTop: 'var(--w-hairline) solid var(--hmi-rule)' }}
    >
      <div className="flex flex-col justify-center">
        <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-value)', letterSpacing: '0.06em' }}>CAT G3516LE</span>
        <span style={{ fontSize: 'var(--fs-status)', color: 'var(--text-label)', letterSpacing: '0.06em' }}>
          {running ? 'RUNNING' : 'STOPPED'}
        </span>
      </div>
      <Field label="SPEED" value={speed.text} unit={speed.unit} large />
      <Field label="OIL PRESSURE" value={oilPf.text} unit={oilPf.unit} />
      <Field label="OIL TEMP" value={oilTf.text} unit={oilTf.unit} />
      <div className="flex flex-col gap-1">
        {alarms.PT_1005 && (
          <MiniMai value={oilP} band={alarms.PT_1005} state={oilPState} />
        )}
        {alarms.TT_2001 && (
          <MiniMai value={oilT} band={alarms.TT_2001} state={oilTState} />
        )}
      </div>
    </div>
  );
}

function MiniMai({
  value,
  band,
  state,
}: {
  value: number;
  band: [number | null, number | null, number | null, number | null];
  state: 'normal' | 'amber' | 'red';
}) {
  const [loSd, , , hiSd] = band;
  const lo = loSd ?? 0;
  const hi = hiSd ?? lo + 100;
  const span = hi - lo || 1;
  const pos = Math.min(120, Math.max(0, ((value - lo) / span) * 120));
  const markColor = state === 'red' ? 'var(--alm-p1)' : state === 'amber' ? 'var(--alm-p2)' : 'var(--text-value)';
  return (
    <svg width={120} height={4}>
      <rect x={0} y={0} width={120} height={4} fill="var(--hmi-surface-sunken)" />
      <rect x={pos - 1.5} y={-1} width={3} height={6} fill={markColor} />
    </svg>
  );
}

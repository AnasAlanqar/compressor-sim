import { formatTag } from '../lib/engUnits';
import { gaugeState, type AlarmTable } from '../lib/pid';
import type { SimTags } from '../hooks/useSimState';

// §9 [restyle Task 3]: the mimic itself only carries equipment names,
// run/stop state, and valve open/closed + position — every scattered
// PT_/TT_ tag/value/unit readout that used to float over the pipework
// moved down here instead, one fixed card per stage.
const num = (tags: SimTags, tag: string) => (typeof tags[tag] === 'number' ? (tags[tag] as number) : 0);

function Field({ label, value, unit, state }: { label: string; value: string; unit: string; state: 'normal' | 'amber' | 'red' }) {
  const color = state === 'red' ? 'var(--alm-p1)' : state === 'amber' ? 'var(--alm-p2)' : 'var(--text-value)';
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span style={{ fontSize: 'var(--fs-tag)', color: 'var(--text-tag)', letterSpacing: '0.04em' }}>{label}</span>
      <span className="tabular" style={{ fontFamily: 'var(--font-value)', fontSize: 'var(--fs-value-sm)', color }}>
        {value}
        <span style={{ fontSize: 'var(--fs-tag)', color: 'var(--text-tag)', marginLeft: 3 }}>{unit}</span>
      </span>
    </div>
  );
}

interface StageSpec {
  name: string;
  sucTag: string;
  sucValue: number;
  disTag: string;
  disValue: number;
  tempTag: string;
  tempValue: number;
  coolerLabel: string;
  fansOn: number;
  fanCount: number;
}

function StageCard({ stage, alarms, stale }: { stage: StageSpec; alarms: AlarmTable; stale: boolean }) {
  const suc = formatTag(stage.sucTag, stage.sucValue, stale);
  const dis = formatTag(stage.disTag, stage.disValue, stale);
  const temp = formatTag(stage.tempTag, stage.tempValue, stale);
  const fanRunning = stage.fansOn > 0;
  return (
    <div
      className="flex min-w-0 flex-1 flex-col gap-1.5 rounded px-3 py-2"
      style={{ backgroundColor: 'var(--hmi-surface)', border: 'var(--w-hairline) solid var(--hmi-rule)' }}
    >
      <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-label)', letterSpacing: '0.06em', fontWeight: 500 }}>
        {stage.name}
      </span>
      <Field label="SUCTION" value={suc.text} unit={suc.unit} state={gaugeState(stage.sucTag, stage.sucValue, alarms)} />
      <Field label="DISCHARGE" value={dis.text} unit={dis.unit} state={gaugeState(stage.disTag, stage.disValue, alarms)} />
      <Field label="DISCH. TEMP" value={temp.text} unit={temp.unit} state={gaugeState(stage.tempTag, stage.tempValue, alarms)} />
      <div className="flex items-baseline justify-between gap-3">
        <span style={{ fontSize: 'var(--fs-tag)', color: 'var(--text-tag)', letterSpacing: '0.04em' }}>{stage.coolerLabel}</span>
        <span style={{ fontSize: 'var(--fs-value-sm)', color: 'var(--text-value)', fontWeight: 500, letterSpacing: '0.02em' }}>
          {stage.fansOn}/{stage.fanCount} FANS {fanRunning ? 'ON' : 'OFF'}
        </span>
      </div>
    </div>
  );
}

export default function StageDetailStrip({
  tags,
  cmdEcho,
  alarms,
  stale = false,
}: {
  tags: SimTags;
  cmdEcho: SimTags;
  alarms: AlarmTable;
  stale?: boolean;
}) {
  const P_s = num(tags, 'PT_1001');
  const P_1 = num(tags, 'PT_1002');
  const P_2 = num(tags, 'PT_1003');
  const P_3 = num(tags, 'PT_1004');
  const T_cyl1 = num(tags, 'TT_2004');
  const T_cyl2 = num(tags, 'TT_2005');
  const T_cyl3 = num(tags, 'TT_2006');
  const n_fans = (Boolean(cmdEcho['CMD_4011']) ? 1 : 0) + (Boolean(cmdEcho['CMD_4012']) ? 1 : 0);

  const stages: StageSpec[] = [
    {
      name: 'ST1',
      sucTag: 'PT_1001', sucValue: P_s,
      disTag: 'PT_1002', disValue: P_1,
      tempTag: 'TT_2004', tempValue: T_cyl1,
      coolerLabel: 'INTERCOOL. 1', fansOn: n_fans, fanCount: 2,
    },
    {
      name: 'ST2',
      sucTag: 'PT_1002', sucValue: P_1,
      disTag: 'PT_1003', disValue: P_2,
      tempTag: 'TT_2005', tempValue: T_cyl2,
      coolerLabel: 'INTERCOOL. 2', fansOn: n_fans, fanCount: 2,
    },
    {
      name: 'ST3',
      sucTag: 'PT_1003', sucValue: P_2,
      disTag: 'PT_1004', disValue: P_3,
      tempTag: 'TT_2006', tempValue: T_cyl3,
      coolerLabel: 'AFTERCOOLER', fansOn: n_fans, fanCount: 2,
    },
  ];

  return (
    <div className="flex h-full min-h-0 items-stretch gap-2 px-2 py-2">
      {stages.map((s) => (
        <StageCard key={s.name} stage={s} alarms={alarms} stale={stale} />
      ))}
    </div>
  );
}

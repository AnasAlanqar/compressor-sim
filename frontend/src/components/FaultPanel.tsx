import { Fragment, useEffect, useState } from 'react';

// Mirrors backend/app/faults.py's Flt (APP_SPEC.md section 5's full fault
// table) plus the section 7 step-8 instrumentation toggles and the section
// 6.5 boundary condition panel — grouped here since neither has its own
// tab slot (section 6.1 fixes the tab set to Trends / Faults / Tag table).
interface FaultState {
  lube_low: boolean;
  lube_slow: boolean;
  mag_pickup: boolean;
  overspeed_offset: number;
  disch_blocked: number; // sent as a 0-1 fraction, edited here as 0-100%
  valve_stuck: '' | 'byp' | 'suc' | 'sesd' | 'desd' | 'bdv';
  engine_fail_start: boolean;
  temp_bias: { cyl1: number; cyl2: number; cyl3: number; cyl4: number };
  signal_freeze: string[];
  signal_invalid: string[];
  cooler_trip: number[];
  link_drop: boolean;
  // Tier 2 discrete fault inputs — simple "true while armed" switches,
  // no dynamics, tags.py's tier2_fault_tags().
  scrubber_level_hi: number[];  // {1,2,3,4} — LSH_7001-7004
  vibration_trip: number[];     // {1,2,3} — VSH_7011-7013
  oil_jw_level_lo: number[];    // {1,2,3} — LSL_7021-7023
  fuel_gas_press_lo: boolean;   // PSL_7031
  lubricator_no_flow: number[]; // {1,2} — FSL_7041-7042
}

const INITIAL_FAULTS: FaultState = {
  lube_low: false,
  lube_slow: false,
  mag_pickup: false,
  overspeed_offset: 0,
  disch_blocked: 0,
  valve_stuck: '',
  engine_fail_start: false,
  temp_bias: { cyl1: 0, cyl2: 0, cyl3: 0, cyl4: 0 },
  signal_freeze: [],
  signal_invalid: [],
  cooler_trip: [],
  link_drop: false,
  scrubber_level_hi: [],
  vibration_trip: [],
  oil_jw_level_lo: [],
  fuel_gas_press_lo: false,
  lubricator_no_flow: [],
};

const SCRUBBERS = [
  [1, 'Suction scrubber'],
  [2, 'ST2 scrubber'],
  [3, 'ST3 scrubber'],
  [4, 'Fuel gas scrubber'],
] as const;
const VIBRATION = [
  [1, 'Compressor frame'],
  [2, 'Engine'],
  [3, 'Skid / piping'],
] as const;
const LEVELS = [
  [1, 'Compressor oil'],
  [2, 'Engine oil'],
  [3, 'Engine JW / coolant'],
] as const;
const LUBRICATORS = [
  [1, 'Bank 1'],
  [2, 'Bank 2'],
] as const;

interface Boundary {
  P_src_psig: number;
  P_proc_psig: number;
  T_suc_F: number;
  T_amb_F: number;
}

// config.yaml's boundaries defaults (APP_SPEC.md section 3.1).
const INITIAL_BOUNDARY: Boundary = { P_src_psig: 60, P_proc_psig: 1050, T_suc_F: 100, T_amb_F: 90 };

// section 4.1's AI tags — the set signal freeze/invalid can target.
const AI_TAGS: Array<[string, string]> = [
  ['PT_1001', 'Suction pressure'],
  ['PT_1002', 'ST1 discharge'],
  ['PT_1003', 'ST2 discharge'],
  ['PT_1004', 'ST3 discharge'],
  ['PT_1005', 'Oil pressure'],
  ['PT_1006', 'Final discharge'],
  ['ST_1008', 'Engine speed'],
  ['TT_2001', 'Oil temperature'],
  ['TT_2004', 'Cyl 1 temp'],
  ['TT_2005', 'Cyl 2 temp'],
  ['TT_2006', 'Cyl 3 temp'],
  ['TT_2007', 'Cyl 4 temp'],
  ['TT_2013', 'Aftercooler temp'],
  ['TT_2009', 'Packing 1'],
  ['TT_2010', 'Packing 2'],
  ['TT_2011', 'Packing 3'],
  ['TT_2012', 'Packing 4'],
];

interface Props {
  onFault: (msg: Record<string, unknown>) => void;
  boundary: Boundary;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 break-inside-avoid rounded border border-[var(--hmi-rule)] bg-[var(--hmi-surface)] p-3">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-tag)]">{title}</h3>
      {children}
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="flex flex-col">
        <span className="text-[var(--text-value)]">{label}</span>
        {hint && <span className="text-xs text-[var(--text-tag)]">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`h-5 w-9 shrink-0 rounded-full border transition-colors ${
          checked ? 'border-[var(--alm-p1)] bg-[var(--alm-p1)]' : 'border-[var(--hmi-rule-strong)] bg-[var(--btn-face)]'
        }`}
      >
        <span
          className={`block h-3.5 w-3.5 translate-y-[1px] rounded-full bg-[var(--equip-fill)] transition-transform ${
            checked ? 'translate-x-[19px]' : 'translate-x-[2px]'
          }`}
        />
      </button>
    </label>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="py-1.5 text-sm">
      <div className="flex items-baseline justify-between">
        <span className="text-[var(--text-value)]">{label}</span>
        <span className="tabular text-[var(--text-tag)]">
          {value.toFixed(0)}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-[var(--alm-p1)]"
      />
    </div>
  );
}

export default function FaultPanel({ onFault, boundary }: Props) {
  const [f, setF] = useState<FaultState>(INITIAL_FAULTS);
  const [b, setB] = useState<Boundary>(INITIAL_BOUNDARY);
  const [lagEnabled, setLagEnabled] = useState(false);
  const [noiseEnabled, setNoiseEnabled] = useState(false);
  const [boundaryTouched, setBoundaryTouched] = useState(false);

  // Once the backend echoes real boundary values, adopt them as the
  // editing baseline — but only before the user has touched a slider,
  // so an in-flight edit is never clobbered by the next state push.
  useEffect(() => {
    if (!boundaryTouched) setB(boundary);
  }, [boundary, boundaryTouched]);

  useEffect(() => {
    onFault({
      type: 'fault',
      faults: {
        ...f,
        disch_blocked: f.disch_blocked / 100,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f]);

  useEffect(() => {
    onFault({ type: 'instrument', lag_enabled: lagEnabled, noise_enabled: noiseEnabled });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lagEnabled, noiseEnabled]);

  const set = <K extends keyof FaultState>(key: K, value: FaultState[K]) =>
    setF((prev) => ({ ...prev, [key]: value }));

  const toggleInList = (key: 'signal_freeze' | 'signal_invalid', tag: string) =>
    setF((prev) => ({
      ...prev,
      [key]: prev[key].includes(tag) ? prev[key].filter((t) => t !== tag) : [...prev[key], tag],
    }));

  const toggleCooler = (n: number) =>
    setF((prev) => ({
      ...prev,
      cooler_trip: prev.cooler_trip.includes(n)
        ? prev.cooler_trip.filter((x) => x !== n)
        : [...prev.cooler_trip, n],
    }));

  const toggleInNumList = (
    key: 'scrubber_level_hi' | 'vibration_trip' | 'oil_jw_level_lo' | 'lubricator_no_flow',
    n: number,
  ) =>
    setF((prev) => ({
      ...prev,
      [key]: prev[key].includes(n) ? prev[key].filter((x) => x !== n) : [...prev[key], n],
    }));

  const clearAll = () => {
    setF(INITIAL_FAULTS);
    setLagEnabled(false);
    setNoiseEnabled(false);
    onFault({ type: 'fault', clear: true });
  };

  const sendBoundary = (next: Boundary) => {
    setBoundaryTouched(true);
    setB(next);
    onFault({ type: 'boundary', boundary: next });
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={clearAll}
        className="w-fit rounded border border-[var(--alm-p1)] bg-[var(--hmi-surface)] px-3 py-1.5 text-sm text-[var(--alm-p1)] hover:bg-[var(--hmi-surface)]"
      >
        Clear all faults
      </button>

      <div className="columns-1 gap-3 sm:columns-2 xl:columns-3">
      <Section title="Engine">
        <Toggle
          label="Low lube oil pressure"
          hint="forces oil pressure below its 35 psi trip"
          checked={f.lube_low}
          onChange={(v) => set('lube_low', v)}
        />
        <Toggle
          label="Slow lube build"
          hint="τ = 90s, exceeds the 120s permissive timer"
          checked={f.lube_slow}
          onChange={(v) => set('lube_slow', v)}
        />
        <Toggle
          label="Engine fails to start"
          hint="holds speed at the 550 rpm running permit"
          checked={f.engine_fail_start}
          onChange={(v) => set('engine_fail_start', v)}
        />
        <Toggle
          label="Mag pickup fault"
          hint="reports 0 rpm while the engine runs"
          checked={f.mag_pickup}
          onChange={(v) => set('mag_pickup', v)}
        />
        <Slider
          label="Overspeed bias"
          value={f.overspeed_offset}
          min={-200}
          max={400}
          unit=" rpm"
          onChange={(v) => set('overspeed_offset', v)}
        />
      </Section>

      <Section title="Process">
        <Slider
          label="Blocked discharge"
          value={f.disch_blocked}
          min={0}
          max={100}
          unit="%"
          onChange={(v) => set('disch_blocked', v)}
        />
        <div className="py-1.5 text-sm">
          <div className="mb-1 text-[var(--text-value)]">Valve stuck</div>
          <select
            value={f.valve_stuck}
            onChange={(e) => set('valve_stuck', e.target.value as FaultState['valve_stuck'])}
            className="w-full rounded border border-[var(--hmi-rule-strong)] bg-[var(--btn-face)] px-2 py-1 text-sm"
          >
            <option value="">none</option>
            <option value="byp">Bypass</option>
            <option value="suc">Suction control</option>
            <option value="sesd">Suction ESD</option>
            <option value="desd">Discharge ESD</option>
            <option value="bdv">Blowdown</option>
          </select>
        </div>
      </Section>

      <Section title="Cylinder temperature bias">
        {(['cyl1', 'cyl2', 'cyl3', 'cyl4'] as const).map((cyl, i) => (
          <Slider
            key={cyl}
            label={`Cylinder ${i + 1}`}
            value={f.temp_bias[cyl]}
            min={-50}
            max={150}
            unit="°F"
            onChange={(v) => set('temp_bias', { ...f.temp_bias, [cyl]: v })}
          />
        ))}
      </Section>

      <Section title="Cooler motors">
        <Toggle
          label="Cooler motor 1 trip"
          checked={f.cooler_trip.includes(1)}
          onChange={() => toggleCooler(1)}
        />
        <Toggle
          label="Cooler motor 2 trip"
          checked={f.cooler_trip.includes(2)}
          onChange={() => toggleCooler(2)}
        />
      </Section>

      <Section title="Scrubber levels (Tier 2)">
        {SCRUBBERS.map(([n, label]) => (
          <Toggle
            key={n}
            label={label}
            hint={`LSH_700${n} · level high`}
            checked={f.scrubber_level_hi.includes(n)}
            onChange={() => toggleInNumList('scrubber_level_hi', n)}
          />
        ))}
      </Section>

      <Section title="Vibration (Tier 2)">
        {VIBRATION.map(([n, label]) => (
          <Toggle
            key={n}
            label={label}
            hint={`VSH_701${n} · vibration trip`}
            checked={f.vibration_trip.includes(n)}
            onChange={() => toggleInNumList('vibration_trip', n)}
          />
        ))}
      </Section>

      <Section title="Oil / JW levels (Tier 2)">
        {LEVELS.map(([n, label]) => (
          <Toggle
            key={n}
            label={label}
            hint={`LSL_702${n} · level low`}
            checked={f.oil_jw_level_lo.includes(n)}
            onChange={() => toggleInNumList('oil_jw_level_lo', n)}
          />
        ))}
        <Toggle
          label="Fuel gas pressure low"
          hint="PSL_7031"
          checked={f.fuel_gas_press_lo}
          onChange={(v) => set('fuel_gas_press_lo', v)}
        />
      </Section>

      <Section title="Lubricator no-flow (Tier 2)">
        {LUBRICATORS.map(([n, label]) => (
          <Toggle
            key={n}
            label={label}
            hint={`FSL_704${n}`}
            checked={f.lubricator_no_flow.includes(n)}
            onChange={() => toggleInNumList('lubricator_no_flow', n)}
          />
        ))}
      </Section>

      <Section title="Signal freeze / invalid">
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 gap-y-1 text-xs">
          <span className="text-[var(--text-tag)]">tag</span>
          <span className="text-[var(--text-tag)]">freeze</span>
          <span className="text-[var(--text-tag)]">invalid</span>
          {AI_TAGS.map(([tag, label]) => (
            <Fragment key={tag}>
              <span className="text-[var(--text-label)]" title={label}>
                {tag}
              </span>
              <input
                type="checkbox"
                checked={f.signal_freeze.includes(tag)}
                onChange={() => toggleInList('signal_freeze', tag)}
                className="accent-[var(--alm-p1)]"
              />
              <input
                type="checkbox"
                checked={f.signal_invalid.includes(tag)}
                onChange={() => toggleInList('signal_invalid', tag)}
                className="accent-[var(--alm-p1)]"
              />
            </Fragment>
          ))}
        </div>
      </Section>

      <Section title="Link">
        <Toggle
          label="Link drop"
          hint="suspends OPC UA writes, exercises the watchdog"
          checked={f.link_drop}
          onChange={(v) => set('link_drop', v)}
        />
      </Section>

      <Section title="Instrumentation (section 7 step 8)">
        <Toggle label="Signal lag" hint="0.3-2s first-order lag per tag" checked={lagEnabled} onChange={setLagEnabled} />
        <Toggle label="Signal noise" hint="Gaussian noise per tag" checked={noiseEnabled} onChange={setNoiseEnabled} />
      </Section>

      <Section title="Boundary conditions (section 6.5)">
        <Slider
          label="Source pressure"
          value={b.P_src_psig}
          min={0}
          max={150}
          unit=" psig"
          onChange={(v) => sendBoundary({ ...b, P_src_psig: v })}
        />
        <Slider
          label="Pipeline pressure"
          value={b.P_proc_psig}
          min={0}
          max={1600}
          unit=" psig"
          onChange={(v) => sendBoundary({ ...b, P_proc_psig: v })}
        />
        <Slider
          label="Suction (inlet) temperature"
          value={b.T_suc_F}
          min={40}
          max={150}
          unit="°F"
          onChange={(v) => sendBoundary({ ...b, T_suc_F: v })}
        />
        <Slider
          label="Ambient temperature"
          value={b.T_amb_F}
          min={-20}
          max={130}
          unit="°F"
          onChange={(v) => sendBoundary({ ...b, T_amb_F: v })}
        />
      </Section>
      </div>
    </div>
  );
}

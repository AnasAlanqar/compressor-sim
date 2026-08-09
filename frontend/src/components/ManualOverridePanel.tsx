import { useEffect, useState } from 'react';
import type { TagValue } from '../hooks/useSimState';

// Every command in APP_SPEC.md section 4.3 (analog) and 4.4 (discrete).
// Fail values match the defaults physics.Cmd() already encodes (section
// 4.3/4.4 "Fail value" column): everything off, both analog outputs 0.
interface OverrideState {
  SC_3001: number;
  FC_3002: number;
  FC_3003: number;
  CMD_4001: boolean;
  CMD_4003: boolean;
  CMD_4004: boolean;
  CMD_4005: boolean;
  CMD_4006: boolean;
  CMD_4008: boolean;
  CMD_4009: boolean;
  CMD_4010: boolean;
  CMD_4011: boolean;
  CMD_4012: boolean;
}

const INITIAL: OverrideState = {
  SC_3001: 0,
  FC_3002: 0,
  FC_3003: 0,
  CMD_4001: false,
  CMD_4003: false,
  CMD_4004: false,
  CMD_4005: false,
  CMD_4006: false,
  CMD_4008: false,
  CMD_4009: false,
  CMD_4010: false,
  CMD_4011: false,
  CMD_4012: false,
};

// Tier 1 operator pushbuttons and CAT ECU status inputs — discrete inputs
// TO the PLC (app writes), not commands FROM it, so unlike OverrideState
// above these stay live even once OPC UA is connected: a real pushbutton
// or a real ECU status relay is wired straight into the PLC's I/O, never
// routed through — or overridden by — an upstream OPC UA command.
interface HmiState {
  PB_5001: boolean; // unit shutdown pushbutton, momentary
  ESD_5002: boolean; // remote ESD, maintained
  PB_5003: boolean; // local stop pushbutton, momentary
  PB_5004: boolean; // remote stop pushbutton, momentary
  XA_6002: boolean; // CAT engine alarm
  XS_6003: boolean; // CAT engine failure shutdown
}

const INITIAL_HMI: HmiState = {
  PB_5001: false,
  ESD_5002: false,
  PB_5003: false,
  PB_5004: false,
  XA_6002: false,
  XS_6003: false,
};

interface Props {
  disabled: boolean; // true once OPC UA is driving — section 6.4
  onChange: (tags: Record<string, TagValue>) => void;
  /** cmd_echo from the backend — what's actually commanding the machine.
   * Same canonical tag names as OverrideState's keys (section 4.3/4.4).
   * Only consulted while disabled, to show the PLC's real values instead
   * of whatever this panel last held. */
  readback?: Record<string, TagValue>;
  /** Full live tag set, for the read-only Tier 1 status feedback block
   * (cooler run status, engine JW temp, engine oil pressure). */
  liveTags?: Record<string, TagValue>;
}

// A relay/pushbutton-style tile: the whole tile is the hit target, an LED
// dot reports state at a glance, tag id sits underneath in mono caption
// type. Denser than a label+switch row, and reads like real panel hardware.
function SwitchTile({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex flex-col gap-1 rounded border px-2 py-1 text-left transition-colors ${
        checked ? 'border-emerald-700/70 bg-emerald-950/40' : 'border-neutral-800 bg-neutral-900/70'
      } ${disabled ? 'opacity-40' : 'hover:border-neutral-600'}`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-[11px] leading-tight text-neutral-200">{label}</span>
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${
            checked ? 'bg-emerald-400 shadow-[0_0_5px_1.5px_rgba(52,211,153,0.6)]' : 'bg-neutral-700'
          }`}
        />
      </span>
      <span className="font-mono text-[9px] text-neutral-500">{hint}</span>
    </button>
  );
}

function CompactSlider({
  label,
  hint,
  value,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className="rounded border border-neutral-800 bg-neutral-900/70 px-2 py-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] text-neutral-200">{label}</span>
        <span className="tabular font-mono text-[11px] text-emerald-400">{value.toFixed(0)}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 h-1 w-full accent-emerald-600 disabled:opacity-40"
      />
      <div className="mt-0.5 font-mono text-[9px] text-neutral-500">{hint}</div>
    </div>
  );
}

function PulseButton({ label, hint, onPress }: { label: string; hint?: string; onPress: () => void }) {
  return (
    <button
      type="button"
      onClick={onPress}
      className="rounded border border-neutral-800 bg-neutral-900/70 px-2 py-1 text-left transition-colors hover:border-neutral-600 hover:bg-neutral-800 active:bg-neutral-700"
    >
      <div className="text-[11px] text-neutral-200">{label}</div>
      {hint && <div className="font-mono text-[9px] text-neutral-500">{hint}</div>}
    </button>
  );
}

function StatusChip({ label, hint, on }: { label: string; hint?: string; on: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded border border-neutral-800 bg-neutral-900/70 px-2 py-1">
      <span className="flex flex-col leading-tight">
        <span className="text-[11px] text-neutral-200">{label}</span>
        {hint && <span className="font-mono text-[9px] text-neutral-500">{hint}</span>}
      </span>
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${
          on ? 'bg-emerald-400 shadow-[0_0_5px_1.5px_rgba(52,211,153,0.6)]' : 'bg-neutral-700'
        }`}
      />
    </div>
  );
}

function ReadoutChip({ label, hint, value }: { label: string; hint?: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded border border-neutral-800 bg-neutral-900/70 px-2 py-1">
      <span className="flex flex-col leading-tight">
        <span className="text-[11px] text-neutral-200">{label}</span>
        {hint && <span className="font-mono text-[9px] text-neutral-500">{hint}</span>}
      </span>
      <span className="tabular font-mono text-[12px] text-neutral-300">{value}</span>
    </div>
  );
}

function Section({ title, cols = 2, children }: { title: string; cols?: 2 | 3; children: React.ReactNode }) {
  return (
    <div className="mb-3 break-inside-avoid rounded border border-neutral-800 bg-neutral-900/40 p-1.5">
      <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{title}</h3>
      <div className={`grid gap-1 ${cols === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>{children}</div>
    </div>
  );
}

export default function ManualOverridePanel({ disabled, onChange, readback, liveTags }: Props) {
  const [ov, setOv] = useState<OverrideState>(INITIAL);
  const [hmi, setHmi] = useState<HmiState>(INITIAL_HMI);

  // Push the full command set on every change — the backend applies
  // whatever tags are present, and this panel always knows the whole
  // section 4.3/4.4 set, so there is no ambiguity about what's live.
  useEffect(() => {
    if (!disabled) onChange({ ...ov });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ov, disabled]);

  // Tier 1 operator/ECU inputs are never gated by `disabled` — see the
  // HmiState comment above.
  useEffect(() => {
    onChange({ ...hmi });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hmi]);

  // Once OPC UA is driving, mirror the PLC's actual commands instead of
  // whatever this panel last held (section 6.4: "these become read-only
  // indicators showing what the PLC is commanding").
  useEffect(() => {
    if (disabled && readback) setOv((prev) => ({ ...prev, ...(readback as Partial<OverrideState>) }));
  }, [disabled, readback]);

  const set = <K extends keyof OverrideState>(key: K, value: OverrideState[K]) =>
    setOv((prev) => ({ ...prev, [key]: value }));

  const setHmiToggle = <K extends keyof HmiState>(key: K, value: HmiState[K]) =>
    setHmi((prev) => ({ ...prev, [key]: value }));

  const pulse = (key: keyof HmiState) => {
    setHmi((prev) => ({ ...prev, [key]: true }));
    setTimeout(() => setHmi((prev) => ({ ...prev, [key]: false })), 400);
  };

  const tag = (t: string) => (liveTags && typeof liveTags[t] === 'number' ? (liveTags[t] as number) : 0);
  const flag = (t: string) => Boolean(liveTags?.[t]);

  return (
    <div className="flex flex-col gap-2">
      {disabled && (
        <div className="rounded border border-amber-700 bg-amber-950/40 px-2 py-1 text-[11px] text-amber-400">
          OPC UA connected — the PLC is driving. These are read-only indicators.
        </div>
      )}

      <div className="columns-1 gap-3 sm:columns-2 xl:columns-3">
      <Section title="Engine">
        <SwitchTile label="CAT start" hint="CMD_4005" checked={ov.CMD_4005} disabled={disabled} onChange={(v) => set('CMD_4005', v)} />
        <SwitchTile label="CAT ESD healthy" hint="CMD_4006" checked={ov.CMD_4006} disabled={disabled} onChange={(v) => set('CMD_4006', v)} />
        <SwitchTile label="Driven equip. ready" hint="CMD_4008" checked={ov.CMD_4008} disabled={disabled} onChange={(v) => set('CMD_4008', v)} />
        <SwitchTile label="Idle / rated speed" hint="CMD_4003 · off=idle 650rpm" checked={ov.CMD_4003} disabled={disabled} onChange={(v) => set('CMD_4003', v)} />
        <div className="col-span-2">
          <CompactSlider label="Speed command" hint="SC_3001 · rated-range throttle" value={ov.SC_3001} disabled={disabled} onChange={(v) => set('SC_3001', v)} />
        </div>
        <SwitchTile label="Auxiliary lube" hint="CMD_4001" checked={ov.CMD_4001} disabled={disabled} onChange={(v) => set('CMD_4001', v)} />
      </Section>

      <Section title="Valves">
        <div className="col-span-2">
          <CompactSlider label="Bypass command" hint="FC_3002 · fail 0 open; closed @75%" value={ov.FC_3002} disabled={disabled} onChange={(v) => set('FC_3002', v)} />
        </div>
        <div className="col-span-2">
          <CompactSlider label="Suction command" hint="FC_3003 · fail 0 closed" value={ov.FC_3003} disabled={disabled} onChange={(v) => set('FC_3003', v)} />
        </div>
        <SwitchTile label="Suction ESD" hint="CMD_4009 · en=open" checked={ov.CMD_4009} disabled={disabled} onChange={(v) => set('CMD_4009', v)} />
        <SwitchTile label="Discharge ESD" hint="CMD_4010 · en=open" checked={ov.CMD_4010} disabled={disabled} onChange={(v) => set('CMD_4010', v)} />
        <SwitchTile label="Blowdown" hint="CMD_4004 · en=closed" checked={ov.CMD_4004} disabled={disabled} onChange={(v) => set('CMD_4004', v)} />
      </Section>

      <Section title="Coolers">
        <SwitchTile label="Cooler motor 1" hint="CMD_4011" checked={ov.CMD_4011} disabled={disabled} onChange={(v) => set('CMD_4011', v)} />
        <SwitchTile label="Cooler motor 2" hint="CMD_4012" checked={ov.CMD_4012} disabled={disabled} onChange={(v) => set('CMD_4012', v)} />
      </Section>

      <Section title="Operator / ECU inputs (always live)" cols={3}>
        <PulseButton label="Unit shutdown" hint="PB_5001" onPress={() => pulse('PB_5001')} />
        <PulseButton label="Local stop" hint="PB_5003" onPress={() => pulse('PB_5003')} />
        <PulseButton label="Remote stop" hint="PB_5004" onPress={() => pulse('PB_5004')} />
        <SwitchTile label="Remote ESD" hint="ESD_5002" checked={hmi.ESD_5002} disabled={false} onChange={(v) => setHmiToggle('ESD_5002', v)} />
        <SwitchTile label="CAT alarm" hint="XA_6002" checked={hmi.XA_6002} disabled={false} onChange={(v) => setHmiToggle('XA_6002', v)} />
        <SwitchTile label="CAT fail SD" hint="XS_6003" checked={hmi.XS_6003} disabled={false} onChange={(v) => setHmiToggle('XS_6003', v)} />
      </Section>

      <Section title="Status feedback (read-only)">
        <StatusChip label="Cooler 1 running" hint="RS_4011" on={flag('RS_4011')} />
        <StatusChip label="Cooler 2 running" hint="RS_4012" on={flag('RS_4012')} />
        <ReadoutChip label="Engine JW temp" hint="TT_2014" value={`${tag('TT_2014').toFixed(0)} °F`} />
        <ReadoutChip label="Engine oil press" hint="PT_1007" value={`${tag('PT_1007').toFixed(0)} psig`} />
      </Section>
      </div>
    </div>
  );
}

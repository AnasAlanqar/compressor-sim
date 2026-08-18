// Per-tag-prefix numeric format registry (§5.3). Every number rendered in
// the view layer routes through here — no bare `.toFixed()` + string
// concatenation, so decimal places and unit glyphs stay consistent across
// the whole app instead of drifting file to file ("0 psig", "0.0 psig").

export type UnitKind = 'PT' | 'TT' | 'FC' | 'CMD' | 'speed' | 'load' | 'runtime' | 'simClock' | 'generic';

interface FormatSpec {
  decimals: number;
  unit: string;
}

const SPECS: Record<Exclude<UnitKind, 'CMD' | 'generic'>, FormatSpec> = {
  PT: { decimals: 1, unit: 'psig' },
  TT: { decimals: 1, unit: 'degF' },
  FC: { decimals: 1, unit: '%' },
  speed: { decimals: 0, unit: 'RPM' },
  load: { decimals: 0, unit: '%' },
  runtime: { decimals: 1, unit: 'hr' },
  simClock: { decimals: 1, unit: 's' },
};

/** Tag prefix ("PT_1001" -> "PT") -> UnitKind, for callers that only have a
 * tag id and not a semantic kind. Falls back to 'generic' (2 decimals, no
 * unit glyph) for anything unrecognized rather than guessing. */
export function kindForTag(tag: string): UnitKind {
  const prefix = tag.split('_')[0];
  if (prefix === 'PT') return 'PT';
  if (prefix === 'TT') return 'TT';
  if (prefix === 'FC') return 'FC';
  if (prefix === 'CMD') return 'CMD';
  return 'generic';
}

export interface FormattedValue {
  text: string;
  unit: string;
}

/** Formats a live numeric reading. `stale` replaces the value with "-.-"
 * per §7 ("never show a stale number as if it were live") — comms-loss
 * callers should pass stale=true rather than special-casing the display
 * string themselves. */
export function formatValue(kind: UnitKind, value: number, stale = false): FormattedValue {
  if (stale) return { text: '-.-', unit: '' };
  if (kind === 'CMD') return { text: value ? 'OPEN' : 'CLOSED', unit: '' };
  if (kind === 'generic') return { text: value.toFixed(2), unit: '' };
  const spec = SPECS[kind];
  return { text: value.toFixed(spec.decimals), unit: spec.unit };
}

export function formatTag(tag: string, value: number, stale = false): FormattedValue {
  return formatValue(kindForTag(tag), value, stale);
}

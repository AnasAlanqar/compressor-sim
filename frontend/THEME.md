# HMI theme (ISA-101 restyle)

## The one rule

**Normal state is gray and quiet. Color exists only to signal abnormality.**

A reading, valve, or piece of equipment operating within its normal band
carries no color at all — it's rendered in the neutral ink/surface tokens
(`--text-value`, `--equip-fill`, `--pipe-major`, etc.). Color turns on only
when `gaugeState()` (`frontend/src/lib/pid.ts`) returns `amber` or `red`,
i.e. an actual alarm condition. Equipment/valve state (open, closed,
running, tripped) is communicated by **shape and position**, not hue — see
`GateValve.tsx` / `ControlValve.tsx` / `BlowdownValve.tsx` for the pattern
(closed = filled body + full-width block, open = hollow, transit = a single
dashed amber line, never a color fill by itself).

This is the entire design brief. Every other rule below exists to protect
this one from erosion over time.

## Toggling themes

`Ctrl+Shift+L` cycles `light -> legacy` (see `useTheme.ts`); a `dark` theme
value also exists and is reachable by setting `localStorage['hmi-theme']`
directly. `legacy` renders `AppShellLegacy.tsx` — a frozen, byte-for-byte
snapshot of the pre-restyle app, kept solely so the old and new HMI can be
compared side by side. **Never edit anything under the `*Legacy.tsx` /
`tokens.legacy.css` files** — if the legacy comparison drifts, it stops
being a useful baseline.

## Tokens

Every color, line weight, radius, spacing value, and font size in the live
(non-legacy) app must come from `frontend/src/styles/tokens.css`
(`:root`/`[data-theme="light"]` and `[data-theme="dark"]` blocks). No
hard-coded hex, no Tailwind default color classes (`bg-blue-500` etc.) —
only `var(--token)` or Tailwind's arbitrary-value syntax (`bg-[var(--x)]`).

| Token | Purpose |
|---|---|
| `--hmi-canvas` / `--hmi-surface` / `--hmi-surface-sunken` / `--hmi-chrome` | Background layers, darkest (canvas) to lightest (chrome), or the inverse in dark mode |
| `--hmi-rule` / `--hmi-rule-strong` | Hairline dividers; `-strong` for borders that need to read as a boundary, not just a seam |
| `--pipe-major` / `--pipe-minor` / `--pipe-signal` | Process line, minor/bypass line, dashed instrument-signal leader |
| `--equip-stroke` / `--equip-stroke-idle` / `--equip-fill` / `--equip-fill-active` / `--equip-hatch` | Equipment symbol outline and fill (idle vs. active stroke weight/color) |
| `--text-value` / `--text-label` / `--text-tag` / `--text-disabled` | Readout value, field label, tag id, sim-only/disabled text — a deliberate contrast hierarchy, brightest to dimmest |
| `--alm-p1` / `--alm-p2` / `--alm-p3` / `--alm-trip` (+ `-on` variants) | The *only* saturated colors in the app. P1 = high urgency (red), P2 = advisory (amber), P3 = low (yellow), trip = magenta, reserved for ESD/shutdown states. `-on` is the text/icon color to use *on top of* a filled alarm chip |
| `--alm-unack-ring` | Outline drawn around an unacknowledged alarm row/banner segment |
| `--focus-ring` / `--select-ring` | Keyboard focus indicator — the only permitted outline/glow in the app |
| `--btn-face` / `--btn-face-hover` / `--btn-face-active` | Button background states |
| `--w-pipe-major` / `--w-pipe-minor` / `--w-signal` / `--w-equip` / `--w-hairline` | Stroke widths — a fixed small set, not arbitrary per-component values |
| `--radius` / `--radius-btn` / `--unit` | Corner radius (0 on the mimic — ISA-101 favors rectilinear symbols), button radius, base spacing unit |
| `--font-label` / `--font-value` / `--font-prose` | Condensed sans (tags/labels), mono (numeric readouts, tabular-nums), regular sans (prose/UI chrome) |
| `--fs-tag` … `--fs-header` | The complete type scale (§5.2) — six sizes, nothing else is permitted |

## Adding a new tag / readout

1. Add the tag to `frontend/src/lib/engUnits.ts`'s `SPECS` table (decimals +
   unit string) so it's covered by `formatTag()`/`formatValue()` — every
   displayed number must route through this, never a raw `toFixed()` at the
   call site.
2. If it has alarm limits, they come from the backend's `config.yaml`
   alarms block (`/api/config` → `alarms[tag]`), not something invented in
   the frontend — `gaugeState(tag, value, alarms)` derives normal/amber/red
   from that table.
3. Place it as a `ReadingSpec` row inside the nearest `ReadoutGroup` in
   `PidDiagram.tsx` (mimic) and/or as a `Field`/`Sparkline` in
   `DriverStrip.tsx` / `RightDock.tsx` (dock and footer) — whichever is
   contextually closest to the equipment it instruments. Real transmitter
   tags render as `tag`/state-colored; a model-only estimate with no real
   I/O point sets `simOnly` (dimmer, italic, "SIM" label, no MAI — there
   are no configured limits to show).
4. If it has meaningful alarm limits, pass `band={alarms['TAG']}` so a
   `MovingAnalogIndicator` renders under the readout automatically.
5. Never touch tag names, OPC UA addressing, or backend config to make a
   tag "fit" the display — the display adapts to the tag map, not the
   reverse.

## Motion

The only permitted animation in the app is the 1Hz unacked-alarm blink
(`.alarm-unacked-blink` in `index.css`), and it respects
`prefers-reduced-motion`. Everything else — the old travelling flow-dot
indicators, the blowdown plume's puff animation — was removed in Phase 8.
Flow direction is now communicated statically via the fixed chevron marks
on each process line (`Chevrons` in `PidDiagram.tsx`).

## Known, documented deviations from the literal spec

See the Phase 6/7 commit messages and the final PR description for the
full list (client-side-derived alarm log with no historian persistence,
the TOOLS dock placement, the driver-strip field set limited to real
tags). They're deviations from the spec's assumed environment or tag set,
not from the ISA-101 principle above.

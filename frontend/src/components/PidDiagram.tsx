import { useLayoutEffect, useRef, useState } from 'react';
import type { SimTags, Flows, ValvePositions, SimInsight } from '../hooks/useSimState';
import { gaugeState, type AlarmTable, type GaugeState } from '../lib/pid';
import { formatTag, formatValue } from '../lib/engUnits';

// ISA-101: normal state carries no color at all. Alarm state is the only
// thing color communicates — see tokens.css §"Alarm priorities" and
// THEME.md. gaugeState -> token name, resolved via var() at paint time.
const STATE_TOKEN: Record<GaugeState, string> = {
  normal: 'var(--text-value)',
  amber: 'var(--alm-p2)',
  red: 'var(--alm-p1)',
};

interface Props {
  tags: SimTags;
  flows: Flows;
  valves: ValvePositions;
  alarms: AlarmTable;
  /** Actual (fault-aware) command status, section 6.4/6.2 — cooler run
   * status specifically, since section 4's tag map has no continuous fan
   * feedback and the raw commands never crossed the websocket before. */
  cmdEcho: SimTags;
  /** Model-internal temperatures with no real transmitter (T_suc, T_inter)
   * — rendered in a visually distinct "simulator-only" style, never mixed
   * into the instrumented readouts. */
  simInsight: SimInsight;
}

const num = (tags: SimTags, tag: string) => (typeof tags[tag] === 'number' ? (tags[tag] as number) : 0);

// A NARROWER viewBox with the same element sizes renders everything larger
// once the SVG is scaled to fill its container — this is the lever for
// diagram scale, not canvas size. The right-side cards now need extra
// margin so the final EXPORT and AFTERCLR label blocks can sit in the
// right gutter without squeezing the stage readouts.
const CANVAS_W = 3120;
// Reference height the layout below is designed for; the actual viewBox
// height tracks the container's aspect ratio (see useContainerHeight) so
// the diagram always fills its box edge-to-edge with no letterbox bars —
// the tight cluster below is simply centered within whatever height that
// yields, rather than distorted or cropped.
const CANVAS_H_REF = 930;
const BASE_AXIS_Y = 360; // main process line, within the CANVAS_H_REF layout

// Tracks a wrapper element's rendered aspect ratio so the SVG viewBox can
// match it exactly (clamped to a sane range so extreme window shapes don't
// squash icons into an unreadable sliver or stretch them absurdly tall).
function useContainerHeight(width: number, refHeight: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(refHeight);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box || box.width === 0 || box.height === 0) return;
      const h = (width * box.height) / box.width;
      // Floor at the full reference height (not a fraction of it) — the
      // diagram's content (bypass loop, blowdown stack) extends down to
      // ~refHeight already; a lower floor let very wide/short containers
      // (e.g. a full-page-width layout) clip that content out of the
      // viewBox entirely instead of just letterboxing it.
      setHeight(Math.min(1400, Math.max(refHeight, h)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [width, refHeight]);
  return { ref, height };
}

// ---- flow-arrow animation: dots travelling a straight or curved segment,
// speed and visibility driven by mass flow (section 6.2: "animation speed
// proportional to mass flow, hidden when flow is zero") -----------------
function FlowDots({ path, flow }: { path: string; flow: number }) {
  if (flow < 1e-4) return null;
  const dur = Math.max(0.4, Math.min(4, 0.6 / flow));
  return (
    <>
      {[0, 0.33, 0.66].map((offset) => (
        <circle key={offset} r={4.6} fill="var(--text-value)">
          <animateMotion dur={`${dur}s`} begin={`${-offset * dur}s`} repeatCount="indefinite" path={path} />
        </circle>
      ))}
    </>
  );
}

function Pipe({ x1, y1, x2, y2, flow }: { x1: number; y1: number; x2: number; y2: number; psig: number; flow: number }) {
  const path = `M${x1},${y1} L${x2},${y2}`;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--pipe-major)" strokeWidth={11} strokeLinecap="round" />
      <FlowDots path={path} flow={flow} />
    </g>
  );
}

// Bowtie valve glyph — the shape itself carries state as well as the fill
// colour: closed gets a blocking bar through the pinch point, open gets a
// soft glow halo, in-transit pulses a dashed ring. `orientation` rotates the
// glyph for valves sitting on a vertical run (blowdown) without rotating the
// surrounding labels.
function ValveIcon({
  x,
  y,
  pct,
  label,
  sub,
  orientation = 'h',
}: {
  x: number;
  y: number;
  pct: number;
  label: string;
  sub: string;
  orientation?: 'h' | 'v';
}) {
  const closed = pct < 2;
  const open = pct > 98;
  const transit = !closed && !open;
  // Position, not color, carries valve state (§7): closed fills solid,
  // open reads hollow against the canvas, in-transit sits between the two.
  const color = closed ? 'var(--equip-fill)' : open ? 'var(--hmi-canvas)' : 'var(--equip-fill-active)';
  const rot = orientation === 'v' ? 90 : 0;
  // State is carried by the glyph shape and colour, but also spelled out as
  // text so open/closed/transit reads without relying on colour perception.
  const stateWord = closed ? 'CLOSED' : open ? 'OPEN' : 'MOVING';
  return (
    <g transform={`translate(${x},${y})`}>
      <g transform={`rotate(${rot})`}>
        <path d="M-46,-32 L-46,32 L0,0 Z M46,-32 L46,32 L0,0 Z" fill={color} stroke="var(--equip-stroke)" strokeWidth={3} />
        {closed && <rect x={-10} y={-36} width={20} height={72} rx={4} fill="var(--hmi-canvas)" stroke={color} strokeWidth={3} />}
        {transit && (
          <circle r={52} fill="none" stroke="var(--equip-stroke)" strokeWidth={4.5} strokeDasharray="8 8" strokeOpacity={0.85}>
            <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="2.2s" repeatCount="indefinite" />
          </circle>
        )}
      </g>
      <text
        y={-72}
        textAnchor="middle"
        fontSize={26}
        fontFamily="var(--font-value)"
        fontWeight={500}
        fill="var(--text-value)"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {formatValue('FC', pct).text}
        <tspan fontFamily="var(--font-label)" fill="var(--text-tag)"> {formatValue('FC', pct).unit}</tspan>
      </text>
      <text y={52} textAnchor="middle" fontSize={14} fontWeight={500} letterSpacing={0.6} fill="var(--text-label)">
        {stateWord}
      </text>
      <text y={78} textAnchor="middle" fontSize={19} fill="var(--text-label)">
        {label}
      </text>
      <text y={99} textAnchor="middle" fontSize={15} fill="var(--text-tag)">
        {sub}
      </text>
    </g>
  );
}

// P vs T get a fixed identity, independent of alarm state, so the two
// quantities are visually distinguishable regardless of alarm — both read
// as --text-tag now (§7: normal state carries no color); only the kind
// letter's weight/position, not hue, tells P from T.
const KIND_ACCENT: Record<'P' | 'T', string> = { P: 'var(--text-tag)', T: 'var(--text-tag)' };

interface ReadingSpec {
  kind: 'P' | 'T';
  value: string;
  unit: string;
  /** Real tag id ("PT_1001") for instrumented readings; ignored (replaced
   * by "sim") when simOnly is set. */
  tag: string;
  state: GaugeState;
  /** No corresponding transmitter on the real unit (section 4's I/O list
   * has no interstage TTs) — a model-internal value shown as insight only,
   * rendered dimmer with a dashed, unfilled kind chip and no tag number. */
  simOnly?: boolean;
}

// Word appended after the unit when a reading is out of its normal band —
// alongside the colour change, so alarm/trip reads without relying on
// colour perception. Normal readings stay calm (no extra word).
const STATE_WORD: Record<GaugeState, string | null> = { normal: null, amber: 'ALARM', red: 'TRIP' };

function ReadingRow({ y, width, kind, value, unit, tag, state, simOnly }: ReadingSpec & { y: number; width: number }) {
  const accent = KIND_ACCENT[kind];
  const valueColor = simOnly ? 'var(--text-disabled)' : STATE_TOKEN[state];
  const chipX = -width / 2 + 28;
  const stateWord = simOnly ? null : STATE_WORD[state];
  return (
    <g>
      <circle
        cx={chipX}
        cy={y}
        r={17}
        fill={accent}
        fillOpacity={simOnly ? 0 : 0.22}
        stroke={accent}
        strokeWidth={2.4}
        strokeDasharray={simOnly ? '3 3' : undefined}
      />
      <text x={chipX} y={y + 6.5} textAnchor="middle" fontSize={18} fontWeight={500} fill={accent}>
        {kind}
      </text>
      <text
        x={chipX + 34}
        y={y + 9}
        fontSize={32}
        fontFamily="var(--font-value)"
        fill={valueColor}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
        <tspan fontSize={17} fontFamily="var(--font-label)" fill="var(--text-tag)">
          {' '}
          {unit}
        </tspan>
      </text>
      <text
        x={width / 2 - 16}
        y={y - 15}
        textAnchor="end"
        fontSize={15}
        fontStyle={simOnly ? 'italic' : 'normal'}
        fill="var(--text-tag)"
      >
        {simOnly ? 'sim' : tag}
      </text>
      {stateWord && (
        <text x={width / 2 - 16} y={y + 14} textAnchor="end" fontSize={14} fontWeight={500} letterSpacing={0.5} fill={valueColor}>
          {stateWord}
        </text>
      )}
    </g>
  );
}

// Card geometry shared between the layout math in PidDiagram (which needs
// to know a card's height before it's drawn, to bottom-anchor it a fixed
// distance above the process line) and the ReadoutCard renderer itself.
const CARD_W = 300;
const ROW_H = 74;
const HEADER_H = 44;
const CARD_PAD = 18;
function cardHeight(rows: number) {
  return HEADER_H + rows * ROW_H + CARD_PAD;
}

// Unified instrument card — every readout in the diagram (stage in/out
// conditions, aftercooler, final discharge) uses this same shape and size
// so P vs T and real-vs-simulator are the only things that visually vary;
// everything else (border, alignment, tap-line style) stays consistent.
function ReadoutCard({
  x,
  y,
  tapX,
  tapY,
  title,
  rows,
}: {
  x: number;
  y: number;
  tapX: number;
  tapY: number;
  title: string;
  rows: ReadingSpec[];
}) {
  const w = CARD_W;
  const h = cardHeight(rows.length);
  return (
    <g>
      <line x1={tapX} y1={tapY} x2={x} y2={y + h / 2} stroke="var(--pipe-signal)" strokeWidth={1.4} strokeDasharray="3 4" />
      <circle cx={tapX} cy={tapY} r={4} fill="var(--pipe-signal)" />
      <g transform={`translate(${x},${y})`}>
        <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={12} fill="var(--hmi-surface)" stroke="var(--hmi-rule-strong)" strokeWidth={2} />
        <text x={0} y={-h / 2 + 27} textAnchor="middle" fontSize={16.5} fontWeight={500} letterSpacing={0.5} fill="var(--text-label)">
          {title}
        </text>
        {rows.map((r, i) => (
          <ReadingRow key={i} y={-h / 2 + HEADER_H + ROW_H * i + ROW_H / 2 + 2} width={w} {...r} />
        ))}
      </g>
    </g>
  );
}

// Legend for the P/T colour coding and the real-vs-simulator distinction —
// tucked in the top-left corner, clear of the process line.
function Legend({ x, y }: { x: number; y: number }) {
  const row = 26;
  return (
    <g transform={`translate(${x},${y})`}>
      <circle cx={0} cy={0} r={10} fill={KIND_ACCENT.P} fillOpacity={0.22} stroke={KIND_ACCENT.P} strokeWidth={1.8} />
      <text x={0} y={4.5} textAnchor="middle" fontSize={11} fontWeight={500} fill={KIND_ACCENT.P}>P</text>
      <text x={17} y={5} fontSize={13.5} fill="var(--text-label)">pressure</text>

      <circle cx={140} cy={0} r={10} fill={KIND_ACCENT.T} fillOpacity={0.22} stroke={KIND_ACCENT.T} strokeWidth={1.8} />
      <text x={140} y={4.5} textAnchor="middle" fontSize={11} fontWeight={500} fill={KIND_ACCENT.T}>T</text>
      <text x={157} y={5} fontSize={13.5} fill="var(--text-label)">temperature</text>

      <circle cx={0} cy={row} r={10} fill="var(--text-tag)" fillOpacity={0.22} stroke="var(--text-tag)" strokeWidth={1.8} />
      <text x={17} y={row + 5} fontSize={13.5} fill="var(--text-tag)">
        solid + tag id — real PLC instrument
      </text>
      <circle cx={0} cy={row * 2} r={10} fill="none" stroke="var(--text-tag)" strokeWidth={1.8} strokeDasharray="3 3" />
      <text x={17} y={row * 2 + 5} fontSize={13.5} fontStyle="italic" fill="var(--text-tag)">
        dashed + "sim" — no field TT, model estimate only
      </text>
    </g>
  );
}

function Cylinder({ x, y, label, rpm }: { x: number; y: number; label: string; rpm: number }) {
  const running = rpm > 5;
  return (
    <g transform={`translate(${x},${y})`}>
      <rect
        x={-72}
        y={-67}
        width={144}
        height={134}
        rx={14}
        fill={running ? 'var(--equip-fill-active)' : 'var(--equip-fill)'}
        stroke={running ? 'var(--equip-stroke)' : 'var(--equip-stroke-idle)'}
        strokeWidth={running ? 1.5 : 1}
      />
      <text y={-10} textAnchor="middle" fontSize={28} fontWeight={500} fill="var(--text-label)">
        {label}
      </text>
      <text y={26} textAnchor="middle" fontSize={17} fontWeight={500} letterSpacing={0.6} fill="var(--text-label)">
        {running ? 'RUN' : 'OFF'}
      </text>
      <text y={101} textAnchor="middle" fontSize={15} fill="var(--text-tag)">
        cylinder
      </text>
    </g>
  );
}

function Cooler({ x, y, label, fansOn }: { x: number; y: number; label: string; fansOn: number; heat: number }) {
  const running = fansOn > 0;
  return (
    <g transform={`translate(${x},${y})`}>
      <rect
        x={-60}
        y={-54}
        width={120}
        height={108}
        rx={9}
        fill={running ? 'var(--equip-fill-active)' : 'var(--equip-fill)'}
        stroke={running ? 'var(--equip-stroke)' : 'var(--equip-stroke-idle)'}
        strokeWidth={running ? 1.5 : 1}
      />
      {[0, 1].map((i) => (
        <g key={i} transform={`translate(${-22 + i * 44},0)`}>
          <path
            d="M0,-22 L5.2,-5.2 L22,0 L5.2,5.2 L0,22 L-5.2,5.2 L-22,0 L-5.2,-5.2 Z"
            fill={fansOn > i ? 'var(--equip-stroke)' : 'var(--equip-stroke-idle)'}
          />
        </g>
      ))}
      <text y={78} textAnchor="middle" fontSize={15} fill="var(--text-label)">
        {label}
      </text>
      <text y={99} textAnchor="middle" fontSize={14} fontWeight={500} letterSpacing={0.5} fill="var(--text-label)">
        {`${fansOn}/2 FANS ${running ? 'ON' : 'OFF'}`}
      </text>
    </g>
  );
}

function Vessel({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={-38} y={-67} width={76} height={134} rx={38} fill="var(--equip-fill)" stroke="var(--equip-stroke-idle)" strokeWidth={1} />
      <text y={101} textAnchor="middle" fontSize={15} fill="var(--text-label)">
        {label}
      </text>
    </g>
  );
}

function BlowdownPlume({ x, y, active }: { x: number; y: number; active: boolean }) {
  if (!active) return null;
  return (
    <g transform={`translate(${x},${y})`}>
      {[0, 1, 2].map((i) => (
        <circle key={i} r={5.5} fill="var(--pipe-minor)" opacity={0}>
          <animate attributeName="cy" values="0;-50" dur="1.6s" begin={`${i * 0.5}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;0.5;0" dur="1.6s" begin={`${i * 0.5}s`} repeatCount="indefinite" />
          <animate attributeName="r" values="4;15" dur="1.6s" begin={`${i * 0.5}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </g>
  );
}

// Dedicated engine/crankshaft card — anchored below the compressor train,
// not floating over the piping. Dashed drivelines drop from each cylinder
// down to the card to show what it's driving.
function EngineBlock({ x, y, width, rpm }: { x: number; y: number; width: number; rpm: number }) {
  const running = rpm > 5;
  const cx = width - 78;
  return (
    <g transform={`translate(${x},${y})`}>
      <rect
        width={width}
        height={136}
        rx={12}
        fill="var(--hmi-surface)"
        stroke={running ? 'var(--equip-stroke)' : 'var(--equip-stroke-idle)'}
        strokeWidth={running ? 1.5 : 1}
      />
      <text x={26} y={34} fontSize={17} fontWeight={500} letterSpacing={0.4} fill="var(--text-value)">
        CAT G3516LE
      </text>
      <text x={26} y={56} fontSize={13.5} letterSpacing={0.3} fill="var(--text-tag)">
        ENGINE / CRANKSHAFT
      </text>
      <text x={26} y={80} fontSize={13} fontWeight={500} letterSpacing={0.6} fill="var(--text-label)">
        {running ? 'RUNNING' : 'STOPPED'}
      </text>
      <g transform={`translate(${width / 2 - 6},78)`}>
        <text
          textAnchor="middle"
          fontSize={34}
          fontFamily="var(--font-value)"
          fill={running ? 'var(--text-value)' : 'var(--text-disabled)'}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {formatValue('speed', rpm).text}
        </text>
        <text textAnchor="middle" y={20} fontSize={13} letterSpacing={0.3} fill="var(--text-tag)">
          RPM
        </text>
      </g>
      <g transform={`translate(${cx},68)`}>
        <circle r={32} fill="var(--hmi-surface-sunken)" stroke="var(--equip-stroke-idle)" strokeWidth={4} />
        <g>
          {running && (
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0"
              to="360"
              dur={`${Math.max(0.1, 60 / Math.max(rpm, 1))}s`}
              repeatCount="indefinite"
            />
          )}
          <line x1={0} y1={0} x2={25} y2={0} stroke="var(--equip-stroke)" strokeWidth={4} strokeLinecap="round" />
          <circle r={4} fill="var(--equip-stroke)" />
        </g>
      </g>
    </g>
  );
}

export default function PidDiagram({ tags, flows, valves, alarms, cmdEcho, simInsight }: Props) {
  const { ref: containerRef, height: CANVAS_H } = useContainerHeight(CANVAS_W, CANVAS_H_REF);
  const AXIS_Y = BASE_AXIS_Y + Math.max(0, (CANVAS_H - CANVAS_H_REF) / 2);

  const P_s = num(tags, 'PT_1001');
  const P_1 = num(tags, 'PT_1002');
  const P_2 = num(tags, 'PT_1003');
  const P_3 = num(tags, 'PT_1004');
  const P_d = num(tags, 'PT_1006');
  const rpm = num(tags, 'ST_1008');
  const Z_byp = valves.Z_byp;
  const Z_suc = valves.Z_suc;
  const Z_sesd = valves.Z_sesd;
  const Z_desd = valves.Z_desd;
  const Z_bdv = valves.Z_bdv;

  const n_fans = (Boolean(cmdEcho['CMD_4011']) ? 1 : 0) + (Boolean(cmdEcho['CMD_4012']) ? 1 : 0);

  const T_cyl1 = num(tags, 'TT_2004');
  const T_cyl2 = num(tags, 'TT_2005');
  const T_cyl3 = num(tags, 'TT_2006');
  const T_ac = num(tags, 'TT_2013');
  const T_suc = simInsight.T_suc_F;
  const T_inter = simInsight.T_inter_F;

  const gs = (tag: string, v: number) => gaugeState(tag, v, alarms);

  const suctionOn = P_s > 1;

  // ---- axis layout: named x positions for every component on the main
  // process line. Gaps are kept tight — pipe stubs are short, only the
  // stage pitch (cylinder to cylinder) is wide enough to give the shared
  // stage readout cards clearance from their neighbours. --------------
  const xSucScrub = 78;
  const xSesd = 198;
  const xSucCtrl = 326;
  const xCyl1 = 738;
  const xCooler1 = 906;
  const xScrub2 = 1282;
  const xCyl2 = 1428;
  const xCooler2 = 1596;
  const xScrub3 = 1972;
  const xCyl3 = 2118;
  const xAfterclr = 2745;
  const xDesd = 2887;
  const xEnd = 2983;

  // one shared readout card per pressure tap now (see PidDiagram redesign
  // notes) — PT_1002 and PT_1003 each serve one OUT/IN pair, so their card
  // sits over the pipe segment *between* the two cylinders it straddles,
  // not duplicated on both sides of it.
  const xIn1 = xCyl1 - 210;
  const xMid12 = (xCooler1 + xScrub2) / 2;
  const xMid23 = (xCooler2 + xScrub3) / 2;
  const xOut3 = xCyl3 + 277;

  // every card is bottom-anchored a fixed distance above the process line,
  // so leader lines are the same length regardless of how many rows a card
  // holds — only its top edge (and therefore its visual size) grows.
  const CARD_GAP = 70;
  const cardBottomY = AXIS_Y - CARD_GAP;
  const cardY2 = cardBottomY - cardHeight(2) / 2;
  const cardY3 = cardBottomY - cardHeight(3) / 2;

  // train boundary hugs the equipment (cylinders/coolers/scrubbers) only —
  // the label sits in a tab cut into the top border so the box reads as an
  // intentional, closed group rather than a stray dashed rectangle.
  const trainX0 = xCyl1 - 90;
  const trainX1 = xAfterclr + 90;
  const trainY0 = AXIS_Y - 110;
  const trainY1 = AXIS_Y + 115;

  // engine card sits directly under the cylinders it drives — short
  // drivelines, no floating gap.
  const engineX = xCyl1 - 55;
  const engineY = AXIS_Y + 150;
  const engineW = xAfterclr - xCyl1 + 110;
  const engineBottom = engineY + 136;

  // bypass (recycle) loop: taps off *after* the aftercooler/before the
  // discharge ESD, drops below the engine card, runs back under the whole
  // train, and rises back into the suction line *before* the suction
  // control valve/ST1 — so it reads unambiguously as "final discharge
  // recycles to suction," never crossing the train or engine.
  const bypTapOut = xAfterclr + 70;
  const bypTapIn = xSesd + 75;
  const loopY = engineBottom + 85;
  const bypCorner = 32;
  const bypassPath = `M${bypTapOut},${AXIS_Y + 18} L${bypTapOut},${loopY - bypCorner} Q${bypTapOut},${loopY} ${bypTapOut - bypCorner},${loopY} L${bypTapIn + bypCorner},${loopY} Q${bypTapIn},${loopY} ${bypTapIn},${loopY - bypCorner} L${bypTapIn},${AXIS_Y + 18}`;
  const bypassValveX = (bypTapOut + bypTapIn) / 2;

  // blowdown taps the suction line upstream of the bypass return and the
  // suction ESD, so its vertical run never crosses the recycle loop below.
  const xBlowdown = xSucScrub + 70;

  return (
    <div ref={containerRef} className="h-full w-full">
    <svg viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} className="h-full w-full" role="img" aria-label="Compressor P&amp;ID" preserveAspectRatio="xMidYMid meet">
      <rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="var(--hmi-canvas)" />

      <Legend x={18} y={26} />

      {/* boundary labels — clear of the (now much taller) end vessels/valves,
          which span most of AXIS_Y +/- their half-height */}
      <text x={20} y={AXIS_Y - 95} fontSize={15} letterSpacing={0.5} fill="var(--text-tag)">
        SOURCE
      </text>
      <text x={CANVAS_W - 20} y={AXIS_Y - 95} fontSize={15} letterSpacing={0.5} fill="var(--text-tag)" textAnchor="end">
        PIPELINE
      </text>

      {/* compressor train box, drawn first so equipment sits above it; the
          label lives in a tab notched into the border, not floating text
          that could be mistaken for a stray annotation. */}
      <rect x={trainX0} y={trainY0} width={trainX1 - trainX0} height={trainY1 - trainY0} rx={12} fill="none" stroke="var(--hmi-rule-strong)" strokeWidth={1.6} strokeDasharray="5 5" />
      <rect x={trainX0 + 18} y={trainY0 - 13} width={210} height={26} rx={5} fill="var(--hmi-canvas)" />
      <text x={trainX0 + 18 + 105} y={trainY0 + 5} textAnchor="middle" fontSize={14} letterSpacing={0.8} fill="var(--text-label)">
        COMPRESSOR TRAIN
      </text>

      {/* suction train — short stub in from the boundary, no dead run */}
      <Pipe x1={16} y1={AXIS_Y} x2={xSucScrub - 38} y2={AXIS_Y} psig={P_s} flow={flows.m_sup} />
      <Vessel x={xSucScrub} y={AXIS_Y} label="Suc. scrub." />
      <Pipe x1={xSucScrub + 38} y1={AXIS_Y} x2={xSesd - 46} y2={AXIS_Y} psig={P_s} flow={flows.m_sup} />
      <ValveIcon x={xSesd} y={AXIS_Y} pct={Z_sesd} label="Suction ESD" sub="CMD_4009" />
      <Pipe x1={xSesd + 46} y1={AXIS_Y} x2={xSucCtrl - 46} y2={AXIS_Y} psig={P_s} flow={flows.m_sup} />
      <ValveIcon x={xSucCtrl} y={AXIS_Y} pct={Z_suc} label="Suction ctrl" sub="FC_3003" />
      <Pipe x1={xSucCtrl + 46} y1={AXIS_Y} x2={xCyl1 - 72} y2={AXIS_Y} psig={P_s} flow={flows.m_comp} />

      {/* suction */}
      <ReadoutCard
        x={xIn1} y={cardY2} tapX={xIn1} tapY={AXIS_Y} title="SUCTION"
        rows={[
          { kind: 'P', value: formatTag('PT_1001', P_s).text, unit: formatTag('PT_1001', P_s).unit, tag: 'PT_1001', state: gs('PT_1001', P_s) },
          { kind: 'T', value: formatValue('TT', T_suc).text, unit: formatValue('TT', T_suc).unit, tag: '', state: 'normal', simOnly: true },
        ]}
      />
      <Cylinder x={xCyl1} y={AXIS_Y} label="ST1" rpm={rpm} />
      <Pipe x1={xCyl1 + 72} y1={AXIS_Y} x2={xCooler1 - 60} y2={AXIS_Y} psig={P_1} flow={flows.m_comp} />
      <Cooler x={xCooler1} y={AXIS_Y} label="Intercool. 1" fansOn={n_fans} heat={n_fans / 2} />
      {/* PT_1002 sits on the pipe between ST1 and ST2 — one card serves both
          the ST1 discharge and ST2 suction reading, since it's one tap. */}
      <ReadoutCard
        x={xMid12} y={cardY3} tapX={xMid12} tapY={AXIS_Y} title="ST1 OUT / ST2 IN"
        rows={[
          { kind: 'P', value: formatTag('PT_1002', P_1).text, unit: formatTag('PT_1002', P_1).unit, tag: 'PT_1002', state: gs('PT_1002', P_1) },
          { kind: 'T', value: formatTag('TT_2004', T_cyl1).text, unit: formatTag('TT_2004', T_cyl1).unit, tag: 'TT_2004', state: gs('TT_2004', T_cyl1) },
          { kind: 'T', value: formatValue('TT', T_inter).text, unit: formatValue('TT', T_inter).unit, tag: '', state: 'normal', simOnly: true },
        ]}
      />
      <Pipe x1={xCooler1 + 60} y1={AXIS_Y} x2={xScrub2 - 38} y2={AXIS_Y} psig={P_1} flow={flows.m_comp} />
      <Vessel x={xScrub2} y={AXIS_Y} label="ST2 scrub." />

      {/* stage 2 */}
      <Pipe x1={xScrub2 + 38} y1={AXIS_Y} x2={xCyl2 - 72} y2={AXIS_Y} psig={P_2} flow={flows.m_comp} />
      <Cylinder x={xCyl2} y={AXIS_Y} label="ST2" rpm={rpm} />
      <Pipe x1={xCyl2 + 72} y1={AXIS_Y} x2={xCooler2 - 60} y2={AXIS_Y} psig={P_2} flow={flows.m_comp} />
      <Cooler x={xCooler2} y={AXIS_Y} label="Intercool. 2" fansOn={n_fans} heat={n_fans / 2} />
      {/* PT_1003 likewise serves both ST2 discharge and ST3 suction. */}
      <ReadoutCard
        x={xMid23} y={cardY3} tapX={xMid23} tapY={AXIS_Y} title="ST2 OUT / ST3 IN"
        rows={[
          { kind: 'P', value: formatTag('PT_1003', P_2).text, unit: formatTag('PT_1003', P_2).unit, tag: 'PT_1003', state: gs('PT_1003', P_2) },
          { kind: 'T', value: formatTag('TT_2005', T_cyl2).text, unit: formatTag('TT_2005', T_cyl2).unit, tag: 'TT_2005', state: gs('TT_2005', T_cyl2) },
          { kind: 'T', value: formatValue('TT', T_inter).text, unit: formatValue('TT', T_inter).unit, tag: '', state: 'normal', simOnly: true },
        ]}
      />
      <Pipe x1={xCooler2 + 60} y1={AXIS_Y} x2={xScrub3 - 38} y2={AXIS_Y} psig={P_2} flow={flows.m_comp} />
      <Vessel x={xScrub3} y={AXIS_Y} label="ST3 scrub." />

      {/* stage 3 */}
      <Pipe x1={xScrub3 + 38} y1={AXIS_Y} x2={xCyl3 - 72} y2={AXIS_Y} psig={P_3} flow={flows.m_comp} />
      <Cylinder x={xCyl3} y={AXIS_Y} label="ST3" rpm={rpm} />
      <ReadoutCard
        x={xOut3} y={cardY2} tapX={xOut3} tapY={AXIS_Y} title="ST3 OUT"
        rows={[
          { kind: 'P', value: formatTag('PT_1004', P_3).text, unit: formatTag('PT_1004', P_3).unit, tag: 'PT_1004', state: gs('PT_1004', P_3) },
          { kind: 'T', value: formatTag('TT_2006', T_cyl3).text, unit: formatTag('TT_2006', T_cyl3).unit, tag: 'TT_2006/07', state: gs('TT_2006', T_cyl3) },
        ]}
      />
      <Pipe x1={xCyl3 + 72} y1={AXIS_Y} x2={xAfterclr - 60} y2={AXIS_Y} psig={P_3} flow={flows.m_comp} />
      <Cooler x={xAfterclr} y={AXIS_Y} label="Aftercooler" fansOn={n_fans} heat={n_fans / 2} />
      {/* sits directly above the aftercooler it measures — short vertical
          leader, no diagonal run out to a right-hand gutter. */}
      <ReadoutCard
        x={xAfterclr} y={cardY2} tapX={xAfterclr} tapY={AXIS_Y} title="AFTERCOOLER / FINAL"
        rows={[
          { kind: 'P', value: formatTag('PT_1006', P_d).text, unit: formatTag('PT_1006', P_d).unit, tag: 'PT_1006', state: gs('PT_1006', P_d) },
          { kind: 'T', value: formatTag('TT_2013', T_ac).text, unit: formatTag('TT_2013', T_ac).unit, tag: 'TT_2013', state: gs('TT_2013', T_ac) },
        ]}
      />

      {/* engine / crankshaft card, anchored tight under the cylinders it drives */}
      <EngineBlock x={engineX} y={engineY} width={engineW} rpm={rpm} />
      {[xCyl1, xCyl2, xCyl3].map((cx, i) => (
        <line key={i} x1={cx} y1={AXIS_Y + 67} x2={cx} y2={engineY} stroke="var(--hmi-rule-strong)" strokeWidth={2.4} strokeDasharray="4 5" />
      ))}

      {/* discharge ESD -> pipeline, then a short stub to the boundary — no dead run */}
      <Pipe x1={xAfterclr + 60} y1={AXIS_Y} x2={xDesd - 46} y2={AXIS_Y} psig={P_d} flow={flows.m_proc} />
      <ValveIcon x={xDesd} y={AXIS_Y} pct={Z_desd} label="Discharge ESD" sub="CMD_4010" />
      <Pipe x1={xDesd + 46} y1={AXIS_Y} x2={xEnd} y2={AXIS_Y} psig={P_d} flow={flows.m_proc} />

      {/* bypass / recycle loop: final discharge -> lower loop, under the
          engine card, back into suction before ST1 */}
      <path d={bypassPath} fill="none" stroke="var(--pipe-minor)" strokeWidth={8} strokeDasharray={Z_byp < 2 ? '3 9' : undefined} strokeLinecap="round" />
      <ValveIcon x={bypassValveX} y={loopY} pct={Z_byp} label="Bypass / recycle" sub="FC_3002" />
      <FlowDots path={bypassPath} flow={flows.m_byp} />

      {/* blowdown: suction to atmosphere */}
      <Pipe x1={xBlowdown} y1={AXIS_Y + 77} x2={xBlowdown} y2={AXIS_Y + 300} psig={P_s} flow={flows.m_bdv} />
      <ValveIcon x={xBlowdown} y={AXIS_Y + 335} pct={Z_bdv} label="Blowdown" sub="CMD_4004" orientation="v" />
      <line x1={xBlowdown} y1={AXIS_Y + 400} x2={xBlowdown} y2={AXIS_Y + 480} stroke="var(--pipe-minor)" strokeWidth={8} strokeLinecap="round" />
      <BlowdownPlume x={xBlowdown} y={AXIS_Y + 472} active={Z_bdv > 50 && suctionOn} />
      <text x={xBlowdown} y={AXIS_Y + 510} textAnchor="middle" fontSize={13.5} letterSpacing={0.4} fill="var(--text-tag)">
        atmosphere
      </text>
    </svg>
    </div>
  );
}

import { useLayoutEffect, useRef, useState } from 'react';
import type { SimTags, Flows, ValvePositions, SimInsight } from '../hooks/useSimState';
import { gaugeState, type AlarmTable, type GaugeState } from '../lib/pid';
import { formatTag, formatValue } from '../lib/engUnits';
import Separator from './symbols/Separator';
import ReciprocatingCylinder from './symbols/ReciprocatingCylinder';
import AirCooler from './symbols/AirCooler';
import GateValve from './symbols/GateValve';
import ControlValve from './symbols/ControlValve';
import BlowdownValve from './symbols/BlowdownValve';
import MovingAnalogIndicator from './symbols/MovingAnalogIndicator';
import type { AlarmBand } from '../lib/pid';

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
  /** WS link down (§7: never show a stale number as if it were live) —
   * real-tag readouts render "-.-" instead of the last value received
   * before the drop. Sim-only rows are unaffected (nothing to go stale). */
  stale?: boolean;
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

// Static flow-direction chevrons on the main gas path, ~140px apart along
// the segment centerline (§3) — a fixed ">" reference, not the animated
// flow-dot motion FlowDots draws (that's removed in Phase 8).
const CHEVRON_PITCH = 140;
function Chevrons({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < CHEVRON_PITCH * 0.75) return null;
  const ux = dx / len;
  const uy = dy / len;
  const n = Math.max(1, Math.floor(len / CHEVRON_PITCH));
  const start = (len - (n - 1) * CHEVRON_PITCH) / 2;
  const chevrons = Array.from({ length: n }, (_, i) => start + i * CHEVRON_PITCH);
  return (
    <>
      {chevrons.map((d) => {
        const cx = x1 + ux * d;
        const cy = y1 + uy * d;
        // perpendicular half-width for the two chevron strokes
        const px = -uy * 6;
        const py = ux * 6;
        const bx = -ux * 6;
        const by = -uy * 6;
        return (
          <g key={d}>
            <line x1={cx + px + bx} y1={cy + py + by} x2={cx} y2={cy} stroke="var(--pipe-minor)" strokeWidth={1.5} strokeLinecap="butt" />
            <line x1={cx - px + bx} y1={cy - py + by} x2={cx} y2={cy} stroke="var(--pipe-minor)" strokeWidth={1.5} strokeLinecap="butt" />
          </g>
        );
      })}
    </>
  );
}

function Pipe({ x1, y1, x2, y2, flow }: { x1: number; y1: number; x2: number; y2: number; psig: number; flow: number }) {
  const path = `M${x1},${y1} L${x2},${y2}`;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--pipe-major)" strokeWidth="var(--w-pipe-major)" strokeLinecap="butt" strokeLinejoin="miter" />
      <Chevrons x1={x1} y1={y1} x2={x2} y2={y2} />
      <FlowDots path={path} flow={flow} />
    </g>
  );
}

// Word appended after the unit when a reading is out of its normal band —
// alongside the colour change, so alarm/trip reads without relying on
// colour perception. Normal readings stay calm (no extra word).
const STATE_WORD: Record<GaugeState, string | null> = { normal: null, amber: 'ALARM', red: 'TRIP' };

interface ReadingSpec {
  value: string;
  unit: string;
  /** Real tag id ("PT_1001") for instrumented readings; empty (rendered as
   * "SIM") when simOnly is set. */
  tag: string;
  state: GaugeState;
  band?: AlarmBand;
  /** No corresponding transmitter on the real unit (section 4's I/O list
   * has no interstage TTs) — a model-internal value shown as insight only,
   * dimmer, italic, no MAI (no configured limits to show). */
  simOnly?: boolean;
}

// §5/§8: no border, no background, no card — sits directly on the canvas,
// right-aligned, tag on top, value+unit below, a Moving Analog Indicator
// (§8, "the single highest-value addition") under that when limits exist.
const READOUT_ROW_H = 46;
function AnchoredReadout({ x, y, value, unit, tag, state, band, simOnly }: ReadingSpec & { x: number; y: number }) {
  const valueColor = simOnly ? 'var(--text-disabled)' : STATE_TOKEN[state];
  const stateWord = simOnly ? null : STATE_WORD[state];
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} textAnchor="end" fontSize={11} fontStyle={simOnly ? 'italic' : 'normal'} fill="var(--text-tag)">
        {simOnly ? 'SIM' : tag}
        {stateWord ? ` — ${stateWord}` : ''}
      </text>
      <text
        x={0}
        y={20}
        textAnchor="end"
        fontSize={20}
        fontFamily="var(--font-value)"
        fill={valueColor}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
        <tspan fontSize={11} fontFamily="var(--font-label)" fill="var(--text-tag)"> {unit}</tspan>
      </text>
      {!simOnly && band && <MovingAnalogIndicator x={-104} y={28} value={Number(value)} band={band} state={state} />}
    </g>
  );
}

// One tap point can carry several readings (P, real T, sim-only T) —
// stacked upward from a shared baseline with one leader line down to the
// tap, instead of one card per reading.
function ReadoutGroup({ x, tapX, tapY, baseY, rows }: { x: number; tapX: number; tapY: number; baseY: number; rows: ReadingSpec[] }) {
  return (
    <g>
      <line x1={tapX} y1={tapY} x2={x} y2={baseY + 6} stroke="var(--pipe-signal)" strokeWidth="var(--w-signal)" strokeDasharray="3 3" />
      <circle cx={tapX} cy={tapY} r={2} fill="var(--pipe-signal)" />
      {rows.map((r, i) => (
        <AnchoredReadout key={i} x={x} y={baseY - (rows.length - 1 - i) * READOUT_ROW_H} {...r} />
      ))}
    </g>
  );
}

// Legend for the P/T colour coding and the real-vs-simulator distinction —
// tucked in the top-left corner, clear of the process line.
// P/T no longer carry a color-coded chip (§7: normal state carries no
// color) — the legend now only needs to explain the one remaining visual
// distinction, real tag vs. model-only estimate.
function Legend({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} fontSize={11} fill="var(--text-tag)">
        PT_/TT_ tag id — real PLC instrument
      </text>
      <text x={0} y={16} fontSize={11} fontStyle="italic" fill="var(--text-disabled)">
        SIM — no field transmitter, model estimate only
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
// Replaces the old full-height engine card — engine data moved out to the
// driver strip (§9 [E], DriverStrip.tsx) below the mimic. What's left here
// is just the §9 [D] instruction: "delete the large empty rectangle around
// the engine block, replace it with a bracket on the left/right edges of
// the train it drives, plus a small label."
function TrainBracket({ x, width, y, rpm }: { x: number; width: number; y: number; rpm: number }) {
  const running = rpm > 5;
  const tick = 10;
  return (
    <g>
      <path d={`M${x},${y - tick} L${x},${y} L${x + width},${y} L${x + width},${y - tick}`} fill="none" stroke="var(--hmi-rule-strong)" strokeWidth="var(--w-hairline)" />
      <text x={x + width / 2} y={y + 16} textAnchor="middle" fontSize={13} letterSpacing={0.3} fill="var(--text-tag)">
        DRIVEN BY CAT G3516LE — {running ? 'RUNNING' : 'STOPPED'}
      </text>
    </g>
  );
}

export default function PidDiagram({ tags, flows, valves, alarms, cmdEcho, simInsight, stale = false }: Props) {
  const { ref: containerRef, height: CANVAS_H } = useContainerHeight(CANVAS_W, CANVAS_H_REF);
  const AXIS_Y = BASE_AXIS_Y + Math.max(0, (CANVAS_H - CANVAS_H_REF) / 2);
  const ft = (tag: string, value: number) => formatTag(tag, value, stale);

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

  // Every readout group's bottom-most row sits a fixed distance above the
  // process line — leader lines are always the same length; rows above it
  // (a second/third reading on the same tap) stack upward from there.
  const readoutBaseY = AXIS_Y - 84;

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
  const engineBottom = engineY + 40;

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
      <Separator x={xSucScrub} y={AXIS_Y} label="Suc. scrub." />
      <Pipe x1={xSucScrub + 38} y1={AXIS_Y} x2={xSesd - 46} y2={AXIS_Y} psig={P_s} flow={flows.m_sup} />
      <GateValve x={xSesd} y={AXIS_Y} pct={Z_sesd} label="Suction ESD" tag="CMD_4009" />
      <Pipe x1={xSesd + 46} y1={AXIS_Y} x2={xSucCtrl - 46} y2={AXIS_Y} psig={P_s} flow={flows.m_sup} />
      <ControlValve x={xSucCtrl} y={AXIS_Y} pct={Z_suc} label="Suction ctrl" tag="FC_3003" />
      <Pipe x1={xSucCtrl + 46} y1={AXIS_Y} x2={xCyl1 - 72} y2={AXIS_Y} psig={P_s} flow={flows.m_comp} />

      {/* suction */}
      <ReadoutGroup
        x={xIn1} tapX={xIn1} tapY={AXIS_Y} baseY={readoutBaseY}
        rows={[
          { value: ft('PT_1001', P_s).text, unit: ft('PT_1001', P_s).unit, tag: 'PT_1001', state: gs('PT_1001', P_s), band: alarms['PT_1001'] },
          { value: formatValue('TT', T_suc).text, unit: formatValue('TT', T_suc).unit, tag: '', state: 'normal', simOnly: true },
        ]}
      />
      <ReciprocatingCylinder x={xCyl1} y={AXIS_Y} label="ST1" rpm={rpm} />
      <Pipe x1={xCyl1 + 72} y1={AXIS_Y} x2={xCooler1 - 60} y2={AXIS_Y} psig={P_1} flow={flows.m_comp} />
      <AirCooler x={xCooler1} y={AXIS_Y} label="Intercool. 1" fansOn={n_fans} />
      {/* PT_1002 sits on the pipe between ST1 and ST2 — one card serves both
          the ST1 discharge and ST2 suction reading, since it's one tap. */}
      <ReadoutGroup
        x={xMid12} tapX={xMid12} tapY={AXIS_Y} baseY={readoutBaseY}
        rows={[
          { value: ft('PT_1002', P_1).text, unit: ft('PT_1002', P_1).unit, tag: 'PT_1002', state: gs('PT_1002', P_1), band: alarms['PT_1002'] },
          { value: ft('TT_2004', T_cyl1).text, unit: ft('TT_2004', T_cyl1).unit, tag: 'TT_2004', state: gs('TT_2004', T_cyl1), band: alarms['TT_2004'] },
          { value: formatValue('TT', T_inter).text, unit: formatValue('TT', T_inter).unit, tag: '', state: 'normal', simOnly: true },
        ]}
      />
      <Pipe x1={xCooler1 + 60} y1={AXIS_Y} x2={xScrub2 - 38} y2={AXIS_Y} psig={P_1} flow={flows.m_comp} />
      <Separator x={xScrub2} y={AXIS_Y} label="ST2 scrub." />

      {/* stage 2 */}
      <Pipe x1={xScrub2 + 38} y1={AXIS_Y} x2={xCyl2 - 72} y2={AXIS_Y} psig={P_2} flow={flows.m_comp} />
      <ReciprocatingCylinder x={xCyl2} y={AXIS_Y} label="ST2" rpm={rpm} />
      <Pipe x1={xCyl2 + 72} y1={AXIS_Y} x2={xCooler2 - 60} y2={AXIS_Y} psig={P_2} flow={flows.m_comp} />
      <AirCooler x={xCooler2} y={AXIS_Y} label="Intercool. 2" fansOn={n_fans} />
      {/* PT_1003 likewise serves both ST2 discharge and ST3 suction. */}
      <ReadoutGroup
        x={xMid23} tapX={xMid23} tapY={AXIS_Y} baseY={readoutBaseY}
        rows={[
          { value: ft('PT_1003', P_2).text, unit: ft('PT_1003', P_2).unit, tag: 'PT_1003', state: gs('PT_1003', P_2), band: alarms['PT_1003'] },
          { value: ft('TT_2005', T_cyl2).text, unit: ft('TT_2005', T_cyl2).unit, tag: 'TT_2005', state: gs('TT_2005', T_cyl2), band: alarms['TT_2005'] },
          { value: formatValue('TT', T_inter).text, unit: formatValue('TT', T_inter).unit, tag: '', state: 'normal', simOnly: true },
        ]}
      />
      <Pipe x1={xCooler2 + 60} y1={AXIS_Y} x2={xScrub3 - 38} y2={AXIS_Y} psig={P_2} flow={flows.m_comp} />
      <Separator x={xScrub3} y={AXIS_Y} label="ST3 scrub." />

      {/* stage 3 */}
      <Pipe x1={xScrub3 + 38} y1={AXIS_Y} x2={xCyl3 - 72} y2={AXIS_Y} psig={P_3} flow={flows.m_comp} />
      <ReciprocatingCylinder x={xCyl3} y={AXIS_Y} label="ST3" rpm={rpm} />
      <ReadoutGroup
        x={xOut3} tapX={xOut3} tapY={AXIS_Y} baseY={readoutBaseY}
        rows={[
          { value: ft('PT_1004', P_3).text, unit: ft('PT_1004', P_3).unit, tag: 'PT_1004', state: gs('PT_1004', P_3), band: alarms['PT_1004'] },
          { value: ft('TT_2006', T_cyl3).text, unit: ft('TT_2006', T_cyl3).unit, tag: 'TT_2006/07', state: gs('TT_2006', T_cyl3), band: alarms['TT_2006'] },
        ]}
      />
      <Pipe x1={xCyl3 + 72} y1={AXIS_Y} x2={xAfterclr - 60} y2={AXIS_Y} psig={P_3} flow={flows.m_comp} />
      <AirCooler x={xAfterclr} y={AXIS_Y} label="Aftercooler" fansOn={n_fans} />
      {/* sits directly above the aftercooler it measures — short vertical
          leader, no diagonal run out to a right-hand gutter. */}
      <ReadoutGroup
        x={xAfterclr} tapX={xAfterclr} tapY={AXIS_Y} baseY={readoutBaseY}
        rows={[
          { value: ft('PT_1006', P_d).text, unit: ft('PT_1006', P_d).unit, tag: 'PT_1006', state: gs('PT_1006', P_d), band: alarms['PT_1006'] },
          { value: ft('TT_2013', T_ac).text, unit: ft('TT_2013', T_ac).unit, tag: 'TT_2013', state: gs('TT_2013', T_ac), band: alarms['TT_2013'] },
        ]}
      />

      {/* engine / crankshaft card, anchored tight under the cylinders it drives */}
      <TrainBracket x={engineX} width={engineW} y={engineY} rpm={rpm} />
      {[xCyl1, xCyl2, xCyl3].map((cx, i) => (
        <line key={i} x1={cx} y1={AXIS_Y + 67} x2={cx} y2={engineY - 10} stroke="var(--hmi-rule-strong)" strokeWidth={2.4} strokeDasharray="4 5" />
      ))}

      {/* discharge ESD -> pipeline, then a short stub to the boundary — no dead run */}
      <Pipe x1={xAfterclr + 60} y1={AXIS_Y} x2={xDesd - 46} y2={AXIS_Y} psig={P_d} flow={flows.m_proc} />
      <GateValve x={xDesd} y={AXIS_Y} pct={Z_desd} label="Discharge ESD" tag="CMD_4010" />
      <Pipe x1={xDesd + 46} y1={AXIS_Y} x2={xEnd} y2={AXIS_Y} psig={P_d} flow={flows.m_proc} />

      {/* bypass / recycle loop: final discharge -> lower loop, under the
          engine card, back into suction before ST1 */}
      <path d={bypassPath} fill="none" stroke="var(--pipe-minor)" strokeWidth="var(--w-pipe-minor)" strokeDasharray={Z_byp < 2 ? '3 9' : undefined} strokeLinecap="butt" />
      <ControlValve x={bypassValveX} y={loopY} pct={Z_byp} label="Bypass / recycle" tag="FC_3002" />
      <FlowDots path={bypassPath} flow={flows.m_byp} />

      {/* blowdown: suction to atmosphere */}
      <Pipe x1={xBlowdown} y1={AXIS_Y + 77} x2={xBlowdown} y2={AXIS_Y + 300} psig={P_s} flow={flows.m_bdv} />
      <BlowdownValve x={xBlowdown} y={AXIS_Y + 335} pct={Z_bdv} label="Blowdown" tag="CMD_4004" />
      <line x1={xBlowdown} y1={AXIS_Y + 400} x2={xBlowdown} y2={AXIS_Y + 480} stroke="var(--pipe-minor)" strokeWidth="var(--w-pipe-minor)" strokeLinecap="butt" />
      <BlowdownPlume x={xBlowdown} y={AXIS_Y + 472} active={Z_bdv > 50 && suctionOn} />
      <text x={xBlowdown} y={AXIS_Y + 510} textAnchor="middle" fontSize={13.5} letterSpacing={0.4} fill="var(--text-tag)">
        atmosphere
      </text>
    </svg>
    </div>
  );
}

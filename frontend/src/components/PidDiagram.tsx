import { useLayoutEffect, useRef, useState } from 'react';
import type { SimTags, Flows, ValvePositions } from '../hooks/useSimState';
import Separator from './symbols/Separator';
import ReciprocatingCylinder from './symbols/ReciprocatingCylinder';
import AirCooler from './symbols/AirCooler';
import GateValve from './symbols/GateValve';
import ControlValve from './symbols/ControlValve';
import BlowdownValve from './symbols/BlowdownValve';

interface Props {
  tags: SimTags;
  flows: Flows;
  valves: ValvePositions;
  /** Actual (fault-aware) command status, section 6.4/6.2 — cooler run
   * status specifically, since section 4's tag map has no continuous fan
   * feedback and the raw commands never crossed the websocket before. */
  cmdEcho: SimTags;
}

const num = (tags: SimTags, tag: string) => (typeof tags[tag] === 'number' ? (tags[tag] as number) : 0);

// Content-driven canvas: every position below is derived from a handful of
// named layout constants (component footprints + a fixed pipe gap), and the
// viewBox is the min/max bound of those — not an independent hardcoded
// canvas size. Change a footprint or a gap and the viewBox follows.
//
// Single horizontal process line, left to right, no serpentine/wrap.
// Straight pipe runs between adjacent components are a fixed GAP (not to
// scale — this is a mimic, not a plot plan) so the diagram doesn't carry
// long empty pipe runs sized for equipment that isn't drawn to scale either.
const GAP = 40; // pipe run between two components' facing edges
const BOUNDARY_GAP = 24; // shorter stub from the canvas edge to the first/last component

// Equipment footprints (half-width/height used for pipe-edge math below).
// Vessels and coolers were widened boxes with flat, unconvincing proportions
// at their old size (76x134 / 120x108) — narrower and taller reads as
// upright equipment instead. Cylinders are left at their original height
// (not "vessel or cooler" per the brief) and only trimmed in width to fit
// the pipe budget.
const SEP_W = 32, SEP_H = 150; // suction/ST2/ST3 scrubbers
const COOL_W = 46, COOL_H = 150; // intercoolers + aftercooler
const CYL_W = 58, CYL_H = 134; // ST1/ST2/ST3 cylinders
const VALVE_SCALE = 0.61; // main-line gate/control valves (native glyph is ~92 units wide)
const BYPASS_VALVE_SCALE = 0.6;
const BLOWDOWN_SCALE = 0.61; // match the process valves, not the native full size
const BLOWDOWN_HALF = 46 * BLOWDOWN_SCALE; // rotated-bowtie half-height, for pipe joins

const sepHalf = SEP_W / 2;
const coolHalf = COOL_W / 2;
const cylHalf = CYL_W / 2;
const valveHalf = 46 * VALVE_SCALE;

// ---- main-line X positions: boundary -> component -> GAP -> component...
const xSucScrub = BOUNDARY_GAP + sepHalf;
const xSesd = xSucScrub + sepHalf + GAP + valveHalf;
const xSucCtrl = xSesd + valveHalf + GAP + valveHalf;
const xCyl1 = xSucCtrl + valveHalf + GAP + cylHalf;
const xCooler1 = xCyl1 + cylHalf + GAP + coolHalf;
const xScrub2 = xCooler1 + coolHalf + GAP + sepHalf;
const xCyl2 = xScrub2 + sepHalf + GAP + cylHalf;
const xCooler2 = xCyl2 + cylHalf + GAP + coolHalf;
const xScrub3 = xCooler2 + coolHalf + GAP + sepHalf;
const xCyl3 = xScrub3 + sepHalf + GAP + cylHalf;
const xAfterclr = xCyl3 + cylHalf + GAP + coolHalf;
const xDesd = xAfterclr + coolHalf + GAP + valveHalf;
const xEnd = xDesd + valveHalf + BOUNDARY_GAP;

const CANVAS_W = xEnd + BOUNDARY_GAP; // right margin matching the left one

// ---- Y layout: all static (no prop/state dependency), so it's hoisted
// alongside the X positions above rather than recomputed inside the
// component every render — CANVAS_H needs to be known before the
// container-scale hook can be called with it. ---------------------------

// train boundary hugs the equipment (cylinders/coolers/scrubbers) only —
// the label sits in a tab cut into the top border so the box reads as an
// intentional, closed group rather than a stray annotation.
const trainX0 = xCyl1 - 55;
const trainX1 = xAfterclr + 55;
const trainY0 = -(SEP_H / 2 + 35);
const trainY1 = SEP_H / 2 + 22 /* boot */ + 18 /* label gap */ + 15;

// engine card sits directly under the cylinders it drives — short
// drivelines, no floating gap.
const engineX = xCyl1 - 55;
const engineY = trainY1 + 20;
const engineW = xAfterclr - xCyl1 + 110;
const engineBottom = engineY + 30;

// bypass (recycle) loop: taps off *after* the aftercooler/before the
// discharge ESD, drops below the engine card, runs back under the whole
// train, and rises back into the suction line *before* the suction
// control valve/ST1 — so it reads unambiguously as "final discharge
// recycles to suction," never crossing the train or engine. Tap points
// sit at the midpoint of the (short, fixed-GAP) pipe run on either end so
// they land clear of the valves flanking them instead of on top of one.
// loopY drops well clear of the engine card so the loop actually reads as
// a deep rectangle below the line, not a band hugging the engine label.
const bypTapOut = (xAfterclr + coolHalf + xDesd - valveHalf) / 2;
// Pushed toward the ESD side of its segment (not the midpoint) — its own
// long vertical descent to loopY needs maximum clearance from the
// blowdown branch's descent on the *other* side of the suction ctrl
// valve (see xBlowdown below); at the midpoint the two ran close enough
// to visually tangle together despite being in different segments.
const bypTapIn = xSesd + valveHalf + (xSucCtrl - valveHalf - (xSesd + valveHalf)) * 0.3;
const loopY = engineBottom + 70;
const bypCorner = 24;
const bypassPath = `M${bypTapOut},${18} L${bypTapOut},${loopY - bypCorner} Q${bypTapOut},${loopY} ${bypTapOut - bypCorner},${loopY} L${bypTapIn + bypCorner},${loopY} Q${bypTapIn},${loopY} ${bypTapIn},${loopY - bypCorner} L${bypTapIn},${18}`;
const bypassValveX = (bypTapOut + bypTapIn) / 2;
const bypassValveBottom = loopY + 73 * BYPASS_VALVE_SCALE + 12;

// Blowdown taps the suction line on the ctrl-valve -> Cyl1 run, *not* the
// scrubber -> ESD run right next to it: "Suc. scrub."'s own label is
// wider than that whole segment (a 32-unit-wide vessel with a ~100-unit
// label centered on it), so nothing placed there clears it. This segment
// has a similar squeeze from the ctrl valve's label on one side and
// Cyl1's "cylinder" label on the other; 58% lands in the clear band
// between the two, and clear of bypTapIn's own vertical run below.
const xBlowdown = xSucCtrl + valveHalf + (xCyl1 - cylHalf - (xSucCtrl + valveHalf)) * 0.5;
// Clean vertical bands, no overlap: process line (0) -> inlet pipe -> valve
// body (bdValveY +/- BLOWDOWN_HALF) -> outlet pipe -> vent plume ->
// "atmosphere". The valve's own name/state labels sit to its left (see
// BlowdownValve), so the centre line is free for the piping.
const bdValveY = 106;
const bdPipeTop = 0;
const bdPipeBottom = bdValveY - BLOWDOWN_HALF; // meets the valve's top point
const bdPipe2Top = bdValveY + BLOWDOWN_HALF; // leaves the valve's bottom point
const bdPipe2Bottom = bdValveY + BLOWDOWN_HALF + 52;
const bdPlumeY = bdPipe2Bottom; // plume rings vent upward from the open end
const bdTextY = bdPipe2Bottom + 30;

// viewBox: derived from the layout above, not a hardcoded canvas size.
// AXIS_Y is however far the highest content point (most negative candidate)
// sits above the process line; CANVAS_H adds however far the lowest content
// point sits below it. Widen either list and the canvas follows.
const VIEW_PAD = 10;
const topCandidates = [
  trainY0 - 13 - VIEW_PAD, // train-label tab, cut into the box's top border
  -20 - 15 - VIEW_PAD, // SOURCE / PIPELINE boundary labels
];
const bottomCandidates = [
  trainY1 + VIEW_PAD,
  engineBottom + VIEW_PAD,
  bypassValveBottom + VIEW_PAD,
  bdTextY + 8 + VIEW_PAD, // "atmosphere" label, plus descender room
];
const AXIS_Y = -Math.min(...topCandidates);
const CANVAS_H = AXIS_Y + Math.max(...bottomCandidates);

// Task 4 zoom range — 1x is fit-to-view (the SVG's own preserveAspectRatio
// meet already does the "fit" part); the toolbar and wheel/pinch handlers
// below just move within this clamp.
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;

// Measures the wrapper's rendered pixel size so the typography floor below
// can be computed against the *actual* container-to-viewBox scale factor,
// not a guess — a docked/narrow window shrinks that scale well below what a
// full-width desktop view gets, and this is what makes minUnits track it.
function useContainerScale(canvasW: number, canvasH: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box || box.width === 0 || box.height === 0) return;
      // preserveAspectRatio="meet": the SVG is fit by whichever axis is
      // more constraining, so that's the scale governing rendered text size.
      setScale(Math.min(box.width / canvasW, box.height / canvasH));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [canvasW, canvasH]);
  return { ref, scale };
}

// Static flow-direction chevrons on the main gas path, ~140px apart along
// the segment centerline (§3) — a fixed ">" reference. Phase 8 removed the
// animated travelling-dot indicator that used to accompany these (motion
// is reserved solely for the 1Hz unacked-alarm blink, §8).
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

function Pipe({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number; psig: number; flow: number }) {
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--pipe-major)" strokeWidth="var(--w-pipe-major)" strokeLinecap="butt" strokeLinejoin="miter" shapeRendering="crispEdges" />
      <Chevrons x1={x1} y1={y1} x2={x2} y2={y2} />
    </g>
  );
}

// Static release marks (Phase 8: no motion outside the alarm blink) — three
// fixed, fading rings standing in for the plume that used to animate here.
function BlowdownPlume({ x, y, active }: { x: number; y: number; active: boolean }) {
  if (!active) return null;
  return (
    <g transform={`translate(${x},${y})`}>
      {[0, 1, 2].map((i) => (
        <circle key={i} cy={-i * 20} r={6 + i * 4} fill="none" stroke="var(--pipe-minor)" strokeWidth={1.5} opacity={0.5 - i * 0.15} />
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
function TrainBracket({ x, width, y, rpm, minUnits }: { x: number; width: number; y: number; rpm: number; minUnits: number }) {
  const running = rpm > 5;
  const tick = 10;
  return (
    <g>
      <path d={`M${x},${y - tick} L${x},${y} L${x + width},${y} L${x + width},${y - tick}`} fill="none" stroke="var(--hmi-rule-strong)" strokeWidth="var(--w-hairline)" />
      <text x={x + width / 2} y={y + 16} textAnchor="middle" fontSize={Math.max(13, minUnits)} letterSpacing={0.3} fill="var(--text-tag)">
        DRIVEN BY CAT G3516LE — {running ? 'RUNNING' : 'STOPPED'}
      </text>
    </g>
  );
}

export default function PidDiagram({ tags, flows, valves, cmdEcho }: Props) {
  const { ref: containerRef, scale: containerScale } = useContainerScale(CANVAS_W, CANVAS_H);
  // 11px floor (Task 4), expressed in user units against the *default*
  // (zoom=1, fit-to-view) container scale — deliberately not divided by the
  // live zoom level below, so zooming in only ever makes text bigger and
  // zooming out is an explicit, informed user choice rather than something
  // that could silently violate the floor.
  // A 13px rendered floor keeps equipment names and valve state readable
  // on a reduced-width window without requiring the operator to zoom first.
  const minUnits = containerScale > 0 ? 13 / containerScale : 13;

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panOrigin = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
  const fitToView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };
  const zoomBy = (factor: number) => setZoom((z) => clampZoom(z * factor));
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1);
  };
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    panOrigin.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!panOrigin.current) return;
    const o = panOrigin.current;
    setPan({ x: o.panX + (e.clientX - o.x), y: o.panY + (e.clientY - o.y) });
  };
  const onPointerUp = () => {
    panOrigin.current = null;
  };

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

  const suctionOn = P_s > 1;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full touch-none select-none"
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      style={{ cursor: panOrigin.current ? 'grabbing' : 'grab' }}
    >
    <svg
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      className="h-full w-full"
      role="img"
      aria-label="Compressor P&amp;ID"
      preserveAspectRatio="xMidYMid meet"
      style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`, transformOrigin: '50% 50%' }}
    >
      <rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="var(--hmi-canvas)" />

      <g transform={`translate(0,${AXIS_Y})`}>

      {/* boundary labels sit close to the process line — nothing tall is
          directly above the boundary pipe stubs on either end */}
      <text x={4} y={-20} fontSize={Math.max(15, minUnits)} letterSpacing={0.5} fill="var(--text-tag)">
        SOURCE
      </text>
      <text x={CANVAS_W - 4} y={-20} fontSize={Math.max(15, minUnits)} letterSpacing={0.5} fill="var(--text-tag)" textAnchor="end">
        PIPELINE
      </text>

      {/* compressor train box, drawn first so equipment sits above it; the
          label lives in a tab notched into the border, not floating text
          that could be mistaken for a stray annotation. */}
      <rect x={trainX0} y={trainY0} width={trainX1 - trainX0} height={trainY1 - trainY0} rx={10} fill="none" stroke="var(--hmi-rule)" strokeWidth={1.2} />
      <rect x={trainX0 + 14} y={trainY0 - 13} width={170} height={26} rx={5} fill="var(--hmi-canvas)" />
      <text x={trainX0 + 14 + 85} y={trainY0 + 5} textAnchor="middle" fontSize={Math.max(13, minUnits)} letterSpacing={0.6} fill="var(--text-label)">
        COMPRESSOR TRAIN
      </text>

      {/* suction train — short stub in from the boundary, no dead run */}
      <Pipe x1={0} y1={0} x2={xSucScrub - sepHalf} y2={0} psig={P_s} flow={flows.m_sup} />
      <Separator x={xSucScrub} y={0} label="Suc. scrub." width={SEP_W} height={SEP_H} minUnits={minUnits} />
      <Pipe x1={xSucScrub + sepHalf} y1={0} x2={xSesd - valveHalf} y2={0} psig={P_s} flow={flows.m_sup} />
      <GateValve x={xSesd} y={0} pct={Z_sesd} label="Suction ESD" scale={VALVE_SCALE} minUnits={minUnits} />
      <Pipe x1={xSesd + valveHalf} y1={0} x2={xSucCtrl - valveHalf} y2={0} psig={P_s} flow={flows.m_sup} />
      <ControlValve x={xSucCtrl} y={0} pct={Z_suc} label="Suction ctrl" scale={VALVE_SCALE} minUnits={minUnits} />
      <Pipe x1={xSucCtrl + valveHalf} y1={0} x2={xCyl1 - cylHalf} y2={0} psig={P_s} flow={flows.m_comp} />

      <ReciprocatingCylinder x={xCyl1} y={0} label="ST1" rpm={rpm} width={CYL_W} height={CYL_H} minUnits={minUnits} />
      <Pipe x1={xCyl1 + cylHalf} y1={0} x2={xCooler1 - coolHalf} y2={0} psig={P_1} flow={flows.m_comp} />
      <AirCooler x={xCooler1} y={0} label="Intercool. 1" fansOn={n_fans} width={COOL_W} height={COOL_H} minUnits={minUnits} />
      <Pipe x1={xCooler1 + coolHalf} y1={0} x2={xScrub2 - sepHalf} y2={0} psig={P_1} flow={flows.m_comp} />
      <Separator x={xScrub2} y={0} label="ST2 scrub." width={SEP_W} height={SEP_H} minUnits={minUnits} />

      {/* stage 2 */}
      <Pipe x1={xScrub2 + sepHalf} y1={0} x2={xCyl2 - cylHalf} y2={0} psig={P_2} flow={flows.m_comp} />
      <ReciprocatingCylinder x={xCyl2} y={0} label="ST2" rpm={rpm} width={CYL_W} height={CYL_H} minUnits={minUnits} />
      <Pipe x1={xCyl2 + cylHalf} y1={0} x2={xCooler2 - coolHalf} y2={0} psig={P_2} flow={flows.m_comp} />
      <AirCooler x={xCooler2} y={0} label="Intercool. 2" fansOn={n_fans} width={COOL_W} height={COOL_H} minUnits={minUnits} />
      <Pipe x1={xCooler2 + coolHalf} y1={0} x2={xScrub3 - sepHalf} y2={0} psig={P_2} flow={flows.m_comp} />
      <Separator x={xScrub3} y={0} label="ST3 scrub." width={SEP_W} height={SEP_H} minUnits={minUnits} />

      {/* stage 3 */}
      <Pipe x1={xScrub3 + sepHalf} y1={0} x2={xCyl3 - cylHalf} y2={0} psig={P_3} flow={flows.m_comp} />
      <ReciprocatingCylinder x={xCyl3} y={0} label="ST3" rpm={rpm} width={CYL_W} height={CYL_H} minUnits={minUnits} />
      <Pipe x1={xCyl3 + cylHalf} y1={0} x2={xAfterclr - coolHalf} y2={0} psig={P_3} flow={flows.m_comp} />
      <AirCooler x={xAfterclr} y={0} label="Aftercooler" fansOn={n_fans} width={COOL_W} height={COOL_H} minUnits={minUnits} />

      {/* engine / crankshaft card, anchored tight under the cylinders it drives.
          Solid, not dashed — a driveline is a fixed mechanical link, not a
          state indicator, so a dash here doesn't mean anything (unlike the
          bypass pipe below, where dashed genuinely means "closed/no flow"). */}
      <TrainBracket x={engineX} width={engineW} y={engineY} rpm={rpm} minUnits={minUnits} />
      {[xCyl1, xCyl2, xCyl3].map((cx, i) => (
        <line key={i} x1={cx} y1={CYL_H / 2} x2={cx} y2={engineY - 10} stroke="var(--hmi-rule-strong)" strokeWidth={2} />
      ))}

      {/* discharge ESD -> pipeline, then a short stub to the boundary — no dead run */}
      <Pipe x1={xAfterclr + coolHalf} y1={0} x2={xDesd - valveHalf} y2={0} psig={P_d} flow={flows.m_proc} />
      <GateValve x={xDesd} y={0} pct={Z_desd} label="Discharge ESD" scale={VALVE_SCALE} minUnits={minUnits} />
      <Pipe x1={xDesd + valveHalf} y1={0} x2={xEnd} y2={0} psig={P_d} flow={flows.m_proc} />

      {/* bypass / recycle loop: final discharge -> lower loop, under the
          engine card, back into suction before ST1. Dashed only means one
          thing on this mimic now: the pipe is closed/not flowing — solid
          when the valve's open enough to pass gas. Coarser dash than the
          instrument leader lines below so the two meanings don't blur. */}
      <path d={bypassPath} fill="none" stroke="var(--pipe-minor)" strokeWidth="var(--w-pipe-minor)" strokeDasharray={Z_byp < 2 ? '7 5' : undefined} strokeLinecap="butt" />
      <ControlValve x={bypassValveX} y={loopY} pct={Z_byp} label="Bypass / recycle" scale={BYPASS_VALVE_SCALE} minUnits={minUnits} />

      {/* blowdown: suction to atmosphere */}
      <Pipe x1={xBlowdown} y1={bdPipeTop} x2={xBlowdown} y2={bdPipeBottom} psig={P_s} flow={flows.m_bdv} />
      <BlowdownValve x={xBlowdown} y={bdValveY} pct={Z_bdv} label="Blowdown" scale={BLOWDOWN_SCALE} minUnits={minUnits} />
      <line x1={xBlowdown} y1={bdPipe2Top} x2={xBlowdown} y2={bdPipe2Bottom} stroke="var(--pipe-minor)" strokeWidth="var(--w-pipe-minor)" strokeLinecap="butt" />
      <BlowdownPlume x={xBlowdown} y={bdPlumeY} active={Z_bdv > 50 && suctionOn} />
      <text x={xBlowdown} y={bdTextY} textAnchor="middle" fontSize={Math.max(13.5, minUnits)} letterSpacing={0.4} fill="var(--text-tag)">
        atmosphere
      </text>
      </g>
    </svg>
    {/* Task 4 zoom/pan toolbar — floating, top-right of the mimic pane so it
        never competes with mimic content for space. */}
    <div className="absolute right-2 top-2 flex gap-1" style={{ pointerEvents: 'auto' }}>
      <button
        type="button"
        onClick={() => zoomBy(1 / 1.25)}
        aria-label="Zoom out"
        className="flex h-7 w-7 items-center justify-center rounded"
        style={{ backgroundColor: 'var(--hmi-surface)', border: 'var(--w-hairline) solid var(--hmi-rule)', color: 'var(--text-label)' }}
      >
        −
      </button>
      <button
        type="button"
        onClick={fitToView}
        aria-label="Fit to view"
        className="flex h-7 items-center justify-center rounded px-2"
        style={{ backgroundColor: 'var(--hmi-surface)', border: 'var(--w-hairline) solid var(--hmi-rule)', color: 'var(--text-label)', fontSize: 'var(--fs-tag)' }}
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        type="button"
        onClick={() => zoomBy(1.25)}
        aria-label="Zoom in"
        className="flex h-7 w-7 items-center justify-center rounded"
        style={{ backgroundColor: 'var(--hmi-surface)', border: 'var(--w-hairline) solid var(--hmi-rule)', color: 'var(--text-label)' }}
      >
        +
      </button>
    </div>
    </div>
  );
}

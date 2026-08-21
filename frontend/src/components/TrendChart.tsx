import { useEffect, useRef, useState } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import type { SimMessage, UseSimState } from '../hooks/useSimState';
import type { AlarmTable } from '../lib/pid';
import { CHART_PEN_COLORS, cssVar } from '../lib/chartPalette';

// APP_SPEC.md section 6.3: up to 12 selectable pens, 30-minute rolling
// window, uPlot only (hard requirement — it's the one chart library that
// doesn't drop frames at 10 Hz streaming).
const WINDOW_S = 30 * 60;
const HZ = 10;
const MAX_POINTS = WINDOW_S * HZ;

interface PenDef {
  key: string; // tag name, or "flows.m_comp" / "valves.Z_byp" for diagnostics
  label: string;
  color: string;
  unit: string;
}

const AVAILABLE_PENS: PenDef[] = [
  { key: 'PT_1001', label: 'Suction', color: CHART_PEN_COLORS.PT_1001, unit: 'psig' },
  { key: 'PT_1002', label: 'ST1 discharge', color: CHART_PEN_COLORS.PT_1002, unit: 'psig' },
  { key: 'PT_1003', label: 'ST2 discharge', color: CHART_PEN_COLORS.PT_1003, unit: 'psig' },
  { key: 'PT_1006', label: 'Final discharge', color: CHART_PEN_COLORS.PT_1006, unit: 'psig' },
  { key: 'TT_2004', label: 'Cyl 1 temp', color: CHART_PEN_COLORS.TT_2004, unit: '°F' },
  { key: 'TT_2005', label: 'Cyl 2 temp', color: CHART_PEN_COLORS.TT_2005, unit: '°F' },
  { key: 'ST_1008', label: 'Engine speed', color: CHART_PEN_COLORS.ST_1008, unit: 'rpm' },
  { key: 'valves.Z_byp', label: 'Bypass position', color: CHART_PEN_COLORS['valves.Z_byp'], unit: '%' },
  { key: 'PT_1005', label: 'Oil pressure', color: CHART_PEN_COLORS.PT_1005, unit: 'psig' },
  { key: 'TT_2001', label: 'Oil temp', color: CHART_PEN_COLORS.TT_2001, unit: '°F' },
  { key: 'TT_2013', label: 'Aftercooler temp', color: CHART_PEN_COLORS.TT_2013, unit: '°F' },
  { key: 'flows.m_comp', label: 'Mass flow', color: CHART_PEN_COLORS['flows.m_comp'], unit: 'kg/s' },
];

const DEFAULT_KEYS = [
  'PT_1001',
  'PT_1002',
  'PT_1003',
  'PT_1006',
];

function readKey(msg: SimMessage, key: string): number {
  if (key.startsWith('flows.')) return (msg.flows as unknown as Record<string, number>)[key.slice(6)] ?? 0;
  if (key.startsWith('valves.')) return (msg.valves as unknown as Record<string, number>)[key.slice(7)] ?? 0;
  const v = msg[key];
  return typeof v === 'number' ? v : 0;
}

export default function TrendChart({ subscribe, alarms, height = 260 }: { subscribe: UseSimState['subscribe']; alarms: AlarmTable; height?: number | 'workspace' }) {
  const [selected, setSelected] = useState<string[]>(DEFAULT_KEYS);
  const [windowSeconds, setWindowSeconds] = useState(5 * 60);
  const [liveFollow, setLiveFollow] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);
  const dragStartX = useRef<number | null>(null);
  // Columnar ring buffer: buf[0] is time, buf[i+1] is pen i's series, for
  // every AVAILABLE_PENS entry (not just selected — so toggling a pen back
  // on doesn't lose history already collected).
  const buf = useRef<Float64Array[]>(AVAILABLE_PENS.map(() => new Float64Array(MAX_POINTS)));
  const timeBuf = useRef(new Float64Array(MAX_POINTS));
  const count = useRef(0);

  useEffect(() => {
    const unsub = subscribe((msg) => {
      const i = count.current % MAX_POINTS;
      timeBuf.current[i] = msg.sim_time_s;
      AVAILABLE_PENS.forEach((pen, pIdx) => {
        buf.current[pIdx][i] = readKey(msg, pen.key);
      });
      count.current += 1;
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const pens = AVAILABLE_PENS.filter((p) => selected.includes(p.key));

    const plotHeight = height === 'workspace'
      ? Math.max(320, containerRef.current.clientHeight || window.innerHeight - 330)
      : height;
    const units = [...new Set(pens.map((pen) => pen.unit))];
    const opts: uPlot.Options = {
      width: containerRef.current.clientWidth || 600,
      height: plotHeight,
      scales: Object.fromEntries([['x', { time: false }], ...units.map((unit) => [unit, { auto: true }])]),
      cursor: {
        sync: { key: 'compressor-sim-trends' },
        drag: { x: true, y: false, setScale: true },
      },
      legend: { show: false },
      series: [
        {},
        ...pens.map((p) => ({
          label: `${p.label} (${p.unit})`,
          scale: p.unit,
          stroke: p.color,
          width: 2.5,
          points: { show: false },
        })),
      ],
      axes: [
        {
          stroke: cssVar('--text-tag'),
          grid: { stroke: cssVar('--hmi-rule') },
          values: (_u, vals) => vals.map((v) => `${v.toFixed(0)}s`),
        },
        ...units.map((unit, index) => ({
          scale: unit,
          side: index % 2 === 0 ? 3 : 1,
          label: unit,
          stroke: cssVar('--text-tag'),
          grid: { stroke: index === 0 ? cssVar('--hmi-rule') : 'transparent' },
          size: 64,
        } as uPlot.Axis)),
      ],
      hooks: {
        draw: [
          (u) => {
            // alarm/trip setpoints as horizontal dashed lines — section 6.3
            const ctx = u.ctx;
            ctx.save();
            ctx.strokeStyle = cssVar('--alm-p1');
            ctx.setLineDash([4, 4]);
            ctx.lineWidth = 1;
            pens.forEach((pen) => {
              const band = alarms[pen.key];
              if (!band) return;
              band.forEach((v) => {
                if (v === null) return;
                const y = u.valToPos(v, pen.unit, true);
                ctx.beginPath();
                ctx.moveTo(u.bbox.left, y);
                ctx.lineTo(u.bbox.left + u.bbox.width, y);
                ctx.stroke();
              });
            });
            ctx.restore();
          },
        ],
      },
    };

    const plot = new uPlot(opts, [new Float64Array(0), ...pens.map(() => new Float64Array(0))], containerRef.current);
    plotRef.current = plot;

    const onResize = () => {
      if (containerRef.current) {
        const nextHeight = height === 'workspace'
          ? Math.max(320, containerRef.current.clientHeight || window.innerHeight - 330)
          : height;
        plot.setSize({ width: containerRef.current.clientWidth || 600, height: nextHeight });
      }
    };
    window.addEventListener('resize', onResize);

    const interval = setInterval(() => {
      const n = Math.min(count.current, MAX_POINTS);
      if (n === 0) return;
      // Ring buffer -> contiguous, oldest-first slice for uPlot.
      const start = count.current > MAX_POINTS ? count.current % MAX_POINTS : 0;
      const ordered = (arr: Float64Array) =>
        start === 0 ? arr.slice(0, n) : Float64Array.from([...arr.slice(start), ...arr.slice(0, start)]);
      const xs = ordered(timeBuf.current);
      const data = [xs, ...pens.map((p) => ordered(buf.current[AVAILABLE_PENS.indexOf(p)]))] as uPlot.AlignedData;
      plot.setData(data, false);
      if (liveFollow && xs.length > 0) {
        const end = xs[xs.length - 1];
        plot.setScale('x', { min: Math.max(xs[0], end - windowSeconds), max: end });
      }
    }, 250);

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', onResize);
      plot.destroy();
    };
  }, [selected, alarms, height, liveFollow, windowSeconds]);

  const togglePen = (key: string) => {
    setSelected((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length >= 12) return prev;
      return [...prev, key];
    });
  };

  const chooseWindow = (seconds: number) => {
    setWindowSeconds(seconds);
    setLiveFollow(true);
  };

  const zoomBy = (factor: number) => {
    setWindowSeconds((current) => Math.max(10, Math.min(WINDOW_S, Math.round(current * factor))));
    setLiveFollow(true);
  };

  const resetView = () => {
    setWindowSeconds(5 * 60);
    setLiveFollow(true);
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="mr-1 font-medium tracking-wide" style={{ color: 'var(--text-tag)' }}>TIME WINDOW</span>
        {[60, 5 * 60, 15 * 60, 30 * 60].map((seconds) => (
          <button
            type="button"
            key={seconds}
            className="hmi-btn"
            onClick={() => chooseWindow(seconds)}
            style={{ outline: windowSeconds === seconds && liveFollow ? '1px solid var(--focus-ring)' : 'none' }}
          >
            {seconds < 60 ? `${seconds}s` : `${seconds / 60}m`}
          </button>
        ))}
        <span className="mx-1 h-5" style={{ borderLeft: '1px solid var(--hmi-rule)' }} />
        <button type="button" className="hmi-btn" onClick={() => zoomBy(0.5)}>ZOOM IN</button>
        <button type="button" className="hmi-btn" onClick={() => zoomBy(2)}>ZOOM OUT</button>
        <button type="button" className="hmi-btn" onClick={resetView}>RESET VIEW</button>
        <button
          type="button"
          className="hmi-btn ml-auto"
          onClick={() => setLiveFollow((current) => !current)}
          style={{ outline: liveFollow ? '1px solid var(--focus-ring)' : 'none' }}
        >
          {liveFollow ? '● LIVE FOLLOW' : '○ HOLD VIEW'}
        </button>
      </div>
      <div
        ref={containerRef}
        className="min-h-0 w-full flex-1 overflow-hidden"
        style={{ backgroundColor: 'var(--hmi-surface)', border: '1px solid var(--hmi-rule-strong)' }}
        onPointerDown={(event) => { dragStartX.current = event.clientX; }}
        onPointerUp={(event) => {
          if (dragStartX.current !== null && Math.abs(event.clientX - dragStartX.current) > 5) setLiveFollow(false);
          dragStartX.current = null;
        }}
        onDoubleClick={resetView}
      />
      <div className="grid max-h-[154px] grid-cols-2 gap-2 overflow-y-auto pr-1 text-xs md:grid-cols-3 xl:grid-cols-4">
        {AVAILABLE_PENS.map((pen) => (
          <label
            key={pen.key}
            className="flex min-w-0 cursor-pointer items-center gap-2 px-3 py-2"
            style={{
              color: selected.includes(pen.key) ? 'var(--text-value)' : 'var(--text-tag)',
              backgroundColor: selected.includes(pen.key) ? 'var(--hmi-surface)' : 'var(--hmi-canvas)',
              border: `1px solid ${selected.includes(pen.key) ? pen.color : 'var(--hmi-rule)'}`,
            }}
          >
            <input
              type="checkbox"
              checked={selected.includes(pen.key)}
              onChange={() => togglePen(pen.key)}
              className="accent-[var(--focus-ring)]"
            />
            <span className="inline-block h-1 w-8 shrink-0" style={{ backgroundColor: pen.color }} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{pen.label}</span>
              <span className="block tabular text-[10px]" style={{ color: 'var(--text-tag)' }}>{pen.key} · {pen.unit}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="flex items-center justify-between text-xs text-[var(--text-disabled)]">
        <span>{selected.length}/12 pens selected</span>
        <span>Drag horizontally on the plot to inspect a time range · RESET VIEW returns to live.</span>
      </div>
    </div>
  );
}

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
  'TT_2004',
  'TT_2005',
  'ST_1008',
  'valves.Z_byp',
];

function readKey(msg: SimMessage, key: string): number {
  if (key.startsWith('flows.')) return (msg.flows as unknown as Record<string, number>)[key.slice(6)] ?? 0;
  if (key.startsWith('valves.')) return (msg.valves as unknown as Record<string, number>)[key.slice(7)] ?? 0;
  const v = msg[key];
  return typeof v === 'number' ? v : 0;
}

export default function TrendChart({ subscribe, alarms }: { subscribe: UseSimState['subscribe']; alarms: AlarmTable }) {
  const [selected, setSelected] = useState<string[]>(DEFAULT_KEYS);
  const containerRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);
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

    const opts: uPlot.Options = {
      width: containerRef.current.clientWidth || 600,
      height: 260,
      scales: { x: { time: false } },
      cursor: { sync: { key: 'compressor-sim-trends' } },
      series: [
        {},
        ...pens.map((p) => ({
          label: `${p.label} (${p.unit})`,
          stroke: p.color,
          width: 1.5,
          points: { show: false },
        })),
      ],
      axes: [
        {
          stroke: cssVar('--text-tag'),
          grid: { stroke: cssVar('--hmi-rule') },
          values: (_u, vals) => vals.map((v) => `${v.toFixed(0)}s`),
        },
        { stroke: cssVar('--text-tag'), grid: { stroke: cssVar('--hmi-rule') } },
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
                const y = u.valToPos(v, 'y', true);
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
      if (containerRef.current) plot.setSize({ width: containerRef.current.clientWidth || 600, height: 260 });
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
      plot.setData(data);
    }, 250);

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', onResize);
      plot.destroy();
    };
  }, [selected, alarms]);

  const togglePen = (key: string) => {
    setSelected((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length >= 12) return prev;
      return [...prev, key];
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div ref={containerRef} className="w-full" />
      <div className="grid grid-cols-2 gap-1 text-xs sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {AVAILABLE_PENS.map((pen) => (
          <label key={pen.key} className="flex items-center gap-1.5 text-[var(--text-tag)]">
            <input
              type="checkbox"
              checked={selected.includes(pen.key)}
              onChange={() => togglePen(pen.key)}
              className="accent-[var(--focus-ring)]"
            />
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: pen.color }} />
            {pen.label}
          </label>
        ))}
      </div>
      <div className="text-xs text-[var(--text-disabled)]">{selected.length}/12 pens &middot; 30-min rolling window</div>
    </div>
  );
}

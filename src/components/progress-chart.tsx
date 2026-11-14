"use client";

import { useEffect, useRef, useState } from "react";
import type { DayPoint } from "@/lib/stats";
import { fmtDay } from "@/lib/dates";
import { fmtCompact, fmtNum } from "@/lib/format";

const M = { l: 44, r: 12, t: 12, b: 24 };

function niceMax(v: number) {
  if (v <= 0) return 10;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * exp >= v) return m * exp;
  return 10 * exp;
}
const ticks = (max: number, n = 4) => Array.from({ length: n + 1 }, (_, i) => (max / n) * i);

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function ProgressChart({
  series,
  target,
  unit,
  today,
  dailyRef,
  title = "Progress",
}: {
  series: DayPoint[];
  target: number | null;
  unit: string;
  today: string;
  dailyRef: number | null;
  title?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const n = series.length;
  if (n === 0) return null;

  const iw = Math.max(0, width - M.l - M.r);
  const band = iw / n;
  const x = (i: number) => M.l + (i + 0.5) * band;
  const idxAt = (px: number) => Math.max(0, Math.min(n - 1, Math.floor((px - M.l) / band)));

  // Top chart: cumulative vs even pace
  const H1 = 210;
  const ih1 = H1 - M.t - M.b;
  const hasPace = series.some((p) => p.pace != null);
  const max1 = niceMax(Math.max(target ?? 0, ...series.map((p) => Math.max(p.cumulative ?? 0, p.pace ?? 0))));
  const y1 = (v: number) => M.t + ih1 - (v / max1) * ih1;
  const happened = series.map((p, i) => [i, p] as const).filter(([, p]) => p.cumulative != null);
  const linePath = happened.map(([i, p], k) => `${k ? "L" : "M"}${x(i)},${y1(p.cumulative!)}`).join("");
  const areaPath = happened.length
    ? `${linePath}L${x(happened[happened.length - 1][0])},${y1(0)}L${x(happened[0][0])},${y1(0)}Z`
    : "";
  const pacePath = hasPace ? series.map((p, i) => `${i ? "L" : "M"}${x(i)},${y1(p.pace!)}`).join("") : "";
  const last = happened[happened.length - 1];

  // Bottom chart: daily columns
  const H2 = 130;
  const ih2 = H2 - M.t - M.b;
  const max2 = niceMax(Math.max(dailyRef ?? 0, ...series.map((p) => p.amount)));
  const y2 = (v: number) => M.t + ih2 - (v / max2) * ih2;
  const bw = Math.max(1, Math.min(24, band - 2));

  const labelIdx = (() => {
    const want = Math.min(n, width < 420 ? 3 : 6);
    if (want <= 1) return [0];
    return Array.from(new Set(Array.from({ length: want }, (_, k) => Math.round((k * (n - 1)) / (want - 1)))));
  })();

  const h = hover != null ? series[hover] : null;
  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    setHover(idxAt(e.clientX - r.left));
  };

  const xAxis = (H: number) => (
    <g>
      {labelIdx.map((i) => (
        <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} className="fill-[var(--faint)] text-[11px]">
          {fmtDay(series[i].day)}
        </text>
      ))}
    </g>
  );

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="flex items-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-series-1" /> Actual</span>
          {hasPace && <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-[var(--pace)]" /> Even pace</span>}
        </div>
      </div>
      <div ref={ref} className="relative select-none" onPointerLeave={() => setHover(null)}>
        {width > 0 && (
          <>
            <svg width={width} height={H1} role="img" aria-label={`Cumulative ${unit} over time`}>
              {ticks(max1).map((t) => (
                <g key={t}>
                  <line x1={M.l} x2={width - M.r} y1={y1(t)} y2={y1(t)} stroke="var(--grid)" strokeWidth={1} />
                  <text x={M.l - 8} y={y1(t) + 4} textAnchor="end" className="tnum fill-[var(--faint)] text-[11px]">{fmtCompact(t)}</text>
                </g>
              ))}
              {hasPace && <path d={pacePath} fill="none" stroke="var(--pace)" strokeWidth={2} strokeLinecap="round" />}
              {areaPath && <path d={areaPath} fill="var(--series-1-wash)" />}
              {linePath && <path d={linePath} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
              {last && hover == null && (
                <>
                  <circle cx={x(last[0])} cy={y1(last[1].cumulative!)} r={5} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />
                  <text
                    x={x(last[0])}
                    y={y1(last[1].cumulative!) - 10}
                    textAnchor={last[0] > n * 0.8 ? "end" : "middle"}
                    className="tnum fill-[var(--ink)] text-[12px] font-semibold"
                  >
                    {fmtNum(last[1].cumulative!, 0)}
                  </text>
                </>
              )}
              {hover != null && (
                <>
                  <line x1={x(hover)} x2={x(hover)} y1={M.t} y2={M.t + ih1} stroke="var(--faint)" strokeWidth={1} />
                  {h?.cumulative != null && <circle cx={x(hover)} cy={y1(h.cumulative)} r={5} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />}
                  {h?.pace != null && <circle cx={x(hover)} cy={y1(h.pace)} r={4} fill="var(--pace)" stroke="var(--surface)" strokeWidth={2} />}
                </>
              )}
              {xAxis(H1)}
              <rect x={M.l} y={0} width={iw} height={H1} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} />
            </svg>

            <div className="mb-1 mt-3 flex items-center justify-between text-xs text-muted">
              <span>Per day</span>
              {dailyRef != null && dailyRef > 0 && (
                <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-[var(--pace)]" /> Daily pace {fmtNum(Math.ceil(dailyRef))}</span>
              )}
            </div>
            <svg width={width} height={H2} role="img" aria-label={`${unit} per day`}>
              {ticks(max2, 2).map((t) => (
                <g key={t}>
                  <line x1={M.l} x2={width - M.r} y1={y2(t)} y2={y2(t)} stroke="var(--grid)" strokeWidth={1} />
                  <text x={M.l - 8} y={y2(t) + 4} textAnchor="end" className="tnum fill-[var(--faint)] text-[11px]">{fmtCompact(t)}</text>
                </g>
              ))}
              {series.map((p, i) => {
                if (p.amount <= 0) return null;
                const top = y2(p.amount);
                const bh = y2(0) - top;
                const r = Math.min(4, bw / 2, bh);
                const x0 = x(i) - bw / 2;
                const d = `M${x0},${y2(0)}V${top + r}Q${x0},${top} ${x0 + r},${top}H${x0 + bw - r}Q${x0 + bw},${top} ${x0 + bw},${top + r}V${y2(0)}Z`;
                return <path key={p.day} d={d} fill="var(--series-1)" opacity={hover == null || hover === i ? 1 : 0.45} />;
              })}
              {dailyRef != null && dailyRef > 0 && (
                <line x1={M.l} x2={width - M.r} y1={y2(dailyRef)} y2={y2(dailyRef)} stroke="var(--pace)" strokeWidth={2} />
              )}
              {hover != null && <line x1={x(hover)} x2={x(hover)} y1={M.t} y2={M.t + ih2} stroke="var(--faint)" strokeWidth={1} />}
              {xAxis(H2)}
              <rect x={M.l} y={0} width={iw} height={H2} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} />
            </svg>

            {h && (
              <div
                className="card pointer-events-none absolute top-2 z-10 min-w-40 p-2.5 text-xs shadow-lg"
                style={{ left: Math.min(Math.max(0, x(hover!) - 80), width - 170) }}
              >
                <div className="mb-1 font-semibold">
                  {fmtDay(h.day, { weekday: "short", month: "short", day: "numeric" })}
                  {h.day === today && <span className="ml-1 text-muted">· today</span>}
                </div>
                {h.cumulative == null ? (
                  <div className="text-muted">Hasn&apos;t happened yet</div>
                ) : (
                  <>
                    <Row k="That day" v={`${fmtNum(h.amount)} ${unit}`} />
                    <Row k="Running total" v={fmtNum(h.cumulative)} />
                  </>
                )}
                {h.pace != null && <Row k="Even pace" v={fmtNum(h.pace, 0)} />}
              </div>
            )}
          </>
        )}
      </div>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-xs text-muted">Show as table</summary>
        <div className="mt-2 max-h-64 overflow-auto">
          <table className="tnum w-full text-left text-xs">
            <thead className="text-muted">
              <tr><th className="py-1">Day</th><th>Amount</th><th>Total</th>{hasPace && <th>Pace</th>}</tr>
            </thead>
            <tbody>
              {series.filter((p) => p.cumulative != null).map((p) => (
                <tr key={p.day} className="border-t border-line">
                  <td className="py-1">{fmtDay(p.day)}</td>
                  <td>{fmtNum(p.amount)}</td>
                  <td>{fmtNum(p.cumulative!)}</td>
                  {hasPace && <td>{fmtNum(p.pace ?? 0, 0)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted">{k}</span>
      <span className="tnum font-medium">{v}</span>
    </div>
  );
}

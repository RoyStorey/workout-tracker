"use client";

import { useEffect, useRef, useState } from "react";
import { fmtDay } from "@/lib/dates";
import { fmtCompact, fmtNum } from "@/lib/format";

type Line = { id: number; name: string; slot: number; values: (number | null)[] };
const M = { l: 44, r: 16, t: 14, b: 24 };
const color = (slot: number) => `var(--cat-${(slot % 8) + 1})`;

function niceMax(v: number) {
  if (v <= 0) return 10;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * exp >= v) return m * exp;
  return 10 * exp;
}

export function BattleChart({ days, lines, unit, today, average }: { days: string[]; lines: Line[]; unit: string; today: string; average: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const n = days.length;
  const H = 240;
  const iw = Math.max(0, width - M.l - M.r);
  const ih = H - M.t - M.b;
  const x = (i: number) => M.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const max = niceMax(Math.max(0, ...lines.flatMap((l) => l.values.map((v) => v ?? 0))));
  const y = (v: number) => M.t + ih - (v / max) * ih;
  const lastIdx = Math.max(-1, ...lines.map((l) => l.values.findLastIndex((v) => v != null)));
  const want = Math.min(n, width < 420 ? 3 : 6);
  const labels = Array.from(new Set(Array.from({ length: want }, (_, k) => Math.round((k * (n - 1)) / Math.max(1, want - 1)))));

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left - M.l) / Math.max(1, iw)) * (n - 1));
    setHover(Math.max(0, Math.min(lastIdx, i)));
  };
  const at = hover ?? lastIdx;
  const ranked = at >= 0 ? [...lines].sort((a, b) => (b.values[at] ?? 0) - (a.values[at] ?? 0)) : lines;

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {lines.map((l) => (
          <span key={l.id} className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded" style={{ background: color(l.slot) }} />
            {l.name}
          </span>
        ))}
      </div>
      <div ref={ref} className="relative select-none" onPointerLeave={() => setHover(null)}>
        {width > 0 && n > 0 && (
          <svg width={width} height={H} role="img" aria-label={`Running ${average ? "average per member" : "total"} by squad`}>
            {[0, 0.25, 0.5, 0.75, 1].map((f) => (
              <g key={f}>
                <line x1={M.l} x2={width - M.r} y1={y(max * f)} y2={y(max * f)} stroke="var(--grid)" />
                <text x={M.l - 8} y={y(max * f) + 4} textAnchor="end" className="tnum fill-[var(--faint)] text-[11px]">{fmtCompact(max * f)}</text>
              </g>
            ))}
            {labels.map((i) => (
              <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} className="fill-[var(--faint)] text-[11px]">
                {fmtDay(days[i])}
              </text>
            ))}
            {lines.map((l) => {
              const pts = l.values.map((v, i) => [i, v] as const).filter(([, v]) => v != null);
              if (!pts.length) return null;
              const d = pts.map(([i, v], k) => `${k ? "L" : "M"}${x(i)},${y(v!)}`).join("");
              const [li, lv] = pts[pts.length - 1];
              return (
                <g key={l.id}>
                  <path d={d} fill="none" stroke={color(l.slot)} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  {hover == null && <circle cx={x(li)} cy={y(lv!)} r={4.5} fill={color(l.slot)} stroke="var(--surface)" strokeWidth={2} />}
                </g>
              );
            })}
            {hover != null && (
              <>
                <line x1={x(hover)} x2={x(hover)} y1={M.t} y2={M.t + ih} stroke="var(--faint)" />
                {lines.map((l) =>
                  l.values[hover] != null ? <circle key={l.id} cx={x(hover)} cy={y(l.values[hover]!)} r={4.5} fill={color(l.slot)} stroke="var(--surface)" strokeWidth={2} /> : null,
                )}
              </>
            )}
            <rect x={M.l} y={0} width={iw} height={H} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} />
          </svg>
        )}
        {hover != null && (
          <div className="card pointer-events-none absolute top-0 z-10 min-w-44 p-2.5 text-xs shadow-lg" style={{ left: Math.min(Math.max(0, x(hover) - 90), width - 190) }}>
            <div className="mb-1.5 font-semibold">
              {fmtDay(days[hover], { weekday: "short", month: "short", day: "numeric" })}
              {days[hover] === today && <span className="text-muted"> · today</span>}
            </div>
            {ranked.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-4 py-0.5">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-[2px]" style={{ background: color(l.slot) }} />
                  {l.name}
                </span>
                <span className="tnum font-semibold">{fmtNum(l.values[hover] ?? 0, average ? 1 : 0)}</span>
              </div>
            ))}
            <div className="mt-1 text-faint">{average ? `${unit} per member` : `${unit} total`}</div>
          </div>
        )}
      </div>
    </div>
  );
}

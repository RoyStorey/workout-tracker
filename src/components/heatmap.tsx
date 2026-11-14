import { addDays, fmtDay, weekday } from "@/lib/dates";

/** GitHub-style calendar of active days (shade = number of sets). */
export function Heatmap({ days, today, weeks = 26 }: { days: { day: string; sets: number }[]; today: string; weeks?: number }) {
  const map = new Map(days.map((d) => [d.day, d.sets]));
  const end = addDays(today, 6 - weekday(today));
  const start = addDays(end, -(weeks * 7 - 1));
  const cols: string[][] = [];
  for (let w = 0; w < weeks; w++) cols.push(Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
  const level = (n: number) => (n <= 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 6 ? 3 : 4);
  const active = days.filter((d) => d.day >= start).length;
  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <div className="flex w-max gap-[3px]" role="img" aria-label={`${active} active days in the last ${weeks} weeks`}>
          {cols.map((col, i) => (
            <div key={i} className="flex flex-col gap-[3px]">
              {col.map((d) => {
                const n = map.get(d) ?? 0;
                return (
                  <div
                    key={d}
                    title={d > today ? "" : `${fmtDay(d, { weekday: "short", month: "short", day: "numeric" })}: ${n} set${n === 1 ? "" : "s"}`}
                    className="h-[13px] w-[13px] rounded-[3px]"
                    style={{ background: d > today ? "transparent" : `var(--heat-${level(n)})` }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted">
        <span>{active} active days in {weeks} weeks</span>
        <span className="flex items-center gap-1">
          Less {[0, 1, 2, 3, 4].map((l) => <span key={l} className="h-[11px] w-[11px] rounded-[3px]" style={{ background: `var(--heat-${l})` }} />)} More
        </span>
      </div>
    </div>
  );
}

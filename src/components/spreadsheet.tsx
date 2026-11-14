import { eachDay, fmtDay, weekday } from "@/lib/dates";
import { cx, fmtNum } from "@/lib/format";
import type { PublicUser, Squad } from "@/lib/queries";
import { Avatar } from "./avatar";
import { squadColor } from "./ui";

type Member = PublicUser & { squad_id: number | null };

/** The old-school sheet: one row per day, one column per person, heat-shaded, totals pinned. */
export function Spreadsheet({
  entries,
  members,
  squads,
  start,
  end,
  today,
  unit,
  exportHref,
}: {
  entries: { user_id: number; amount: number; day: string }[];
  members: Member[];
  squads: Squad[];
  start: string;
  end: string | null;
  today: string;
  unit: string;
  exportHref: (type: "daily" | "sets") => string;
}) {
  const last = end && end < today ? end : today;
  if (last < start || members.length === 0) return null;
  const days = eachDay(start, last).reverse().slice(0, 400);

  const cell = new Map<string, number>();
  const totals = new Map<number, number>();
  for (const e of entries) {
    cell.set(`${e.day}|${e.user_id}`, (cell.get(`${e.day}|${e.user_id}`) ?? 0) + e.amount);
    totals.set(e.user_id, (totals.get(e.user_id) ?? 0) + e.amount);
  }
  const cols = [...members].sort((a, b) => (totals.get(b.id) ?? 0) - (totals.get(a.id) ?? 0));
  const max = Math.max(1, ...cell.values());
  const grand = [...totals.values()].reduce((a, b) => a + b, 0);
  const squadOf = new Map(squads.map((s) => [s.id, s]));
  const many = squads.length > 8;
  const shade = (v: number) => (v > 0 ? `color-mix(in srgb, var(--series-1) ${Math.round(8 + 34 * (v / max))}%, transparent)` : undefined);

  const stickyLeft = "sticky left-0 z-[1] border-r border-line";
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <h2 className="display text-2xl uppercase">Spreadsheet</h2>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">Download CSV:</span>
          <a href={exportHref("daily")} className="btn-ghost h-8 px-3 text-xs" download>
            Daily totals
          </a>
          <a href={exportHref("sets")} className="btn-ghost h-8 px-3 text-xs" download>
            Every set
          </a>
        </div>
      </div>
      <div className="card overflow-hidden">
        <div className="max-h-[560px] overflow-auto">
          <table className="tnum w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className={cx(stickyLeft, "top-0 z-[3] border-b bg-surface px-3 py-2 text-left text-xs font-semibold text-muted")} style={{ position: "sticky" }}>
                  Day
                </th>
                {cols.map((m) => {
                  const sq = m.squad_id ? squadOf.get(m.squad_id) : undefined;
                  return (
                    <th key={m.id} className="sticky top-0 z-[2] min-w-[92px] border-b border-line bg-surface px-3 py-2 text-right align-bottom font-semibold">
                      {sq && <div className="mb-1.5 ml-auto h-1 w-8 rounded-full" style={{ background: many ? "var(--faint)" : squadColor(sq.slot) }} title={sq.name} />}
                      <div className="flex items-center justify-end gap-1.5">
                        <Avatar user={m} size={18} />
                        <span className="max-w-[90px] truncate" title={m.display_name}>{m.display_name.split(" ")[0]}</span>
                      </div>
                    </th>
                  );
                })}
                <th className="sticky top-0 z-[2] border-b border-l border-line bg-surface px-3 py-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => {
                const isToday = d === today;
                const weekend = [0, 6].includes(weekday(d));
                const vals = cols.map((m) => cell.get(`${d}|${m.id}`) ?? 0);
                const sum = vals.reduce((a, b) => a + b, 0);
                const rowBg = isToday ? "bg-surface-2" : "bg-surface";
                return (
                  <tr key={d} className="group">
                    <td className={cx(stickyLeft, rowBg, "whitespace-nowrap border-b px-3 py-1.5 text-left", isToday ? "font-bold" : weekend ? "text-faint" : "text-muted")}>
                      {isToday && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-signal align-middle" />}
                      {fmtDay(d, { weekday: "short", month: "short", day: "numeric" })}
                    </td>
                    {vals.map((v, i) => (
                      <td key={cols[i].id} className={cx("border-b border-line px-3 py-1.5 text-right group-hover:brightness-95", rowBg, v === 0 && "text-faint/60", isToday && "font-semibold")}>
                        <span className="-mx-1.5 rounded px-1.5 py-0.5" style={{ background: shade(v) }}>
                          {v ? fmtNum(v) : "·"}
                        </span>
                      </td>
                    ))}
                    <td className={cx("border-b border-l border-line px-3 py-1.5 text-right font-semibold", rowBg, sum === 0 && "text-faint")}>{sum ? fmtNum(sum) : "·"}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className={cx(stickyLeft, "bottom-0 z-[3] border-t bg-surface-2 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide")} style={{ position: "sticky" }}>
                  Total
                </td>
                {cols.map((m) => (
                  <td key={m.id} className="sticky bottom-0 z-[2] border-t border-line bg-surface-2 px-3 py-2 text-right font-bold">
                    {fmtNum(totals.get(m.id) ?? 0)}
                  </td>
                ))}
                <td className="sticky bottom-0 z-[2] border-l border-t border-line bg-surface-2 px-3 py-2 text-right font-bold">{fmtNum(grand)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="flex justify-between border-t border-line px-3 py-2 text-xs text-muted">
          <span>
            {days.length} days · {members.length} {members.length === 1 ? "person" : "people"} · in {unit}
          </span>
          <span className="flex items-center gap-1.5">
            Light <span className="h-2.5 w-6 rounded-sm" style={{ background: "linear-gradient(90deg, color-mix(in srgb, var(--series-1) 10%, transparent), color-mix(in srgb, var(--series-1) 42%, transparent))" }} /> Big day
          </span>
        </div>
      </div>
    </section>
  );
}

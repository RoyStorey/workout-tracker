import { addDays, fmtDay } from "@/lib/dates";
import { cx } from "@/lib/format";
import { TIERS, nextTier, tierFor, type Streak } from "@/lib/streaks";
import { FlameGlyph, StreakFlame } from "./streak";
import { Panel } from "./ui";

/** Profile streak card: the live flame, progress to the next tier, the last two weeks, and every tier ever reached. */
export function StreakCard({ streak, activeDays, today, isMe }: { streak: Streak; activeDays: Set<string>; today: string; isMe: boolean }) {
  const { current, atRisk, longest } = streak;
  const tier = tierFor(current);
  const next = nextTier(current);
  const floor = tier?.min ?? 0;
  const toNext = next ? (current - floor) / (next.min - floor) : 1;
  const color = tier?.color ?? "var(--faint)";
  const strip = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));

  return (
    <Panel title="Streak" actions={tier && <StreakFlame days={current} size="md" />}>
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex items-center gap-4">
          <span className={cx(tier && "streak-flicker", tier?.glow && "streak-glow")} style={{ ["--tier" as string]: color }}>
            <FlameGlyph color={current > 0 ? color : "var(--line-strong)"} size={72} />
          </span>
          <div className="min-w-0">
            {current > 0 ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className={cx("display text-6xl", tier?.shimmer && "streak-shimmer")}>
                    <span className="streak-num">{current}</span>
                  </span>
                  <span className="font-semibold text-muted">day{current === 1 ? "" : "s"} in a row</span>
                </div>
                <div className="mt-1 text-sm">
                  {tier ? <b>{tier.name}</b> : <span className="text-muted">Flair unlocks at 3 days</span>}
                  {atRisk && <span className="text-bad"> · {isMe ? "Log anything today or it resets at midnight" : "Hasn't logged yet today"}</span>}
                </div>
              </>
            ) : (
              <>
                <div className="display text-4xl uppercase text-muted">No streak</div>
                <div className="mt-1 text-sm text-muted">
                  {streak.lastActive ? `Last logged ${fmtDay(streak.lastActive)}. ` : ""}
                  {isMe ? "Log anything today to start one." : ""}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {next && (
            <div>
              <div className="mb-1.5 flex justify-between text-xs">
                <span className="text-muted">
                  Next: <b className="text-ink">{next.name}</b>
                </span>
                <span className="tnum text-muted">{next.min - current} more day{next.min - current === 1 ? "" : "s"}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-[3px]" style={{ background: `color-mix(in srgb, ${next.color} 16%, transparent)` }}>
                <div className="h-full rounded-[3px] transition-[width] duration-700" style={{ width: `${Math.max(3, toNext * 100)}%`, background: next.color }} />
              </div>
            </div>
          )}
          <div>
            <div className="mb-1.5 text-xs text-muted">Last 14 days</div>
            <div className="flex gap-1">
              {strip.map((d) => {
                const on = activeDays.has(d);
                return (
                  <span
                    key={d}
                    title={`${fmtDay(d, { weekday: "short", month: "short", day: "numeric" })}${on ? ": logged" : ""}`}
                    className={cx("h-6 flex-1 rounded-[3px]", d === today && "ring-2 ring-ink ring-offset-1 ring-offset-[var(--surface)]")}
                    style={{ background: on ? (current > 0 ? color : "var(--series-1)") : "var(--surface-2)" }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <div className="mb-2 flex justify-between text-xs text-muted">
          <span>Tiers reached</span>
          <span>
            Best ever: <b className="tnum text-ink">{longest}</b> day{longest === 1 ? "" : "s"}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {TIERS.map((t) => {
            const got = longest >= t.min;
            return (
              <div
                key={t.name}
                title={got ? `${t.name}: reached` : `${t.name}: reach a ${t.min}-day streak`}
                className={cx("flex flex-col items-center rounded-md border px-1 py-2 text-center", got ? "border-line" : "border-dashed border-line")}
              >
                <span className={cx(!got && "opacity-25 grayscale")}>
                  <FlameGlyph color={t.color} size={26} />
                </span>
                <span className={cx("mt-1 text-[11px] font-semibold leading-tight", !got && "text-faint")}>{t.name}</span>
                <span className="text-[10px] text-faint">{t.min}d</span>
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

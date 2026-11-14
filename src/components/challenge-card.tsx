import Link from "next/link";
import type { ChallengeCard as Card } from "@/lib/queries";
import { challengeStatus } from "@/lib/stats";
import { diffDays, fmtRange } from "@/lib/dates";
import { fmtCompact, fmtPct, plural } from "@/lib/format";
import { ProgressBar, StatusTag } from "./ui";

export function ChallengeCardView({ c, today }: { c: Card; today: string }) {
  const status = challengeStatus(c, today);
  const battle = c.kind === "battle";
  const groupTarget = !battle && c.target ? (c.goal_type === "shared" ? c.target : c.target * Math.max(1, c.member_count)) : null;
  const pct = groupTarget ? c.total / groupTarget : null;
  const when =
    status === "upcoming"
      ? `Starts in ${plural(diffDays(today, c.start_date), "day")}`
      : status === "active" && c.end_date
        ? `${plural(diffDays(today, c.end_date) + 1, "day")} left`
        : status === "active"
          ? "Ongoing"
          : fmtRange(c.start_date, c.end_date);
  const goal = battle
    ? `${plural(c.squad_count, "squad")} battling`
    : c.target
      ? `${fmtCompact(c.target)} ${c.unit} ${c.goal_type === "individual" ? "each" : "together"}`
      : `Most ${c.unit} wins`;
  return (
    <Link href={`/c/${c.slug}`} className="card group flex flex-col p-4 transition hover:border-line-strong hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-bold group-hover:underline">{c.title}</div>
          <div className="truncate text-xs text-muted">
            {c.exercise} · {goal}
          </div>
        </div>
        <StatusTag status={status} reached={pct != null && pct >= 1} />
      </div>
      <div className="mt-4">
        {pct != null ? (
          <>
            <ProgressBar value={pct} />
            <div className="tnum mt-1.5 flex justify-between text-xs text-muted">
              <span>
                <b className="text-ink">{fmtCompact(c.total)}</b> / {fmtCompact(groupTarget!)}
              </span>
              <span>{fmtPct(pct)}</span>
            </div>
          </>
        ) : (
          <div className="flex items-baseline gap-1.5">
            <span className="display text-3xl">{fmtCompact(c.total)}</span>
            <span className="text-xs text-muted">{c.unit} logged</span>
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-2 border-t border-line pt-3 text-xs text-muted">
        <span>{plural(c.member_count, "member")}</span>
        <span>·</span>
        <span>{when}</span>
        {c.team_name && (
          <>
            <span>·</span>
            <span className="truncate">{c.team_name}</span>
          </>
        )}
        {c.visibility === "private" && (
          <>
            <span>·</span>
            <span>Private</span>
          </>
        )}
      </div>
    </Link>
  );
}

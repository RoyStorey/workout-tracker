import Link from "next/link";
import type { ChallengeCard as Card } from "@/lib/queries";
import { challengeStatus } from "@/lib/stats";
import { diffDays, fmtRange } from "@/lib/dates";
import { fmtCompact, fmtPct, plural } from "@/lib/format";
import { ProgressBar, StatusPill, VisibilityPill } from "./ui";

export function ChallengeCardView({ c, today }: { c: Card; today: string }) {
  const status = challengeStatus(c, today);
  const groupTarget = c.target ? (c.goal_type === "shared" ? c.target : c.target * Math.max(1, c.member_count)) : null;
  const pct = groupTarget ? c.total / groupTarget : null;
  const timeNote =
    status === "upcoming"
      ? `Starts in ${plural(diffDays(today, c.start_date), "day")}`
      : status === "active" && c.end_date
        ? `${plural(diffDays(today, c.end_date) + 1, "day")} left`
        : status === "active"
          ? "Ongoing"
          : "Wrapped up";
  return (
    <Link href={`/c/${c.slug}`} className="card group block p-4 transition hover:border-accent/50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold group-hover:text-accent">{c.title}</div>
          <div className="truncate text-sm text-muted">
            {c.target ? `${fmtCompact(c.target)} ${c.unit} ${c.goal_type === "individual" ? "each" : "together"}` : `${c.exercise} · ${c.unit}`}
            {c.team_name && <> · {c.team_name}</>}
          </div>
        </div>
        <StatusPill status={status} reached={pct != null && pct >= 1} />
      </div>
      {pct != null && (
        <div className="mt-3">
          <ProgressBar value={pct} />
          <div className="tnum mt-1.5 flex justify-between text-xs text-muted">
            <span>{fmtCompact(c.total)} / {fmtCompact(groupTarget!)} {c.unit}</span>
            <span>{fmtPct(pct)}</span>
          </div>
        </div>
      )}
      {pct == null && <div className="tnum mt-3 text-sm"><b>{fmtCompact(c.total)}</b> <span className="text-muted">{c.unit} logged</span></div>}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>{plural(c.member_count, "member")}</span>·<span>{timeNote}</span>·<span>{fmtRange(c.start_date, c.end_date)}</span>
        {c.visibility === "private" && <VisibilityPill visibility="private" />}
      </div>
    </Link>
  );
}

import Link from "next/link";
import type { TeamCard } from "@/lib/queries";
import { plural } from "@/lib/format";
import { TeamMark } from "./ui";

/** One way to show a team in a list, used everywhere teams are listed. */
export function TeamRow({ t, compact }: { t: TeamCard; compact?: boolean }) {
  return (
    <Link href={`/t/${t.slug}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2/60">
      <TeamMark name={t.name} size={compact ? 30 : 36} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{t.name}</div>
        {!compact && t.description && <div className="truncate text-xs text-muted">{t.description}</div>}
      </div>
      <div className="shrink-0 text-right text-xs text-muted">
        <div>{plural(t.member_count, "member")}</div>
        {!compact && (
          <div>
            {plural(t.challenge_count, "challenge")}
            {t.visibility === "private" ? " · Private" : ""}
          </div>
        )}
      </div>
    </Link>
  );
}

import Link from "next/link";
import type { FeedItem } from "@/lib/queries";
import { fmtDay, timeAgo } from "@/lib/dates";
import { fmtNum } from "@/lib/format";
import { Avatar } from "./avatar";
import { KudosButton } from "./kudos-button";

export function Feed({ items, unit, viewerId, showChallenge }: { items: FeedItem[]; unit?: string; viewerId?: number; showChallenge?: boolean }) {
  if (!items.length) return <p className="px-1 py-6 text-center text-sm text-muted">No sets logged yet. Be the first.</p>;
  return (
    <ul className="divide-y divide-line">
      {items.map((it) => (
        <li key={it.id} className={`flex items-start gap-3 py-3 ${Date.now() - it.created_at < 20_000 ? "animate-[fresh_3s_ease-out]" : ""}`}>
          <Link href={`/u/${it.user.username}`}>
            <Avatar user={it.user} size={34} />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="text-sm">
              <Link href={`/u/${it.user.username}`} className="font-semibold hover:underline">{it.user.display_name}</Link>{" "}
              <span className="text-muted">did</span>{" "}
              <span className="tnum font-semibold">{fmtNum(it.amount)} {it.unit ?? unit}</span>
              {showChallenge && it.challenge_slug && (
                <>
                  {" "}<span className="text-muted">in</span>{" "}
                  <Link href={`/c/${it.challenge_slug}`} className="font-medium hover:underline">{it.challenge_title}</Link>
                </>
              )}
            </div>
            {it.note && <p className="mt-0.5 break-words text-sm text-muted">“{it.note}”</p>}
            <div className="mt-0.5 text-xs text-faint">
              {timeAgo(it.created_at)}
              {" · "}{fmtDay(it.day, { weekday: "short", month: "short", day: "numeric" })}
            </div>
          </div>
          <KudosButton entryId={it.id} count={it.kudos} mine={!!it.mine} disabled={!viewerId || viewerId === it.user.id} />
        </li>
      ))}
    </ul>
  );
}

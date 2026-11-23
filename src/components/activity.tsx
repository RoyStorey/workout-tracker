import Link from "next/link";
import { deleteMessage } from "@/lib/actions/conversation";
import { fmtDay, timeAgo } from "@/lib/dates";
import { cx, fmtNum } from "@/lib/format";
import type { TimelineFilter, TimelineItem } from "@/lib/queries";
import { Avatar } from "./avatar";
import { Composer } from "./composer";
import { ConfirmButton } from "./forms";
import { ReactionBar } from "./reaction-bar";
import { Panel } from "./ui";
import { StreakFlame } from "./streak";

/** The Activity panel: conversation and logged sets in one timeline, with reactions. */
export function Activity({
  challengeId,
  items,
  unit,
  filter,
  filterHref,
  viewer,
  canTalk,
  isOrganizer,
  joinHint,
  streaks,
}: {
  challengeId: number;
  items: TimelineItem[];
  unit: string;
  filter: TimelineFilter;
  filterHref: (f: TimelineFilter) => string;
  viewer?: { id: number; display_name: string };
  canTalk: boolean;
  isOrganizer: boolean;
  joinHint: string;
  /** Live day streak by user id, for flair. */
  streaks: Record<number, number>;
}) {
  const fresh = (t: number) => Date.now() - t < 20_000;
  return (
    <Panel
      flush
      title="Activity"
      actions={
        <div className="flex text-xs font-semibold">
          {(["all", "chat", "sets"] as const).map((f) => (
            <Link key={f} href={filterHref(f)} scroll={false} className={cx("border-b-2 px-2 py-1 capitalize", filter === f ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink")}>
              {f}
            </Link>
          ))}
        </div>
      }
    >
      {canTalk ? (
        <div className="border-b border-line bg-surface-2/30">
          <Composer challengeId={challengeId} />
        </div>
      ) : (
        <p className="border-b border-line px-4 py-3 text-xs text-muted">{joinHint}</p>
      )}
      {items.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted">{filter === "chat" ? "No messages yet. Start the trash talk." : "Nothing here yet."}</p>
      ) : (
        <ul className="max-h-[44rem] divide-y divide-line overflow-auto">
          {items.map((it) => (
            <li key={`${it.type}-${it.id}`} className={cx("px-4 py-3", fresh(it.created_at) && "animate-[fresh_3s_ease-out]")}>
              {it.type === "message" ? (
                <div className="flex gap-2.5">
                  <Link href={`/u/${it.user.username}`} className="shrink-0">
                    <Avatar user={it.user} size={30} streak={streaks[it.user.id]} />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <Link href={`/u/${it.user.username}`} className="truncate text-sm font-semibold hover:underline">{it.user.display_name}</Link>
                      <StreakFlame days={streaks[it.user.id] ?? 0} />
                      <span className="shrink-0 text-[11px] text-faint">{timeAgo(it.created_at)}</span>
                      {(it.user.id === viewer?.id || isOrganizer) && (
                        <span className="ml-auto shrink-0">
                          <ConfirmButton action={deleteMessage.bind(null, it.id)} message="Delete this message?" className="text-[11px] text-faint hover:text-bad">
                            Delete
                          </ConfirmButton>
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap break-words rounded-md bg-surface-2/70 px-3 py-2 text-sm">{it.body}</p>
                    <ReactionBar kind="message" targetId={it.id} reactions={it.reactions} canReact={canTalk} you={viewer?.display_name} />
                  </div>
                </div>
              ) : (
                <div className="flex gap-2.5">
                  <Link href={`/u/${it.user.username}`} className="shrink-0 pt-0.5">
                    <Avatar user={it.user} size={22} />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">
                      <Link href={`/u/${it.user.username}`} className="font-semibold hover:underline">{it.user.display_name}</Link>{" "}
                      <StreakFlame days={streaks[it.user.id] ?? 0} />{" "}
                      <span className="text-muted">logged</span> <span className="tnum font-semibold">{fmtNum(it.amount)} {unit}</span>
                      <span className="text-[11px] text-faint">
                        {" · "}
                        {timeAgo(it.created_at)}
                        {" · "}
                        {fmtDay(it.day, { weekday: "short", month: "short", day: "numeric" })}
                      </span>
                    </div>
                    {it.note && <p className="mt-0.5 break-words text-sm text-muted">“{it.note}”</p>}
                    <ReactionBar kind="entry" targetId={it.id} reactions={it.reactions} canReact={canTalk && it.user.id !== viewer?.id} you={viewer?.display_name} />
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

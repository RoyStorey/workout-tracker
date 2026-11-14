import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, getToday } from "@/lib/auth";
import { activityByDay, entriesForChallenges, getUserByUsername, lifetimeTotals, teamsForUser, visibleChallengesOf } from "@/lib/queries";
import { addDays } from "@/lib/dates";
import { badgesFor, challengeStatus, computeStats, type Badge } from "@/lib/stats";
import { fmtCompact, fmtNum, plural } from "@/lib/format";
import { Avatar } from "@/components/avatar";
import { ChallengeCardView } from "@/components/challenge-card";
import { Heatmap } from "@/components/heatmap";
import { Panel } from "@/components/ui";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props) {
  const { username } = await params;
  const u = getUserByUsername(username);
  return { title: u ? `${u.display_name} (@${u.username})` : "Profile" };
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;
  const u = getUserByUsername(username);
  if (!u) notFound();
  const viewer = await getCurrentUser();
  const today = await getToday();
  const isMe = viewer?.id === u.id;
  const totals = lifetimeTotals("user", u.id);
  const heat = activityByDay(u.id, addDays(today, -7 * 27));
  const challenges = visibleChallengesOf(u.id, viewer?.id);
  const teams = teamsForUser(u.id).filter((t) => t.visibility === "public" || isMe);

  // Badges and streaks across visible challenges
  const entries = entriesForChallenges(challenges.map((c) => c.id));
  const earned = new Map<string, Badge & { count: number }>();
  let bestStreak = 0;
  let wins = 0;
  for (const c of challenges) {
    const ce = entries.filter((e) => e.challenge_id === c.id);
    const totalsByUser = new Map<number, number>();
    for (const e of ce) totalsByUser.set(e.user_id, (totalsByUser.get(e.user_id) ?? 0) + e.amount);
    const ranked = [...totalsByUser.entries()].sort((a, b) => b[1] - a[1]);
    const rank = ranked.findIndex(([id]) => id === u.id) + 1;
    const mine = ce.filter((e) => e.user_id === u.id);
    const s = computeStats(mine, c, c.goal_type === "individual" ? c.target : null, today);
    bestStreak = Math.max(bestStreak, s.longestStreak);
    if (rank === 1 && c.member_count > 1 && challengeStatus(c, today) === "finished") wins++;
    for (const b of badgesFor({ stats: s, goalType: c.goal_type, sharedTarget: c.goal_type === "shared" ? c.target : null, memberCount: c.member_count, rank })) {
      const prev = earned.get(b.id);
      earned.set(b.id, { ...b, count: (prev?.count ?? 0) + 1 });
    }
  }
  const live = challenges.filter((c) => challengeStatus(c, today) !== "finished");
  const past = challenges.filter((c) => challengeStatus(c, today) === "finished");

  return (
    <div className="space-y-6">
      <header className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        <Avatar user={u} size={84} />
        <div className="min-w-0 flex-1">
          <h1 className="display text-5xl uppercase">{u.display_name}</h1>
          <div className="text-sm text-muted">@{u.username} · joined {new Date(u.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</div>
          {u.bio && <p className="mt-2 text-sm">{u.bio}</p>}
          {teams.length > 0 && (
            <div className="mt-2 flex flex-wrap justify-center gap-1.5 sm:justify-start">
              {teams.map((t) => <Link key={t.id} href={`/t/${t.slug}`} className="tag hover:text-ink">{t.name}</Link>)}
            </div>
          )}
        </div>
        {isMe && <Link href="/settings" className="btn-ghost">Edit profile</Link>}
      </header>

      <section className="grid grid-cols-3 divide-x divide-line border-y border-line">
        {([
          [challenges.length, "challenges"],
          [bestStreak, "best streak"],
          [wins, "wins"],
        ] as const).map(([n, label]) => (
          <div key={label} className="py-4 text-center">
            <div className="display text-4xl">{n}</div>
            <div className="eyebrow mt-1">{label}</div>
          </div>
        ))}
      </section>
      <div className="grid items-start gap-6 lg:grid-cols-2">
      <Panel flush title="Lifetime totals">
        {totals.length ? (
          <div className="-mb-px -mr-px grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 [&>*]:border-b [&>*]:border-r [&>*]:border-line">
            {totals.map((t) => (
              <div key={t.exercise_key + t.unit} className="p-4">
                <div className="eyebrow">{t.exercise}</div>
                <div className="mt-1 flex items-baseline gap-1.5"><span className="display text-4xl">{fmtCompact(t.total)}</span> <span className="text-sm text-muted">{t.unit}</span></div>
                <div className="tnum mt-1 text-xs text-muted">{fmtNum(t.sets)} sets · {fmtNum(t.days)} days · best set {fmtNum(t.best_set)}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="p-4 text-sm text-muted">Nothing logged yet.</p>
        )}
      </Panel>
      <Panel title="Activity">
        <Heatmap days={heat} today={today} />
      </Panel>
      </div>
      {earned.size > 0 && (
        <Panel flush title="Badges" actions={<span className="text-xs text-muted">{earned.size} earned</span>}>
          <div className="-mb-px -mr-px grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 [&>*]:border-b [&>*]:border-r [&>*]:border-line">
            {[...earned.values()].map((b) => (
              <div key={b.id} className="flex items-center gap-3 p-3">
                <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden className="shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="9" r="6" />
                  <path d="m8.5 14-1.5 7 5-3 5 3-1.5-7" />
                </svg>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{b.name}{b.count > 1 && <span className="text-muted"> ×{b.count}</span>}</div>
                  <div className="truncate text-xs text-muted">{b.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel title="Challenges" actions={<span className="text-xs text-muted">{plural(challenges.length, "challenge")}</span>}>
        {challenges.length === 0 ? (
          <p className="text-sm text-muted">No visible challenges.</p>
        ) : (
          <div className="space-y-6">
            {live.length > 0 && <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,18rem),1fr))]">{live.map((c) => <ChallengeCardView key={c.id} c={c} today={today} />)}</div>}
            {past.length > 0 && (
              <div>
                <div className="mb-2 text-sm text-muted">Past</div>
                <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,18rem),1fr))]">{past.map((c) => <ChallengeCardView key={c.id} c={c} today={today} />)}</div>
              </div>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}

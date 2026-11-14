import Link from "next/link";
import { getCurrentUser, getTimeZone, getToday, type User } from "@/lib/auth";
import {
  challengesForUser,
  entriesForChallenges,
  friendsFeed,
  publicChallenges,
  siteStats,
  teamsForUser,
} from "@/lib/queries";
import { challengeStatus, computeStats } from "@/lib/stats";
import { fmtCompact, fmtNum, fmtPct, plural } from "@/lib/format";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";
import { ChallengeCardView } from "@/components/challenge-card";
import { Feed } from "@/components/feed";
import { QuickLog } from "@/components/quick-log";
import { Empty, PaceDelta, ProgressBar } from "@/components/ui";
import { FlameIcon } from "@/components/icons";

export default async function Home() {
  const user = await getCurrentUser();
  return user ? <Dashboard user={user} /> : <Landing />;
}

async function Dashboard({ user }: { user: User }) {
  const today = await getToday();
  const mine = challengesForUser(user.id);
  const active = mine.filter((c) => challengeStatus(c, today) === "active");
  const upcoming = mine.filter((c) => challengeStatus(c, today) === "upcoming");
  const finished = mine.filter((c) => challengeStatus(c, today) === "finished");
  const all = entriesForChallenges(active.map((c) => c.id));
  const teams = teamsForUser(user.id);
  const feed = friendsFeed(user.id, 10);
  const tz = await getTimeZone();
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: tz }).format(new Date()));
  const hello = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{hello}, {user.display_name.split(" ")[0]} 👊</h1>
        <p className="text-sm text-muted">
          {active.length ? `You've got ${active.length} live challenge${active.length > 1 ? "s" : ""}. Get after it.` : "Nothing live right now. Start something."}
        </p>
      </div>

      {active.length > 0 ? (
        <section className="grid gap-4 md:grid-cols-2">
          {active.map((c) => {
            const shared = c.goal_type === "shared";
            const ce = all.filter((e) => e.challenge_id === c.id);
            const stats = shared
              ? computeStats(ce, c, c.target, today)
              : computeStats(ce.filter((e) => e.user_id === user.id), c, c.target, today);
            const myToday = ce.filter((e) => e.user_id === user.id && e.day === today).reduce((s, e) => s + e.amount, 0);
            return (
              <div key={c.id} className="card flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/c/${c.slug}`} className="min-w-0 hover:text-accent">
                    <div className="truncate font-semibold">{c.title}</div>
                    <div className="truncate text-xs text-muted">{shared ? "Team goal" : "Your goal"} · {c.exercise}</div>
                  </Link>
                  {stats.currentStreak > 0 && (
                    <span className="pill shrink-0 border-accent/30 text-accent"><FlameIcon size={12} /> {stats.currentStreak}</span>
                  )}
                </div>
                {stats.target ? (
                  <div>
                    <div className="tnum flex items-baseline justify-between text-sm">
                      <span><b className="text-lg">{fmtNum(stats.total)}</b> <span className="text-muted">/ {fmtCompact(stats.target)} {c.unit}</span></span>
                      <span className="font-semibold">{fmtPct(stats.pct ?? 0)}</span>
                    </div>
                    <ProgressBar value={stats.pct ?? 0} className="mt-1.5" />
                    <div className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-xs text-muted">
                      <span>
                        Today: <b className="tnum text-ink">{fmtNum(myToday)}</b>
                        {stats.todayLeft != null && stats.todayLeft > 0 && <> · <b className="tnum text-ink">{fmtNum(Math.ceil(stats.todayLeft))}</b> {shared ? "left for the team" : "to stay on pace"}</>}
                        {stats.todayLeft === 0 && !stats.reached && <span className="text-good"> · on pace ✓</span>}
                      </span>
                      {stats.aheadBy != null && <PaceDelta aheadBy={stats.aheadBy} unit="" />}
                    </div>
                  </div>
                ) : (
                  <div className="tnum text-sm">
                    <b className="text-lg">{fmtNum(stats.total)}</b> <span className="text-muted">{c.unit} {shared ? "as a team" : "so far"} · today {fmtNum(myToday)}</span>
                  </div>
                )}
                <QuickLog
                  compact
                  challengeId={c.id}
                  unit={c.unit}
                  exercise={c.exercise}
                  quickAdds={c.quick_adds.split(",").map(Number).filter((n) => n > 0)}
                  minDay={c.start_date}
                  maxDay={c.end_date}
                  todayLeft={null}
                />
              </div>
            );
          })}
        </section>
      ) : (
        <Empty title="No live challenges" action={{ href: "/challenges/new", label: "Create a challenge" }}>
          Make one and send the link to your friends, or <Link href="/explore" className="text-accent hover:underline">find a public one</Link> to jump into.
        </Empty>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-8">
          {upcoming.length > 0 && (
            <section>
              <div className="h-section mb-3">Coming up</div>
              <div className="grid gap-3 sm:grid-cols-2">{upcoming.map((c) => <ChallengeCardView key={c.id} c={c} today={today} />)}</div>
            </section>
          )}
          {finished.length > 0 && (
            <section>
              <div className="h-section mb-3">Past challenges</div>
              <div className="grid gap-3 sm:grid-cols-2">{finished.slice(0, 6).map((c) => <ChallengeCardView key={c.id} c={c} today={today} />)}</div>
            </section>
          )}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <div className="h-section">Your teams</div>
              <Link href="/teams/new" className="text-sm font-medium text-accent hover:underline">New team</Link>
            </div>
            {teams.length ? (
              <div className="flex flex-wrap gap-2">
                {teams.map((t) => (
                  <Link key={t.id} href={`/t/${t.slug}`} className="card px-4 py-3 text-sm hover:border-accent/50">
                    <div className="font-semibold">{t.name}</div>
                    <div className="text-xs text-muted">{plural(t.member_count, "member")} · {plural(t.challenge_count, "challenge")}</div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">Teams keep your regular crew together across challenges. <Link href="/teams" className="text-accent hover:underline">Find or start one</Link>.</p>
            )}
          </section>
        </div>
        <section className="card h-fit p-4">
          <h3 className="font-semibold">Your crew&apos;s activity</h3>
          <Feed items={feed} viewerId={user.id} showChallenge />
        </section>
      </div>
    </div>
  );
}

async function Landing() {
  const today = await getToday();
  const stats = siteStats();
  const pub = publicChallenges(6);
  return (
    <div className="space-y-14">
      <section className="pt-6 text-center sm:pt-14">
        <div className="pill mx-auto mb-5 border-accent/30 text-accent">Pushups, miles, minutes, anything</div>
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight sm:text-6xl">
          Big goals are easier <span className="text-accent">with a crew.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted">{APP_TAGLINE} {APP_NAME} does the math: what&apos;s left, what you need per day, who&apos;s carrying the team.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/signup" className="btn-primary px-6 py-3 text-base">Start a challenge</Link>
          <Link href="/explore" className="btn-ghost px-6 py-3 text-base">Browse public ones</Link>
        </div>
        <div className="tnum mx-auto mt-10 grid max-w-lg grid-cols-3 gap-3 text-center">
          <div><div className="text-2xl font-bold">{fmtCompact(stats.users)}</div><div className="text-xs text-muted">athletes</div></div>
          <div><div className="text-2xl font-bold">{fmtCompact(stats.challenges)}</div><div className="text-xs text-muted">public challenges</div></div>
          <div><div className="text-2xl font-bold">{fmtCompact(stats.sets)}</div><div className="text-xs text-muted">sets logged</div></div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ["🎯", "Any goal, any timeframe", "5,000 pushups in a month, 100 miles in a quarter, or an open-ended lifetime tally. Every challenge is one exercise, done your way."],
          ["📈", "Stats that keep you honest", "Needed per day, ahead or behind pace, projected finish, streaks, best sets, and a chart of every day."],
          ["🤝", "Solo goals or team goals", "Everyone chases the same number, or the whole crew stacks toward one big total. Public or invite-only."],
        ].map(([icon, title, desc]) => (
          <div key={title} className="card p-5">
            <div className="text-2xl">{icon}</div>
            <div className="mt-2 font-semibold">{title}</div>
            <p className="mt-1 text-sm text-muted">{desc}</p>
          </div>
        ))}
      </section>

      {pub.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div className="h-section">Happening now</div>
            <Link href="/explore" className="text-sm font-medium text-accent hover:underline">See all</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{pub.map((c) => <ChallengeCardView key={c.id} c={c} today={today} />)}</div>
        </section>
      )}
    </div>
  );
}

import Link from "next/link";
import { getCurrentUser, getTimeZone, getToday, type User } from "@/lib/auth";
import {
  challengeSquads,
  challengesForUser,
  entriesForChallenges,
  friendsFeed,
  publicChallenges,
  siteStats,
  teamsForUser,
} from "@/lib/queries";
import { db } from "@/lib/db";
import { challengeStatus, computeStats } from "@/lib/stats";
import { diffDays } from "@/lib/dates";
import { fmtCompact, fmtNum, fmtPct, plural } from "@/lib/format";
import { APP_NAME } from "@/lib/config";
import { ChallengeCardView } from "@/components/challenge-card";
import { Feed } from "@/components/feed";
import { QuickLog } from "@/components/quick-log";
import { LiveUpdates } from "@/components/live-updates";
import { Empty, PaceNote, ProgressBar, SectionHead, SquadDot } from "@/components/ui";

export default async function Home() {
  const user = await getCurrentUser();
  return user ? <Dashboard user={user} /> : <Landing />;
}

const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]}`;

async function Dashboard({ user }: { user: User }) {
  const today = await getToday();
  const tz = await getTimeZone();
  const mine = challengesForUser(user.id);
  const active = mine.filter((c) => challengeStatus(c, today) === "active");
  const upcoming = mine.filter((c) => challengeStatus(c, today) === "upcoming");
  const finished = mine.filter((c) => challengeStatus(c, today) === "finished");
  const all = entriesForChallenges(active.map((c) => c.id));
  const teams = teamsForUser(user.id);
  const feed = friendsFeed(user.id, 12);
  const dateLine = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: tz }).format(new Date());

  return (
    <div className="space-y-10">
      <LiveUpdates ids={[...active, ...upcoming].map((c) => c.id)} />
      <header>
        <div className="eyebrow">{dateLine}</div>
        <h1 className="display mt-1 text-5xl uppercase sm:text-6xl">Today</h1>
      </header>

      {active.length > 0 ? (
        <section className="grid gap-4 md:grid-cols-2">
          {active.map((c) => {
            const shared = c.goal_type === "shared" && c.kind !== "battle";
            const battle = c.kind === "battle";
            const ce = all.filter((e) => e.challenge_id === c.id);
            const myEntries = ce.filter((e) => e.user_id === user.id);
            const stats = shared ? computeStats(ce, c, c.target, today) : computeStats(myEntries, c, battle ? null : c.target, today);
            const myToday = myEntries.filter((e) => e.day === today).reduce((s, e) => s + e.amount, 0);
            const left = shared ? stats.todayLeft : stats.todayLeft;

            // Battle: where does my squad stand?
            let squadLine: React.ReactNode = null;
            if (battle) {
              const squads = challengeSquads(c.id);
              const assign = db().prepare("SELECT user_id, squad_id FROM challenge_members WHERE challenge_id = ?").all(c.id) as { user_id: number; squad_id: number | null }[];
              const sq = new Map(assign.map((a) => [a.user_id, a.squad_id]));
              const scores = squads
                .map((s) => {
                  const n = assign.filter((a) => a.squad_id === s.id).length;
                  const t = ce.filter((e) => sq.get(e.user_id) === s.id).reduce((a, e) => a + e.amount, 0);
                  return { ...s, score: c.scoring === "average" ? t / Math.max(1, n) : t };
                })
                .sort((a, b) => b.score - a.score);
              const mySquadId = sq.get(user.id);
              const rank = scores.findIndex((s) => s.id === mySquadId);
              squadLine =
                rank >= 0 ? (
                  <span className="flex items-center gap-1.5">
                    <SquadDot slot={scores[rank].slot} /> <b>{scores[rank].name}</b> is {ordinal(rank + 1)} of {scores.length}
                    {rank > 0 && (
                      <span className="text-muted">
                        , {fmtNum(scores[rank - 1].score - scores[rank].score, 0)} behind {scores[rank - 1].name}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-bad">Pick a squad to start logging</span>
                );
            }

            return (
              <article key={c.id} className="card flex flex-col">
                <div className="flex items-start justify-between gap-4 p-4 pb-3">
                  <div className="min-w-0">
                    <Link href={`/c/${c.slug}`} className="block truncate text-lg font-bold hover:underline">{c.title}</Link>
                    <div className="truncate text-xs text-muted">
                      {c.exercise} · {battle ? "Squad battle" : shared ? "Team goal" : "Your goal"}
                      {c.end_date && <> · {plural(diffDays(today, c.end_date) + 1, "day")} left</>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="display text-4xl">{fmtNum(myToday)}</div>
                    <div className="eyebrow">today</div>
                  </div>
                </div>
                <div className="px-4 pb-4 text-sm">
                  {battle ? (
                    squadLine
                  ) : stats.target ? (
                    <>
                      <div className="mb-1.5 flex justify-between text-xs text-muted">
                        <span className="tnum">
                          <b className="text-ink">{fmtNum(stats.total)}</b> / {fmtCompact(stats.target)} {c.unit}
                          {shared && " (team)"}
                        </span>
                        <span className="tnum font-semibold text-ink">{fmtPct(stats.pct ?? 0)}</span>
                      </div>
                      <ProgressBar value={stats.pct ?? 0} />
                      <div className="mt-2 text-xs">
                        {stats.reached ? (
                          <span className="font-semibold text-good">Goal hit. Keep stacking.</span>
                        ) : left != null && left > 0 ? (
                          <span className="text-muted">
                            <b className="tnum text-ink">{fmtNum(Math.ceil(left))}</b> more today keeps {shared ? "the team" : "you"} on pace
                            {stats.aheadBy != null && <> · <PaceNote aheadBy={stats.aheadBy} unit="" /></>}
                          </span>
                        ) : (
                          <span className="font-semibold text-good">On pace for today</span>
                        )}
                      </div>
                    </>
                  ) : (
                    <span className="text-muted">
                      <b className="tnum text-ink">{fmtNum(stats.total)}</b> {c.unit} so far
                    </span>
                  )}
                </div>
                <div className="mt-auto border-t border-line bg-surface-2/40 p-3">
                  <QuickLog compact challengeId={c.id} unit={c.unit} quickAdds={c.quick_adds.split(",").map(Number).filter((n) => n > 0)} minDay={c.start_date} maxDay={c.end_date} />
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <Empty title="Nothing live right now" action={{ href: "/challenges/new", label: "Start a challenge" }}>
          Make one and send your friends the link, or <Link href="/explore" className="link">join a public one</Link>.
        </Empty>
      )}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-10">
          {upcoming.length > 0 && (
            <section>
              <SectionHead title="Coming up" />
              <div className="grid gap-3 sm:grid-cols-2">{upcoming.map((c) => <ChallengeCardView key={c.id} c={c} today={today} />)}</div>
            </section>
          )}
          {finished.length > 0 && (
            <section>
              <SectionHead title="Past" />
              <div className="grid gap-3 sm:grid-cols-2">{finished.slice(0, 6).map((c) => <ChallengeCardView key={c.id} c={c} today={today} />)}</div>
            </section>
          )}
          <section>
            <SectionHead title="Your teams">
              <Link href="/teams/new" className="text-sm font-semibold text-muted hover:text-ink">+ New team</Link>
            </SectionHead>
            {teams.length ? (
              <div className="card divide-y divide-line">
                {teams.map((t) => (
                  <Link key={t.id} href={`/t/${t.slug}`} className="flex items-center justify-between px-4 py-3 hover:bg-surface-2/60">
                    <span className="font-semibold">{t.name}</span>
                    <span className="text-xs text-muted">{plural(t.member_count, "member")} · {plural(t.challenge_count, "challenge")}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">
                A team keeps your regular crew together across challenges. <Link href="/teams" className="link">Find or start one</Link>.
              </p>
            )}
          </section>
        </div>
        <section>
          <SectionHead title="Activity" />
          <div className="card px-4">
            <Feed items={feed} viewerId={user.id} showChallenge />
          </div>
        </section>
      </div>
    </div>
  );
}

async function Landing() {
  const today = await getToday();
  const stats = siteStats();
  const order = { active: 0, upcoming: 1, finished: 2 } as const;
  const pub = publicChallenges(30)
    .filter((c) => challengeStatus(c, today) !== "finished")
    .sort((a, b) => order[challengeStatus(a, today)] - order[challengeStatus(b, today)] || b.member_count - a.member_count)
    .slice(0, 6);
  return (
    <div className="space-y-16 sm:space-y-20">
      <section className="pt-4 sm:pt-12">
        <h1 className="display max-w-4xl text-[64px] uppercase sm:text-[104px]">
          Count every rep.
          <br />
          <span className="text-muted">Together.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted">
          Set a goal, send your friends a link, and log as you go. {APP_NAME} keeps the score: what&apos;s left, what you need each day, and who&apos;s carrying the team.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/signup" className="btn-primary h-12 px-6 text-base">Start a challenge</Link>
          <Link href="/explore" className="btn-ghost h-12 px-6 text-base">See what&apos;s live</Link>
        </div>
      </section>

      <section className="grid grid-cols-3 divide-x divide-line border-y border-line">
        {[
          [stats.users, "athletes"],
          [stats.sets, "sets logged"],
          [stats.challenges, "public challenges"],
        ].map(([n, label]) => (
          <div key={label} className="px-2 py-5 text-center sm:px-6">
            <div className="display text-4xl sm:text-5xl">{fmtCompact(n as number)}</div>
            <div className="eyebrow mt-1">{label}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
        {[
          ["01", "Make a challenge", "One exercise, a goal, and dates. 5,000 pushups in November. 100 miles by spring. Or no end at all."],
          ["02", "Send the link", "Friends sign up with a username and password and they're in. Public, or private with an invite link."],
          ["03", "Log and compete", "Tap +25 after every set. Standings, pace, streaks and charts update for everyone."],
        ].map(([n, title, body]) => (
          <div key={n} className="bg-surface p-6">
            <div className="display text-3xl text-faint">{n}</div>
            <div className="mt-3 font-bold">{title}</div>
            <p className="mt-1 text-sm text-muted">{body}</p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-6 rounded-lg bg-primary p-6 text-primary-ink sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="max-w-xl">
          <div className="display text-4xl uppercase">Squad battles</div>
          <p className="mt-2 opacity-75">
            Running a unit, a gym or an office? Split everyone into squads and let them fight it out for a month. Score by total, or by average per member so uneven squads stay fair.
          </p>
        </div>
        <Link href="/signup?next=/challenges/new" className="btn h-12 shrink-0 bg-primary-ink px-6 text-base text-primary hover:opacity-90">Set one up</Link>
      </section>

      {pub.length > 0 && (
        <section>
          <SectionHead title="Live now">
            <Link href="/explore" className="text-sm font-semibold text-muted hover:text-ink">See all →</Link>
          </SectionHead>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{pub.map((c) => <ChallengeCardView key={c.id} c={c} today={today} />)}</div>
        </section>
      )}
    </div>
  );
}

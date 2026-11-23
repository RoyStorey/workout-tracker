import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser, getToday } from "@/lib/auth";
import {
  canViewChallenge,
  challengeEntries,
  challengeTimeline,
  type TimelineFilter,
  challengeMembers,
  challengeSquads,
  challengeSlugForAlias,
  getChallengeBySlug,
  streaksFor,
  teamsForUser,
} from "@/lib/queries";
import { computeStats, type Stats } from "@/lib/stats";
import { addDays, diffDays, fmtDay, fmtRange, weekday } from "@/lib/dates";
import { cx, fmtCompact, fmtNum, fmtPct, plural } from "@/lib/format";
import {
  createSquad,
  deleteEntry,
  enterTeam,
  withdrawTeam,
  joinChallenge,
  leaveChallenge,
  regenerateChallengeInvite,
  removeMember,
  setSquad,
} from "@/lib/actions/challenges";
import { db } from "@/lib/db";
import { Avatar } from "@/components/avatar";
import { BattleChart } from "@/components/battle-chart";
import { ConfirmButton, SubmitButton } from "@/components/forms";
import { CopyLink } from "@/components/copy-link";
import { Activity } from "@/components/activity";
import { ProgressChart } from "@/components/progress-chart";
import { QuickLog } from "@/components/quick-log";
import { PaceNote, Panel, ProgressBar, SquadDot, Stat, StatusTag, squadColor } from "@/components/ui";
import { TrashIcon } from "@/components/icons";
import { LiveUpdates } from "@/components/live-updates";
import { Spreadsheet } from "@/components/spreadsheet";
import { StreakFlame } from "@/components/streak";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ k?: string; board?: string; feed?: string }> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { k } = await searchParams;
  const c = getChallengeBySlug(slug);
  const user = await getCurrentUser();
  if (!c || !canViewChallenge(c, user?.id, k)) return { title: "Challenge" };
  return { title: c.title, description: `${c.exercise} · ${fmtRange(c.start_date, c.end_date)}` };
}

type Period = "all" | "week" | "today";

export default async function ChallengePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { k, board, feed: feedParam } = await searchParams;
  const c = getChallengeBySlug(slug);
  if (!c) {
    const current = challengeSlugForAlias(slug);
    if (current) {
      const q = new URLSearchParams(Object.entries({ k, board, feed: feedParam }).filter(([, v]) => v) as [string, string][]).toString();
      permanentRedirect(`/c/${current}${q ? `?${q}` : ""}`);
    }
  }
  const user = await getCurrentUser();
  if (!c || !canViewChallenge(c, user?.id, k)) notFound();
  const feedFilter: TimelineFilter = feedParam === "chat" || feedParam === "sets" ? feedParam : "all";

  const today = await getToday();
  const members = challengeMembers(c.id);
  const entries = challengeEntries(c.id);
  const teamsMode = c.kind === "teams";
  const battle = c.kind === "battle" || teamsMode; // any group-vs-group format
  const squads = battle ? challengeSquads(c.id) : [];
  const groupWord = teamsMode ? "team" : "squad";
  // Past 8 groups, colour can't carry identity reliably, so fall back to one neutral hue.
  const many = squads.length > 8;
  const colorOf = (slot: number) => (many ? "var(--series-1)" : squadColor(slot));
  const shared = c.goal_type === "shared" && !battle;
  const me = user ? members.find((m) => m.id === user.id) : undefined;
  const isMember = !!me;
  const isOwner = !!user && c.owner_id === user.id;
  const memberCount = Math.max(1, members.length);
  const groupTarget = c.target ? (shared ? c.target : c.target * memberCount) : null;
  const group = computeStats(entries, c, groupTarget, today);

  const byUser = new Map<number, typeof entries>();
  for (const e of entries) byUser.set(e.user_id, [...(byUser.get(e.user_id) ?? []), e]);
  const personal = members.map((m) => ({ user: m, stats: computeStats(byUser.get(m.id) ?? [], c, shared || battle ? null : c.target, today) }));
  const mine = personal.find((p) => p.user.id === user?.id);

  // Period filter for the standings
  const period: Period = board === "week" || board === "today" ? board : "all";
  const weekStart = addDays(today, -((weekday(today) + 6) % 7)); // Monday
  const inPeriod = (day: string) => (period === "all" ? true : period === "today" ? day === today : day >= weekStart && day <= today);
  const periodTotal = (uid: number) => (byUser.get(uid) ?? []).filter((e) => inPeriod(e.day)).reduce((s, e) => s + e.amount, 0);
  const rows = personal
    .map((p) => ({ ...p, total: periodTotal(p.user.id) }))
    .sort((a, b) => b.total - a.total || b.stats.total - a.stats.total);

  // Battle scoreboard
  const squadOf = new Map(members.map((m) => [m.id, m.squad_id]));
  const average = c.scoring === "average";
  const board_ = squads
    .map((s) => {
      const ms = members.filter((m) => m.squad_id === s.id);
      const es = entries.filter((e) => squadOf.get(e.user_id) === s.id);
      const total = es.reduce((a, e) => a + e.amount, 0);
      const todayTotal = es.filter((e) => e.day === today).reduce((a, e) => a + e.amount, 0);
      return { ...s, members: ms, entries: es, total, todayTotal, score: average ? total / Math.max(1, ms.length) : total };
    })
    .sort((a, b) => b.score - a.score);
  const mySquad = me?.squad_id ? board_.find((s) => s.id === me.squad_id) : undefined;
  const unassigned = battle ? members.filter((m) => !m.squad_id) : [];

  const focus: Stats = !shared && !battle && mine ? mine.stats : group;
  const canLog = isMember && group.status !== "upcoming" && (!battle || !!mySquad);
  const timeline = challengeTimeline(c.id, user?.id, feedFilter, 40);
  // Everyone's live day streak (across all challenges) for flair next to their name.
  const streakMap = streaksFor([...members.map((m) => m.id), ...timeline.map((t) => t.user.id)], today);
  const streakOf = (id: number) => streakMap.get(id)?.current ?? 0;
  const pageHref = (extra: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const all = { k, board, feed: feedFilter === "all" ? undefined : feedFilter, ...extra };
    for (const [key, v] of Object.entries(all)) if (v) q.set(key, v);
    const qs = q.toString();
    return `/c/${c.slug}${qs ? `?${qs}` : ""}`;
  };
  const myRecent = mine ? [...(byUser.get(mine.user.id) ?? [])].reverse().slice(0, 20) : [];
  const invitePath = c.visibility === "private" ? `/join/${c.invite_code}` : `/c/${c.slug}`;
  const owner = c.owner_id ? (db().prepare("SELECT username, display_name FROM users WHERE id = ?").get(c.owner_id) as { username: string; display_name: string } | undefined) : undefined;
  const team = c.team_id ? (db().prepare("SELECT name, slug FROM teams WHERE id = ?").get(c.team_id) as { name: string; slug: string } | undefined) : undefined;
  // Reaching this page already passed the access check, so anyone here may join.
  const canJoin = !isMember;
  const myTeams = user && teamsMode ? teamsForUser(user.id) : [];
  const entered = new Set(squads.map((s) => s.team_id));
  const joinable = teamsMode ? board_.filter((s) => myTeams.some((t) => t.id === s.team_id)) : [];
  const enterable = teamsMode && group.status !== "finished" ? myTeams.filter((t) => t.owner_id === user?.id && !entered.has(t.id)) : [];
  const unit = c.unit;

  const timeLine =
    group.status === "upcoming"
      ? `Starts in ${plural(diffDays(today, c.start_date), "day")}`
      : group.status === "active" && c.end_date
        ? `${plural(diffDays(today, c.end_date) + 1, "day")} left`
        : group.status === "active"
          ? "Ongoing"
          : "Finished";

  const goalLine = battle
    ? `${teamsMode ? "Team vs team" : "Squad battle"} · most ${unit}${average ? " per member" : ""} wins`
    : c.target
      ? `${fmtNum(c.target)} ${unit} ${shared ? "together" : "each"}`
      : `Most ${unit} wins`;

  return (
    <div className="space-y-8">
      <LiveUpdates ids={[c.id]} inviteKey={k} renderedAt={Date.now()} />
      {/* ---------- Header ---------- */}
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <StatusTag status={group.status} reached={!battle && !!groupTarget && group.reached} />
          {battle && <span className="tag">{teamsMode ? "Team vs team" : "Squad battle"}</span>}
          {c.visibility === "private" && <span className="tag">Private</span>}
          {team && <Link href={`/t/${team.slug}`} className="tag hover:border-ink hover:text-ink">{team.name}</Link>}
        </div>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="display text-5xl uppercase sm:text-6xl">{c.title}</h1>
            <p className="mt-2 text-muted">
              <span className="font-semibold text-ink">{c.exercise}</span> · {goalLine} · {fmtRange(c.start_date, c.end_date)} · {timeLine}
            </p>
            {owner && (
              <p className="mt-1 text-xs text-faint">
                Organized by <Link href={`/u/${owner.username}`} className="hover:text-ink">{owner.display_name}</Link>
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {(isMember || isOwner) && <CopyLink path={invitePath} label={c.visibility === "private" ? "Invite" : "Share"} />}
            {isOwner && <Link href={`/c/${c.slug}/edit`} className="btn-ghost">Edit</Link>}
          </div>
        </div>
        {c.description && <p className="mt-4 max-w-2xl whitespace-pre-line text-sm text-muted">{c.description}</p>}
      </header>

      {/* ---------- Join ---------- */}
      {canJoin && !battle && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-primary p-5 text-primary-ink">
          <div>
            <div className="display text-2xl uppercase">Get in on this</div>
            <div className="text-sm opacity-75">{plural(members.length, "person", "people")} in so far. {user ? "" : "Takes ten seconds to sign up."}</div>
          </div>
          <form action={joinChallenge.bind(null, c.id, k ?? null, null)}>
            <SubmitButton className="btn h-11 bg-primary-ink px-6 text-primary hover:opacity-90">{user ? "Join challenge" : "Sign up & join"}</SubmitButton>
          </form>
        </div>
      )}
      {teamsMode && !mySquad && (
        <section className="card p-5">
          <div className="display text-2xl uppercase">{joinable.length ? "Compete for your team" : "Get your team in"}</div>
          <p className="text-sm text-muted">
            {!user
              ? "Sign up, join a team, then your team's leader enters it here."
              : `${plural(squads.length, "team")} entered so far. Team leaders enter their whole team; members of entered teams can compete.`}
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {joinable.map((s) => (
              <form key={s.id} action={joinChallenge.bind(null, c.id, k ?? null, s.id)}>
                <button className="flex w-full items-center gap-3 rounded-md border border-line-strong p-3 text-left transition hover:border-ink">
                  {!many && <SquadDot slot={s.slot} size={14} />}
                  <span className="flex-1 font-semibold">{s.name}</span>
                  <span className="text-sm font-semibold">Compete →</span>
                </button>
              </form>
            ))}
            {enterable.map((t) => (
              <form key={t.id} action={enterTeam.bind(null, c.id, t.id, k ?? null)}>
                <button className="flex w-full items-center gap-3 rounded-md bg-primary p-3 text-left text-primary-ink transition hover:opacity-90">
                  <span className="flex-1">
                    <span className="block font-semibold">Enter {t.name}</span>
                    <span className="block text-xs opacity-75">Signs up all {plural(t.member_count, "member")} of your team</span>
                  </span>
                  <span className="text-sm font-semibold">→</span>
                </button>
              </form>
            ))}
          </div>
          {!user ? (
            <Link href={`/signup?next=${encodeURIComponent(`/c/${c.slug}${k ? `?k=${k}` : ""}`)}`} className="btn-primary mt-2">Sign up</Link>
          ) : (
            joinable.length === 0 &&
            enterable.length === 0 && (
              <p className="mt-1 text-sm">
                None of your teams are in this one.{" "}
                <Link href="/teams" className="link">Start or join a team</Link>, and if you lead it, come back here to enter it.
              </p>
            )
          )}
        </section>
      )}
      {c.kind === "battle" && (canJoin || (isMember && !mySquad)) && (
        <section className="card p-5">
          <div className="display text-2xl uppercase">Pick your squad</div>
          <p className="text-sm text-muted">{user ? "Your reps count toward the squad you join." : "You'll sign up first, then land back here."}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {squads.map((s) => (
              <form key={s.id} action={joinChallenge.bind(null, c.id, k ?? null, s.id)}>
                <button className="flex w-full items-center gap-3 rounded-md border border-line-strong p-3 text-left transition hover:border-ink">
                  <SquadDot slot={s.slot} size={14} />
                  <span className="flex-1 font-semibold">{s.name}</span>
                  <span className="text-xs text-muted">{plural(members.filter((m) => m.squad_id === s.id).length, "member")}</span>
                  <span className="text-sm font-semibold">Join →</span>
                </button>
              </form>
            ))}
          </div>
          {user && (c.open_squads || isOwner) && squads.length < 8 && (
            <form action={createSquad.bind(null, c.id, k ?? null)} className="mt-3 flex gap-2">
              <input name="name" className="input h-10 text-sm" placeholder="Or start a new squad" maxLength={30} required />
              <input type="hidden" name="join" value="on" />
              <SubmitButton className="btn-ghost h-10 shrink-0">Create & join</SubmitButton>
            </form>
          )}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          {/* ---------- Status + log ---------- */}
          {battle ? (
            <section className="card overflow-hidden">
              <div className="flex min-h-12 items-center justify-between gap-3 border-b border-line bg-surface-2/40 px-4 py-2.5">
                <h2 className="display text-xl uppercase">Scoreboard</h2>
                <span className="text-xs text-muted">{average ? `${unit} per member` : `total ${unit}`}</span>
              </div>
              {board_.length === 0 ? (
                <p className="p-5 text-sm text-muted">{teamsMode ? "No teams have entered yet. Send the link to team leaders." : "No squads yet."}</p>
              ) : (
                <ol>
                  {board_.map((s, i) => {
                    const lead = board_[0].score || 1;
                    return (
                      <li key={s.id} className={cx("border-b border-line px-5 py-4 last:border-0", s.id === mySquad?.id && "bg-surface-2/60")}>
                        <div className="flex items-center gap-3">
                          <span className="display w-6 text-2xl text-faint">{i + 1}</span>
                          {!many && <SquadDot slot={s.slot} size={12} />}
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-semibold">
                              {s.team_slug ? <Link href={`/t/${s.team_slug}`} className="hover:underline">{s.name}</Link> : s.name}
                              {s.id === mySquad?.id && <span className="ml-2 text-xs font-semibold text-muted">Your {groupWord}</span>}
                            </div>
                            <div className="text-xs text-muted">
                              {plural(s.members.length, "member")}
                              {group.status === "active" && <> · {fmtNum(s.todayTotal)} today</>}
                              {average && <> · {fmtNum(s.total)} total</>}
                              {teamsMode && s.entries.length === 0 && (s.team_owner === user?.id || isOwner) && (
                                <>
                                  {" · "}
                                  <ConfirmButton action={withdrawTeam.bind(null, c.id, s.id)} message={`Withdraw ${s.name}? Its members will be taken out of this challenge.`} className="inline underline underline-offset-2 hover:text-bad">
                                    Withdraw
                                  </ConfirmButton>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="display text-4xl">{fmtNum(s.score, average ? 1 : 0)}</div>
                        </div>
                        <div className="mt-3 pl-9">
                          <ProgressBar value={s.score / lead} color={colorOf(s.slot)} />
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
              {board_.length > 1 && board_[0].score > 0 && (
                <div className="border-t border-line px-5 py-3 text-sm">
                  <b>{board_[0].name}</b> {group.status === "finished" ? "won" : "leads"} by{" "}
                  <b className="tnum">{fmtNum(board_[0].score - board_[1].score, average ? 1 : 0)}</b> {unit}
                  {average ? " per member" : ""} over {board_[1].name}.
                </div>
              )}
              {canLog && (
                <div className="border-t border-line bg-surface-2/40 px-5 py-4">
                  <div className="mb-3 text-sm">
                    Logging for <SquadDot slot={mySquad!.slot} /> <b>{mySquad!.name}</b> · you&apos;ve done <b className="tnum">{fmtNum(mine?.stats.total ?? 0)}</b> {unit}
                    {group.status === "active" && <>, <b className="tnum">{fmtNum(mine?.stats.todayTotal ?? 0)}</b> today</>}
                  </div>
                  <LogBox c={c} />
                </div>
              )}
            </section>
          ) : (
            <section className="card overflow-hidden">
              <div className="p-5">
                <div className="eyebrow">{shared ? "Team total" : mine ? "Your progress" : "Everyone combined"}</div>
                <div className="mt-2 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="display text-6xl sm:text-7xl">{fmtNum(focus.total)}</span>
                    <span className="text-lg font-semibold text-muted">
                      {focus.target ? `/ ${fmtNum(focus.target)} ` : ""}
                      {unit}
                    </span>
                  </div>
                  {focus.pct != null && <span className="display text-4xl text-muted">{fmtPct(focus.pct)}</span>}
                </div>
                {focus.target != null && (
                  <div className="relative mt-4">
                    <ProgressBar value={focus.pct ?? 0} className="h-3" />
                    {focus.status === "active" && focus.aheadBy != null && focus.totalDays && (
                      <span
                        title="Where an even pace would put you"
                        className="absolute -top-1 h-5 w-0.5 bg-ink"
                        style={{ left: `${Math.min(100, ((focus.total - focus.aheadBy) / focus.target) * 100)}%` }}
                      />
                    )}
                  </div>
                )}
                <p className="mt-3 text-sm text-muted">
                  {group.status === "upcoming" ? (
                    <>Kicks off {fmtDay(c.start_date, { weekday: "long", month: "long", day: "numeric" })}. Logging opens then.</>
                  ) : focus.target == null ? (
                    <>
                      {fmtNum(focus.avgPerDay, 0)} a day on average · best day {fmtNum(focus.bestDay?.amount ?? 0)}
                      {focus.currentStreak > 1 && <> · {focus.currentStreak}-day streak</>}
                    </>
                  ) : focus.reached ? (
                    <span className="font-semibold text-good">
                      Goal hit{focus.finishDay ? ` on ${fmtDay(focus.finishDay)}` : ""}. {focus.status === "active" ? "Everything from here is bonus." : ""}
                    </span>
                  ) : focus.status === "finished" ? (
                    <>Finished {fmtNum(focus.remaining!)} short.</>
                  ) : (
                    <>
                      {focus.aheadBy != null && <PaceNote aheadBy={focus.aheadBy} unit={unit} />} · <b className="text-ink">{fmtNum(focus.remaining!)}</b> to go ·{" "}
                      <b className="text-ink">{fmtNum(Math.ceil(focus.perDayNeeded ?? 0))}</b> a day finishes it
                    </>
                  )}
                </p>
              </div>
              {canLog && (
                <div className="border-t border-line bg-surface-2/40 px-5 py-4">
                  <div className="mb-3 flex flex-wrap justify-between gap-2 text-sm">
                    <span>
                      Today: <b className="tnum">{fmtNum(shared ? group.todayTotal : (mine?.stats.todayTotal ?? 0))}</b> {unit}
                      {shared && mine && <span className="text-muted"> (you: {fmtNum(mine.stats.todayTotal)})</span>}
                    </span>
                    {(() => {
                      const left = shared ? group.todayLeft : mine?.stats.todayLeft;
                      if (left == null) return null;
                      return left > 0 ? (
                        <span className="text-muted">
                          <b className="tnum text-ink">{fmtNum(Math.ceil(left))}</b> more keeps {shared ? "the team" : "you"} on pace
                        </span>
                      ) : (
                        <span className="font-semibold text-good">On pace for today</span>
                      );
                    })()}
                  </div>
                  <LogBox c={c} />
                </div>
              )}
            </section>
          )}

          {/* ---------- Standings ---------- */}
          <Panel
            flush
            title={battle ? "Top athletes" : "Standings"}
            actions={
              <div className="flex text-xs font-semibold">
                {(["all", "week", "today"] as const).map((p) => (
                  <Link
                    key={p}
                    scroll={false}
                    href={pageHref({ board: p === "all" ? undefined : p })}
                    className={cx("border-b-2 px-2.5 py-1", period === p ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink")}
                  >
                    {p === "all" ? "All time" : p === "week" ? "This week" : "Today"}
                  </Link>
                ))}
              </div>
            }
          >
            {rows.length === 0 ? (
              <p className="p-4 text-sm text-muted">No one has joined yet.</p>
            ) : (
              <ol className="max-h-[36rem] divide-y divide-line overflow-auto">
                {rows.map((r, i) => {
                  const sq = battle ? squads.find((s) => s.id === r.user.squad_id) : undefined;
                  const pct = !shared && !battle && c.target ? r.stats.total / c.target : null;
                  return (
                    <li key={r.user.id} className={cx("flex items-center gap-3 px-4 py-3", r.user.id === user?.id && "bg-surface-2/60")}>
                      <span className={cx("display w-6 text-center text-xl", i === 0 && r.total > 0 ? "text-ink" : "text-faint")}>{i + 1}</span>
                      <Avatar user={r.user} size={32} streak={streakOf(r.user.id)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <Link href={`/u/${r.user.username}`} className="truncate font-semibold hover:underline">
                            {r.user.display_name}
                          </Link>
                          <StreakFlame days={streakOf(r.user.id)} />
                          {r.user.id === user?.id && <span className="text-xs font-medium text-muted">you</span>}
                        </div>
                        <div className="flex items-center gap-1.5 truncate text-xs text-muted">
                          {sq && (
                            <>
                              <SquadDot slot={sq.slot} size={8} /> {sq.name}
                            </>
                          )}

                          {pct != null && pct >= 1 && <span className="font-semibold text-good"> · Done</span>}
                        </div>
                        {pct != null && period === "all" && <ProgressBar value={pct} className="mt-1.5 h-1" />}
                      </div>
                      <div className="text-right">
                        <div className="display text-2xl">{fmtNum(r.total)}</div>
                        {period === "all" && shared && group.total > 0 && <div className="text-xs text-muted">{fmtPct(r.stats.total / group.total)} of team</div>}
                        {period === "all" && pct != null && <div className="text-xs text-muted">{fmtPct(pct)}</div>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Panel>

          {/* ---------- Chart ---------- */}
          {group.series.length > 1 && group.status !== "upcoming" && (
            <Panel title={battle ? (many ? "Race · top 5" : "Race") : "Progress"}>
              <div>
                {battle ? (
                  <BattleChart
                    days={group.series.map((p) => p.day)}
                    unit={unit}
                    today={today}
                    average={average}
                    lines={(many ? board_.slice(0, 5) : board_).map((s, idx) => {
                      const firstDay = group.series[0].day;
                      let run = s.entries.filter((e) => e.day < firstDay).reduce((a, e) => a + e.amount, 0);
                      const perDay = new Map<string, number>();
                      for (const e of s.entries) perDay.set(e.day, (perDay.get(e.day) ?? 0) + e.amount);
                      const div = average ? Math.max(1, s.members.length) : 1;
                      return {
                        id: s.id,
                        name: s.name,
                        slot: many ? idx : s.slot,
                        values: group.series.map((p) => {
                          if (p.cumulative == null) return null;
                          run += perDay.get(p.day) ?? 0;
                          return run / div;
                        }),
                      };
                    })}
                  />
                ) : (
                  <ProgressChart
                    series={focus.series}
                    target={focus.target}
                    unit={unit}
                    today={today}
                    dailyRef={focus.perDayNeeded ?? focus.basePace}
                    title={shared ? "Team total vs. even pace" : mine ? "Your total vs. even pace" : "Combined total"}
                  />
                )}
              </div>
            </Panel>
          )}

          {/* ---------- Numbers ---------- */}
          {group.status !== "upcoming" && (
            <Panel flush title={mine && !shared ? "Your numbers" : "By the numbers"}>
              <NumbersGrid s={battle && mine ? mine.stats : focus} unit={unit} />
            </Panel>
          )}

          {group.daysElapsed > 0 && members.length > 0 && (
            <Spreadsheet
              entries={entries}
              members={members}
              squads={squads}
              start={c.start_date}
              end={c.end_date}
              today={today}
              unit={unit}
              exportHref={(t) => `/c/${c.slug}/export?type=${t}${k ? `&k=${encodeURIComponent(k)}` : ""}`}
            />
          )}

          {myRecent.length > 0 && (
            <Panel flush title="Your sets" actions={<span className="text-xs text-muted">Logged something wrong? Delete it here.</span>}>
              <ul className="max-h-72 divide-y divide-line overflow-auto text-sm">
                {myRecent.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-2">
                    <span className="tnum w-24 font-semibold">{fmtNum(e.amount)} {unit}</span>
                    <span className="min-w-0 flex-1 truncate text-muted">{e.note}</span>
                    <span className="text-xs text-faint">{fmtDay(e.day)}</span>
                    <form action={deleteEntry.bind(null, e.id)}>
                      <button className="rounded p-1.5 text-faint hover:bg-surface-2 hover:text-bad" aria-label={`Delete ${e.amount} ${unit} on ${e.day}`}>
                        <TrashIcon size={15} />
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        {/* ---------- Sidebar ---------- */}
        <aside className="min-w-0 space-y-6">
          <Activity
            challengeId={c.id}
            items={timeline}
            unit={unit}
            filter={feedFilter}
            filterHref={(f) => pageHref({ feed: f === "all" ? undefined : f })}
            viewer={user ? { id: user.id, display_name: user.display_name } : undefined}
            canTalk={isMember || isOwner}
            isOrganizer={isOwner}
            joinHint={user ? "Join the challenge to chat and react." : "Log in and join to chat and react."}
            streaks={Object.fromEntries([...streakMap].map(([id, st]) => [id, st.current]))}
          />

          {teamsMode && mySquad && enterable.length > 0 && (
            <Panel title="Your other teams">
              <div className="space-y-2">
                {enterable.map((t) => (
                  <form key={t.id} action={enterTeam.bind(null, c.id, t.id, k ?? null)}>
                    <SubmitButton className="btn-ghost h-9 w-full text-xs">Enter {t.name}</SubmitButton>
                  </form>
                ))}
              </div>
            </Panel>
          )}

          {isOwner && (
            <Panel flush title="Organizer">
              <div className="divide-y divide-line">
                <div className="flex flex-wrap gap-2 p-4">
                  <Link href={`/c/${c.slug}/edit`} className="btn-ghost h-9 flex-1 text-xs">Edit challenge</Link>
                  <CopyLink path={invitePath} label={c.visibility === "private" ? "Copy invite link" : "Copy link"} className="btn-ghost h-9 flex-1 text-xs" />
                </div>
                <div className="px-4 py-3 text-xs text-muted">
                  {plural(members.length, "person", "people")} in · {c.visibility === "public" ? "Public: anyone can find and join it on Explore." : "Private: only people with the link can see it."}
                </div>
                {c.kind === "battle" && members.length > 0 && (
                  <div className="p-4">
                    <div className="mb-2 text-sm font-semibold">Squad assignments</div>
                    {unassigned.length > 0 && <p className="mb-2 text-xs text-bad">{plural(unassigned.length, "person", "people")} without a squad.</p>}
                    <ul className="space-y-2">
                      {members.map((m) => (
                        <li key={m.id}>
                          <form action={setSquad.bind(null, c.id, m.id)} className="flex items-center gap-2">
                            <span className="min-w-0 flex-1 truncate text-sm">{m.display_name}</span>
                            <select name="squad_id" defaultValue={m.squad_id ?? ""} className="input h-8 w-32 px-2 text-xs">
                              <option value="">No squad</option>
                              {squads.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                            <SubmitButton className="btn-ghost h-8 px-2 text-xs" pendingText="…">Move</SubmitButton>
                          </form>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {c.kind === "battle" && squads.length < 8 && (
                  <form action={createSquad.bind(null, c.id, k ?? null)} className="flex gap-2 p-4">
                    <input name="name" className="input h-9 text-sm" placeholder="New squad name" maxLength={30} required />
                    <SubmitButton className="btn-ghost h-9 shrink-0 text-xs">Add</SubmitButton>
                  </form>
                )}
                {c.visibility === "private" && (
                  <div className="p-4 text-sm text-muted">
                    Anyone with the invite link can view and join.
                    <form action={regenerateChallengeInvite.bind(null, c.id)} className="mt-2">
                      <SubmitButton className="btn-ghost h-9 w-full text-xs">Reset invite link</SubmitButton>
                    </form>
                  </div>
                )}
                {members.filter((m) => m.id !== user!.id).length > 0 && (
                  <details className="p-4">
                    <summary className="cursor-pointer text-sm font-semibold">Remove someone</summary>
                    <ul className="mt-2 space-y-2">
                      {members.filter((m) => m.id !== user!.id).map((m) => (
                        <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="flex min-w-0 items-center gap-2 truncate"><Avatar user={m} size={20} /> {m.display_name}</span>
                          <ConfirmButton action={removeMember.bind(null, c.id, m.id)} message={`Remove ${m.display_name}? Their sets here will be deleted.`} className="text-xs font-semibold text-bad hover:underline">
                            Remove
                          </ConfirmButton>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </Panel>
          )}

          {isMember && !isOwner && (
            <ConfirmButton action={leaveChallenge.bind(null, c.id)} message="Leave this challenge? Your sets here will be deleted." className="text-xs text-muted underline-offset-2 hover:text-bad hover:underline">
              Leave this challenge
            </ConfirmButton>
          )}
        </aside>
      </div>
    </div>
  );
}

function LogBox({ c }: { c: { id: number; unit: string; exercise: string; quick_adds: string; start_date: string; end_date: string | null } }) {
  return (
    <QuickLog
      challengeId={c.id}
      unit={c.unit}
      exercise={c.exercise}
      quickAdds={c.quick_adds.split(",").map(Number).filter((n) => n > 0)}
      minDay={c.start_date}
      maxDay={c.end_date}
    />
  );
}

function NumbersGrid({ s, unit }: { s: Stats; unit: string }) {
  const cells: [string, React.ReactNode, React.ReactNode?][] = [
    ["Avg per day", fmtNum(s.avgPerDay, 0), unit],
    ["Best day", fmtNum(s.bestDay?.amount ?? 0), s.bestDay ? fmtDay(s.bestDay.day) : "—"],
    ["Best set", fmtNum(s.bestSet), unit],
    ["Streak", `${s.currentStreak}d`, `longest ${s.longestStreak}d`],
    ["Sets", fmtNum(s.sets), `avg ${fmtNum(s.avgSet)} ${unit}`],
    ["Active days", fmtNum(s.activeDays), `of ${fmtNum(s.daysElapsed)} so far`],
    ...(s.projectedTotal != null ? ([["Projected", fmtCompact(Math.round(s.projectedTotal)), "at this pace"]] as [string, React.ReactNode, React.ReactNode][]) : []),
    ...(s.finishDay && !s.reached && s.target ? ([["Finish date", fmtDay(s.finishDay), "at this pace"]] as [string, React.ReactNode, React.ReactNode][]) : []),
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4">
      {cells.map(([label, value, sub], i) => (
        <div key={label} className={cx("border-line p-4", i % 2 === 1 && "border-l", i >= 2 && "border-t", "sm:border-l sm:border-t-0", i % 4 === 0 && "sm:border-l-0", i >= 4 && "sm:border-t")}>
          <Stat label={label} value={value} sub={sub} />
        </div>
      ))}
    </div>
  );
}

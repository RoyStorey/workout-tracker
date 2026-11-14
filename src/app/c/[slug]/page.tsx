import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser, getToday } from "@/lib/auth";
import {
  canViewChallenge,
  challengeEntries,
  challengeFeed,
  challengeMembers,
  getChallengeBySlug,
  isTeamMember,
  type PublicUser,
} from "@/lib/queries";
import { badgesFor, computeStats, type Stats } from "@/lib/stats";
import { addDays, diffDays, eachDay, fmtDay, fmtRange, weekday } from "@/lib/dates";
import { cx, fmtCompact, fmtNum, fmtPct, plural } from "@/lib/format";
import {
  deleteEntry,
  joinChallenge,
  leaveChallenge,
  regenerateChallengeInvite,
  removeMember,
} from "@/lib/actions/challenges";
import { db } from "@/lib/db";
import { Avatar, UserChip } from "@/components/avatar";
import { ConfirmButton, SubmitButton } from "@/components/forms";
import { CopyLink } from "@/components/copy-link";
import { Feed } from "@/components/feed";
import { ProgressChart } from "@/components/progress-chart";
import { QuickLog } from "@/components/quick-log";
import { PaceDelta, ProgressBar, ProgressRing, StatTile, StatusPill, VisibilityPill } from "@/components/ui";
import { CalendarIcon, FlameIcon, SettingsIcon, TrashIcon } from "@/components/icons";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ k?: string; board?: string }> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { k } = await searchParams;
  const c = getChallengeBySlug(slug);
  const user = await getCurrentUser();
  if (!c || !canViewChallenge(c, user?.id, k)) return { title: "Challenge" };
  const goal = c.target ? `${fmtNum(c.target)} ${c.unit} ${c.goal_type === "individual" ? "each" : "together"}` : `${c.exercise}`;
  return { title: c.title, description: `${goal} · ${fmtRange(c.start_date, c.end_date)}` };
}

type Period = "all" | "week" | "today";

export default async function ChallengePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { k, board } = await searchParams;
  const c = getChallengeBySlug(slug);
  const user = await getCurrentUser();
  if (!c || !canViewChallenge(c, user?.id, k)) notFound();

  const today = await getToday();
  const members = challengeMembers(c.id);
  const entries = challengeEntries(c.id);
  const isMember = !!user && members.some((m) => m.id === user.id);
  const isOwner = !!user && c.owner_id === user.id;
  const shared = c.goal_type === "shared";
  const memberCount = Math.max(1, members.length);
  const groupTarget = c.target ? (shared ? c.target : c.target * memberCount) : null;
  const group = computeStats(entries, c, groupTarget, today);

  const byUser = new Map<number, typeof entries>();
  for (const e of entries) byUser.set(e.user_id, [...(byUser.get(e.user_id) ?? []), e]);
  const personal = members.map((m) => ({ user: m, stats: computeStats(byUser.get(m.id) ?? [], c, shared ? null : c.target, today) }));
  const allTimeRank = [...personal].sort((a, b) => b.stats.total - a.stats.total);
  const me = personal.find((p) => p.user.id === user?.id);

  // Leaderboard for the chosen period
  const period: Period = board === "week" || board === "today" ? board : "all";
  const weekStart = addDays(today, -((weekday(today) + 6) % 7)); // Monday
  const inPeriod = (day: string) => (period === "all" ? true : period === "today" ? day === today : day >= weekStart && day <= today);
  const rows = personal
    .map((p) => ({ ...p, periodTotal: (byUser.get(p.user.id) ?? []).filter((e) => inPeriod(e.day)).reduce((s, e) => s + e.amount, 0) }))
    .sort((a, b) => b.periodTotal - a.periodTotal || b.stats.total - a.stats.total);
  const finishers = shared ? 0 : personal.filter((p) => p.stats.reached).length;

  const focus: Stats = !shared && me ? me.stats : group;
  const focusLabel = shared ? "Team progress" : me ? "Your progress" : "Combined progress";
  const canLog = isMember && group.status !== "upcoming";
  const feed = challengeFeed(c.id, user?.id);
  const myRecent = me ? [...(byUser.get(me.user.id) ?? [])].reverse().slice(0, 15) : [];
  const invitePath = c.visibility === "private" ? `/c/${c.slug}?k=${c.invite_code}` : `/c/${c.slug}`;
  const owner = c.owner_id ? members.find((m) => m.id === c.owner_id) : undefined;
  const team = c.team_id ? (db().prepare("SELECT name, slug FROM teams WHERE id = ?").get(c.team_id) as { name: string; slug: string } | undefined) : undefined;
  const canJoin = !isMember && (c.visibility === "public" || k === c.invite_code || isTeamMember(c.team_id, user?.id));
  const dailyRef = focus.perDayNeeded ?? focus.basePace;

  const leaderboard = (
    <section className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Leaderboard</h3>
              <div className="flex rounded-lg bg-surface-2 p-0.5 text-xs">
                {(["all", "week", "today"] as const).map((p) => (
                  <Link
                    key={p}
                    scroll={false}
                    href={`/c/${c.slug}?${new URLSearchParams({ ...(k ? { k } : {}), ...(p !== "all" ? { board: p } : {}) })}`}
                    className={cx("rounded-md px-2.5 py-1 font-medium capitalize", period === p ? "bg-surface text-ink shadow-sm" : "text-muted")}
                  >
                    {p === "all" ? "All" : p}
                  </Link>
                ))}
              </div>
            </div>
            {rows.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted">No one has joined yet.</p>
            ) : (
              <ol className="space-y-3">
                {rows.map((r, i) => {
                  const badges = badgesFor({
                    stats: r.stats,
                    goalType: c.goal_type,
                    sharedTarget: shared ? c.target : null,
                    memberCount: members.length,
                    rank: allTimeRank.findIndex((x) => x.user.id === r.user.id) + 1,
                  });
                  const bar = shared
                    ? group.total > 0 ? r.stats.total / group.total : 0
                    : r.stats.pct ?? (rows[0].stats.total ? r.stats.total / Math.max(...rows.map((x) => x.stats.total)) : 0);
                  return (
                    <li key={r.user.id} className={cx("rounded-xl p-2", r.user.id === user?.id && "bg-accent-soft/40")}>
                      <div className="flex items-center gap-2.5">
                        <span className={cx("tnum w-5 text-center text-sm font-bold", i === 0 && r.periodTotal > 0 ? "text-accent" : "text-faint")}>{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <UserChip
                            user={r.user}
                            size={30}
                            sub={
                              <span className="inline-flex items-center gap-1.5">
                                {r.stats.currentStreak > 1 && <span>🔥{r.stats.currentStreak}</span>}
                                <span title={badges.map((b) => `${b.name}: ${b.desc}`).join("\n")}>{badges.map((b) => b.icon).join(" ")}</span>
                              </span>
                            }
                          />
                        </div>
                        <div className="text-right">
                          <div className="tnum font-semibold">{fmtNum(r.periodTotal)}</div>
                          {period === "all" && (
                            <div className="tnum text-xs text-muted">
                              {shared ? `${fmtPct(bar)} of team` : r.stats.pct != null ? fmtPct(r.stats.pct) : ""}
                            </div>
                          )}
                        </div>
                      </div>
                      {period === "all" && <ProgressBar value={bar} className="mt-2 h-1.5" />}
                    </li>
                  );
                })}
              </ol>
            )}
            {isMember && !isOwner && (
              <div className="mt-4 border-t border-line pt-3">
                <ConfirmButton
                  action={leaveChallenge.bind(null, c.id)}
                  message="Leave this challenge? Your logged sets here will be deleted."
                  className="text-xs text-muted hover:text-bad"
                >
                  Leave challenge
                </ConfirmButton>
              </div>
            )}
          </section>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={group.status} reached={!!groupTarget && group.reached} />
          <VisibilityPill visibility={c.visibility} />
          {team && <Link href={`/t/${team.slug}`} className="pill hover:text-ink">Team · {team.name}</Link>}
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{c.title}</h1>
            <p className="mt-1 text-muted">
              {c.target ? (
                <>
                  <b className="text-ink">{fmtNum(c.target)} {c.unit}</b> of {c.exercise.toLowerCase()} {shared ? "as a group" : "each"}
                </>
              ) : (
                <>
                  {c.exercise} · most {c.unit} wins
                </>
              )}
              {" · "}
              <span className="inline-flex items-center gap-1"><CalendarIcon size={14} /> {fmtRange(c.start_date, c.end_date)}</span>
            </p>
            {owner && <p className="mt-1 text-xs text-faint">Started by <Link href={`/u/${owner.username}`} className="hover:underline">{owner.display_name}</Link></p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {(isMember || isOwner) && <CopyLink path={invitePath} label={c.visibility === "private" ? "Invite link" : "Share"} />}
            {isOwner && (
              <Link href={`/c/${c.slug}/edit`} className="btn-ghost" aria-label="Edit challenge">
                <SettingsIcon size={16} /> Edit
              </Link>
            )}
            {canJoin && (
              <form action={joinChallenge.bind(null, c.id, k ?? null)}>
                <SubmitButton className="btn-primary px-6">{user ? "Join challenge" : "Sign up to join"}</SubmitButton>
              </form>
            )}
          </div>
        </div>
        {c.description && <p className="max-w-2xl whitespace-pre-line text-sm text-muted">{c.description}</p>}
      </header>

      {group.status === "upcoming" && (
        <div className="card flex items-center gap-4 p-5">
          <div className="tnum text-4xl font-extrabold text-accent">{diffDays(today, c.start_date)}</div>
          <div>
            <div className="font-semibold">{diffDays(today, c.start_date) === 1 ? "day" : "days"} until kickoff</div>
            <div className="text-sm text-muted">Starts {fmtDay(c.start_date, { weekday: "long", month: "long", day: "numeric" })}. Rally the crew before then.</div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          {canLog && (
            <QuickLog
              challengeId={c.id}
              unit={c.unit}
              exercise={c.exercise}
              quickAdds={c.quick_adds.split(",").map(Number).filter((n) => n > 0)}
              minDay={c.start_date}
              maxDay={c.end_date}
              todayLeft={group.status === "active" ? (shared ? group.todayLeft : me?.stats.todayLeft ?? null) : null}
            />
          )}

          {/* Hero */}
          <section className="card p-5">
            <div className="h-section mb-4">{focusLabel}</div>
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
              {focus.target ? (
                <ProgressRing value={focus.pct ?? 0}>
                  <div className="tnum text-3xl font-extrabold">{fmtPct(focus.pct ?? 0)}</div>
                  <div className="text-xs text-muted">complete</div>
                </ProgressRing>
              ) : (
                <div className="flex h-[148px] w-[148px] shrink-0 flex-col items-center justify-center rounded-full bg-accent-soft text-center">
                  <div className="tnum text-3xl font-extrabold text-accent">{fmtCompact(focus.total)}</div>
                  <div className="text-xs text-muted">{c.unit}</div>
                </div>
              )}
              <div className="w-full min-w-0 flex-1 space-y-3">
                <div className="tnum text-center text-2xl font-bold sm:text-left">
                  {fmtNum(focus.total)}
                  {focus.target && <span className="text-muted"> / {fmtNum(focus.target)}</span>} <span className="text-base font-medium text-muted">{c.unit}</span>
                </div>
                {focus.target != null && (
                  <p className="text-center text-sm text-muted sm:text-left">
                    {focus.reached ? (
                      <span className="font-medium text-good">
                        Goal crushed{focus.finishDay ? ` on ${fmtDay(focus.finishDay)}` : ""}! {focus.status === "active" ? "Keep stacking." : ""}
                      </span>
                    ) : focus.status === "finished" ? (
                      <>Fell {fmtNum(focus.remaining!)} short. Run it back?</>
                    ) : (
                      <>
                        <b className="text-ink">{fmtNum(focus.remaining!)}</b> to go
                        {focus.aheadBy != null && focus.status === "active" && <> · <PaceDelta aheadBy={focus.aheadBy} unit={c.unit} /></>}
                      </>
                    )}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {focus.perDayNeeded != null && !focus.reached && (
                    <MiniStat label="Needed per day" value={fmtNum(Math.ceil(focus.perDayNeeded))} />
                  )}
                  {focus.daysLeft != null && focus.status !== "finished" && <MiniStat label="Days left" value={fmtNum(focus.daysLeft)} sub="incl. today" />}
                  {focus.status === "active" && <MiniStat label="Today" value={fmtNum(focus.todayTotal)} />}
                  <MiniStat label="Avg per day" value={fmtNum(focus.avgPerDay, 0)} />
                  {focus.finishDay && !focus.reached && focus.target != null && (
                    <MiniStat
                      label="On pace to finish"
                      value={fmtDay(focus.finishDay)}
                      tone={c.end_date && focus.finishDay > c.end_date ? "bad" : "good"}
                    />
                  )}
                  {focus.projectedTotal != null && <MiniStat label="Projected total" value={fmtCompact(Math.round(focus.projectedTotal))} />}
                  {!focus.target && <MiniStat label="Current streak" value={`${focus.currentStreak}d`} />}
                </div>
              </div>
            </div>
            {!shared && personal.length > 1 && (
              <div className="mt-5 border-t border-line pt-4 text-sm text-muted">
                <b className="text-ink">{fmtNum(group.total)}</b> {c.unit} logged by {plural(members.length, "member")}
                {c.target != null && <> · <b className="text-ink">{finishers}</b> of {members.length} finished</>}
              </div>
            )}
          </section>

          <div className="lg:hidden">{leaderboard}</div>

          {group.series.length > 1 && (
            <ProgressChart
              series={focus.series}
              target={focus.target}
              unit={c.unit}
              today={today}
              dailyRef={dailyRef}
              title={shared ? "Team total vs. pace" : me ? "Your total vs. pace" : "Combined total vs. pace"}
            />
          )}

          {/* Nerd stats */}
          <section>
            <div className="h-section mb-3">{shared || !me ? "By the numbers" : "Your numbers"}</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatTile label="Sets logged" value={fmtNum(focus.sets)} />
              <StatTile label="Avg set" value={fmtNum(focus.avgSet)} sub={c.unit} />
              <StatTile label="Best set" value={fmtNum(focus.bestSet)} sub={c.unit} />
              <StatTile label="Best day" value={fmtNum(focus.bestDay?.amount ?? 0)} sub={focus.bestDay ? fmtDay(focus.bestDay.day) : "—"} />
              <StatTile label="Active days" value={fmtNum(focus.activeDays)} sub={`of ${fmtNum(focus.daysElapsed)} so far`} />
              <StatTile label="Current streak" value={<span className="inline-flex items-center gap-1">{focus.currentStreak}<FlameIcon size={18} className="text-accent" /></span>} sub="days in a row" />
              <StatTile label="Longest streak" value={fmtNum(focus.longestStreak)} sub="days" />
              <StatTile label="Avg per active day" value={fmtNum(focus.avgPerActiveDay, 0)} sub={c.unit} />
            </div>
          </section>

          {members.length > 1 && group.daysElapsed > 0 && <DailyGrid entries={entries} members={members} start={c.start_date} end={group.series.at(-1)?.day ?? today} today={today} />}

          {myRecent.length > 0 && (
            <section className="card p-4">
              <h3 className="mb-2 font-semibold">Your recent sets</h3>
              <ul className="divide-y divide-line text-sm">
                {myRecent.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="tnum font-medium">{fmtNum(e.amount)} {c.unit}</span>
                    <span className="min-w-0 flex-1 truncate text-muted">{e.note}</span>
                    <span className="text-xs text-faint">{fmtDay(e.day)}</span>
                    <form action={deleteEntry.bind(null, e.id)}>
                      <button className="rounded-lg p-1.5 text-faint hover:bg-surface-2 hover:text-bad" aria-label="Delete set">
                        <TrashIcon size={15} />
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <aside className="min-w-0 space-y-6">
          <div className="hidden lg:block">{leaderboard}</div>

          <section className="card p-4">
            <h3 className="font-semibold">Activity</h3>
            <Feed items={feed} unit={c.unit} viewerId={isMember ? user?.id : undefined} />
          </section>

          {isOwner && (c.visibility === "private" || members.length > 1) && (
            <section className="card space-y-3 p-4">
              <h3 className="font-semibold">Manage</h3>
              {c.visibility === "private" && (
                <div className="text-sm text-muted">
                  Anyone with the invite link can view and join.
                  <form action={regenerateChallengeInvite.bind(null, c.id)} className="mt-2">
                    <SubmitButton className="btn-ghost w-full py-2 text-xs">Reset invite link</SubmitButton>
                  </form>
                </div>
              )}
              {members.length > 1 && (
                <details>
                  <summary className="cursor-pointer text-sm text-muted">Remove members</summary>
                  <ul className="mt-2 space-y-2">
                    {members.filter((m) => m.id !== user!.id).map((m) => (
                      <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex items-center gap-2"><Avatar user={m} size={22} /> {m.display_name}</span>
                        <ConfirmButton action={removeMember.bind(null, c.id, m.id)} message={`Remove ${m.display_name}? Their sets in this challenge will be deleted.`} className="text-xs text-bad hover:underline">
                          Remove
                        </ConfirmButton>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function MiniStat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2">
      <div className="text-[11px] font-medium text-muted">{label}</div>
      <div className={cx("tnum text-lg font-semibold", tone === "good" && "text-good", tone === "bad" && "text-bad")}>{value}</div>
      {sub && <div className="text-[10px] text-faint">{sub}</div>}
    </div>
  );
}

/** The old-school spreadsheet view: one row per day, one column per member. */
function DailyGrid({
  entries,
  members,
  start,
  end,
  today,
}: {
  entries: { user_id: number; amount: number; day: string }[];
  members: PublicUser[];
  start: string;
  end: string;
  today: string;
}) {
  const last = end < today ? end : today;
  if (last < start) return null;
  const days = eachDay(start, last).reverse().slice(0, 120);
  const cell = new Map<string, number>();
  for (const e of entries) cell.set(`${e.day}|${e.user_id}`, (cell.get(`${e.day}|${e.user_id}`) ?? 0) + e.amount);
  return (
    <details className="card p-4">
      <summary className="cursor-pointer font-semibold">Spreadsheet view</summary>
      <div className="mt-3 max-h-96 overflow-auto">
        <table className="tnum w-full text-right text-sm">
          <thead className="sticky top-0 bg-surface text-xs text-muted">
            <tr>
              <th className="py-1.5 pr-3 text-left font-medium">Day</th>
              {members.map((m) => (
                <th key={m.id} className="px-2 font-medium">{m.display_name.split(" ")[0]}</th>
              ))}
              <th className="pl-2 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const vals = members.map((m) => cell.get(`${d}|${m.id}`) ?? 0);
              return (
                <tr key={d} className="border-t border-line">
                  <td className="py-1.5 pr-3 text-left text-muted">{fmtDay(d, { weekday: "short", month: "short", day: "numeric" })}</td>
                  {vals.map((v, i) => (
                    <td key={i} className={cx("px-2", v === 0 && "text-faint")}>{v ? fmtNum(v) : "·"}</td>
                  ))}
                  <td className="pl-2 font-semibold">{fmtNum(vals.reduce((a, b) => a + b, 0))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}

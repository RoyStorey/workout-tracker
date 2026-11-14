import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser, getToday } from "@/lib/auth";
import { canViewTeam, getTeamBySlug, lifetimeTotals, teamChallenges, teamMembers } from "@/lib/queries";
import { deleteTeam, joinTeam, leaveTeam, regenerateTeamInvite, removeTeamMember, transferTeam } from "@/lib/actions/teams";
import { db } from "@/lib/db";
import { addDays } from "@/lib/dates";
import { fmtCompact, fmtNum } from "@/lib/format";
import { UserChip } from "@/components/avatar";
import { ChallengeCardView } from "@/components/challenge-card";
import { CopyLink } from "@/components/copy-link";
import { ConfirmButton, SubmitButton } from "@/components/forms";
import { TeamForm } from "@/components/team-form";
import { Empty, VisibilityPill } from "@/components/ui";
import { PlusIcon } from "@/components/icons";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ k?: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const t = getTeamBySlug(slug);
  return { title: t && t.visibility === "public" ? t.name : "Team" };
}

export default async function TeamPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { k } = await searchParams;
  const t = getTeamBySlug(slug);
  const user = await getCurrentUser();
  if (!t || !canViewTeam(t, user?.id, k)) notFound();
  const today = await getToday();
  const members = teamMembers(t.id);
  const isMember = !!user && members.some((m) => m.id === user.id);
  const isOwner = !!user && t.owner_id === user.id;
  const challenges = teamChallenges(t.id).filter((c) => isMember || c.visibility === "public");
  const totals = lifetimeTotals("team", t.id);

  // Who's been busiest over the last 7 days (sets across team challenges)
  const weekly = db()
    .prepare(
      `SELECT e.user_id, COUNT(*) AS sets, COUNT(DISTINCT e.day) AS days FROM entries e
       JOIN challenges c ON c.id = e.challenge_id
       WHERE c.team_id = ? AND e.day >= ? GROUP BY e.user_id`,
    )
    .all(t.id, addDays(today, -6)) as { user_id: number; sets: number; days: number }[];
  const weeklyBy = new Map(weekly.map((w) => [w.user_id, w]));
  const ranked = [...members].sort((a, b) => (weeklyBy.get(b.id)?.sets ?? 0) - (weeklyBy.get(a.id)?.sets ?? 0));

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <VisibilityPill visibility={t.visibility} />
          <span className="tag">{members.length} members</span>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="display text-5xl uppercase sm:text-6xl">{t.name}</h1>
            {t.description && <p className="mt-1 max-w-2xl whitespace-pre-line text-muted">{t.description}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {isMember && <CopyLink path={`/join/${t.invite_code}`} label="Invite link" />}
            {isMember && (
              <Link href={`/challenges/new?team=${t.id}`} className="btn-primary"><PlusIcon size={16} /> Team challenge</Link>
            )}
            {!isMember && (
              <form action={joinTeam.bind(null, t.id, k ?? null)}>
                <SubmitButton className="btn-primary px-6">{user ? "Join team" : "Sign up to join"}</SubmitButton>
              </form>
            )}
          </div>
        </div>
      </header>

      {totals.length > 0 && (
        <section>
          <div className="eyebrow mb-3">Team lifetime totals</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {totals.map((x) => (
              <div key={x.exercise_key + x.unit} className="card p-4">
                <div className="text-sm text-muted">{x.exercise}</div>
                <div className="tnum text-2xl font-bold">{fmtCompact(x.total)} <span className="text-sm font-medium text-muted">{x.unit}</span></div>
                <div className="tnum text-xs text-muted">{fmtNum(x.sets)} sets</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section>
          <div className="eyebrow mb-3">Challenges</div>
          {challenges.length ? (
            <div className="grid gap-3 sm:grid-cols-2">{challenges.map((c) => <ChallengeCardView key={c.id} c={c} today={today} />)}</div>
          ) : (
            <Empty title="No team challenges yet">{isMember ? "Kick one off with the Team challenge button." : "Join the team to see more."}</Empty>
          )}
        </section>

        <aside className="space-y-6">
          <section className="card p-4">
            <h3 className="mb-1 font-semibold">Members</h3>
            <p className="mb-3 text-xs text-muted">Sorted by sets in the last 7 days</p>
            <ul className="space-y-3">
              {ranked.map((m) => {
                const w = weeklyBy.get(m.id);
                return (
                  <li key={m.id} className="flex items-center justify-between gap-2">
                    <UserChip user={m} sub={m.role === "owner" ? "Owner" : undefined} />
                    <div className="flex items-center gap-2">
                      <span className="tnum text-right text-xs text-muted">{w ? `${w.sets} sets · ${w.days}d` : "quiet"}</span>
                      {isOwner && m.id !== user!.id && (
                        <details className="relative">
                          <summary className="cursor-pointer list-none rounded px-1.5 text-faint hover:text-ink [&::-webkit-details-marker]:hidden">⋯</summary>
                          <div className="card absolute right-0 z-10 mt-1 w-40 space-y-1 p-1 text-sm shadow-lg">
                            <ConfirmButton action={transferTeam.bind(null, t.id, m.id)} message={`Make ${m.display_name} the team owner? You'll become a regular member.`} className="w-full rounded-lg px-3 py-1.5 text-left hover:bg-surface-2">
                              Make owner
                            </ConfirmButton>
                            <ConfirmButton action={removeTeamMember.bind(null, t.id, m.id)} message={`Remove ${m.display_name} from the team?`} className="w-full rounded-lg px-3 py-1.5 text-left text-bad hover:bg-surface-2">
                              Remove
                            </ConfirmButton>
                          </div>
                        </details>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            {isMember && !isOwner && (
              <div className="mt-4 border-t border-line pt-3">
                <ConfirmButton action={leaveTeam.bind(null, t.id)} message="Leave this team?" className="text-xs text-muted hover:text-bad">Leave team</ConfirmButton>
              </div>
            )}
          </section>

          {isOwner && (
            <details className="card p-4">
              <summary className="cursor-pointer font-semibold">Team settings</summary>
              <div className="mt-4 space-y-6">
                <TeamForm initial={{ id: t.id, name: t.name, description: t.description, visibility: t.visibility }} />
                <form action={regenerateTeamInvite.bind(null, t.id)}>
                  <SubmitButton className="btn-ghost w-full text-xs">Reset invite link</SubmitButton>
                </form>
                <ConfirmButton action={deleteTeam.bind(null, t.id)} message="Delete this team? Its challenges stay but lose the team link." className="btn-danger w-full">
                  Delete team
                </ConfirmButton>
              </div>
            </details>
          )}
        </aside>
      </div>
    </div>
  );
}

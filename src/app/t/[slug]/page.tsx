import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser, getToday } from "@/lib/auth";
import { canViewTeam, challengesEnteredBy, getTeamBySlug, lifetimeTotals, teamChallenges, teamMembers } from "@/lib/queries";
import { deleteTeam, joinTeam, leaveTeam, regenerateTeamInvite, removeTeamMember, transferTeam } from "@/lib/actions/teams";
import { db } from "@/lib/db";
import { addDays } from "@/lib/dates";
import { fmtCompact, fmtNum } from "@/lib/format";
import { UserChip } from "@/components/avatar";
import { ChallengeCardView } from "@/components/challenge-card";
import { CopyLink } from "@/components/copy-link";
import { ConfirmButton, SubmitButton } from "@/components/forms";
import { TeamForm } from "@/components/team-form";
import { Panel, TeamMark, VisibilityPill } from "@/components/ui";
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
  const hosted = teamChallenges(t.id).filter((c) => isMember || c.visibility === "public");
  const competing = challengesEnteredBy(t.id).filter((c) => isMember || c.visibility === "public");
  const totals = lifetimeTotals("team", t.id);

  // Who's been busiest over the last 7 days (sets across team challenges)
  const weekly = db()
    .prepare(
      `SELECT e.user_id, COUNT(*) AS sets, COUNT(DISTINCT e.day) AS days FROM entries e
       JOIN challenges c ON c.id = e.challenge_id
       WHERE e.day >= ? AND e.user_id IN (SELECT user_id FROM team_members WHERE team_id = ?)
         AND (c.team_id = ? OR c.id IN (SELECT challenge_id FROM squads WHERE team_id = ?))
       GROUP BY e.user_id`,
    )
    .all(addDays(today, -6), t.id, t.id, t.id) as { user_id: number; sets: number; days: number }[];
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
          <div className="flex min-w-0 items-start gap-4">
            <TeamMark name={t.name} size={64} />
            <div className="min-w-0">
            <h1 className="display text-5xl uppercase sm:text-6xl">{t.name}</h1>
            {t.description && <p className="mt-1 max-w-2xl whitespace-pre-line text-muted">{t.description}</p>}
            {isMember && (
              <p className="mt-3 text-sm text-muted">
                Invite code <code className="ml-1 rounded border border-line-strong bg-surface px-2 py-0.5 font-mono text-sm font-semibold tracking-wider text-ink select-all">{t.invite_code}</code>
                <span className="ml-2 text-xs">Friends enter it on their Teams page.</span>
              </p>
            )}
            </div>
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
        <Panel flush title="Lifetime totals">
          <div className="-mb-px -mr-px grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 [&>*]:border-b [&>*]:border-r [&>*]:border-line">
            {totals.map((x) => (
              <div key={x.exercise_key + x.unit} className="p-4">
                <div className="eyebrow">{x.exercise}</div>
                <div className="mt-1 flex items-baseline gap-1.5"><span className="display text-4xl">{fmtCompact(x.total)}</span> <span className="text-sm text-muted">{x.unit}</span></div>
                <div className="tnum text-xs text-muted">{fmtNum(x.sets)} sets</div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          {competing.length > 0 && (
            <Panel title="Competing in" actions={<span className="text-xs text-muted">Team-vs-team challenges this team entered</span>}>
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,18rem),1fr))]">{competing.map((c) => <ChallengeCardView key={c.id} c={c} today={today} />)}</div>
            </Panel>
          )}
          <Panel
            title="Team challenges"
            actions={isOwner && <Link href="/explore" className="text-xs font-semibold text-muted hover:text-ink">Find a team-vs-team challenge →</Link>}
          >
            {hosted.length ? (
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,18rem),1fr))]">{hosted.map((c) => <ChallengeCardView key={c.id} c={c} today={today} />)}</div>
            ) : (
              <p className="text-sm text-muted">{isMember ? "No team challenges yet. Kick one off with the Team challenge button." : "Join the team to see more."}</p>
            )}
          </Panel>
        </div>

        <aside className="space-y-6">
          <Panel title="Members" actions={<span className="text-xs text-muted">by sets, last 7 days</span>}>
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
          </Panel>

          {isOwner && (
            <Panel title="Team settings">
              <div className="space-y-6">
                <TeamForm initial={{ id: t.id, name: t.name, description: t.description, visibility: t.visibility }} />
                <form action={regenerateTeamInvite.bind(null, t.id)}>
                  <SubmitButton className="btn-ghost w-full text-xs">Reset invite link</SubmitButton>
                </form>
                <ConfirmButton action={deleteTeam.bind(null, t.id)} message="Delete this team? Its challenges stay but lose the team link." className="btn-danger w-full">
                  Delete team
                </ConfirmButton>
              </div>
            </Panel>
          )}
        </aside>
      </div>
    </div>
  );
}

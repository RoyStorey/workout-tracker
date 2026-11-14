import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { publicTeams, teamsForUser, type TeamCard } from "@/lib/queries";
import { Empty, VisibilityPill } from "@/components/ui";
import { PlusIcon } from "@/components/icons";

export const metadata = { title: "Teams" };

function TeamTile({ t }: { t: TeamCard }) {
  return (
    <Link href={`/t/${t.slug}`} className="card block p-4 hover:border-accent/50">
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold">{t.name}</div>
        <VisibilityPill visibility={t.visibility} />
      </div>
      {t.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{t.description}</p>}
      <div className="mt-2 text-xs text-muted">{t.member_count} members · {t.challenge_count} challenges</div>
    </Link>
  );
}

export default async function TeamsPage() {
  const user = await requireUser("/teams");
  const mine = teamsForUser(user.id);
  const mineIds = new Set(mine.map((t) => t.id));
  const others = publicTeams(30).filter((t) => !mineIds.has(t.id));
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Teams</h1>
        <Link href="/teams/new" className="btn-primary"><PlusIcon size={16} /> New team</Link>
      </div>
      <section>
        <div className="h-section mb-3">Your teams</div>
        {mine.length ? (
          <div className="grid gap-3 sm:grid-cols-2">{mine.map((t) => <TeamTile key={t.id} t={t} />)}</div>
        ) : (
          <Empty title="You're not on a team yet" action={{ href: "/teams/new", label: "Start a team" }}>
            Create one for your crew, or ask a friend for their team invite link.
          </Empty>
        )}
      </section>
      {others.length > 0 && (
        <section>
          <div className="h-section mb-3">Public teams</div>
          <div className="grid gap-3 sm:grid-cols-2">{others.map((t) => <TeamTile key={t.id} t={t} />)}</div>
        </section>
      )}
    </div>
  );
}

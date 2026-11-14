import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { publicTeams, teamsForUser, type TeamCard } from "@/lib/queries";
import { plural } from "@/lib/format";
import { Empty, SectionHead } from "@/components/ui";
import { JoinByCode } from "@/components/join-code";
import { PlusIcon } from "@/components/icons";

export const metadata = { title: "Teams" };

function TeamRow({ t, mine }: { t: TeamCard; mine?: boolean }) {
  return (
    <Link href={`/t/${t.slug}`} className="flex items-center justify-between gap-4 px-4 py-3 transition hover:bg-surface-2/60">
      <div className="min-w-0">
        <div className="truncate font-semibold">{t.name}</div>
        {t.description && <div className="truncate text-xs text-muted">{t.description}</div>}
      </div>
      <div className="shrink-0 text-right text-xs text-muted">
        <div>{plural(t.member_count, "member")}</div>
        <div>{mine ? (t.visibility === "private" ? "Private" : "Public") : plural(t.challenge_count, "challenge")}</div>
      </div>
    </Link>
  );
}

export default async function TeamsPage() {
  const user = await requireUser("/teams");
  const mine = teamsForUser(user.id);
  const mineIds = new Set(mine.map((t) => t.id));
  const others = publicTeams(60).filter((t) => !mineIds.has(t.id));
  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-5xl uppercase">Teams</h1>
          <p className="mt-1 text-muted">Your regular crew. Teams can enter team-vs-team challenges together.</p>
        </div>
        <Link href="/teams/new" className="btn-primary"><PlusIcon size={16} /> New team</Link>
      </div>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0">
          <SectionHead title="Your teams" />
          {mine.length ? (
            <div className="card divide-y divide-line">{mine.map((t) => <TeamRow key={t.id} t={t} mine />)}</div>
          ) : (
            <Empty title="You're not on a team yet" action={{ href: "/teams/new", label: "Start a team" }}>
              Start one for your crew, or enter a friend&apos;s invite code.
            </Empty>
          )}
        </section>
        <section>
          <SectionHead title="Join with a code" />
          <div className="card p-4">
            <p className="mb-3 text-sm text-muted">Got a code from a team (or a private challenge)? Paste the code or the whole link.</p>
            <JoinByCode />
          </div>
        </section>
      </div>

      {others.length > 0 && (
        <section>
          <SectionHead title="Public teams" />
          <div className="grid gap-x-6 sm:grid-cols-2 xl:grid-cols-3">
            {others.map((t) => (
              <div key={t.id} className="border-b border-line">
                <TeamRow t={t} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

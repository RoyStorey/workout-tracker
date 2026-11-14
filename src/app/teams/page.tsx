import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { publicTeams, teamsForUser } from "@/lib/queries";
import { plural } from "@/lib/format";
import { Panel } from "@/components/ui";
import { TeamRow } from "@/components/team-row";
import { JoinByCode } from "@/components/join-code";
import { PlusIcon } from "@/components/icons";

export const metadata = { title: "Teams" };

export default async function TeamsPage() {
  const user = await requireUser("/teams");
  const mine = teamsForUser(user.id);
  const mineIds = new Set(mine.map((t) => t.id));
  const others = publicTeams(60).filter((t) => !mineIds.has(t.id));
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-5xl uppercase">Teams</h1>
          <p className="mt-1 text-muted">Your regular crew. Teams can enter team-vs-team challenges together.</p>
        </div>
        <Link href="/teams/new" className="btn-primary"><PlusIcon size={16} /> New team</Link>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <Panel flush title="Your teams" actions={<span className="text-xs text-muted">{plural(mine.length, "team")}</span>}>
            {mine.length ? (
              <div className="divide-y divide-line">{mine.map((t) => <TeamRow key={t.id} t={t} />)}</div>
            ) : (
              <p className="p-4 text-sm text-muted">You&apos;re not on a team yet. Start one for your crew, or enter a friend&apos;s invite code.</p>
            )}
          </Panel>
          <Panel flush title="Public teams" actions={<span className="text-xs text-muted">Anyone can join these</span>}>
            {others.length ? (
              <div className="divide-y divide-line">{others.map((t) => <TeamRow key={t.id} t={t} />)}</div>
            ) : (
              <p className="p-4 text-sm text-muted">No public teams yet.</p>
            )}
          </Panel>
        </div>
        <Panel title="Join with a code" className="lg:sticky lg:top-20">
          <p className="mb-3 text-sm text-muted">Got a code from a team or a private challenge? Paste the code or the whole link.</p>
          <JoinByCode />
        </Panel>
      </div>
    </div>
  );
}

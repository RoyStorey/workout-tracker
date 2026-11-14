import Link from "next/link";
import { getToday } from "@/lib/auth";
import { publicChallenges, publicTeams, siteStats } from "@/lib/queries";
import { challengeStatus, type Status } from "@/lib/stats";
import { cx, fmtCompact, plural } from "@/lib/format";
import { ChallengeCardView } from "@/components/challenge-card";
import { Empty, Panel } from "@/components/ui";
import { TeamRow } from "@/components/team-row";

export const metadata = { title: "Explore" };

const TABS: { id: Status; label: string }[] = [
  { id: "active", label: "Live" },
  { id: "upcoming", label: "Upcoming" },
  { id: "finished", label: "Finished" },
];

export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const { tab, q } = await searchParams;
  const status: Status = tab === "upcoming" || tab === "finished" ? tab : "active";
  const today = await getToday();
  const query = (q ?? "").trim().toLowerCase();
  const all = publicChallenges(500).filter(
    (c) => !query || c.title.toLowerCase().includes(query) || c.exercise.toLowerCase().includes(query),
  );
  const list = all.filter((c) => challengeStatus(c, today) === status).sort((a, b) => b.member_count - a.member_count);
  const teams = publicTeams(12);
  const s = siteStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-5xl uppercase">Explore</h1>
        <p className="text-sm text-muted">
          {fmtCompact(s.users)} athletes · {fmtCompact(s.sets)} sets logged · {fmtCompact(s.teams)} teams
        </p>
      </div>
      <form className="flex gap-2">
        <input type="hidden" name="tab" value={status} />
        <input name="q" defaultValue={q} className="input" placeholder="Search by name or exercise" />
        <button className="btn-ghost">Search</button>
      </form>
      <div className="flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/explore?${new URLSearchParams({ tab: t.id, ...(q ? { q } : {}) })}`}
            className={cx("-mb-px border-b-2 px-3 py-2 text-sm font-medium", status === t.id ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink")}
          >
            {t.label} <span className="text-faint">{all.filter((c) => challengeStatus(c, today) === t.id).length}</span>
          </Link>
        ))}
      </div>
      {list.length ? (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr))]">{list.map((c) => <ChallengeCardView key={c.id} c={c} today={today} />)}</div>
      ) : (
        <Empty title={query ? "Nothing matches that" : "Nothing here yet"} action={{ href: "/challenges/new", label: "Start one" }}>
          Public challenges show up here for anyone to join.
        </Empty>
      )}

      {teams.length > 0 && (
        <Panel flush title="Public teams" actions={<Link href="/teams" className="text-xs font-semibold text-muted hover:text-ink">All teams →</Link>}>
          <div className="grid divide-y divide-line md:grid-cols-2 md:divide-y-0 md:[&>*]:border-b md:[&>*]:border-line md:[&>*:nth-child(odd)]:border-r">
            {teams.map((t) => <TeamRow key={t.id} t={t} />)}
          </div>
        </Panel>
      )}
    </div>
  );
}

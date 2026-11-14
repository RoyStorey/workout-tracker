import { getToday, requireUser } from "@/lib/auth";
import { teamsForUser } from "@/lib/queries";
import { ChallengeForm } from "@/components/challenge-form";

export const metadata = { title: "New challenge" };

export default async function NewChallengePage({ searchParams }: { searchParams: Promise<{ team?: string }> }) {
  const user = await requireUser("/challenges/new");
  const { team } = await searchParams;
  const teams = teamsForUser(user.id).map((t) => ({ id: t.id, name: t.name }));
  const today = await getToday();
  const preTeam = teams.find((t) => String(t.id) === team);
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">New challenge</h1>
      <p className="mb-6 text-sm text-muted">One exercise, one goal. Make another challenge for each extra exercise.</p>
      <ChallengeForm teams={teams} today={today} initial={preTeam ? { team_id: String(preTeam.id), visibility: "private" } : undefined} />
    </div>
  );
}

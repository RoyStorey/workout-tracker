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
    <div className="mx-auto max-w-3xl">
      <h1 className="display text-5xl uppercase">New challenge</h1>
      <p className="mb-10 mt-2 text-muted">One exercise per challenge. Want pushups and squats? Make two.</p>
      <ChallengeForm teams={teams} today={today} initial={preTeam ? { team_id: String(preTeam.id), visibility: "private" } : undefined} />
    </div>
  );
}

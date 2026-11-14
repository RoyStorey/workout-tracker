import Link from "next/link";
import { notFound } from "next/navigation";
import { getToday, requireUser } from "@/lib/auth";
import { getChallengeBySlug, teamsForUser } from "@/lib/queries";
import { deleteChallenge } from "@/lib/actions/challenges";
import { ChallengeForm } from "@/components/challenge-form";
import { ConfirmButton } from "@/components/forms";
import { fmtNum } from "@/lib/format";

export const metadata = { title: "Edit challenge" };

export default async function EditChallengePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser(`/c/${slug}/edit`);
  const c = getChallengeBySlug(slug);
  if (!c || c.owner_id !== user.id) notFound();
  const teams = teamsForUser(user.id).map((t) => ({ id: t.id, name: t.name }));
  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/c/${c.slug}`} className="text-sm text-muted hover:text-ink">← Back to challenge</Link>
      <h1 className="mb-6 mt-2 text-2xl font-bold tracking-tight">Edit challenge</h1>
      <ChallengeForm
        teams={teams}
        today={await getToday()}
        initial={{
          id: c.id,
          title: c.title,
          description: c.description,
          exercise: c.exercise,
          unit: c.unit,
          goal_type: c.goal_type,
          target: c.target != null ? fmtNum(c.target, 2).replace(/,/g, "") : "",
          start_date: c.start_date,
          end_date: c.end_date ?? "",
          open_ended: !c.end_date,
          visibility: c.visibility,
          team_id: c.team_id ? String(c.team_id) : "",
          quick_adds: c.quick_adds.split(",").join(", "),
        }}
      />
      <div className="card mt-10 border-bad/30 p-5">
        <h2 className="font-semibold text-bad">Danger zone</h2>
        <p className="mb-3 mt-1 text-sm text-muted">Deleting removes the challenge and every logged set for everyone. There&apos;s no undo.</p>
        <ConfirmButton action={deleteChallenge.bind(null, c.id)} message={`Delete "${c.title}" and all its sets?`}>
          Delete challenge
        </ConfirmButton>
      </div>
    </div>
  );
}

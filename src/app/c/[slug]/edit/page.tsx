import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { getToday, requireUser } from "@/lib/auth";
import { challengeSlugForAlias, challengeSquads, getChallengeBySlug, teamsForUser } from "@/lib/queries";
import { deleteChallenge } from "@/lib/actions/challenges";
import { ChallengeForm } from "@/components/challenge-form";
import { ConfirmButton } from "@/components/forms";
import { fmtNum } from "@/lib/format";

export const metadata = { title: "Edit challenge" };

export default async function EditChallengePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser(`/c/${slug}/edit`);
  const c = getChallengeBySlug(slug);
  if (!c && challengeSlugForAlias(slug)) permanentRedirect(`/c/${challengeSlugForAlias(slug)}/edit`);
  if (!c || c.owner_id !== user.id) notFound();
  const teams = teamsForUser(user.id).map((t) => ({ id: t.id, name: t.name }));
  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/c/${c.slug}`} className="text-sm font-semibold text-muted hover:text-ink">← Back to challenge</Link>
      <h1 className="display mb-8 mt-3 text-5xl uppercase">Edit challenge</h1>
      <ChallengeForm
        teams={teams}
        today={await getToday()}
        initial={{
          id: c.id,
          title: c.title,
          description: c.description,
          exercise: c.exercise,
          unit: c.unit,
          format: c.kind === "standard" ? c.goal_type : c.kind,
          scoring: c.scoring,
          open_squads: !!c.open_squads,
          squads: challengeSquads(c.id).map((q) => ({ id: q.id, name: q.name })),
          target: c.target != null ? fmtNum(c.target, 2).replace(/,/g, "") : "",
          start_date: c.start_date,
          end_date: c.end_date ?? "",
          open_ended: !c.end_date,
          visibility: c.visibility,
          team_id: c.team_id ? String(c.team_id) : "",
          quick_adds: c.quick_adds.split(",").join(", "),
        }}
      />
      <div className="mt-14 rounded-lg border border-bad/40 p-5">
        <h2 className="font-semibold text-bad">Danger zone</h2>
        <p className="mb-3 mt-1 text-sm text-muted">Deleting removes the challenge and every logged set for everyone. There&apos;s no undo.</p>
        <ConfirmButton action={deleteChallenge.bind(null, c.id)} message={`Delete "${c.title}" and all its sets?`}>
          Delete challenge
        </ConfirmButton>
      </div>
    </div>
  );
}

import { requireUser } from "@/lib/auth";
import { TeamForm } from "@/components/team-form";

export const metadata = { title: "New team" };

export default async function NewTeamPage() {
  await requireUser("/teams/new");
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">New team</h1>
      <p className="mb-6 text-sm text-muted">A team is your regular crew. Host challenges under it and see combined lifetime stats.</p>
      <div className="card p-5"><TeamForm /></div>
    </div>
  );
}

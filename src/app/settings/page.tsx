import { requireUser } from "@/lib/auth";
import { DeleteAccountForm, PasswordForm, ProfileForm } from "@/components/settings-forms";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser("/settings");
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <section className="card p-5">
        <h2 className="mb-4 font-semibold">Profile</h2>
        <ProfileForm user={user} />
      </section>
      <section className="card p-5">
        <h2 className="mb-4 font-semibold">Password</h2>
        <PasswordForm />
      </section>
      <details className="card border-bad/30 p-5">
        <summary className="cursor-pointer font-semibold text-bad">Delete account</summary>
        <div className="mt-4"><DeleteAccountForm username={user.username} /></div>
      </details>
    </div>
  );
}

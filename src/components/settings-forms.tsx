"use client";

import { useActionState, useState } from "react";
import { changePassword, deleteAccount, updateProfile } from "@/lib/actions/auth";
import { AVATAR_COLORS } from "@/lib/colors";
import { cx } from "@/lib/format";
import { Avatar } from "./avatar";
import { FormMessage, SubmitButton } from "./forms";

export function ProfileForm({ user }: { user: { username: string; display_name: string; bio: string; color: string } }) {
  const [state, action] = useActionState(updateProfile, undefined);
  const [color, setColor] = useState(user.color);
  const [name, setName] = useState(user.display_name);
  return (
    <form action={action} className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar user={{ ...user, display_name: name || user.username, color }} size={56} />
        <div className="flex flex-wrap gap-2">
          {AVATAR_COLORS.map((c) => (
            <label key={c} className={cx("h-8 w-8 cursor-pointer rounded-full ring-offset-2 ring-offset-[var(--surface)]", color === c && "ring-2 ring-[var(--ink)]")} style={{ background: c }}>
              <input type="radio" name="color" value={c} checked={color === c} onChange={() => setColor(c)} className="sr-only" aria-label={`Color ${c}`} />
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="label" htmlFor="display_name">Display name</label>
        <input id="display_name" name="display_name" className="input" maxLength={40} required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="bio">Bio</label>
        <input id="bio" name="bio" className="input" maxLength={160} defaultValue={user.bio} placeholder="Chasing 10k pushups this year" />
      </div>
      <FormMessage state={state} />
      <SubmitButton>Save profile</SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="space-y-3">
      <input name="current" type="password" className="input" placeholder="Current password" autoComplete="current-password" required />
      <input name="password" type="password" className="input" placeholder="New password (6+ characters)" autoComplete="new-password" minLength={6} required />
      <input name="confirm" type="password" className="input" placeholder="Confirm new password" autoComplete="new-password" minLength={6} required />
      <FormMessage state={state} />
      <SubmitButton className="btn-ghost">Change password</SubmitButton>
    </form>
  );
}

export function DeleteAccountForm({ username }: { username: string }) {
  const [state, action] = useActionState(deleteAccount, undefined);
  return (
    <form action={action} className="space-y-3">
      <p className="text-sm text-muted">
        This deletes your account and every set you&apos;ve logged. Challenges and teams you own pass to the next member. Type <b className="text-ink">{username}</b> to confirm.
      </p>
      <input name="confirm_username" className="input" autoCapitalize="none" autoComplete="off" />
      <FormMessage state={state} />
      <SubmitButton className="btn-danger">Delete my account</SubmitButton>
    </form>
  );
}

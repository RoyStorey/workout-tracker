"use client";

import { useActionState, useState } from "react";
import { createTeam, updateTeam } from "@/lib/actions/teams";
import { cx } from "@/lib/format";
import { FormMessage, SubmitButton } from "./forms";

export function TeamForm({ initial }: { initial?: { id: number; name: string; description: string; visibility: "public" | "private" } }) {
  const [state, action] = useActionState(initial ? updateTeam : createTeam, undefined);
  const [vis, setVis] = useState(initial?.visibility ?? "private");
  return (
    <form action={action} className="space-y-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <div>
        <label className="label" htmlFor="name">Team name</label>
        <input id="name" name="name" className="input" required maxLength={50} defaultValue={initial?.name} placeholder="The Storey Brothers" />
      </div>
      <div>
        <label className="label" htmlFor="description">About <span className="font-normal text-muted">(optional)</span></label>
        <textarea id="description" name="description" className="input min-h-20" maxLength={500} defaultValue={initial?.description} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {([
          ["private", "Private", "Invite link only."],
          ["public", "Public", "Listed on Explore; anyone can join."],
        ] as const).map(([val, title, desc]) => (
          <label key={val} className={cx("cursor-pointer rounded-xl border p-3", vis === val ? "border-accent bg-accent-soft/40" : "border-line hover:bg-surface-2")}>
            <input type="radio" name="visibility" value={val} className="sr-only" checked={vis === val} onChange={() => setVis(val)} />
            <div className="text-sm font-semibold">{title}</div>
            <div className="text-xs text-muted">{desc}</div>
          </label>
        ))}
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full">{initial ? "Save team" : "Create team"}</SubmitButton>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { joinByCode } from "@/lib/actions/teams";
import { FormMessage, SubmitButton } from "./forms";

export function JoinByCode({ compact }: { compact?: boolean }) {
  const [state, action] = useActionState(joinByCode, undefined);
  return (
    <form action={action} className="space-y-2">
      <div className="flex gap-2">
        <input
          name="code"
          className={compact ? "input h-10 text-sm" : "input"}
          placeholder="Invite code or link"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          aria-label="Invite code or link"
        />
        <SubmitButton className={compact ? "btn-primary h-10 shrink-0" : "btn-primary h-11 shrink-0 px-5"}>Join</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

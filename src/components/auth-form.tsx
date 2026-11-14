"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, signup } from "@/lib/actions/auth";
import { FormMessage, SubmitButton } from "./forms";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const [state, action] = useActionState(mode === "login" ? login : signup, undefined);
  const q = next ? `?next=${encodeURIComponent(next)}` : "";
  return (
    <form action={action} className="card mx-auto mt-6 max-w-sm space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{mode === "login" ? "Welcome back" : "Join the grind"}</h1>
        <p className="mt-1 text-sm text-muted">
          {mode === "login" ? "Log in to keep your streak alive." : "Just a username and password. Takes ten seconds."}
        </p>
      </div>
      <input type="hidden" name="next" value={next ?? ""} />
      <div>
        <label className="label" htmlFor="username">Username</label>
        <input id="username" name="username" className="input" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} required minLength={3} maxLength={24} />
      </div>
      {mode === "signup" && (
        <div>
          <label className="label" htmlFor="display_name">Display name <span className="font-normal text-muted">(optional)</span></label>
          <input id="display_name" name="display_name" className="input" maxLength={40} placeholder="What your friends call you" />
        </div>
      )}
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" className="input" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "signup" ? 6 : 1} />
      </div>
      {mode === "signup" && (
        <div>
          <label className="label" htmlFor="confirm">Confirm password</label>
          <input id="confirm" name="confirm" type="password" className="input" autoComplete="new-password" required minLength={6} />
          <p className="hint">There&apos;s no email recovery, so pick one you&apos;ll remember.</p>
        </div>
      )}
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full py-3">{mode === "login" ? "Log in" : "Create account"}</SubmitButton>
      <p className="text-center text-sm text-muted">
        {mode === "login" ? (
          <>New here? <Link className="font-medium text-accent hover:underline" href={`/signup${q}`}>Create an account</Link></>
        ) : (
          <>Already have one? <Link className="font-medium text-accent hover:underline" href={`/login${q}`}>Log in</Link></>
        )}
      </p>
    </form>
  );
}

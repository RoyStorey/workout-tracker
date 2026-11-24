"use client";

import { useState, useTransition } from "react";
import { adminResetPassword } from "@/lib/actions/admin";

export function AdminReset({ userId, username }: { userId: number; username: string }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const [result, setResult] = useState<{ password: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const run = () =>
    start(async () => {
      setError(null);
      const res = await adminResetPassword(userId, custom);
      if (res.ok) {
        setResult({ password: res.password });
        setCustom("");
      } else setError(res.error);
    });

  if (!open)
    return (
      <button type="button" className="btn-ghost h-8 px-3 text-xs" onClick={() => setOpen(true)}>
        Reset password
      </button>
    );

  return (
    <div className="w-full rounded-md border border-line-strong bg-surface p-3 text-left sm:w-80">
      {result ? (
        <div className="space-y-2">
          <div className="text-xs text-muted">
            New password for <b className="text-ink">@{username}</b>. It&apos;s only shown once; pass it on now.
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 select-all rounded border border-line-strong bg-surface-2 px-2 py-1.5 font-mono text-sm font-semibold">{result.password}</code>
            <button
              type="button"
              className="btn-ghost h-8 px-2 text-xs"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(result.password);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {}
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="text-xs text-muted">They&apos;ve been signed out everywhere and will be asked to pick their own password.</div>
          <button type="button" className="text-xs font-semibold underline underline-offset-2" onClick={() => { setResult(null); setOpen(false); }}>
            Done
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-xs font-semibold">Reset @{username}&apos;s password</div>
          <input
            className="input h-9 text-sm"
            placeholder="Leave blank to generate one"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            autoComplete="new-password"
            aria-label="New password (optional)"
          />
          {error && <div className="text-xs text-bad">{error}</div>}
          <div className="flex gap-2">
            <button type="button" className="btn-primary h-8 flex-1 text-xs" disabled={pending} onClick={run}>
              {pending ? "Resetting…" : custom.trim() ? "Set this password" : "Generate & reset"}
            </button>
            <button type="button" className="btn-ghost h-8 px-3 text-xs" onClick={() => { setOpen(false); setError(null); }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

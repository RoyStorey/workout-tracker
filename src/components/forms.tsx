"use client";

import { useFormStatus } from "react-dom";
import { cx } from "@/lib/format";

export function SubmitButton({ children, className, pendingText }: { children: React.ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={cx(className ?? "btn-primary")}>
      {pending ? (pendingText ?? "Working…") : children}
    </button>
  );
}

export function FormMessage({ state }: { state: { error?: string; ok?: string } | undefined }) {
  if (!state?.error && !state?.ok) return null;
  return (
    <p role="status" className={cx("rounded-xl px-3 py-2 text-sm", state.error ? "bg-bad/10 text-bad" : "bg-good/10 text-good")}>
      {state.error ?? state.ok}
    </p>
  );
}

/** A button that runs a server action after a confirm() prompt. */
export function ConfirmButton({
  action,
  message,
  children,
  className,
}: {
  action: () => Promise<void>;
  message: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <form
      className="contents"
      action={action}
      onSubmit={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      <SubmitButton className={className ?? "btn-danger"}>{children}</SubmitButton>
    </form>
  );
}

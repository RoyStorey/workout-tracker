"use client";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <h1 className="display text-3xl uppercase">Something went sideways</h1>
      <p className="mt-2 text-sm text-muted">{error.message || "Unexpected error."}</p>
      <button onClick={reset} className="btn-primary mt-6">Try again</button>
    </div>
  );
}

"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { toggleReaction } from "@/lib/actions/conversation";
import { REACTIONS, type ReactionSummary } from "@/lib/reactions";
import { cx } from "@/lib/format";

export function ReactionBar({
  kind,
  targetId,
  reactions,
  canReact,
  you,
}: {
  kind: "entry" | "message";
  targetId: number;
  reactions: ReactionSummary[];
  canReact: boolean;
  you?: string;
}) {
  const [, start] = useTransition();
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [state, apply] = useOptimistic(reactions, (cur: ReactionSummary[], emoji: string) => {
    const hit = cur.find((r) => r.emoji === emoji);
    if (!hit) return [...cur, { emoji, count: 1, mine: true, names: you ?? "You" }];
    const next = { ...hit, mine: !hit.mine, count: hit.count + (hit.mine ? -1 : 1) };
    return next.count > 0 ? cur.map((r) => (r.emoji === emoji ? next : r)) : cur.filter((r) => r.emoji !== emoji);
  });

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!pickerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const toggle = (emoji: string) => {
    if (!canReact) return;
    setOpen(false);
    start(async () => {
      apply(emoji);
      await toggleReaction(kind, targetId, emoji);
    });
  };

  if (!state.length && !canReact) return null;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {state.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={() => toggle(r.emoji)}
          title={r.names}
          aria-label={`${r.emoji} ${r.count}: ${r.names}`}
          aria-pressed={r.mine}
          disabled={!canReact}
          className={cx(
            "flex h-6 items-center gap-1 rounded-full border px-2 text-xs transition disabled:cursor-default",
            r.mine ? "border-series-1/50 bg-series-1/10 font-semibold text-ink" : "border-line bg-surface text-muted hover:border-line-strong",
          )}
        >
          <span>{r.emoji}</span>
          <span className="tnum">{r.count}</span>
        </button>
      ))}
      {canReact && (
        <div className="relative" ref={pickerRef}>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label="Add a reaction"
            aria-expanded={open}
            className="flex h-6 w-7 items-center justify-center rounded-full border border-transparent text-faint transition hover:border-line hover:text-ink"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <circle cx="12" cy="12" r="9" />
              <path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01" />
            </svg>
          </button>
          {open && (
            <div className="card absolute bottom-full left-0 z-20 mb-1 flex gap-0.5 p-1 shadow-lg">
              {REACTIONS.map((e) => (
                <button key={e} type="button" onClick={() => toggle(e)} className="flex h-8 w-8 items-center justify-center rounded text-lg transition hover:scale-110 hover:bg-surface-2" aria-label={`React ${e}`}>
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

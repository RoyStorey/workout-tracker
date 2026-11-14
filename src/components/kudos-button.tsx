"use client";

import { useOptimistic, useTransition } from "react";
import { toggleKudos } from "@/lib/actions/challenges";
import { cx } from "@/lib/format";
import { ClapIcon } from "./icons";

export function KudosButton({ entryId, count, mine, disabled }: { entryId: number; count: number; mine: boolean; disabled?: boolean }) {
  const [, start] = useTransition();
  const [state, setState] = useOptimistic({ count, mine });
  return (
    <button
      type="button"
      disabled={disabled}
      title={disabled ? "Kudos" : state.mine ? "Remove kudos" : "Give kudos"}
      onClick={() =>
        start(async () => {
          setState((s) => ({ mine: !s.mine, count: s.count + (s.mine ? -1 : 1) }));
          await toggleKudos(entryId);
        })
      }
      className={cx(
        "flex shrink-0 items-center gap-1 rounded px-1.5 py-1 text-xs font-semibold transition",
        state.mine ? "text-ink" : "text-faint",
        disabled ? "cursor-default" : "hover:bg-surface-2 hover:text-ink active:translate-y-px",
        disabled && state.count === 0 && "invisible",
      )}
    >
      <ClapIcon size={14} />
      <span className="tnum">{state.count || ""}</span>
    </button>
  );
}

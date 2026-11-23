"use client";

import { useEffect, useState, useTransition } from "react";
import { deleteEntry, logEntry, type StreakNews } from "@/lib/actions/challenges";
import { tierFor } from "@/lib/streaks";
import { FlameGlyph } from "./streak";
import { StreakCelebration } from "./streak-celebration";
import { cx, fmtNum } from "@/lib/format";

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const buzz = (ms: number) => {
  try {
    navigator.vibrate?.(ms);
  } catch {}
};

export function QuickLog({
  challengeId,
  unit,
  quickAdds,
  minDay,
  maxDay,
  compact,
}: {
  challengeId: number;
  unit: string;
  exercise?: string;
  quickAdds: number[];
  minDay: string;
  maxDay: string | null;
  todayLeft?: number | null;
  compact?: boolean;
}) {
  const [pending, start] = useTransition();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [day, setDay] = useState("");
  const [today, setToday] = useState("");
  const [more, setMore] = useState(false);
  const [tally, setTally] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; id?: number; error?: boolean; streak?: StreakNews } | null>(null);
  const [party, setParty] = useState<StreakNews | null>(null);

  useEffect(() => {
    const t = localToday();
    const clamped = maxDay && t > maxDay ? maxDay : t;
    setToday(clamped);
    setDay((d) => d || clamped);
  }, [maxDay]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const submit = (n: number) => {
    if (!Number.isFinite(n) || n <= 0) return;
    start(async () => {
      const res = await logEntry(challengeId, n, day || today, note);
      if (res.ok) {
        buzz(15);
        setAmount("");
        setNote("");
        setTally(null);
        const other = day && today && day !== today;
        setToast({ msg: `Logged ${fmtNum(n)} ${unit}${other ? ` for ${day}` : ""}`, id: res.id, streak: res.streak.extended ? res.streak : undefined });
        if (res.streak.tierUp) setParty(res.streak);
      } else setToast({ msg: res.error, error: true });
    });
  };

  const undo = (id: number) =>
    start(async () => {
      await deleteEntry(id);
      setToast({ msg: "Removed" });
    });

  const backdated = !!day && !!today && day !== today;
  const buttons = quickAdds.slice(0, compact ? 4 : 6);

  const celebration = party?.tierUp ? <StreakCelebration tier={party.tierUp} days={party.days} onDone={() => setParty(null)} /> : null;

  if (tally != null)
    return (
      <div className="space-y-3">
        {celebration}
        <button
          type="button"
          onClick={() => {
            setTally((t) => (t ?? 0) + 1);
            buzz(8);
          }}
          className="display flex h-48 w-full select-none items-center justify-center rounded-lg border-2 border-ink text-8xl active:bg-surface-2"
          aria-label="Tap to count one"
        >
          {tally}
        </button>
        <p className="text-center text-xs text-muted">Tap anywhere on the box for each one. Doing pushups? Put the phone under your chest and tap it with your nose.</p>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost flex-1" onClick={() => setTally(null)}>Cancel</button>
          <button type="button" className="btn-ghost w-14" onClick={() => setTally((t) => Math.max(0, (t ?? 0) - 1))}>−1</button>
          <button type="button" className="btn-primary flex-1" disabled={!tally || pending} onClick={() => submit(tally)}>
            Save {tally || ""}
          </button>
        </div>
      </div>
    );

  return (
    <div>
      <div className="flex gap-2">
        {buttons.map((q) => (
          <button
            key={q}
            type="button"
            disabled={pending}
            onClick={() => submit(q)}
            className="display h-12 min-w-0 flex-1 rounded-md border border-line-strong bg-surface text-xl transition hover:border-ink active:translate-y-px active:bg-surface-2 disabled:opacity-50"
          >
            +{fmtNum(q)}
          </button>
        ))}
      </div>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit(Number(amount));
        }}
      >
        <input
          className="input tnum flex-1"
          inputMode="decimal"
          placeholder={`Other amount (${unit})`}
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
          aria-label={`Amount in ${unit}`}
        />
        <button className="btn-primary h-11 px-5" disabled={pending || !Number(amount)}>Log</button>
      </form>

      {!compact && (
        <div className="mt-2">
          {!more ? (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <button type="button" className="text-muted underline decoration-line-strong underline-offset-2 hover:text-ink" onClick={() => setMore(true)}>
                Different day or add a note
              </button>
              <button type="button" className="text-muted underline decoration-line-strong underline-offset-2 hover:text-ink" onClick={() => setTally(0)}>
                Tap counter
              </button>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
              <label className="flex items-center gap-2 text-sm text-muted">
                Day
                <input
                  type="date"
                  className={cx("input h-10 w-auto px-2 text-sm", backdated && "border-ink font-semibold")}
                  value={day}
                  min={minDay}
                  max={today || undefined}
                  onChange={(e) => setDay(e.target.value)}
                />
              </label>
              <input className="input h-10 text-sm" placeholder="Note (optional)" maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          )}
        </div>
      )}

      {celebration}
      {toast && (
        <div
          role="status"
          className={cx(
            "fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-sm items-center justify-between gap-3 rounded-md px-4 py-3 text-sm font-semibold shadow-xl sm:bottom-8",
            toast.error ? "bg-bad text-white" : "bg-primary text-primary-ink",
          )}
        >
          <span className="flex min-w-0 flex-col">
            <span>{toast.msg}</span>
            {toast.streak && (
              <span className="mt-0.5 flex items-center gap-1 text-xs font-medium opacity-90">
                <FlameGlyph color={tierFor(toast.streak.days)?.color ?? "#f5a524"} size={13} />
                {toast.streak.days === 1 ? "Streak started. Come back tomorrow." : `${toast.streak.days}-day streak!`}
              </span>
            )}
          </span>
          {toast.id && (
            <button type="button" onClick={() => undo(toast.id!)} className="underline underline-offset-2">
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

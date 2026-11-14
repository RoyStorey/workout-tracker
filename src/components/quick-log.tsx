"use client";

import { useEffect, useState, useTransition } from "react";
import { deleteEntry, logEntry } from "@/lib/actions/challenges";
import { fmtNum } from "@/lib/format";
import { cx } from "@/lib/format";

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function QuickLog({
  challengeId,
  unit,
  exercise,
  quickAdds,
  minDay,
  maxDay,
  todayLeft,
  compact,
}: {
  challengeId: number;
  unit: string;
  exercise: string;
  quickAdds: number[];
  minDay: string;
  maxDay: string | null;
  todayLeft: number | null;
  compact?: boolean;
}) {
  const [pending, start] = useTransition();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [day, setDay] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [tally, setTally] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; id?: number; error?: boolean } | null>(null);

  const [today, setToday] = useState("");
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
        try {
          navigator.vibrate?.(15);
        } catch {}
        setAmount("");
        setNote("");
        setTally(null);
        setToast({ msg: `+${fmtNum(n)} ${unit} logged`, id: res.id });
      } else setToast({ msg: res.error, error: true });
    });
  };

  const undo = (id: number) =>
    start(async () => {
      await deleteEntry(id);
      setToast({ msg: "Undone" });
    });

  const backdated = !!day && !!today && day !== today;

  return (
    <div className={cx("relative", !compact && "card p-4")}>
      {!compact && (
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h3 className="font-semibold">Log a set</h3>
          {todayLeft != null &&
            (todayLeft > 0 ? (
              <span className="text-sm text-muted">
                <b className="tnum text-ink">{fmtNum(Math.ceil(todayLeft))}</b> {unit} to stay on track today
              </span>
            ) : (
              <span className="text-sm font-medium text-good">Today&apos;s pace done ✓</span>
            ))}
        </div>
      )}

      {tally != null ? (
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setTally((t) => (t ?? 0) + 1);
              try {
                navigator.vibrate?.(8);
              } catch {}
            }}
            className="tnum flex h-44 w-full items-center justify-center rounded-2xl bg-accent-soft text-6xl font-bold text-accent active:scale-[0.98]"
            aria-label="Tap to count one"
          >
            {tally}
          </button>
          <p className="text-xs text-muted">Tap the pad for every {unit === "reps" ? "rep" : unit}. Put your phone on the floor and nose-tap it for pushups.</p>
          <div className="flex w-full gap-2">
            <button type="button" className="btn-ghost flex-1" onClick={() => setTally(null)}>Cancel</button>
            <button type="button" className="btn-ghost" onClick={() => setTally((t) => Math.max(0, (t ?? 0) - 1))}>−1</button>
            <button type="button" className="btn-primary flex-1" disabled={!tally || pending} onClick={() => submit(tally)}>
              Save {tally || ""}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className={cx("grid gap-2", compact ? "grid-cols-4" : "grid-cols-3 sm:grid-cols-6")}>
            {quickAdds.slice(0, compact ? 3 : 6).map((q) => (
              <button
                key={q}
                type="button"
                disabled={pending}
                onClick={() => submit(q)}
                className="btn tnum border border-line bg-surface-2 py-3 text-base hover:border-accent hover:text-accent"
              >
                +{fmtNum(q)}
              </button>
            ))}
            {compact && (
              <button type="button" onClick={() => setShowMore((s) => !s)} className="btn border border-line bg-surface py-3 text-muted">
                {showMore ? "Less" : "More"}
              </button>
            )}
          </div>

          {(!compact || showMore) && (
            <form
              className="mt-3 space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                submit(Number(amount));
              }}
            >
              <div className="flex gap-2">
                <input
                  className="input tnum flex-1"
                  inputMode="decimal"
                  placeholder={`Custom ${unit}`}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                  aria-label={`Amount in ${unit}`}
                />
                <button className="btn-primary px-5" disabled={pending || !Number(amount)}>Log</button>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <label className="flex items-center gap-2 text-muted">
                  Day
                  <input
                    type="date"
                    className={cx("input w-auto px-2 py-1.5 text-sm", backdated && "border-accent text-accent")}
                    value={day}
                    min={minDay}
                    max={today || undefined}
                    onChange={(e) => setDay(e.target.value)}
                  />
                </label>
                <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setTally(0)}>
                  Tally counter
                </button>
              </div>
              <input
                className="input py-2 text-sm"
                placeholder={`Note (optional), e.g. "${exercise} on the beach"`}
                maxLength={140}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </form>
          )}
        </>
      )}

      {toast && (
        <div
          role="status"
          className={cx(
            "fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-sm items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-2xl sm:bottom-6",
            toast.error ? "bg-bad text-white" : "bg-ink text-bg",
          )}
        >
          <span>{toast.msg}</span>
          {toast.id && (
            <button type="button" onClick={() => undo(toast.id!)} className="font-semibold underline underline-offset-2">
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

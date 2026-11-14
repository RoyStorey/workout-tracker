"use client";

import { useActionState, useState } from "react";
import { createChallenge, updateChallenge } from "@/lib/actions/challenges";
import { cx } from "@/lib/format";
import { FormMessage, SubmitButton } from "./forms";

type Values = {
  id?: number;
  title: string;
  description: string;
  exercise: string;
  unit: string;
  goal_type: "shared" | "individual";
  target: string;
  start_date: string;
  end_date: string;
  open_ended: boolean;
  visibility: "public" | "private";
  team_id: string;
  quick_adds: string;
};

const UNITS = ["reps", "minutes", "seconds", "miles", "km", "meters", "steps", "floors", "laps", "lbs", "kg", "calories", "sessions"];

function addDays(day: string, n: number) {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const TEMPLATES: { label: string; v: (today: string) => Partial<Values> }[] = [
  { label: "5,000 pushups / month", v: (t) => ({ title: "5,000 Pushup Month", exercise: "Pushups", unit: "reps", target: "5000", goal_type: "individual", end_date: addDays(t, 29), quick_adds: "10, 20, 25, 50" }) },
  { label: "Squad 10k squats", v: (t) => ({ title: "Squad 10K Squats", exercise: "Squats", unit: "reps", target: "10000", goal_type: "shared", end_date: addDays(t, 29), quick_adds: "15, 25, 50, 100" }) },
  { label: "100 miles in 30 days", v: (t) => ({ title: "100 Mile Month", exercise: "Running", unit: "miles", target: "100", goal_type: "individual", end_date: addDays(t, 29), quick_adds: "1, 2, 3.1, 5" }) },
  { label: "Plank 300 min", v: (t) => ({ title: "Plank-a-thon", exercise: "Plank", unit: "minutes", target: "300", goal_type: "individual", end_date: addDays(t, 29), quick_adds: "1, 2, 3, 5" }) },
  { label: "Most pull-ups wins", v: (t) => ({ title: "Pull-up Showdown", exercise: "Pull-ups", unit: "reps", target: "", goal_type: "individual", end_date: addDays(t, 13), quick_adds: "3, 5, 8, 10" }) },
  { label: "Lifetime tracker", v: () => ({ title: "Lifetime Pushups", exercise: "Pushups", unit: "reps", target: "", goal_type: "individual", open_ended: true, quick_adds: "10, 25, 50" }) },
];

export function ChallengeForm({
  initial,
  teams,
  today,
}: {
  initial?: Partial<Values>;
  teams: { id: number; name: string }[];
  today: string;
}) {
  const editing = !!initial?.id;
  const [state, action] = useActionState(editing ? updateChallenge : createChallenge, undefined);
  const [v, setV] = useState<Values>({
    title: "",
    description: "",
    exercise: "",
    unit: "reps",
    goal_type: "individual",
    target: "",
    start_date: today,
    end_date: addDays(today, 29),
    open_ended: false,
    visibility: "public",
    team_id: "",
    quick_adds: "10, 25, 50",
    ...initial,
  });
  const set = <K extends keyof Values>(k: K, val: Values[K]) => setV((s) => ({ ...s, [k]: val }));
  const days = !v.open_ended && v.end_date >= v.start_date
    ? Math.round((Date.parse(v.end_date) - Date.parse(v.start_date)) / 86400000) + 1
    : null;
  const perDay = days && Number(v.target) > 0 ? Number(v.target) / days : null;

  return (
    <form action={action} className="space-y-6">
      {editing && <input type="hidden" name="id" value={initial!.id} />}

      {!editing && (
        <div>
          <div className="h-section mb-2">Start from a template</div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {TEMPLATES.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => setV((s) => ({ ...s, open_ended: false, start_date: today, ...t.v(today) }))}
                className="pill shrink-0 cursor-pointer px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <section className="card space-y-4 p-5">
        <div>
          <label className="label" htmlFor="title">Challenge name</label>
          <input id="title" name="title" className="input" required maxLength={80} value={v.title} onChange={(e) => set("title", e.target.value)} placeholder="November Pushup Mission" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="exercise">Exercise</label>
            <input id="exercise" name="exercise" className="input" required maxLength={40} value={v.exercise} onChange={(e) => set("exercise", e.target.value)} placeholder="Pushups" />
          </div>
          <div>
            <label className="label" htmlFor="unit">Unit</label>
            <input id="unit" name="unit" className="input" list="units" required maxLength={20} value={v.unit} onChange={(e) => set("unit", e.target.value)} />
            <datalist id="units">{UNITS.map((u) => <option key={u} value={u} />)}</datalist>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="description">Description <span className="font-normal text-muted">(optional)</span></label>
          <textarea id="description" name="description" className="input min-h-20" maxLength={1000} value={v.description} onChange={(e) => set("description", e.target.value)} placeholder="Rules, trash talk, stakes. Loser buys pizza." />
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <div>
          <span className="label">Goal type</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {([
              ["individual", "Everyone hits the target", "Each member chases the same number on their own. Perfect for races."],
              ["shared", "One target, together", "Everyone's sets add up toward a single team goal."],
            ] as const).map(([val, title, desc]) => (
              <label key={val} className={cx("cursor-pointer rounded-xl border p-3 transition", v.goal_type === val ? "border-accent bg-accent-soft/40" : "border-line hover:bg-surface-2")}>
                <input type="radio" name="goal_type" value={val} className="sr-only" checked={v.goal_type === val} onChange={() => set("goal_type", val)} />
                <div className="text-sm font-semibold">{title}</div>
                <div className="text-xs text-muted">{desc}</div>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="target">
            Target {v.goal_type === "individual" ? "per person" : "for the group"} <span className="font-normal text-muted">(optional)</span>
          </label>
          <div className="flex items-center gap-2">
            <input id="target" name="target" className="input tnum" inputMode="decimal" value={v.target} onChange={(e) => set("target", e.target.value.replace(/[^\d.,]/g, ""))} placeholder="5000" />
            <span className="shrink-0 text-sm text-muted">{v.unit || "units"}</span>
          </div>
          <p className="hint">
            {perDay ? `That's about ${Math.ceil(perDay).toLocaleString()} ${v.unit} a day${v.goal_type === "shared" ? " as a group" : ""}.` : "Leave blank for a pure leaderboard: most wins."}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="start_date">Starts</label>
            <input id="start_date" name="start_date" type="date" className="input" required value={v.start_date} onChange={(e) => set("start_date", e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="end_date">Ends</label>
            <input id="end_date" name="end_date" type="date" className="input disabled:opacity-40" disabled={v.open_ended} min={v.start_date} required={!v.open_ended} value={v.end_date} onChange={(e) => set("end_date", e.target.value)} />
            <label className="mt-2 flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" name="open_ended" checked={v.open_ended} onChange={(e) => set("open_ended", e.target.checked)} className="accent-[var(--accent)]" />
              No end date (ongoing)
            </label>
          </div>
        </div>
        {days && <p className="text-sm text-muted">{days} days total.</p>}
      </section>

      <section className="card space-y-4 p-5">
        <div>
          <span className="label">Who can see it</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {([
              ["public", "Public", "Listed on Explore. Anyone can view and join."],
              ["private", "Private", "Hidden. Only people with your invite link (or your team) can see it."],
            ] as const).map(([val, title, desc]) => (
              <label key={val} className={cx("cursor-pointer rounded-xl border p-3 transition", v.visibility === val ? "border-accent bg-accent-soft/40" : "border-line hover:bg-surface-2")}>
                <input type="radio" name="visibility" value={val} className="sr-only" checked={v.visibility === val} onChange={() => set("visibility", val)} />
                <div className="text-sm font-semibold">{title}</div>
                <div className="text-xs text-muted">{desc}</div>
              </label>
            ))}
          </div>
        </div>
        {teams.length > 0 && (
          <div>
            <label className="label" htmlFor="team_id">Host under a team <span className="font-normal text-muted">(optional)</span></label>
            <select id="team_id" name="team_id" className="input" value={v.team_id} onChange={(e) => set("team_id", e.target.value)}>
              <option value="">No team</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <p className="hint">Team members can see and join it from the team page, even if it&apos;s private.</p>
          </div>
        )}
        <div>
          <label className="label" htmlFor="quick_adds">Quick-add buttons</label>
          <input id="quick_adds" name="quick_adds" className="input tnum" value={v.quick_adds} onChange={(e) => set("quick_adds", e.target.value)} placeholder="10, 25, 50" />
          <p className="hint">Up to 6 one-tap amounts, separated by commas.</p>
        </div>
      </section>

      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full py-3 text-base">{editing ? "Save changes" : "Create challenge"}</SubmitButton>
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";
import { createChallenge, updateChallenge } from "@/lib/actions/challenges";
import { cx } from "@/lib/format";
import { FormMessage, SubmitButton } from "./forms";

type Format = "individual" | "shared" | "battle";
type SquadRow = { id: number | null; name: string; key: number };

export type ChallengeValues = {
  id?: number;
  title: string;
  description: string;
  exercise: string;
  unit: string;
  format: Format;
  target: string;
  start_date: string;
  end_date: string;
  open_ended: boolean;
  visibility: "public" | "private";
  team_id: string;
  quick_adds: string;
  scoring: "total" | "average";
  open_squads: boolean;
  squads: { id: number | null; name: string }[];
};

const UNITS = ["reps", "minutes", "seconds", "miles", "km", "meters", "steps", "floors", "laps", "lbs", "kg", "calories", "sessions"];
const PHONETIC = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel"];

function addDays(day: string, n: number) {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const FORMATS: { id: Format; title: string; body: string }[] = [
  { id: "individual", title: "Personal goal", body: "Everyone chases the same number on their own. Who finishes first?" },
  { id: "shared", title: "Group goal", body: "Everyone's reps add up toward one big total." },
  { id: "battle", title: "Squad battle", body: "Split people into squads. Most reps by the end wins." },
];

const TEMPLATES: { label: string; v: (today: string) => Partial<ChallengeValues> }[] = [
  { label: "5,000 pushups in a month", v: (t) => ({ format: "individual", title: "5,000 Pushup Month", exercise: "Pushups", unit: "reps", target: "5000", end_date: addDays(t, 29), quick_adds: "10, 20, 25, 50" }) },
  { label: "Squadron pushup battle", v: (t) => ({ format: "battle", title: "Squadron Pushup Battle", exercise: "Pushups", unit: "reps", target: "", end_date: addDays(t, 29), scoring: "average", quick_adds: "10, 20, 25, 50" }) },
  { label: "Group 10K squats", v: (t) => ({ format: "shared", title: "Group 10K Squats", exercise: "Squats", unit: "reps", target: "10000", end_date: addDays(t, 29), quick_adds: "15, 25, 50, 100" }) },
  { label: "100 miles in 30 days", v: (t) => ({ format: "individual", title: "100 Mile Month", exercise: "Running", unit: "miles", target: "100", end_date: addDays(t, 29), quick_adds: "1, 2, 3.1, 5" }) },
  { label: "Lifetime tracker", v: () => ({ format: "individual", title: "Lifetime Pushups", exercise: "Pushups", unit: "reps", target: "", open_ended: true, quick_adds: "10, 25, 50" }) },
];

let keySeq = 1;
const toRows = (s: { id: number | null; name: string }[]): SquadRow[] => s.map((q) => ({ ...q, key: keySeq++ }));

export function ChallengeForm({ initial, teams, today }: { initial?: Partial<ChallengeValues>; teams: { id: number; name: string }[]; today: string }) {
  const editing = !!initial?.id;
  const [state, action] = useActionState(editing ? updateChallenge : createChallenge, undefined);
  const [v, setV] = useState<ChallengeValues>({
    title: "",
    description: "",
    exercise: "",
    unit: "reps",
    format: "individual",
    target: "",
    start_date: today,
    end_date: addDays(today, 29),
    open_ended: false,
    visibility: "public",
    team_id: "",
    quick_adds: "10, 25, 50",
    scoring: "total",
    open_squads: false,
    squads: [],
    ...initial,
  });
  const [squads, setSquads] = useState<SquadRow[]>(toRows(initial?.squads?.length ? initial.squads : PHONETIC.slice(0, 4).map((name) => ({ id: null, name }))));
  const set = <K extends keyof ChallengeValues>(k: K, val: ChallengeValues[K]) => setV((s) => ({ ...s, [k]: val }));
  const battle = v.format === "battle";
  const days = !v.open_ended && v.end_date >= v.start_date ? Math.round((Date.parse(v.end_date) - Date.parse(v.start_date)) / 86400000) + 1 : null;
  const perDay = days && Number(v.target.replace(/,/g, "")) > 0 ? Number(v.target.replace(/,/g, "")) / days : null;

  return (
    <form action={action} className="space-y-10">
      {editing && <input type="hidden" name="id" value={initial!.id} />}
      <input type="hidden" name="format" value={v.format} />

      {!editing && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <span className="text-muted">Start from:</span>
          {TEMPLATES.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => setV((s) => ({ ...s, open_ended: false, start_date: today, scoring: "total", ...t.v(today) }))}
              className="font-semibold underline decoration-line-strong underline-offset-[3px] hover:decoration-ink"
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <Step n={1} title="What kind of challenge?">
        <div className="grid gap-2 sm:grid-cols-3">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => set("format", f.id)}
              aria-pressed={v.format === f.id}
              className={cx("flex flex-col items-start justify-start rounded-md border p-4 text-left transition", v.format === f.id ? "border-ink bg-surface ring-1 ring-ink" : "border-line-strong bg-surface hover:border-ink")}
            >
              <div className="font-bold">{f.title}</div>
              <div className="mt-1 text-sm text-muted">{f.body}</div>
            </button>
          ))}
        </div>
      </Step>

      <Step n={2} title="The basics">
        <div className="space-y-4">
          <Field label="Name" htmlFor="title">
            <input id="title" name="title" className="input" required maxLength={80} value={v.title} onChange={(e) => set("title", e.target.value)} placeholder="November Pushup Mission" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Exercise" htmlFor="exercise">
              <input id="exercise" name="exercise" className="input" required maxLength={40} value={v.exercise} onChange={(e) => set("exercise", e.target.value)} placeholder="Pushups" />
            </Field>
            <Field label="Counted in" htmlFor="unit">
              <input id="unit" name="unit" className="input" list="units" required maxLength={20} value={v.unit} onChange={(e) => set("unit", e.target.value)} />
              <datalist id="units">{UNITS.map((u) => <option key={u} value={u} />)}</datalist>
            </Field>
          </div>
          <Field label="Description" optional htmlFor="description">
            <textarea id="description" name="description" className="input min-h-20 py-2" maxLength={1000} value={v.description} onChange={(e) => set("description", e.target.value)} placeholder="Rules, stakes, trash talk." />
          </Field>
        </div>
      </Step>

      <Step n={3} title={battle ? "Squads and scoring" : "Goal and dates"}>
        <div className="space-y-5">
          {battle ? (
            <>
              <div>
                <div className="label">Squads</div>
                <div className="space-y-2">
                  {squads.map((q, i) => (
                    <div key={q.key} className="flex items-center gap-2">
                      <span className="h-3 w-3 shrink-0 rounded-[2px]" style={{ background: `var(--cat-${(i % 8) + 1})` }} />
                      <input type="hidden" name="squad_id" value={q.id ?? ""} />
                      <input
                        name="squad_name"
                        className="input h-10"
                        maxLength={30}
                        value={q.name}
                        aria-label={`Squad ${i + 1} name`}
                        onChange={(e) => setSquads((rows) => rows.map((r) => (r.key === q.key ? { ...r, name: e.target.value } : r)))}
                      />
                      <button
                        type="button"
                        disabled={squads.length <= 2}
                        onClick={() => setSquads((rows) => rows.filter((r) => r.key !== q.key))}
                        className="btn-ghost h-10 w-10 shrink-0 px-0 text-muted"
                        aria-label={`Remove ${q.name || "squad"}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                {squads.length < 8 && (
                  <button
                    type="button"
                    className="mt-2 text-sm font-semibold underline decoration-line-strong underline-offset-[3px] hover:decoration-ink"
                    onClick={() => setSquads((rows) => [...rows, { id: null, name: PHONETIC.find((p) => !rows.some((r) => r.name === p)) ?? `Squad ${rows.length + 1}`, key: keySeq++ }])}
                  >
                    + Add a squad
                  </button>
                )}
                <p className="hint">People pick their squad when they join. You can move anyone later from the challenge page.</p>
                {editing && <p className="hint text-bad">Removing a squad leaves its members without one until you reassign them.</p>}
              </div>
              <div>
                <div className="label">How is the winner decided?</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {([
                    ["total", "Most total", `The squad with the most ${v.unit || "reps"} wins. Best when squads are the same size.`],
                    ["average", "Best average per member", "Total divided by squad size, so a squad of 6 can beat a squad of 12."],
                  ] as const).map(([val, title, body]) => (
                    <label key={val} className={cx("cursor-pointer rounded-md border p-3", v.scoring === val ? "border-ink ring-1 ring-ink" : "border-line-strong hover:border-ink")}>
                      <input type="radio" name="scoring" value={val} className="sr-only" checked={v.scoring === val} onChange={() => set("scoring", val)} />
                      <div className="text-sm font-bold">{title}</div>
                      <div className="text-xs text-muted">{body}</div>
                    </label>
                  ))}
                </div>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="open_squads" checked={v.open_squads} onChange={(e) => set("open_squads", e.target.checked)} className="mt-0.5 accent-[var(--ink)]" />
                <span>
                  Let people start their own squads
                  <span className="block text-xs text-muted">Otherwise only you can add squads.</span>
                </span>
              </label>
            </>
          ) : (
            <Field label={v.format === "individual" ? "Target per person" : "Target for the group"} optional htmlFor="target">
              <div className="flex items-center gap-2">
                <input id="target" name="target" className="input tnum" inputMode="decimal" value={v.target} onChange={(e) => set("target", e.target.value.replace(/[^\d.,]/g, ""))} placeholder="5000" />
                <span className="shrink-0 text-sm text-muted">{v.unit || "units"}</span>
              </div>
              <p className="hint">
                {perDay
                  ? `About ${Math.ceil(perDay).toLocaleString()} ${v.unit} a day${v.format === "shared" ? " across the group" : " each"}.`
                  : "Leave it blank and it's simply most-wins."}
              </p>
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starts" htmlFor="start_date">
              <input id="start_date" name="start_date" type="date" className="input" required value={v.start_date} onChange={(e) => set("start_date", e.target.value)} />
            </Field>
            <Field label="Ends" htmlFor="end_date">
              <input id="end_date" name="end_date" type="date" className="input disabled:opacity-40" disabled={v.open_ended} min={v.start_date} required={!v.open_ended} value={v.end_date} onChange={(e) => set("end_date", e.target.value)} />
              <label className="mt-2 flex items-center gap-2 text-sm text-muted">
                <input type="checkbox" name="open_ended" checked={v.open_ended} onChange={(e) => set("open_ended", e.target.checked)} className="accent-[var(--ink)]" />
                No end date
              </label>
            </Field>
          </div>
          {days && <p className="text-sm text-muted">{days} days.</p>}
        </div>
      </Step>

      <Step n={4} title="Who can join">
        <div className="space-y-5">
          <div className="grid gap-2 sm:grid-cols-2">
            {([
              ["public", "Public", "Listed on Explore. Anyone can join."],
              ["private", "Private", "Hidden. Only people with your invite link can see it."],
            ] as const).map(([val, title, body]) => (
              <label key={val} className={cx("cursor-pointer rounded-md border p-3", v.visibility === val ? "border-ink ring-1 ring-ink" : "border-line-strong hover:border-ink")}>
                <input type="radio" name="visibility" value={val} className="sr-only" checked={v.visibility === val} onChange={() => set("visibility", val)} />
                <div className="text-sm font-bold">{title}</div>
                <div className="text-xs text-muted">{body}</div>
              </label>
            ))}
          </div>
          {teams.length > 0 && (
            <Field label="Host under a team" optional htmlFor="team_id">
              <select id="team_id" name="team_id" className="input" value={v.team_id} onChange={(e) => set("team_id", e.target.value)}>
                <option value="">No team</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <p className="hint">Team members can always see and join it, even when it&apos;s private.</p>
            </Field>
          )}
          <Field label="One-tap buttons" htmlFor="quick_adds">
            <input id="quick_adds" name="quick_adds" className="input tnum" value={v.quick_adds} onChange={(e) => set("quick_adds", e.target.value)} placeholder="10, 25, 50" />
            <p className="hint">The amounts people can log with one tap. Up to 6, separated by commas.</p>
          </Field>
        </div>
      </Step>

      <div className="space-y-3 border-t border-line pt-6">
        <FormMessage state={state} />
        <SubmitButton className="btn-primary h-12 w-full text-base sm:w-auto sm:px-10">{editing ? "Save changes" : "Create challenge"}</SubmitButton>
        {!editing && battle && <p className="text-xs text-muted">You won&apos;t be on a squad until you pick one, so you can just referee if you like.</p>}
      </div>
    </form>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 sm:grid-cols-[180px_1fr]">
      <div>
        <div className="display text-3xl text-faint">{String(n).padStart(2, "0")}</div>
        <h2 className="font-bold">{title}</h2>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function Field({ label, optional, htmlFor, children }: { label: string; optional?: boolean; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label} {optional && <span className="font-normal text-muted">(optional)</span>}
      </label>
      {children}
    </div>
  );
}

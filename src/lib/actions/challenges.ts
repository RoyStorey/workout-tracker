"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, now } from "../db";
import { getCurrentUser, getToday, rateLimit, requireUser } from "../auth";
import { addDays, diffDays, isDay } from "../dates";
import { randomCode, slugify } from "../ids";
import { canViewChallenge, getChallengeById, isChallengeMember, isTeamMember } from "../queries";
import type { FormState } from "./auth";

const day = z.string().refine(isDay, "Pick a valid date");

const challengeSchema = z
  .object({
    title: z.string().trim().min(3, "Give it a name (3+ characters)").max(80),
    description: z.string().trim().max(1000),
    exercise: z.string().trim().min(2, "What exercise?").max(40),
    unit: z.string().trim().min(1, "What unit?").max(20),
    goal_type: z.enum(["shared", "individual"]),
    target: z.number().positive("Target must be positive").max(1e9).nullable(),
    start_date: day,
    end_date: day.nullable(),
    visibility: z.enum(["public", "private"]),
    team_id: z.number().int().positive().nullable(),
    quick_adds: z.string(),
  })
  .refine((v) => !v.end_date || v.end_date >= v.start_date, { message: "End date must be on or after the start date" })
  .refine((v) => !v.end_date || diffDays(v.start_date, v.end_date) <= 3660, { message: "Keep it under 10 years" });

function parseChallengeForm(form: FormData) {
  const num = (k: string) => {
    const s = String(form.get(k) ?? "").replace(/,/g, "").trim();
    return s === "" ? null : Number(s);
  };
  const openEnded = form.get("open_ended") === "on";
  const quick = String(form.get("quick_adds") ?? "")
    .split(/[\s,]+/)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0 && n <= 100000)
    .slice(0, 6);
  return challengeSchema.safeParse({
    title: form.get("title") ?? "",
    description: form.get("description") ?? "",
    exercise: form.get("exercise") ?? "",
    unit: form.get("unit") ?? "",
    goal_type: form.get("goal_type"),
    target: num("target"),
    start_date: form.get("start_date") ?? "",
    end_date: openEnded ? null : String(form.get("end_date") ?? ""),
    visibility: form.get("visibility"),
    team_id: num("team_id") || null,
    quick_adds: (quick.length ? quick : [10, 25, 50]).join(","),
  });
}

function uniqueSlug(title: string) {
  const base = slugify(title);
  for (;;) {
    const slug = `${base}-${randomCode(4)}`;
    if (!db().prepare("SELECT 1 FROM challenges WHERE slug = ?").get(slug)) return slug;
  }
}

export async function createChallenge(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = parseChallengeForm(form);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  if (v.team_id && !isTeamMember(v.team_id, user.id)) return { error: "You're not on that team" };
  const slug = uniqueSlug(v.title);
  const d = db();
  d.transaction(() => {
    const res = d
      .prepare(
        `INSERT INTO challenges (slug, title, description, exercise, unit, goal_type, target, start_date, end_date,
           visibility, invite_code, owner_id, team_id, quick_adds, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        slug, v.title, v.description, v.exercise, v.unit, v.goal_type, v.target, v.start_date, v.end_date,
        v.visibility, randomCode(10), user.id, v.team_id, v.quick_adds, now(),
      );
    d.prepare("INSERT INTO challenge_members (challenge_id, user_id, joined_at) VALUES (?, ?, ?)").run(
      res.lastInsertRowid, user.id, now(),
    );
  })();
  redirect(`/c/${slug}`);
}

async function requireOwner(challengeId: number) {
  const user = await requireUser();
  const c = getChallengeById(challengeId);
  if (!c) throw new Error("Challenge not found");
  if (c.owner_id !== user.id) throw new Error("Only the challenge owner can do that");
  return { user, c };
}

export async function updateChallenge(_: FormState, form: FormData): Promise<FormState> {
  const { user, c } = await requireOwner(Number(form.get("id")));
  const parsed = parseChallengeForm(form);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  if (v.team_id && v.team_id !== c.team_id && !isTeamMember(v.team_id, user.id)) return { error: "You're not on that team" };
  const outside = db()
    .prepare("SELECT COUNT(*) AS n FROM entries WHERE challenge_id = ? AND (day < ? OR (? IS NOT NULL AND day > ?))")
    .get(c.id, v.start_date, v.end_date, v.end_date) as { n: number };
  if (outside.n > 0) return { error: `${outside.n} logged set(s) fall outside those dates. Widen the range.` };
  db()
    .prepare(
      `UPDATE challenges SET title=?, description=?, exercise=?, unit=?, goal_type=?, target=?, start_date=?, end_date=?,
         visibility=?, team_id=?, quick_adds=? WHERE id=?`,
    )
    .run(v.title, v.description, v.exercise, v.unit, v.goal_type, v.target, v.start_date, v.end_date, v.visibility, v.team_id, v.quick_adds, c.id);
  redirect(`/c/${c.slug}`);
}

export async function deleteChallenge(id: number) {
  const { c } = await requireOwner(id);
  db().prepare("DELETE FROM challenges WHERE id = ?").run(c.id);
  redirect("/");
}

export async function regenerateChallengeInvite(id: number) {
  const { c } = await requireOwner(id);
  db().prepare("UPDATE challenges SET invite_code = ? WHERE id = ?").run(randomCode(10), c.id);
  revalidatePath(`/c/${c.slug}`);
}

export async function joinChallenge(id: number, key: string | null) {
  const c = getChallengeById(id);
  if (!c) throw new Error("Challenge not found");
  const user = await getCurrentUser();
  if (!user) redirect(`/signup?next=${encodeURIComponent(`/c/${c.slug}${key ? `?k=${key}` : ""}`)}`);
  if (!canViewChallenge(c, user.id, key)) throw new Error("This challenge is invite-only");
  db().prepare("INSERT OR IGNORE INTO challenge_members (challenge_id, user_id, joined_at) VALUES (?, ?, ?)").run(c.id, user.id, now());
  redirect(`/c/${c.slug}`);
}

export async function leaveChallenge(id: number) {
  const user = await requireUser();
  const c = getChallengeById(id);
  if (!c) return;
  if (c.owner_id === user.id) throw new Error("Owners can't leave; delete the challenge instead");
  const d = db();
  d.transaction(() => {
    d.prepare("DELETE FROM entries WHERE challenge_id = ? AND user_id = ?").run(c.id, user.id);
    d.prepare("DELETE FROM challenge_members WHERE challenge_id = ? AND user_id = ?").run(c.id, user.id);
  })();
  redirect(`/c/${c.slug}`);
}

export async function removeMember(challengeId: number, userId: number) {
  const { c, user } = await requireOwner(challengeId);
  if (userId === user.id) return;
  const d = db();
  d.transaction(() => {
    d.prepare("DELETE FROM entries WHERE challenge_id = ? AND user_id = ?").run(c.id, userId);
    d.prepare("DELETE FROM challenge_members WHERE challenge_id = ? AND user_id = ?").run(c.id, userId);
  })();
  revalidatePath(`/c/${c.slug}`);
}

// ---------- logging ----------

export type LogResult = { ok: true; id: number } | { ok: false; error: string };

export async function logEntry(challengeId: number, amount: number, dayStr: string, note: string): Promise<LogResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first" };
  if (!(await rateLimit(`log:${user.id}`, 120, 60_000))) return { ok: false, error: "Whoa, slow down a little" };
  const c = getChallengeById(challengeId);
  if (!c) return { ok: false, error: "Challenge not found" };
  if (!isChallengeMember(c.id, user.id)) return { ok: false, error: "Join the challenge first" };
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) return { ok: false, error: "Enter a positive amount" };
  if (!isDay(dayStr)) return { ok: false, error: "Bad date" };
  // Allow a day of slack for time-zone differences between the browser and the server cookie.
  const latest = addDays(await getToday(), 1);
  if (dayStr > latest) return { ok: false, error: "Can't log sets in the future" };
  if (dayStr < c.start_date) return { ok: false, error: "That's before the challenge starts" };
  if (c.end_date && dayStr > c.end_date) return { ok: false, error: "That's after the challenge ended" };
  const res = db()
    .prepare("INSERT INTO entries (challenge_id, user_id, amount, day, note, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(c.id, user.id, Math.round(amount * 100) / 100, dayStr, note.trim().slice(0, 140), now());
  revalidatePath(`/c/${c.slug}`);
  revalidatePath("/");
  return { ok: true, id: Number(res.lastInsertRowid) };
}

export async function deleteEntry(entryId: number) {
  const user = await requireUser();
  const row = db()
    .prepare("SELECT e.user_id, c.slug, c.owner_id FROM entries e JOIN challenges c ON c.id = e.challenge_id WHERE e.id = ?")
    .get(entryId) as { user_id: number; slug: string; owner_id: number | null } | undefined;
  if (!row) return;
  if (row.user_id !== user.id && row.owner_id !== user.id) throw new Error("Not your set");
  db().prepare("DELETE FROM entries WHERE id = ?").run(entryId);
  revalidatePath(`/c/${row.slug}`);
  revalidatePath("/");
}

export async function toggleKudos(entryId: number) {
  const user = await getCurrentUser();
  if (!user) return;
  const row = db()
    .prepare("SELECT c.id, c.slug FROM entries e JOIN challenges c ON c.id = e.challenge_id WHERE e.id = ?")
    .get(entryId) as { id: number; slug: string } | undefined;
  if (!row) return;
  const c = getChallengeById(row.id)!;
  if (!canViewChallenge(c, user.id)) return;
  const d = db();
  const had = d.prepare("DELETE FROM kudos WHERE entry_id = ? AND user_id = ?").run(entryId, user.id);
  if (had.changes === 0) d.prepare("INSERT INTO kudos (entry_id, user_id, created_at) VALUES (?, ?, ?)").run(entryId, user.id, now());
  revalidatePath(`/c/${row.slug}`);
}

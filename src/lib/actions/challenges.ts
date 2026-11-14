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
import { notifyChallenge } from "../live";

const day = z.string().refine(isDay, "Pick a valid date");

const challengeSchema = z
  .object({
    title: z.string().trim().min(3, "Give it a name (3+ characters)").max(80),
    description: z.string().trim().max(1000),
    exercise: z.string().trim().min(2, "What exercise?").max(40),
    unit: z.string().trim().min(1, "What unit?").max(20),
    format: z.enum(["shared", "individual", "battle"]),
    target: z.number().positive("Target must be positive").max(1e9).nullable(),
    start_date: day,
    end_date: day.nullable(),
    visibility: z.enum(["public", "private"]),
    team_id: z.number().int().positive().nullable(),
    quick_adds: z.string(),
    scoring: z.enum(["total", "average"]),
    open_squads: z.boolean(),
    squads: z.array(z.object({ id: z.number().int().positive().nullable(), name: z.string().trim().min(1).max(30) })),
  })
  .refine((v) => !v.end_date || v.end_date >= v.start_date, { message: "End date must be on or after the start date" })
  .refine((v) => !v.end_date || diffDays(v.start_date, v.end_date) <= 3660, { message: "Keep it under 10 years" })
  .refine((v) => v.format !== "battle" || v.squads.length >= 2, { message: "A battle needs at least 2 squads" })
  .refine((v) => v.squads.length <= 8, { message: "8 squads max" })
  .refine((v) => new Set(v.squads.map((q) => q.name.toLowerCase())).size === v.squads.length, { message: "Squad names must be different" });

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
    format: form.get("format"),
    target: form.get("format") === "battle" ? null : num("target"),
    start_date: form.get("start_date") ?? "",
    end_date: openEnded ? null : String(form.get("end_date") ?? ""),
    visibility: form.get("visibility"),
    team_id: num("team_id") || null,
    quick_adds: (quick.length ? quick : [10, 25, 50]).join(","),
    scoring: form.get("scoring") === "average" ? "average" : "total",
    open_squads: form.get("open_squads") === "on",
    squads:
      form.get("format") === "battle"
        ? form
            .getAll("squad_name")
            .map((n, i) => ({ id: Number(form.getAll("squad_id")[i]) || null, name: String(n).trim() }))
            .filter((q) => q.name)
        : [],
  });
}

type Parsed = Extract<ReturnType<typeof parseChallengeForm>, { success: true }>["data"];
const goalType = (v: Parsed) => (v.format === "individual" ? "individual" : "shared");
const kind = (v: Parsed) => (v.format === "battle" ? "battle" : "standard");

/** Make the challenge's squads match the form: rename kept ones, add new ones, drop removed ones. */
function syncSquads(challengeId: number, squads: Parsed["squads"]) {
  const d = db();
  const existing = d.prepare("SELECT id, slot FROM squads WHERE challenge_id = ?").all(challengeId) as { id: number; slot: number }[];
  const keep = new Set(squads.map((q) => q.id).filter(Boolean));
  for (const e of existing) if (!keep.has(e.id)) d.prepare("DELETE FROM squads WHERE id = ?").run(e.id);
  // Temporarily rename to avoid unique-name clashes when names are swapped.
  for (const q of squads) if (q.id) d.prepare("UPDATE squads SET name = ? WHERE id = ? AND challenge_id = ?").run(`__${q.id}`, q.id, challengeId);
  const used = new Set(existing.filter((e) => keep.has(e.id)).map((e) => e.slot));
  for (const q of squads) {
    if (q.id && keep.has(q.id) && existing.some((e) => e.id === q.id)) {
      d.prepare("UPDATE squads SET name = ? WHERE id = ?").run(q.name, q.id);
    } else {
      let slot = 0;
      while (used.has(slot)) slot++;
      used.add(slot);
      d.prepare("INSERT INTO squads (challenge_id, name, slot, created_at) VALUES (?, ?, ?, ?)").run(challengeId, q.name, slot, now());
    }
  }
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
           visibility, invite_code, owner_id, team_id, quick_adds, created_at, kind, scoring, open_squads)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        slug, v.title, v.description, v.exercise, v.unit, goalType(v), v.target, v.start_date, v.end_date,
        v.visibility, randomCode(10), user.id, v.team_id, v.quick_adds, now(), kind(v), v.scoring, v.open_squads ? 1 : 0,
      );
    if (v.format === "battle") syncSquads(res.lastInsertRowid, v.squads);
    // In a battle the organizer often referees, so they only join when they pick a squad.
    if (v.format !== "battle")
      d.prepare("INSERT INTO challenge_members (challenge_id, user_id, joined_at) VALUES (?, ?, ?)").run(res.lastInsertRowid, user.id, now());
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
  const d = db();
  d.transaction(() => {
    d.prepare(
      `UPDATE challenges SET title=?, description=?, exercise=?, unit=?, goal_type=?, target=?, start_date=?, end_date=?,
         visibility=?, team_id=?, quick_adds=?, kind=?, scoring=?, open_squads=? WHERE id=?`,
    ).run(
      v.title, v.description, v.exercise, v.unit, goalType(v), v.target, v.start_date, v.end_date, v.visibility, v.team_id,
      v.quick_adds, kind(v), v.scoring, v.open_squads ? 1 : 0, c.id,
    );
    syncSquads(c.id, v.squads);
  })();
  notifyChallenge(c.id);
  redirect(`/c/${c.slug}`);
}

export async function deleteChallenge(id: number) {
  const { c } = await requireOwner(id);
  db().prepare("DELETE FROM challenges WHERE id = ?").run(c.id);
  notifyChallenge(c.id);
  redirect("/");
}

export async function regenerateChallengeInvite(id: number) {
  const { c } = await requireOwner(id);
  db().prepare("UPDATE challenges SET invite_code = ? WHERE id = ?").run(randomCode(10), c.id);
  revalidatePath(`/c/${c.slug}`);
}

export async function joinChallenge(id: number, key: string | null, squadId?: number | null) {
  const c = getChallengeById(id);
  if (!c) throw new Error("Challenge not found");
  const user = await getCurrentUser();
  if (!user) redirect(`/signup?next=${encodeURIComponent(`/c/${c.slug}${key ? `?k=${key}` : ""}`)}`);
  if (!canViewChallenge(c, user.id, key)) throw new Error("This challenge is invite-only");
  let squad: number | null = null;
  if (c.kind === "battle") {
    const ok = squadId && db().prepare("SELECT 1 FROM squads WHERE id = ? AND challenge_id = ?").get(squadId, c.id);
    if (!ok) throw new Error("Pick a squad to join");
    squad = squadId!;
  }
  db()
    .prepare(
      `INSERT INTO challenge_members (challenge_id, user_id, joined_at, squad_id) VALUES (?, ?, ?, ?)
       ON CONFLICT(challenge_id, user_id) DO UPDATE SET squad_id = COALESCE(excluded.squad_id, squad_id)`,
    )
    .run(c.id, user.id, now(), squad);
  notifyChallenge(c.id);
  redirect(`/c/${c.slug}${key && c.visibility === "private" ? `?k=${key}` : ""}`);
}

/** Start a new squad in a battle (owner always; members if the battle allows it). The creator joins it. */
export async function createSquad(id: number, key: string | null, form: FormData) {
  const user = await requireUser();
  const c = getChallengeById(id);
  if (!c || c.kind !== "battle") throw new Error("Not a battle");
  if (!canViewChallenge(c, user.id, key)) throw new Error("This challenge is invite-only");
  if (c.owner_id !== user.id && !c.open_squads) throw new Error("Only the organizer can add squads");
  const name = String(form.get("name") ?? "").trim().slice(0, 30);
  if (!name) return;
  const d = db();
  const count = (d.prepare("SELECT COUNT(*) AS n FROM squads WHERE challenge_id = ?").get(c.id) as { n: number }).n;
  if (count >= 8) throw new Error("8 squads max");
  if (d.prepare("SELECT 1 FROM squads WHERE challenge_id = ? AND name = ? COLLATE NOCASE").get(c.id, name)) throw new Error("That squad name is taken");
  const used = new Set((d.prepare("SELECT slot FROM squads WHERE challenge_id = ?").all(c.id) as { slot: number }[]).map((r) => r.slot));
  let slot = 0;
  while (used.has(slot)) slot++;
  const res = d.prepare("INSERT INTO squads (challenge_id, name, slot, created_at) VALUES (?, ?, ?, ?)").run(c.id, name, slot, now());
  if (c.owner_id !== user.id || form.get("join") === "on") {
    d.prepare(
      `INSERT INTO challenge_members (challenge_id, user_id, joined_at, squad_id) VALUES (?, ?, ?, ?)
       ON CONFLICT(challenge_id, user_id) DO UPDATE SET squad_id = excluded.squad_id`,
    ).run(c.id, user.id, now(), res.lastInsertRowid);
  }
  notifyChallenge(c.id);
  revalidatePath(`/c/${c.slug}`);
}

/** Move someone to a squad. Organizers can move anyone; members can switch themselves until they've logged. */
export async function setSquad(challengeId: number, userId: number, form: FormData) {
  const user = await requireUser();
  const c = getChallengeById(challengeId);
  if (!c || c.kind !== "battle") return;
  const squadId = Number(form.get("squad_id")) || null;
  const isOwner = c.owner_id === user.id;
  if (!isOwner) {
    if (userId !== user.id) throw new Error("Only the organizer can move other people");
    const logged = db().prepare("SELECT 1 FROM entries WHERE challenge_id = ? AND user_id = ? LIMIT 1").get(c.id, user.id);
    if (logged) throw new Error("You've already logged for your squad. Ask the organizer to move you.");
  }
  if (squadId && !db().prepare("SELECT 1 FROM squads WHERE id = ? AND challenge_id = ?").get(squadId, c.id)) return;
  db().prepare("UPDATE challenge_members SET squad_id = ? WHERE challenge_id = ? AND user_id = ?").run(squadId, c.id, userId);
  notifyChallenge(c.id);
  revalidatePath(`/c/${c.slug}`);
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
  notifyChallenge(c.id);
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
  notifyChallenge(c.id);
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
  notifyChallenge(c.id);
  revalidatePath(`/c/${c.slug}`);
  revalidatePath("/");
  return { ok: true, id: Number(res.lastInsertRowid) };
}

export async function deleteEntry(entryId: number) {
  const user = await requireUser();
  const row = db()
    .prepare("SELECT e.user_id, c.id, c.slug, c.owner_id FROM entries e JOIN challenges c ON c.id = e.challenge_id WHERE e.id = ?")
    .get(entryId) as { user_id: number; id: number; slug: string; owner_id: number | null } | undefined;
  if (!row) return;
  if (row.user_id !== user.id && row.owner_id !== user.id) throw new Error("Not your set");
  db().prepare("DELETE FROM entries WHERE id = ?").run(entryId);
  notifyChallenge(row.id);
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
  notifyChallenge(row.id);
  revalidatePath(`/c/${row.slug}`);
}

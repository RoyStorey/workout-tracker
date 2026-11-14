"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, now } from "../db";
import { getCurrentUser, requireUser } from "../auth";
import crypto from "node:crypto";
import { randomCode } from "../ids";
import { canViewTeam, type Team } from "../queries";
import type { FormState } from "./auth";

const teamSchema = z.object({
  name: z.string().trim().min(2, "Team name needs 2+ characters").max(50),
  description: z.string().trim().max(500),
  visibility: z.enum(["public", "private"]),
});

const parse = (form: FormData) =>
  teamSchema.safeParse({ name: form.get("name") ?? "", description: form.get("description") ?? "", visibility: form.get("visibility") });

const getTeam = (id: number) => db().prepare("SELECT * FROM teams WHERE id = ?").get(id) as Team | undefined;

export async function createTeam(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = parse(form);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  // Permanent random id for the URL, so renaming the team never breaks links.
  let slug = crypto.randomBytes(4).toString("hex");
  while (db().prepare("SELECT 1 FROM teams WHERE slug = ?").get(slug)) slug = crypto.randomBytes(4).toString("hex");
  const d = db();
  d.transaction(() => {
    const res = d
      .prepare("INSERT INTO teams (slug, name, description, visibility, invite_code, owner_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(slug, v.name, v.description, v.visibility, randomCode(10), user.id, now());
    d.prepare("INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)").run(res.lastInsertRowid, user.id, now());
  })();
  redirect(`/t/${slug}`);
}

async function requireTeamOwner(id: number) {
  const user = await requireUser();
  const t = getTeam(id);
  if (!t) throw new Error("Team not found");
  if (t.owner_id !== user.id) throw new Error("Only the team owner can do that");
  return { user, t };
}

export async function updateTeam(_: FormState, form: FormData): Promise<FormState> {
  const { t } = await requireTeamOwner(Number(form.get("id")));
  const parsed = parse(form);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  db().prepare("UPDATE teams SET name = ?, description = ?, visibility = ? WHERE id = ?").run(v.name, v.description, v.visibility, t.id);
  revalidatePath(`/t/${t.slug}`);
  return { ok: "Team saved" };
}

export async function deleteTeam(id: number) {
  const { t } = await requireTeamOwner(id);
  db().prepare("DELETE FROM teams WHERE id = ?").run(t.id);
  redirect("/teams");
}

export async function regenerateTeamInvite(id: number) {
  const { t } = await requireTeamOwner(id);
  db().prepare("UPDATE teams SET invite_code = ? WHERE id = ?").run(randomCode(10), t.id);
  revalidatePath(`/t/${t.slug}`);
}

export async function joinTeam(id: number, key: string | null) {
  const t = getTeam(id);
  if (!t) throw new Error("Team not found");
  const user = await getCurrentUser();
  if (!user) redirect(`/signup?next=${encodeURIComponent(`/t/${t.slug}${key ? `?k=${key}` : ""}`)}`);
  if (!canViewTeam(t, user.id, key)) throw new Error("This team is invite-only");
  db().prepare("INSERT OR IGNORE INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)").run(t.id, user.id, now());
  redirect(`/t/${t.slug}`);
}

export async function leaveTeam(id: number) {
  const user = await requireUser();
  const t = getTeam(id);
  if (!t) return;
  if (t.owner_id === user.id) throw new Error("Owners can't leave; delete the team or hand it off first");
  db().prepare("DELETE FROM team_members WHERE team_id = ? AND user_id = ?").run(t.id, user.id);
  redirect(`/t/${t.slug}`);
}

export async function removeTeamMember(teamId: number, userId: number) {
  const { t, user } = await requireTeamOwner(teamId);
  if (userId === user.id) return;
  db().prepare("DELETE FROM team_members WHERE team_id = ? AND user_id = ?").run(t.id, userId);
  revalidatePath(`/t/${t.slug}`);
}

export async function transferTeam(teamId: number, userId: number) {
  const { t } = await requireTeamOwner(teamId);
  const d = db();
  const isMember = d.prepare("SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?").get(t.id, userId);
  if (!isMember) return;
  d.transaction(() => {
    d.prepare("UPDATE team_members SET role = 'member' WHERE team_id = ?").run(t.id);
    d.prepare("UPDATE team_members SET role = 'owner' WHERE team_id = ? AND user_id = ?").run(t.id, userId);
    d.prepare("UPDATE teams SET owner_id = ? WHERE id = ?").run(userId, t.id);
  })();
  revalidatePath(`/t/${t.slug}`);
}

/** Join with an invite code, or a pasted invite link. Works for teams and challenges. */
export async function joinByCode(_: FormState, form: FormData): Promise<FormState> {
  const raw = String(form.get("code") ?? "").trim();
  if (!raw) return { error: "Enter a code" };
  // Accept a full link like https://host/join/abc123 or .../t/x?k=abc123
  let code = raw;
  try {
    const u = new URL(raw);
    code = u.searchParams.get("k") ?? u.pathname.split("/").filter(Boolean).pop() ?? raw;
  } catch {}
  code = code.toLowerCase().replace(/[^a-z0-9]/g, "");
  const user = await getCurrentUser();
  if (!user) redirect(`/signup?next=${encodeURIComponent(`/join/${code}`)}`);
  const t = db().prepare("SELECT * FROM teams WHERE invite_code = ?").get(code) as Team | undefined;
  if (t) {
    db().prepare("INSERT OR IGNORE INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)").run(t.id, user.id, now());
    redirect(`/t/${t.slug}`);
  }
  const c = db().prepare("SELECT slug FROM challenges WHERE invite_code = ?").get(code) as { slug: string } | undefined;
  if (c) redirect(`/c/${c.slug}?k=${code}`);
  return { error: "No team or challenge uses that code. Check for typos." };
}

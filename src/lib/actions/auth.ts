"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db, now } from "../db";
import {
  createSession,
  destroySession,
  getCurrentUser,
  hashPassword,
  rateLimit,
  requireUser,
  verifyPassword,
} from "../auth";
import { AVATAR_COLORS } from "../colors";
import { deleteUserCascade } from "../accounts";
import { revalidatePath } from "next/cache";

export type FormState = { error?: string; ok?: string } | undefined;

const username = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(24, "Username must be at most 24 characters")
  .regex(/^[a-zA-Z0-9_]+$/, "Use only letters, numbers and underscores");
const password = z.string().min(6, "Password must be at least 6 characters").max(200);
const displayName = z.string().trim().max(40, "Display name is too long");

const RESERVED = new Set(["admin", "login", "signup", "logout", "settings", "explore", "new", "me", "api"]);

function safeNext(next: FormDataEntryValue | null) {
  const s = typeof next === "string" ? next : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/";
}

export async function signup(_: FormState, form: FormData): Promise<FormState> {
  if (!(await rateLimit("signup", 10, 60 * 60_000))) return { error: "Too many sign-ups from here. Try again later." };
  const parsed = z
    .object({ username, password, display_name: displayName })
    .safeParse({ username: form.get("username"), password: form.get("password"), display_name: form.get("display_name") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { username: u, password: p, display_name } = parsed.data;
  if (RESERVED.has(u.toLowerCase())) return { error: "That username is taken" };
  if (form.get("confirm") !== p) return { error: "Passwords don't match" };

  const exists = db().prepare("SELECT 1 FROM users WHERE username = ?").get(u);
  if (exists) return { error: "That username is taken" };

  const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
  const res = db()
    .prepare("INSERT INTO users (username, display_name, password_hash, color, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(u, display_name || u, hashPassword(p), color, now());
  await createSession(Number(res.lastInsertRowid));
  redirect(safeNext(form.get("next")));
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  if (!(await rateLimit("login", 20, 15 * 60_000))) return { error: "Too many attempts. Wait a few minutes." };
  const u = String(form.get("username") ?? "").trim();
  const p = String(form.get("password") ?? "");
  const row = db().prepare("SELECT id, password_hash FROM users WHERE username = ?").get(u) as
    | { id: number; password_hash: string }
    | undefined;
  if (!row || !verifyPassword(p, row.password_hash)) return { error: "Wrong username or password" };
  await createSession(row.id);
  redirect(safeNext(form.get("next")));
}

export async function logout() {
  await destroySession();
  redirect("/");
}

export async function updateProfile(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = z
    .object({
      display_name: displayName.min(1, "Display name can't be empty"),
      bio: z.string().trim().max(160, "Bio is limited to 160 characters"),
      color: z.enum(AVATAR_COLORS),
    })
    .safeParse({ display_name: form.get("display_name"), bio: form.get("bio") ?? "", color: form.get("color") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { display_name, bio, color } = parsed.data;
  db().prepare("UPDATE users SET display_name = ?, bio = ?, color = ? WHERE id = ?").run(display_name, bio, color, user.id);
  revalidatePath("/", "layout");
  return { ok: "Profile saved" };
}

export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const row = db().prepare("SELECT password_hash FROM users WHERE id = ?").get(user.id) as { password_hash: string };
  if (!verifyPassword(String(form.get("current") ?? ""), row.password_hash)) return { error: "Current password is wrong" };
  const parsed = password.safeParse(form.get("password"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (form.get("confirm") !== parsed.data) return { error: "Passwords don't match" };
  db().prepare("UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?").run(hashPassword(parsed.data), user.id);
  // Sign out other devices, keep this one.
  db().prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);
  await createSession(user.id);
  return { ok: "Password changed. Other devices were signed out." };
}

export async function deleteAccount(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (String(form.get("confirm_username") ?? "") !== user.username) return { error: "Type your username exactly to confirm" };
  deleteUserCascade(user.id);
  await destroySession();
  redirect("/");
}

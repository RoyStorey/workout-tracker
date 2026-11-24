"use server";

import { revalidatePath } from "next/cache";
import { db, now } from "../db";
import { hashPassword, rateLimit, requireAdmin, type User } from "../auth";
import { deleteUserCascade, temporaryPassword } from "../accounts";

type Target = { id: number; username: string; is_admin: number };

function target(userId: number) {
  const t = db().prepare("SELECT id, username, is_admin FROM users WHERE id = ?").get(userId) as Target | undefined;
  if (!t) throw new Error("That account no longer exists");
  return t;
}

function log(admin: User, action: string, targetName?: string) {
  db()
    .prepare("INSERT INTO admin_log (admin_id, admin_name, action, target_name, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(admin.id, admin.username, action, targetName ?? null, now());
}

const adminCount = () => (db().prepare("SELECT COUNT(*) AS n FROM users WHERE is_admin = 1").get() as { n: number }).n;

export type ResetResult = { ok: true; password: string; username: string } | { ok: false; error: string };

/**
 * Set a new password for someone. Leave `password` blank to generate an easy-to-read one.
 * They're signed out everywhere and asked to choose their own password next time.
 */
export async function adminResetPassword(userId: number, password: string): Promise<ResetResult> {
  const admin = await requireAdmin();
  if (!(await rateLimit(`admin-reset:${admin.id}`, 30, 60_000))) return { ok: false, error: "Too many resets. Wait a minute." };
  const t = target(userId);
  const chosen = password.trim();
  if (chosen && chosen.length < 6) return { ok: false, error: "Passwords need at least 6 characters" };
  const pw = chosen || temporaryPassword();
  const d = db();
  d.transaction(() => {
    d.prepare("UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?").run(hashPassword(pw), t.id);
    d.prepare("DELETE FROM sessions WHERE user_id = ?").run(t.id);
  })();
  log(admin, "reset password", t.username);
  revalidatePath("/admin");
  return { ok: true, password: pw, username: t.username };
}

export async function adminSignOutEverywhere(userId: number) {
  const admin = await requireAdmin();
  const t = target(userId);
  db().prepare("DELETE FROM sessions WHERE user_id = ?").run(t.id);
  log(admin, "signed out everywhere", t.username);
  revalidatePath("/admin");
}

export async function adminSetAdmin(userId: number, makeAdmin: boolean) {
  const admin = await requireAdmin();
  const t = target(userId);
  if (!makeAdmin && t.is_admin && adminCount() <= 1) throw new Error("You can't remove the last admin");
  db().prepare("UPDATE users SET is_admin = ? WHERE id = ?").run(makeAdmin ? 1 : 0, t.id);
  log(admin, makeAdmin ? "made admin" : "removed admin", t.username);
  revalidatePath("/admin");
}

export async function adminDeleteUser(userId: number) {
  const admin = await requireAdmin();
  const t = target(userId);
  if (t.id === admin.id) throw new Error("Delete your own account from Settings instead");
  if (t.is_admin && adminCount() <= 1) throw new Error("You can't delete the last admin");
  deleteUserCascade(t.id);
  log(admin, "deleted account", t.username);
  revalidatePath("/admin");
}

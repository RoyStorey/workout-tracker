"use server";

import { revalidatePath } from "next/cache";
import { db, now } from "../db";
import { getCurrentUser, rateLimit } from "../auth";
import { notifyChallenge } from "../live";
import { getChallengeById, isChallengeMember } from "../queries";
import { isReaction } from "../reactions";

export type PostResult = { ok: true } | { ok: false; error: string };

/** Members (and the organizer) can talk in a challenge. */
async function participant(challengeId: number) {
  const user = await getCurrentUser();
  if (!user) return { error: "Log in to join the conversation" } as const;
  const c = getChallengeById(challengeId);
  if (!c) return { error: "Challenge not found" } as const;
  if (c.owner_id !== user.id && !isChallengeMember(c.id, user.id)) return { error: "Join the challenge to chat" } as const;
  return { user, c } as const;
}

export async function postMessage(challengeId: number, body: string): Promise<PostResult> {
  const p = await participant(challengeId);
  if ("error" in p) return { ok: false, error: p.error! };
  const text = body.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 1000);
  if (!text) return { ok: false, error: "Write something first" };
  if (!(await rateLimit(`msg:${p.user.id}`, 20, 60_000))) return { ok: false, error: "Slow down a little" };
  db().prepare("INSERT INTO messages (challenge_id, user_id, body, created_at) VALUES (?, ?, ?, ?)").run(p.c.id, p.user.id, text, now());
  notifyChallenge(p.c.id);
  revalidatePath(`/c/${p.c.slug}`);
  return { ok: true };
}

/** Authors can delete their own messages; the organizer can delete any. */
export async function deleteMessage(messageId: number) {
  const user = await getCurrentUser();
  if (!user) return;
  const m = db()
    .prepare("SELECT m.user_id, c.id, c.slug, c.owner_id FROM messages m JOIN challenges c ON c.id = m.challenge_id WHERE m.id = ?")
    .get(messageId) as { user_id: number; id: number; slug: string; owner_id: number | null } | undefined;
  if (!m || (m.user_id !== user.id && m.owner_id !== user.id)) return;
  db().prepare("DELETE FROM messages WHERE id = ?").run(messageId);
  notifyChallenge(m.id);
  revalidatePath(`/c/${m.slug}`);
}

/** Toggle an emoji reaction on a logged set or a message. */
export async function toggleReaction(kind: "entry" | "message", targetId: number, emoji: string) {
  if (!isReaction(emoji)) return;
  const table = kind === "entry" ? "entries" : "messages";
  const row = db().prepare(`SELECT challenge_id FROM ${table} WHERE id = ?`).get(targetId) as { challenge_id: number } | undefined;
  if (!row) return;
  const p = await participant(row.challenge_id);
  if ("error" in p) return;
  if (!(await rateLimit(`react:${p.user.id}`, 120, 60_000))) return;
  const d = db();
  const removed = d.prepare("DELETE FROM reactions WHERE kind = ? AND target_id = ? AND user_id = ? AND emoji = ?").run(kind, targetId, p.user.id, emoji);
  if (removed.changes === 0)
    d.prepare("INSERT INTO reactions (kind, target_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?, ?)").run(kind, targetId, p.user.id, emoji, now());
  notifyChallenge(p.c.id);
  revalidatePath(`/c/${p.c.slug}`);
}

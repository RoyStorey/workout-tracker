import "server-only";
import crypto from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db, now } from "./db";
import { isValidTz, todayIn } from "./dates";

export const SESSION_COOKIE = "rr_session";
const SESSION_DAYS = 365;
const DAY_MS = 86_400_000;

export type User = {
  id: number;
  username: string;
  display_name: string;
  color: string;
  bio: string;
  created_at: number;
};

// ---------- passwords ----------

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = crypto.scryptSync(password, Buffer.from(saltB64, "base64"), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

// ---------- sessions ----------

const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

async function cookieIsSecure() {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;
  const h = await headers();
  return h.get("x-forwarded-proto") === "https";
}

export async function createSession(userId: number) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expires = now() + SESSION_DAYS * DAY_MS;
  db()
    .prepare("INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .run(hashToken(token), userId, expires, now());
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: await cookieIsSecure(),
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) db().prepare("DELETE FROM sessions WHERE id = ?").run(hashToken(token));
  jar.delete(SESSION_COOKIE);
}

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const id = hashToken(token);
  const row = db()
    .prepare(
      `SELECT s.expires_at, u.id, u.username, u.display_name, u.color, u.bio, u.created_at
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
    )
    .get(id) as (User & { expires_at: number }) | undefined;
  if (!row) return null;
  if (row.expires_at < now()) {
    db().prepare("DELETE FROM sessions WHERE id = ?").run(id);
    return null;
  }
  // Sliding expiry: keep active users signed in.
  if (row.expires_at - now() < (SESSION_DAYS - 30) * DAY_MS) {
    db().prepare("UPDATE sessions SET expires_at = ? WHERE id = ?").run(now() + SESSION_DAYS * DAY_MS, id);
  }
  const { expires_at: _e, ...user } = row;
  return user;
});

export async function requireUser(next?: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return user;
}

// ---------- viewer time zone ----------

export const TZ_COOKIE = "rr_tz";

export const getTimeZone = cache(async (): Promise<string | undefined> => {
  const tz = (await cookies()).get(TZ_COOKIE)?.value;
  return isValidTz(tz) ? tz : undefined;
});

export async function getToday(): Promise<string> {
  return todayIn(await getTimeZone());
}

// ---------- tiny in-memory rate limiter (per process) ----------

const buckets = new Map<string, { count: number; reset: number }>();

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "local";
  const k = `${key}:${ip}`;
  const t = now();
  const b = buckets.get(k);
  if (!b || b.reset < t) {
    buckets.set(k, { count: 1, reset: t + windowMs });
    if (buckets.size > 10_000) for (const [key2, v] of buckets) if (v.reset < t) buckets.delete(key2);
    return true;
  }
  b.count++;
  return b.count <= limit;
}

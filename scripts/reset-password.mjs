// Usage: npm run reset-password -- <username> <new-password>
// There's no email recovery, so this is how the admin resets a forgotten password.
process.removeAllListeners("warning"); // hide node:sqlite's "experimental" notice
const { DatabaseSync } = await import("node:sqlite");
import crypto from "node:crypto";
import path from "node:path";
import { migrate } from "../src/lib/migrations.mjs";

const [username, password] = process.argv.slice(2);
if (!username || !password || password.length < 6) {
  console.error("Usage: npm run reset-password -- <username> <new-password (6+ chars)>");
  process.exit(1);
}
const file = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "app.db");
const db = new DatabaseSync(file);
migrate(db);
const user = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
if (!user) {
  console.error(`No user named "${username}"`);
  process.exit(1);
}
const salt = crypto.randomBytes(16);
const hash = crypto.scryptSync(password, salt, 64);
db.prepare("UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?").run(
  `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`,
  user.id,
);
db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);
console.log(`Password for "${username}" reset. They've been signed out everywhere.`);

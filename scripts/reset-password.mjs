// Usage: npm run reset-password -- <username> <new-password>
// There's no email recovery, so this is how the admin resets a forgotten password.
import Database from "better-sqlite3";
import crypto from "node:crypto";
import path from "node:path";

const [username, password] = process.argv.slice(2);
if (!username || !password || password.length < 6) {
  console.error("Usage: npm run reset-password -- <username> <new-password (6+ chars)>");
  process.exit(1);
}
const file = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "app.db");
const db = new Database(file);
const user = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
if (!user) {
  console.error(`No user named "${username}"`);
  process.exit(1);
}
const salt = crypto.randomBytes(16);
const hash = crypto.scryptSync(password, salt, 64);
db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
  `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`,
  user.id,
);
db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);
console.log(`Password for "${username}" reset. They've been signed out everywhere.`);

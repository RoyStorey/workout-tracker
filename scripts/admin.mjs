// Manage administrators from the server's terminal.
//   npm run admin -- add <username>      make someone an admin
//   npm run admin -- remove <username>   take admin away
//   npm run admin -- list                show current admins
// In PowerShell, quote the dashes:  npm run admin '--' add yourname
process.removeAllListeners("warning"); // hide node:sqlite's "experimental" notice
const { DatabaseSync } = await import("node:sqlite");
import fs from "node:fs";
import path from "node:path";
import { migrate } from "../src/lib/migrations.mjs";

const [cmd, username] = process.argv.slice(2);
const file = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "app.db");
fs.mkdirSync(path.dirname(file), { recursive: true });
const db = new DatabaseSync(file);
db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
migrate(db);

const list = () => db.prepare("SELECT username, display_name FROM users WHERE is_admin = 1 ORDER BY username").all();

if (cmd === "list" || !cmd) {
  const admins = list();
  console.log(admins.length ? `Admins: ${admins.map((a) => `@${a.username}`).join(", ")}` : 'No admins yet. Run: npm run admin -- add <username>');
  process.exit(0);
}
if ((cmd !== "add" && cmd !== "remove") || !username) {
  console.error("Usage: npm run admin -- add|remove <username>   or   npm run admin -- list");
  process.exit(1);
}
const user = db.prepare("SELECT id, username FROM users WHERE username = ?").get(username);
if (!user) {
  console.error(`No account named "${username}". Sign up on the site first.`);
  process.exit(1);
}
if (cmd === "remove" && list().length <= 1 && list()[0]?.username.toLowerCase() === user.username.toLowerCase()) {
  console.error("That's the last admin. Add another admin first.");
  process.exit(1);
}
db.prepare("UPDATE users SET is_admin = ? WHERE id = ?").run(cmd === "add" ? 1 : 0, user.id);
db.prepare("INSERT INTO admin_log (admin_id, admin_name, action, target_name, created_at) VALUES (NULL, ?, ?, ?, ?)").run(
  "server console",
  cmd === "add" ? "made admin" : "removed admin",
  user.username,
  Date.now(),
);
console.log(cmd === "add" ? `@${user.username} is now an admin. Open /admin on the site.` : `@${user.username} is no longer an admin.`);

// Usage: npm run backup  ->  writes data/backups/app-<timestamp>.db (safe while the app is running)
process.removeAllListeners("warning"); // hide node:sqlite's "experimental" notice
const { DatabaseSync } = await import("node:sqlite");
import fs from "node:fs";
import path from "node:path";

const file = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "app.db");
const dir = path.join(path.dirname(file), "backups");
fs.mkdirSync(dir, { recursive: true });
const out = path.join(dir, `app-${new Date().toISOString().replace(/[:.]/g, "-")}.db`);
new DatabaseSync(file).exec(`VACUUM INTO '${out.replace(/'/g, "''")}'`);
console.log("Backup written to", out);

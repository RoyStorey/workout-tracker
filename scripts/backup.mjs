// Usage: npm run backup  ->  writes data/backups/app-<timestamp>.db (safe while the app is running)
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const file = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "app.db");
const dir = path.join(path.dirname(file), "backups");
fs.mkdirSync(dir, { recursive: true });
const out = path.join(dir, `app-${new Date().toISOString().replace(/[:.]/g, "-")}.db`);
await new Database(file, { readonly: true }).backup(out);
console.log("Backup written to", out);

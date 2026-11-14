import "server-only";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

type DB = Database.Database;

const g = globalThis as unknown as { __repDb?: DB };

// Each entry upgrades the schema by one version. Never edit an old entry; append a new one.
const MIGRATIONS: string[] = [
  `
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    color TEXT NOT NULL,
    bio TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  );

  CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX sessions_user ON sessions(user_id);

  CREATE TABLE teams (
    id INTEGER PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    visibility TEXT NOT NULL CHECK (visibility IN ('public','private')),
    invite_code TEXT NOT NULL UNIQUE,
    owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE team_members (
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member')),
    joined_at INTEGER NOT NULL,
    PRIMARY KEY (team_id, user_id)
  );

  CREATE TABLE challenges (
    id INTEGER PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    exercise TEXT NOT NULL,
    unit TEXT NOT NULL,
    goal_type TEXT NOT NULL CHECK (goal_type IN ('shared','individual')),
    target REAL,
    start_date TEXT NOT NULL,
    end_date TEXT,
    visibility TEXT NOT NULL CHECK (visibility IN ('public','private')),
    invite_code TEXT NOT NULL UNIQUE,
    owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
    quick_adds TEXT NOT NULL DEFAULT '10,25,50',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX challenges_team ON challenges(team_id);

  CREATE TABLE challenge_members (
    challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at INTEGER NOT NULL,
    PRIMARY KEY (challenge_id, user_id)
  );
  CREATE INDEX challenge_members_user ON challenge_members(user_id);

  CREATE TABLE entries (
    id INTEGER PRIMARY KEY,
    challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount REAL NOT NULL CHECK (amount > 0),
    day TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX entries_challenge_day ON entries(challenge_id, day);
  CREATE INDEX entries_user ON entries(user_id);

  CREATE TABLE kudos (
    entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (entry_id, user_id)
  );
  `,
];

function migrate(db: DB) {
  const current = db.pragma("user_version", { simple: true }) as number;
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]);
      db.pragma(`user_version = ${v + 1}`);
    })();
  }
}

function open(): DB {
  const file = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "app.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  migrate(db);
  return db;
}

export function db(): DB {
  if (!g.__repDb) g.__repDb = open();
  return g.__repDb;
}

export const now = () => Date.now();

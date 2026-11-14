import "server-only";
import fs from "node:fs";
import path from "node:path";

// Uses the SQLite engine built into Node (node:sqlite, Node 22.13+), so there is
// nothing to compile on install. A thin wrapper gives it the small API the app uses.

type Param = string | number | bigint | null | Uint8Array;
type Row = any; // eslint-disable-line @typescript-eslint/no-explicit-any

type NativeStatement = {
  get(...p: Param[]): Record<string, unknown> | undefined;
  all(...p: Param[]): Record<string, unknown>[];
  run(...p: Param[]): { changes: number | bigint; lastInsertRowid: number | bigint };
};
type NativeDb = { exec(sql: string): void; prepare(sql: string): NativeStatement; close(): void };

export type Statement = {
  get(...p: Param[]): Row;
  all(...p: Param[]): Row[];
  run(...p: Param[]): { changes: number; lastInsertRowid: number };
};

export type DB = {
  prepare(sql: string): Statement;
  exec(sql: string): void;
  /** Returns a function that runs `fn` inside BEGIN/COMMIT (ROLLBACK on throw). */
  transaction<T>(fn: () => T): () => T;
};

function loadSqlite(): { DatabaseSync: new (file: string) => NativeDb } {
  let mod: unknown;
  // node:sqlite prints a one-time "experimental feature" warning; it's stable enough for us, so hide it.
  const emit = process.emitWarning;
  process.emitWarning = ((w: string | Error, ...rest: unknown[]) => {
    if (String(w).includes("SQLite")) return;
    return (emit as (...a: unknown[]) => void).call(process, w, ...rest);
  }) as typeof process.emitWarning;
  try {
    mod = process.getBuiltinModule?.("node:sqlite");
  } catch {
  } finally {
    process.emitWarning = emit;
  }
  if (!mod) {
    throw new Error(
      `This app needs Node.js 22.13 or newer (you have ${process.version}). ` +
        `With nvm: "nvm install 22" then "nvm use" that version, and run "npm install" again.`,
    );
  }
  return mod as { DatabaseSync: new (file: string) => NativeDb };
}

function wrap(native: NativeDb): DB {
  const cache = new Map<string, Statement>();
  let depth = 0;
  return {
    exec: (sql) => native.exec(sql),
    prepare(sql) {
      let st = cache.get(sql);
      if (!st) {
        const n = native.prepare(sql);
        // Copy rows into plain objects (node:sqlite rows have a null prototype,
        // which React refuses to pass to client components).
        st = {
          get: (...p) => {
            const r = n.get(...p);
            return r ? { ...r } : undefined;
          },
          all: (...p) => n.all(...p).map((r) => ({ ...r })),
          run: (...p) => {
            const r = n.run(...p);
            return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) };
          },
        };
        cache.set(sql, st);
      }
      return st;
    },
    transaction(fn) {
      return () => {
        if (depth > 0) return fn(); // nested: join the outer transaction
        native.exec("BEGIN IMMEDIATE");
        depth++;
        try {
          const out = fn();
          native.exec("COMMIT");
          return out;
        } catch (e) {
          native.exec("ROLLBACK");
          throw e;
        } finally {
          depth--;
        }
      };
    },
  };
}

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
  const current = Number(db.prepare("PRAGMA user_version").get()?.user_version ?? 0);
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
    })();
  }
}

function open(): DB {
  const file = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "app.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const { DatabaseSync } = loadSqlite();
  const db = wrap(new DatabaseSync(file));
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  migrate(db);
  return db;
}

export function db(): DB {
  if (!g.__repDb) g.__repDb = open();
  return g.__repDb;
}

export const now = () => Date.now();

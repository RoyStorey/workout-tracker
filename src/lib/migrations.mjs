// Schema migrations, shared by the app (src/lib/db.ts) and the scripts in /scripts.
// Plain JS so the scripts can run it without a build step.

// Each entry upgrades the schema by one version. Never edit an old entry; append a new one.
export const MIGRATIONS = [
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

  // v2: flag demo accounts made by `npm run seed` so `--clear` can remove exactly those.
  `ALTER TABLE users ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0;`,

  // v3: team battles. A challenge of kind 'battle' splits members into squads that compete.
  `
  ALTER TABLE challenges ADD COLUMN kind TEXT NOT NULL DEFAULT 'standard';
  ALTER TABLE challenges ADD COLUMN scoring TEXT NOT NULL DEFAULT 'total';
  ALTER TABLE challenges ADD COLUMN open_squads INTEGER NOT NULL DEFAULT 0;
  CREATE TABLE squads (
    id INTEGER PRIMARY KEY,
    challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slot INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX squads_name ON squads(challenge_id, name COLLATE NOCASE);
  ALTER TABLE challenge_members ADD COLUMN squad_id INTEGER REFERENCES squads(id) ON DELETE SET NULL;
  `,

  // v4: team-vs-team challenges (a squad can represent a whole team) and
  // permanent random team URLs so renaming a team never changes its link.
  `
  ALTER TABLE squads ADD COLUMN team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE;
  CREATE UNIQUE INDEX squads_team ON squads(challenge_id, team_id) WHERE team_id IS NOT NULL;
  UPDATE teams SET slug = lower(hex(randomblob(4)));
  `,

  // v5: conversation on each challenge, and emoji reactions on both messages and
  // logged sets. Existing kudos carry over as a clap.
  `
  CREATE TABLE messages (
    id INTEGER PRIMARY KEY,
    challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX messages_challenge ON messages(challenge_id, created_at);

  CREATE TABLE reactions (
    kind TEXT NOT NULL CHECK (kind IN ('entry', 'message')),
    target_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (kind, target_id, user_id, emoji)
  );
  CREATE INDEX reactions_target ON reactions(kind, target_id);
  CREATE TRIGGER reactions_entry_gone AFTER DELETE ON entries BEGIN
    DELETE FROM reactions WHERE kind = 'entry' AND target_id = OLD.id;
  END;
  CREATE TRIGGER reactions_message_gone AFTER DELETE ON messages BEGIN
    DELETE FROM reactions WHERE kind = 'message' AND target_id = OLD.id;
  END;

  INSERT INTO reactions (kind, target_id, user_id, emoji, created_at)
    SELECT 'entry', entry_id, user_id, '👏', created_at FROM kudos;
  DROP TABLE kudos;
  `,

  // v6: challenge URLs become permanent random ids (renaming no longer leaves the
  // old name in the link). Old addresses are kept as aliases and redirect.
  `
  CREATE TABLE challenge_aliases (
    slug TEXT PRIMARY KEY,
    challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE
  );
  INSERT INTO challenge_aliases (slug, challenge_id) SELECT slug, id FROM challenges;
  UPDATE challenges SET slug = lower(hex(randomblob(4)));
  `,

  // v7: administrators, forced password change after an admin reset, and an audit log.
  `
  ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;
  CREATE TABLE admin_log (
    id INTEGER PRIMARY KEY,
    admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    admin_name TEXT NOT NULL,
    action TEXT NOT NULL,
    target_name TEXT,
    created_at INTEGER NOT NULL
  );
  `,
];

/**
 * Brings a database up to the latest schema.
 * @param {{ exec(sql: string): void; prepare(sql: string): { get(): any } }} db
 */
export function migrate(db) {
  const current = Number(db.prepare("PRAGMA user_version").get()?.user_version ?? 0);
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(MIGRATIONS[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
}

import "server-only";
import { db } from "./db";
import type { User } from "./auth";
import type { EntryLite } from "./stats";

export type Challenge = {
  id: number;
  slug: string;
  title: string;
  description: string;
  exercise: string;
  unit: string;
  goal_type: "shared" | "individual";
  target: number | null;
  start_date: string;
  end_date: string | null;
  visibility: "public" | "private";
  invite_code: string;
  owner_id: number | null;
  team_id: number | null;
  quick_adds: string;
  created_at: number;
  kind: "standard" | "battle" | "teams";
  scoring: "total" | "average";
  open_squads: number;
};

export type Squad = { id: number; name: string; slot: number; team_id: number | null; team_slug: string | null; team_owner: number | null };

export type Team = {
  id: number;
  slug: string;
  name: string;
  description: string;
  visibility: "public" | "private";
  invite_code: string;
  owner_id: number | null;
  created_at: number;
};

export type PublicUser = Pick<User, "id" | "username" | "display_name" | "color">;

export type ChallengeCard = Challenge & { member_count: number; total: number; squad_count: number; team_name: string | null; team_slug: string | null };

const USER_COLS = "u.id, u.username, u.display_name, u.color";

// ---------- users ----------

export function getUserByUsername(username: string) {
  return db()
    .prepare("SELECT id, username, display_name, color, bio, created_at FROM users WHERE username = ?")
    .get(username) as User | undefined;
}

// ---------- challenges ----------

export function getChallengeBySlug(slug: string) {
  return db().prepare("SELECT * FROM challenges WHERE slug = ?").get(slug) as Challenge | undefined;
}

export function getChallengeById(id: number) {
  return db().prepare("SELECT * FROM challenges WHERE id = ?").get(id) as Challenge | undefined;
}

export function isChallengeMember(challengeId: number, userId: number | undefined) {
  if (!userId) return false;
  return !!db().prepare("SELECT 1 FROM challenge_members WHERE challenge_id = ? AND user_id = ?").get(challengeId, userId);
}

export function isTeamMember(teamId: number | null, userId: number | undefined) {
  if (!teamId || !userId) return false;
  return !!db().prepare("SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?").get(teamId, userId);
}

/** Public challenges are open to all; private ones need membership, team membership, or the invite key. */
export function canViewChallenge(c: Challenge, userId: number | undefined, key?: string | null) {
  if (c.visibility === "public") return true;
  if (key && key === c.invite_code) return true;
  if (userId && c.owner_id === userId) return true;
  return isChallengeMember(c.id, userId) || isTeamMember(c.team_id, userId) || onEnteredTeam(c.id, userId);
}

/** In a team-vs-team challenge, members of any entered team can see it. */
export function onEnteredTeam(challengeId: number, userId: number | undefined) {
  if (!userId) return false;
  return !!db()
    .prepare("SELECT 1 FROM squads s JOIN team_members tm ON tm.team_id = s.team_id WHERE s.challenge_id = ? AND tm.user_id = ?")
    .get(challengeId, userId);
}

/** Challenges a team has been entered into. */
export function challengesEnteredBy(teamId: number) {
  return db()
    .prepare(`${CARD_SELECT} WHERE c.id IN (SELECT challenge_id FROM squads WHERE team_id = ?) ORDER BY c.start_date DESC`)
    .all(teamId) as ChallengeCard[];
}

export function challengeMembers(challengeId: number) {
  return db()
    .prepare(
      `SELECT ${USER_COLS}, cm.joined_at, cm.squad_id FROM challenge_members cm JOIN users u ON u.id = cm.user_id
       WHERE cm.challenge_id = ? ORDER BY cm.joined_at`,
    )
    .all(challengeId) as (PublicUser & { joined_at: number; squad_id: number | null })[];
}

export function challengeSquads(challengeId: number) {
  return db()
    .prepare(
      `SELECT s.id, COALESCE(t.name, s.name) AS name, s.slot, s.team_id, t.slug AS team_slug, t.owner_id AS team_owner
       FROM squads s LEFT JOIN teams t ON t.id = s.team_id WHERE s.challenge_id = ? ORDER BY s.slot`,
    )
    .all(challengeId) as Squad[];
}

export function challengeEntries(challengeId: number) {
  return db()
    .prepare("SELECT id, user_id, amount, day, note, created_at FROM entries WHERE challenge_id = ? ORDER BY day, created_at")
    .all(challengeId) as (EntryLite & { id: number; note: string })[];
}

const CARD_SELECT = `
  SELECT c.*,
    (SELECT COUNT(*) FROM challenge_members m WHERE m.challenge_id = c.id) AS member_count,
    (SELECT COALESCE(SUM(amount), 0) FROM entries e WHERE e.challenge_id = c.id) AS total,
    (SELECT COUNT(*) FROM squads s WHERE s.challenge_id = c.id) AS squad_count,
    t.name AS team_name, t.slug AS team_slug
  FROM challenges c LEFT JOIN teams t ON t.id = c.team_id`;

export function challengesForUser(userId: number) {
  return db()
    .prepare(
      `${CARD_SELECT} WHERE c.id IN (SELECT challenge_id FROM challenge_members WHERE user_id = ?)
       ORDER BY c.start_date DESC`,
    )
    .all(userId) as ChallengeCard[];
}

export function publicChallenges(limit = 50) {
  return db()
    .prepare(`${CARD_SELECT} WHERE c.visibility = 'public' ORDER BY c.created_at DESC LIMIT ?`)
    .all(limit) as ChallengeCard[];
}

export function teamChallenges(teamId: number) {
  return db().prepare(`${CARD_SELECT} WHERE c.team_id = ? ORDER BY c.start_date DESC`).all(teamId) as ChallengeCard[];
}

/** Challenges of a user that a given viewer is allowed to see. */
export function visibleChallengesOf(userId: number, viewerId: number | undefined) {
  return challengesForUser(userId).filter(
    (c) =>
      c.visibility === "public" ||
      (viewerId !== undefined && (isChallengeMember(c.id, viewerId) || isTeamMember(c.team_id, viewerId))),
  );
}

/** Entries for many challenges for one user; used on the dashboard. */
export function userEntriesFor(userId: number, challengeIds: number[]) {
  if (!challengeIds.length) return [];
  const qs = challengeIds.map(() => "?").join(",");
  return db()
    .prepare(`SELECT challenge_id, user_id, amount, day, created_at FROM entries WHERE user_id = ? AND challenge_id IN (${qs})`)
    .all(userId, ...challengeIds) as (EntryLite & { challenge_id: number })[];
}

export function entriesForChallenges(challengeIds: number[]) {
  if (!challengeIds.length) return [];
  const qs = challengeIds.map(() => "?").join(",");
  return db()
    .prepare(`SELECT challenge_id, user_id, amount, day, created_at FROM entries WHERE challenge_id IN (${qs})`)
    .all(...challengeIds) as (EntryLite & { challenge_id: number })[];
}

export type FeedItem = {
  id: number;
  amount: number;
  day: string;
  note: string;
  created_at: number;
  kudos: number;
  mine: number;
  user: PublicUser;
  challenge_title?: string;
  challenge_slug?: string;
  unit?: string;
  exercise?: string;
};

type FeedRow = Omit<FeedItem, "user"> & { uid: number; username: string; display_name: string; color: string };

const toFeed = (rows: FeedRow[]): FeedItem[] =>
  rows.map(({ uid, username, display_name, color, ...r }) => ({
    ...r,
    user: { id: uid, username, display_name, color },
  }));

export function challengeFeed(challengeId: number, viewerId: number | undefined, limit = 30) {
  const rows = db()
    .prepare(
      `SELECT e.id, e.amount, e.day, e.note, e.created_at,
         u.id AS uid, u.username, u.display_name, u.color,
         (SELECT COUNT(*) FROM kudos k WHERE k.entry_id = e.id) AS kudos,
         (SELECT COUNT(*) FROM kudos k WHERE k.entry_id = e.id AND k.user_id = ?) AS mine
       FROM entries e JOIN users u ON u.id = e.user_id
       WHERE e.challenge_id = ? ORDER BY e.created_at DESC LIMIT ?`,
    )
    .all(viewerId ?? -1, challengeId, limit) as FeedRow[];
  return toFeed(rows);
}

/** Recent activity across every challenge the viewer belongs to. */
export function friendsFeed(viewerId: number, limit = 20) {
  const rows = db()
    .prepare(
      `SELECT e.id, e.amount, e.day, e.note, e.created_at,
         u.id AS uid, u.username, u.display_name, u.color,
         c.title AS challenge_title, c.slug AS challenge_slug, c.unit, c.exercise,
         (SELECT COUNT(*) FROM kudos k WHERE k.entry_id = e.id) AS kudos,
         (SELECT COUNT(*) FROM kudos k WHERE k.entry_id = e.id AND k.user_id = ?) AS mine
       FROM entries e JOIN users u ON u.id = e.user_id JOIN challenges c ON c.id = e.challenge_id
       WHERE e.challenge_id IN (SELECT challenge_id FROM challenge_members WHERE user_id = ?)
       ORDER BY e.created_at DESC LIMIT ?`,
    )
    .all(viewerId, viewerId, limit) as FeedRow[];
  return toFeed(rows);
}

/** Lifetime totals grouped by exercise + unit. */
export function lifetimeTotals(where: "user" | "team", id: number) {
  // A team's totals: its members' work in challenges it hosted or entered as a team.
  const filter =
    where === "user"
      ? "e.user_id = ?1"
      : `e.user_id IN (SELECT user_id FROM team_members WHERE team_id = ?1)
         AND (c.team_id = ?1 OR c.id IN (SELECT challenge_id FROM squads WHERE team_id = ?1))`;
  return db()
    .prepare(
      `SELECT LOWER(TRIM(c.exercise)) AS exercise_key, MAX(c.exercise) AS exercise, c.unit,
         SUM(e.amount) AS total, COUNT(*) AS sets, COUNT(DISTINCT e.day) AS days, MAX(e.amount) AS best_set
       FROM entries e JOIN challenges c ON c.id = e.challenge_id
       WHERE ${filter} GROUP BY exercise_key, c.unit ORDER BY total DESC`,
    )
    .all(id) as { exercise_key: string; exercise: string; unit: string; total: number; sets: number; days: number; best_set: number }[];
}

export function activityByDay(userId: number, fromDay: string) {
  return db()
    .prepare("SELECT day, COUNT(*) AS sets FROM entries WHERE user_id = ? AND day >= ? GROUP BY day")
    .all(userId, fromDay) as { day: string; sets: number }[];
}

export function siteStats() {
  return db()
    .prepare(
      `SELECT (SELECT COUNT(*) FROM users) AS users,
              (SELECT COUNT(*) FROM challenges WHERE visibility = 'public') AS challenges,
              (SELECT COUNT(*) FROM entries) AS sets,
              (SELECT COUNT(*) FROM teams) AS teams`,
    )
    .get() as { users: number; challenges: number; sets: number; teams: number };
}

// ---------- teams ----------

export function getTeamBySlug(slug: string) {
  return db().prepare("SELECT * FROM teams WHERE slug = ?").get(slug) as Team | undefined;
}

export function getTeamById(id: number) {
  return db().prepare("SELECT * FROM teams WHERE id = ?").get(id) as Team | undefined;
}

export function canViewTeam(t: Team, userId: number | undefined, key?: string | null) {
  return t.visibility === "public" || (!!key && key === t.invite_code) || isTeamMember(t.id, userId);
}

export function teamMembers(teamId: number) {
  return db()
    .prepare(
      `SELECT ${USER_COLS}, tm.role, tm.joined_at FROM team_members tm JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = ? ORDER BY tm.role = 'owner' DESC, tm.joined_at`,
    )
    .all(teamId) as (PublicUser & { role: "owner" | "member"; joined_at: number })[];
}

export type TeamCard = Team & { member_count: number; challenge_count: number };

const TEAM_SELECT = `SELECT t.*,
  (SELECT COUNT(*) FROM team_members m WHERE m.team_id = t.id) AS member_count,
  (SELECT COUNT(*) FROM challenges c WHERE c.team_id = t.id) AS challenge_count
  FROM teams t`;

export function teamsForUser(userId: number) {
  return db()
    .prepare(`${TEAM_SELECT} WHERE t.id IN (SELECT team_id FROM team_members WHERE user_id = ?) ORDER BY t.name`)
    .all(userId) as TeamCard[];
}

export function publicTeams(limit = 50) {
  return db()
    .prepare(`${TEAM_SELECT} WHERE t.visibility = 'public' ORDER BY member_count DESC, t.created_at DESC LIMIT ?`)
    .all(limit) as TeamCard[];
}

export function findByInviteCode(code: string) {
  const c = db().prepare("SELECT slug FROM challenges WHERE invite_code = ?").get(code) as { slug: string } | undefined;
  if (c) return { kind: "challenge" as const, slug: c.slug };
  const t = db().prepare("SELECT slug FROM teams WHERE invite_code = ?").get(code) as { slug: string } | undefined;
  if (t) return { kind: "team" as const, slug: t.slug };
  return null;
}

// Fills the site with demo data: users, teams, challenges, a few weeks of logged sets, chat and reactions.
//
//   npm run seed                      add demo data
//   npm run seed -- --join <username> also put your real account in some demo challenges
//   npm run seed -- --clear           remove all demo data (real accounts are untouched)
//
// Every demo account has the password "password", so you can log in as any of them.
// Stop the app first (or restart it afterwards) if you want pages to reflect changes immediately.

process.removeAllListeners("warning"); // hide node:sqlite's "experimental" notice
const { DatabaseSync } = await import("node:sqlite");
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { migrate } from "../src/lib/migrations.mjs";

const args = process.argv.slice(2);
const CLEAR = args.includes("--clear");
const joinIdx = args.indexOf("--join");
const JOIN = joinIdx >= 0 ? args[joinIdx + 1] : null;
const DEMO_PASSWORD = "password";

const file = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "app.db");
fs.mkdirSync(path.dirname(file), { recursive: true });
const db = new DatabaseSync(file);
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
migrate(db);

const tx = (fn) => {
  db.exec("BEGIN IMMEDIATE");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
};

// ---------- clear ----------

if (CLEAR) {
  const n = tx(() => {
    const demo = "SELECT id FROM users WHERE is_demo = 1";
    db.prepare(`DELETE FROM challenges WHERE owner_id IN (${demo})`).run();
    db.prepare(`DELETE FROM teams WHERE owner_id IN (${demo})`).run();
    return db.prepare("DELETE FROM users WHERE is_demo = 1").run().changes;
  });
  console.log(`Removed ${n} demo users and everything they owned.`);
  process.exit(0);
}

const already = db.prepare("SELECT COUNT(*) AS n FROM users WHERE is_demo = 1").get().n;
if (already > 0) {
  console.error(`Demo data already exists (${already} demo users). Run "npm run seed -- --clear" first to start over.`);
  process.exit(1);
}

let joiner = null;
if (JOIN) {
  joiner = db.prepare("SELECT id, username FROM users WHERE username = ? AND is_demo = 0").get(JOIN);
  if (!joiner) {
    console.error(`No account named "${JOIN}". Sign up on the site first, then run this again.`);
    process.exit(1);
  }
}

// ---------- helpers ----------

// Small seeded PRNG so runs are reproducible.
let seed = 20261114;
const rand = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const between = (a, b) => a + rand() * (b - a);
const int = (a, b) => Math.floor(between(a, b + 1));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const sample = (arr, n) => {
  const copy = [...arr];
  const out = [];
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
  return out;
};
const code = (len = 10) => Array.from({ length: len }, () => pick("abcdefghijkmnopqrstuvwxyz23456789")).join("");
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

const DAY = 86_400_000;
const localDay = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = localDay(new Date());
const addDays = (day, n) => {
  const d = new Date(day + "T12:00:00");
  d.setDate(d.getDate() + n);
  return localDay(d);
};
const dayAtTime = (day, hour) => {
  const d = new Date(day + "T00:00:00");
  return d.getTime() + hour * 3_600_000 + int(0, 59) * 60_000;
};
const hashPassword = (pw) => {
  const salt = crypto.randomBytes(16);
  return `scrypt$${salt.toString("base64")}$${crypto.scryptSync(pw, salt, 64).toString("base64")}`;
};

// ---------- people ----------

const COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
const PEOPLE = [
  ["jake_lifts", "Jake Morales", "Garage gym, zero excuses."],
  ["maria_runs", "Maria Chen", "Marathoner in training 🏃‍♀️"],
  ["big_dave", "Dave Okafor", "Pushups before coffee."],
  ["sasha_k", "Sasha Kowalski", ""],
  ["tommy_two_sets", "Tommy Reyes", "Always one more set."],
  ["lena_strong", "Lena Fischer", "Coach, mom, plank queen."],
  ["chris_p", "Chris Patel", ""],
  ["nora_b", "Nora Bennett", "Trying to beat my brother."],
  ["marcus_w", "Marcus Williams", "Former D1 wrestler."],
  ["aiden_fit", "Aiden Brooks", ""],
  ["priya_moves", "Priya Sharma", "Yoga + calisthenics."],
  ["ollie_g", "Oliver Grant", "Here for the leaderboard."],
  ["kim_lee", "Kim Lee", ""],
  ["rafa_95", "Rafael Souza", "Squat everything."],
  ["hannah_j", "Hannah Johnson", "Couch to 5K graduate."],
  ["benji", "Ben Carter", ""],
  ["zoe_m", "Zoe Martinez", "Streak: unbroken."],
  ["ethan_r", "Ethan Russo", "Dad bod in recovery."],
  ["ivy_t", "Ivy Thompson", ""],
  ["sam_the_man", "Sam Nguyen", "Pull-up enthusiast."],
  ["grace_h", "Grace Hall", "Running to eat more tacos."],
  ["leo_k", "Leo King", ""],
];

const users = tx(() =>
  PEOPLE.map(([username, display_name, bio], i) => {
    const res = db
      .prepare(
        "INSERT INTO users (username, display_name, password_hash, color, bio, created_at, is_demo) VALUES (?, ?, ?, ?, ?, ?, 1)",
      )
      .run(username, display_name, hashPassword(DEMO_PASSWORD), COLORS[i % COLORS.length], bio, Date.now() - int(20, 150) * DAY);
    // Personality: how often they show up and how hard they push.
    return { id: Number(res.lastInsertRowid), username, consistency: between(0.45, 0.97), effort: between(0.55, 1.45) };
  }),
);
if (joiner) users.push({ id: joiner.id, username: joiner.username, consistency: 0.85, effort: 1.05, real: true });
const demoUsers = users.filter((u) => !u.real);

// ---------- teams ----------

const TEAMS = [
  ["Garage Gym Crew", "Iron, chalk, and bad music since 2019.", "public"],
  ["Office Warriors", "Desk jobs, strong backs. Lunch-break workouts.", "public"],
  ["Night Owls", "We work out after the kids are asleep.", "private"],
  ["Run Club 5:30am", "Early miles, every weekday.", "public"],
];
const teams = tx(() =>
  TEAMS.map(([name, description, visibility]) => {
    const members = sample(demoUsers, int(5, 9));
    if (joiner && name === "Garage Gym Crew") members.push(users.at(-1));
    const owner = members[0];
    const res = db
      .prepare("INSERT INTO teams (slug, name, description, visibility, invite_code, owner_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(crypto.randomBytes(4).toString("hex"), name, description, visibility, code(), owner.id, Date.now() - int(30, 120) * DAY);
    const id = Number(res.lastInsertRowid);
    members.forEach((m, i) =>
      db.prepare("INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)").run(
        id, m.id, i === 0 ? "owner" : "member", Date.now() - int(10, 100) * DAY,
      ),
    );
    return { id, name, members };
  }),
);
const team = (name) => teams.find((t) => t.name === name);

// ---------- challenges ----------

const NOTES = [
  "Felt strong today", "Rough one, but done", "Before work 💪", "Lunch break set", "On the beach",
  "With the kids watching", "Last set was ugly", "PR!", "Rain didn't stop me", "Hotel room workout",
  "Caught up on yesterday", "Legs are jelly", "Easy pace", "Brutal", "Morning grind",
];

// start/end are offsets from today in days; end null = open-ended
const CHALLENGES = [
  { title: "November Pushup Mission", exercise: "Pushups", unit: "reps", goal: "individual", target: 5000, start: -13, end: 16, vis: "public", members: 9, quick: "10,20,25,50", inc: 1, setRange: [10, 60] },
  { title: "Squad 25K Squats", exercise: "Squats", unit: "reps", goal: "shared", target: 25000, start: -10, end: 20, vis: "public", team: "Garage Gym Crew", quick: "15,25,50,100", inc: 5, setRange: [15, 100] },
  { title: "100 Mile Month", exercise: "Running", unit: "miles", goal: "individual", target: 100, start: -12, end: 18, vis: "public", team: "Run Club 5:30am", quick: "1,2,3.1,5", inc: 0.1, setRange: [1.5, 7] },
  { title: "Plank-a-thon", exercise: "Plank", unit: "minutes", goal: "shared", target: 600, start: -8, end: 21, vis: "public", members: 7, quick: "1,2,3,5", inc: 0.5, setRange: [1, 5] },
  { title: "Pull-up Showdown", exercise: "Pull-ups", unit: "reps", goal: "individual", target: null, start: -6, end: 7, vis: "public", members: 8, quick: "3,5,8,10", inc: 1, setRange: [3, 15] },
  { title: "Lifetime Burpees", exercise: "Burpees", unit: "reps", goal: "individual", target: null, start: -75, end: null, vis: "public", members: 6, quick: "10,20,30", inc: 1, setRange: [10, 40], consistencyScale: 0.6 },
  { title: "Lunch Break Lunges", exercise: "Lunges", unit: "reps", goal: "shared", target: 8000, start: -9, end: 12, vis: "private", team: "Office Warriors", quick: "10,20,30,50", inc: 2, setRange: [10, 60] },
  { title: "After Dark Abs", exercise: "Sit-ups", unit: "reps", goal: "individual", target: 3000, start: -11, end: 10, vis: "private", team: "Night Owls", quick: "10,25,50", inc: 1, setRange: [15, 70] },
  { title: "October Pushup Classic", exercise: "Pushups", unit: "reps", goal: "individual", target: 3000, start: -44, end: -14, vis: "public", members: 8, quick: "10,25,50", inc: 1, setRange: [10, 50] },
  { title: "Fall 50K Steps a Day", exercise: "Walking", unit: "steps", goal: "shared", target: 6_000_000, start: -50, end: -20, vis: "public", members: 10, quick: "1000,2500,5000", inc: 100, setRange: [2000, 9000] },
  { title: "December Dip Challenge", exercise: "Dips", unit: "reps", goal: "individual", target: 2000, start: 5, end: 35, vis: "public", members: 5, quick: "10,15,25", inc: 1, setRange: [10, 30] },
  { title: "Squadron Pushup Battle", exercise: "Pushups", unit: "reps", goal: "shared", target: null, start: -12, end: 18, vis: "public", members: 18, quick: "10,20,25,50", inc: 1, setRange: [15, 50], battle: { scoring: "average", squads: ["Alpha", "Bravo", "Charlie", "Delta"] } },
  { title: "Office Plank Wars", exercise: "Plank", unit: "minutes", goal: "shared", target: null, start: -7, end: 14, vis: "private", team: "Office Warriors", quick: "1,2,3", inc: 0.5, setRange: [1, 4], battle: { scoring: "total", squads: ["Sales", "Engineering"] } },
  { title: "Inter-Team Pushup League", exercise: "Pushups", unit: "reps", goal: "shared", target: null, start: -9, end: 21, vis: "public", quick: "10,20,25,50", inc: 1, setRange: [15, 50], league: { scoring: "average", teams: ["Garage Gym Crew", "Office Warriors", "Run Club 5:30am", "Night Owls"] } },
  { title: "Holiday Mile-a-Day", exercise: "Running", unit: "miles", goal: "shared", target: 250, start: 12, end: 42, vis: "public", team: "Run Club 5:30am", quick: "1,2,3", inc: 0.1, setRange: [1, 4] },
];
const JOIN_TITLES = new Set(["Squadron Pushup Battle", "November Pushup Mission", "Squad 25K Squats", "Pull-up Showdown", "Plank-a-thon", "October Pushup Classic"]);

const round = (n, inc) => Math.max(inc, Math.round(n / inc) * inc);

let entryCount = 0;
let kudosCount = 0;
let messageCount = 0;
const EMOJI = ["👍", "🔥", "💪", "👏", "😂"];
const CHAT = [
  "Who's ready?", "Day one done. Let's go!", "My arms are not ready for this", "Anyone else doing these before work?",
  "Pace check: we're behind, pick it up 😅", "That last set was brutal", "Who logged 300 yesterday?? Show-off.",
  "Rest day for me, back at it tomorrow", "Weekend push, let's close the gap", "Halfway there!",
  "Doing mine at lunch", "Loser buys pizza, right?", "New PR today", "Can we talk about how sore I am",
  "Keep it up everyone", "Morning crew checking in", "Don't let the streak die", "Just caught up on two days",
  "Nice work this week team", "Final stretch, no excuses",
];
const made = tx(() =>
  CHALLENGES.map((c) => {
    const start = addDays(today, c.start);
    const end = c.end == null ? null : addDays(today, c.end);
    let members = c.team ? [...team(c.team).members] : c.league ? [] : sample(demoUsers, c.members);
    // Team league: everyone on an entered team competes for the first of their teams in the list.
    const leagueOf = new Map();
    if (c.league)
      for (const name of c.league.teams)
        for (const m of team(name).members)
          if (!leagueOf.has(m.id)) {
            leagueOf.set(m.id, name);
            members.push(m);
          }
    if (joiner && JOIN_TITLES.has(c.title) && !members.some((m) => m.real)) members.push(users.at(-1));
    const owner = members.find((m) => !m.real) ?? demoUsers[0];
    const teamId = c.team ? team(c.team).id : null;
    const res = db
      .prepare(
        `INSERT INTO challenges (slug, title, description, exercise, unit, goal_type, target, start_date, end_date,
           visibility, invite_code, owner_id, team_id, quick_adds, created_at, kind, scoring)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        `${slugify(c.title)}-${code(4)}`, c.title, "", c.exercise, c.unit, c.goal, c.target, start, end,
        c.vis, code(), owner.id, teamId, c.quick, dayAtTime(start, 8) - 3 * DAY, c.battle ? "battle" : c.league ? "teams" : "standard", c.battle?.scoring ?? c.league?.scoring ?? "total",
      );
    const cid = Number(res.lastInsertRowid);
    const squadIds = (c.battle?.squads ?? []).map((name, slot) =>
      Number(db.prepare("INSERT INTO squads (challenge_id, name, slot, created_at) VALUES (?, ?, ?, ?)").run(cid, name, slot, Date.now()).lastInsertRowid),
    );
    const leagueSquads = new Map(
      (c.league?.teams ?? []).map((name, slot) => [
        name,
        Number(
          db.prepare("INSERT INTO squads (challenge_id, name, slot, created_at, team_id) VALUES (?, ?, ?, ?, ?)").run(cid, `#team-${team(name).id}`, slot, Date.now(), team(name).id).lastInsertRowid,
        ),
      ]),
    );
    members.forEach((m, i) => {
      if (c.league) {
        db.prepare("INSERT INTO challenge_members (challenge_id, user_id, joined_at, squad_id) VALUES (?, ?, ?, ?)").run(cid, m.id, dayAtTime(start, 7) - int(1, 5) * DAY, leagueSquads.get(leagueOf.get(m.id)));
        return;
      }
      // Uneven squads on purpose, so "average per member" scoring matters.
      const pattern = [0, 1, 0, 2, 3, 0, 1, 3, 0, 2, 1, 0, 3];
      const squad = squadIds.length ? squadIds[pattern[i % pattern.length] % squadIds.length] : null;
      db.prepare("INSERT INTO challenge_members (challenge_id, user_id, joined_at, squad_id) VALUES (?, ?, ?, ?)").run(cid, m.id, dayAtTime(start, 7) - int(1, 5) * DAY, squad);
    });

    // Daily volume a member "aims" for.
    const days = end ? Math.round((Date.parse(end) - Date.parse(start)) / DAY) + 1 : 60;
    const perPerson = c.target ? (c.goal === "shared" ? c.target / members.length : c.target) / days : (c.setRange[0] + c.setRange[1]) * 1.5;
    const ids = [];
    const last = end && end < today ? end : today;
    for (let day = start; day <= last; day = addDays(day, 1)) {
      for (const m of members) {
        const isToday = day === today;
        const showUp = m.consistency * (c.consistencyScale ?? 1) * (isToday ? 0.6 : 1);
        if (rand() > showUp) continue;
        // Make people a bit more motivated at the start and on weekends.
        const dayIdx = Math.round((Date.parse(day) - Date.parse(start)) / DAY);
        const weekend = [0, 6].includes(new Date(day + "T12:00:00").getDay());
        const goalForDay = perPerson * m.effort * between(0.6, 1.5) * (dayIdx < 3 ? 1.25 : 1) * (weekend ? 1.15 : 1);
        let left = goalForDay;
        let hour = int(6, 9);
        while (left > c.setRange[0] * 0.5 && hour < 23) {
          const amount = round(Math.min(left, between(c.setRange[0], c.setRange[1])), c.inc);
          const createdAt = dayAtTime(day, hour);
          if (createdAt > Date.now()) break;
          const note = rand() < 0.08 ? pick(NOTES) : "";
          const r = db
            .prepare("INSERT INTO entries (challenge_id, user_id, amount, day, note, created_at) VALUES (?, ?, ?, ?, ?, ?)")
            .run(cid, m.id, amount, day, note, createdAt);
          ids.push({ id: Number(r.lastInsertRowid), user: m.id, createdAt });
          entryCount++;
          left -= amount;
          hour += int(1, 4);
        }
      }
    }
    // Reactions on a slice of sets, from other demo members.
    const react = (kind, id, author, at) => {
      for (const giver of sample(members.filter((m) => m.id !== author && !m.real), int(1, 3))) {
        const r = db
          .prepare("INSERT OR IGNORE INTO reactions (kind, target_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?, ?)")
          .run(kind, id, giver.id, rand() < 0.5 ? "👍" : pick(EMOJI), Math.min(Date.now(), at + int(5, 300) * 60_000));
        kudosCount += Number(r.changes);
      }
    };
    for (const e of ids) if (rand() < 0.18) react("entry", e.id, e.user, e.createdAt);
    // Some conversation: a few messages a week, mostly reacted to.
    const chatDays = Math.max(0, Math.round((Math.min(Date.now(), Date.parse((end ?? today) + "T23:00:00")) - Date.parse(start + "T00:00:00")) / DAY));
    const talkers = members.filter((m) => !m.real);
    for (let i = 0; i < Math.min(24, Math.ceil(chatDays * 0.7)) && talkers.length; i++) {
      const at = dayAtTime(addDays(start, int(0, Math.max(0, chatDays - 1))), int(6, 22));
      if (at > Date.now()) continue;
      const who = pick(talkers);
      const m = db.prepare("INSERT INTO messages (challenge_id, user_id, body, created_at) VALUES (?, ?, ?, ?)").run(cid, who.id, pick(CHAT), at);
      messageCount++;
      if (rand() < 0.7) react("message", Number(m.lastInsertRowid), who.id, at);
    }
    return { title: c.title, members: members.length };
  }),
);

console.log(`Seeded ${demoUsers.length} demo users, ${teams.length} teams, ${made.length} challenges, ${entryCount} sets, ${messageCount} messages, ${kudosCount} reactions.`);
if (joiner) console.log(`Added "${joiner.username}" to: ${[...JOIN_TITLES].join(", ")} and the Garage Gym Crew team (with sample history).`);
console.log(`Demo logins: any of ${demoUsers.slice(0, 3).map((u) => u.username).join(", ")}… with password "${DEMO_PASSWORD}".`);
console.log('Remove it all later with: npm run seed -- --clear');

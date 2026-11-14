import { addDays, diffDays, eachDay } from "./dates";

export type EntryLite = { user_id: number; amount: number; day: string; created_at: number };

export type Status = "upcoming" | "active" | "finished";

export type DayPoint = {
  day: string;
  amount: number;
  /** Running total through this day; null for days that haven't happened yet. */
  cumulative: number | null;
  /** Where an even pace would put you by the end of this day; null when there's no target/end. */
  pace: number | null;
};

export type Stats = {
  status: Status;
  total: number;
  target: number | null;
  remaining: number | null;
  pct: number | null;
  totalDays: number | null;
  daysElapsed: number;
  /** Days left including today. */
  daysLeft: number | null;
  todayTotal: number;
  /** Amount you'd need today to stay on an even split of what's left. */
  todayGoal: number | null;
  todayLeft: number | null;
  /** Even split of what's left across the remaining days (incl. today). */
  perDayNeeded: number | null;
  /** Ideal daily average from day one. */
  basePace: number | null;
  /** Positive = ahead of an even pace (counting through yesterday, plus today's work). */
  aheadBy: number | null;
  avgPerDay: number;
  avgPerActiveDay: number;
  projectedTotal: number | null;
  /** Day the target was (or, at the current pace, will be) hit. */
  finishDay: string | null;
  finishedEarly: boolean;
  reached: boolean;
  sets: number;
  avgSet: number;
  bestSet: number;
  bestDay: { day: string; amount: number } | null;
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
  series: DayPoint[];
};

export type ChallengeShape = {
  start_date: string;
  end_date: string | null;
  target: number | null;
};

export function challengeStatus(c: ChallengeShape, today: string): Status {
  if (today < c.start_date) return "upcoming";
  if (c.end_date && today > c.end_date) return "finished";
  return "active";
}

export function computeStats(entries: EntryLite[], c: ChallengeShape, target: number | null, today: string): Stats {
  const status = challengeStatus(c, today);
  const start = c.start_date;
  const end = c.end_date;
  const asOf = status === "upcoming" ? addDays(start, -1) : end && today > end ? end : today;
  const daysElapsed = status === "upcoming" ? 0 : diffDays(start, asOf) + 1;
  const totalDays = end ? diffDays(start, end) + 1 : null;
  const daysLeft = !end ? null : status === "active" ? diffDays(today, end) + 1 : status === "upcoming" ? totalDays : 0;

  const byDay = new Map<string, number>();
  let total = 0;
  let bestSet = 0;
  for (const e of entries) {
    byDay.set(e.day, (byDay.get(e.day) ?? 0) + e.amount);
    total += e.amount;
    if (e.amount > bestSet) bestSet = e.amount;
  }

  const todayTotal = status === "active" ? (byDay.get(today) ?? 0) : 0;
  const hasPlan = target != null && target > 0 && end != null && totalDays != null;
  const remaining = target != null ? Math.max(0, target - total) : null;
  const pct = target ? total / target : null;

  let todayGoal: number | null = null;
  let todayLeft: number | null = null;
  let perDayNeeded: number | null = null;
  let aheadBy: number | null = null;
  const basePace = hasPlan ? target! / totalDays! : null;

  if (hasPlan && status !== "finished" && daysLeft) {
    perDayNeeded = remaining! / daysLeft;
    if (status === "active") {
      const beforeToday = total - todayTotal;
      todayGoal = Math.max(0, (target! - beforeToday) / daysLeft);
      todayLeft = Math.max(0, todayGoal - todayTotal);
    }
  }
  if (hasPlan && status !== "upcoming") {
    const completedDays = status === "active" ? daysElapsed - 1 : daysElapsed;
    aheadBy = total - (target! * completedDays) / totalDays!;
  }

  const avgPerDay = daysElapsed > 0 ? total / daysElapsed : 0;
  const activeDayList = [...byDay.keys()].filter((d) => (byDay.get(d) ?? 0) > 0).sort();
  const activeDays = activeDayList.length;
  const avgPerActiveDay = activeDays ? total / activeDays : 0;
  const projectedTotal = totalDays && status !== "upcoming" ? Math.max(total, avgPerDay * totalDays) : null;

  // Series + the day the target was crossed.
  const seriesEnd = end ?? asOf;
  let seriesStart = start;
  if (!end && diffDays(start, seriesEnd) > 119) seriesStart = addDays(seriesEnd, -119);
  let running = 0;
  for (const [d, a] of byDay) if (d < seriesStart) running += a;
  let reachedDay: string | null = null;
  const series: DayPoint[] = [];
  if (seriesEnd >= seriesStart) {
    for (const day of eachDay(seriesStart, seriesEnd)) {
      const amount = byDay.get(day) ?? 0;
      const happened = day <= asOf;
      if (happened) running += amount;
      if (happened && target && !reachedDay && running >= target) reachedDay = day;
      series.push({
        day,
        amount: happened ? amount : 0,
        cumulative: happened ? running : null,
        pace: hasPlan ? (target! * (diffDays(start, day) + 1)) / totalDays! : null,
      });
    }
  }
  if (target && !reachedDay && total >= target) reachedDay = asOf; // entries outside window

  const reached = target != null && total >= target;
  let finishDay: string | null = reachedDay;
  if (!reached && target && avgPerDay > 0 && status === "active") {
    finishDay = addDays(start, Math.ceil(target / avgPerDay) - 1);
  }
  const finishedEarly = reached && !!end && !!reachedDay && reachedDay < end;

  // Streaks
  let longestStreak = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of activeDayList) {
    run = prev && diffDays(prev, d) === 1 ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    prev = d;
  }
  const activeSet = new Set(activeDayList);
  let currentStreak = 0;
  let cursor = activeSet.has(asOf) ? asOf : addDays(asOf, -1);
  if (status === "finished") cursor = asOf;
  while (activeSet.has(cursor)) {
    currentStreak++;
    cursor = addDays(cursor, -1);
  }

  let bestDay: Stats["bestDay"] = null;
  for (const [day, amount] of byDay) if (!bestDay || amount > bestDay.amount) bestDay = { day, amount };

  return {
    status,
    total,
    target,
    remaining,
    pct,
    totalDays,
    daysElapsed,
    daysLeft,
    todayTotal,
    todayGoal,
    todayLeft,
    perDayNeeded,
    basePace,
    aheadBy,
    avgPerDay,
    avgPerActiveDay,
    projectedTotal,
    finishDay,
    finishedEarly,
    reached,
    sets: entries.length,
    avgSet: entries.length ? total / entries.length : 0,
    bestSet,
    bestDay,
    activeDays,
    currentStreak,
    longestStreak,
    series,
  };
}

// ---------- badges ----------

export type Badge = { id: string; icon: string; name: string; desc: string };

export const BADGES: Record<string, Omit<Badge, "id">> = {
  first: { icon: "🎯", name: "First set", desc: "Logged a first set" },
  streak7: { icon: "🔥", name: "On fire", desc: "7-day streak" },
  streak30: { icon: "⛓️", name: "Unbreakable", desc: "30-day streak" },
  bigday: { icon: "💥", name: "Big day", desc: "Did 3× the daily pace in one day" },
  perfect: { icon: "📅", name: "Every day", desc: "Logged every single day (5+ days)" },
  crushed: { icon: "🏆", name: "Goal crushed", desc: "Hit their goal" },
  early: { icon: "⚡", name: "Ahead of schedule", desc: "Finished their goal early" },
  weight: { icon: "🏋️", name: "Pulled their weight", desc: "Did at least an even share of a team goal" },
  mvp: { icon: "👑", name: "MVP", desc: "Top of the leaderboard" },
};

export function badgesFor(opts: {
  stats: Stats;
  goalType: "shared" | "individual";
  sharedTarget: number | null;
  memberCount: number;
  rank: number;
}): Badge[] {
  const { stats: s, goalType, sharedTarget, memberCount, rank } = opts;
  const ids: string[] = [];
  if (s.sets > 0) ids.push("first");
  if (rank === 1 && s.total > 0 && memberCount > 1) ids.push("mvp");
  if (goalType === "individual" && s.reached) ids.push("crushed");
  if (goalType === "individual" && s.finishedEarly) ids.push("early");
  if (goalType === "shared" && sharedTarget && memberCount > 1 && s.total >= sharedTarget / memberCount) ids.push("weight");
  if (s.longestStreak >= 30) ids.push("streak30");
  else if (s.longestStreak >= 7) ids.push("streak7");
  const pace = goalType === "individual" ? s.basePace : sharedTarget && s.totalDays ? sharedTarget / memberCount / s.totalDays : null;
  if (pace && s.bestDay && s.bestDay.amount >= pace * 3) ids.push("bigday");
  if (s.daysElapsed >= 5 && s.activeDays >= s.daysElapsed) ids.push("perfect");
  return ids.map((id) => ({ id, ...BADGES[id] }));
}

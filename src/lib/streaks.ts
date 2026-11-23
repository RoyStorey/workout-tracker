// Day streaks: consecutive calendar days on which someone logged anything, in any challenge.
// Shared by server and client. Nothing here is stored: streaks are recomputed from the
// log on every request, so a broken streak loses its flair the moment the day rolls over.

import { addDays } from "./dates";

export type Tier = { min: number; name: string; color: string; glow: boolean; shimmer: boolean };

export const TIERS: Tier[] = [
  { min: 3, name: "Spark", color: "#f5a524", glow: false, shimmer: false },
  { min: 7, name: "On Fire", color: "#f26b30", glow: false, shimmer: false },
  { min: 14, name: "Blazing", color: "#e5383b", glow: true, shimmer: false },
  { min: 30, name: "Blue Flame", color: "#3b82f6", glow: true, shimmer: false },
  { min: 60, name: "Plasma", color: "#8b5cf6", glow: true, shimmer: false },
  { min: 100, name: "Supernova", color: "#e6a700", glow: true, shimmer: true },
  { min: 365, name: "Eternal", color: "#e6a700", glow: true, shimmer: true },
];

export const tierFor = (days: number): Tier | null => [...TIERS].reverse().find((t) => days >= t.min) ?? null;
export const nextTier = (days: number): Tier | null => TIERS.find((t) => days < t.min) ?? null;

export type Streak = {
  /** Consecutive days ending today, or ending yesterday if today isn't logged yet. */
  current: number;
  /** Alive, but nothing logged today yet: it breaks at midnight. */
  atRisk: boolean;
  longest: number;
  /** Last day of the most recent run (for "your streak ended on…"). */
  lastActive: string | null;
};

/** `days` are YYYY-MM-DD strings (any order, duplicates fine). */
export function computeStreak(days: Iterable<string>, today: string): Streak {
  const set = new Set([...days].filter((d) => d <= today));
  const sorted = [...set].sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  const loggedToday = set.has(today);
  let current = 0;
  for (let d = loggedToday ? today : addDays(today, -1); set.has(d); d = addDays(d, -1)) current++;
  return { current, atRisk: current > 0 && !loggedToday, longest, lastActive: sorted.at(-1) ?? null };
}

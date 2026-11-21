// All "days" are calendar dates as YYYY-MM-DD strings. Math is done in UTC so
// DST never shifts a day.

const DAY_MS = 86_400_000;

export function isValidTz(tz: string | undefined | null): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function todayIn(tz?: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: isValidTz(tz) ? tz : undefined,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function isDay(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const toMs = (day: string) => Date.parse(day + "T00:00:00Z");

export function addDays(day: string, n: number): string {
  return new Date(toMs(day) + n * DAY_MS).toISOString().slice(0, 10);
}

/** Number of days from a to b (b - a). */
export function diffDays(a: string, b: string): number {
  return Math.round((toMs(b) - toMs(a)) / DAY_MS);
}

export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function weekday(day: string): number {
  return new Date(toMs(day)).getUTCDay();
}

export function fmtDay(day: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  return new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "UTC" }).format(new Date(toMs(day)));
}

export function fmtRange(start: string, end: string | null) {
  const sameYear = end && start.slice(0, 4) === end.slice(0, 4);
  const s = fmtDay(start, { month: "short", day: "numeric", year: sameYear ? undefined : "numeric" });
  if (!end) return `${s} onward`;
  return `${s} – ${fmtDay(end, { month: "short", day: "numeric", year: "numeric" })}`;
}

export function timeAgo(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

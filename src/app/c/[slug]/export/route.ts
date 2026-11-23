import { getCurrentUser, getTimeZone, getToday } from "@/lib/auth";
import { eachDay } from "@/lib/dates";
import { canViewChallenge, challengeSlugForAlias, challengeEntries, challengeMembers, challengeSquads, getChallengeBySlug } from "@/lib/queries";

export const dynamic = "force-dynamic";

const cell = (v: string | number) => {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const line = (vals: (string | number)[]) => vals.map(cell).join(",");

/** GET /c/<slug>/export?type=daily|sets[&k=invite] → CSV download. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = new URL(req.url);
  const type = url.searchParams.get("type") === "sets" ? "sets" : "daily";
  const c = getChallengeBySlug(slug) ?? (challengeSlugForAlias(slug) ? getChallengeBySlug(challengeSlugForAlias(slug)!) : undefined);
  const user = await getCurrentUser();
  if (!c || !canViewChallenge(c, user?.id, url.searchParams.get("k"))) return new Response("Not found", { status: 404 });

  const members = challengeMembers(c.id);
  const entries = challengeEntries(c.id);
  const squads = new Map(challengeSquads(c.id).map((s) => [s.id, s.name]));
  const names = new Map(members.map((m) => [m.id, m]));
  const rows: string[] = [];

  if (type === "daily") {
    const today = await getToday();
    const last = c.end_date && c.end_date < today ? c.end_date : today;
    const cellMap = new Map<string, number>();
    for (const e of entries) cellMap.set(`${e.day}|${e.user_id}`, (cellMap.get(`${e.day}|${e.user_id}`) ?? 0) + e.amount);
    rows.push(line(["Date", ...members.map((m) => m.display_name), "Total"]));
    const totals = members.map(() => 0);
    for (const day of last >= c.start_date ? eachDay(c.start_date, last) : []) {
      const vals = members.map((m, i) => {
        const v = cellMap.get(`${day}|${m.id}`) ?? 0;
        totals[i] += v;
        return v;
      });
      rows.push(line([day, ...vals, vals.reduce((a, b) => a + b, 0)]));
    }
    rows.push(line(["Total", ...totals, totals.reduce((a, b) => a + b, 0)]));
  } else {
    const tz = await getTimeZone();
    const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
    const hasSquads = squads.size > 0;
    rows.push(line(["Date", "Logged at", "Name", "Username", ...(hasSquads ? [c.kind === "teams" ? "Team" : "Squad"] : []), `Amount (${c.unit})`, "Note"]));
    for (const e of entries) {
      const m = names.get(e.user_id);
      rows.push(
        line([
          e.day,
          fmt.format(new Date(e.created_at)).replace(",", ""),
          m?.display_name ?? "(left)",
          m?.username ?? "",
          ...(hasSquads ? [m?.squad_id ? (squads.get(m.squad_id) ?? "") : ""] : []),
          e.amount,
          e.note,
        ]),
      );
    }
  }

  // BOM so Excel opens it as UTF-8.
  const body = "﻿" + rows.join("\r\n") + "\r\n";
  const file = `${c.slug}-${type === "daily" ? "daily-totals" : "all-sets"}.csv`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file}"`,
      "Cache-Control": "no-store",
    },
  });
}

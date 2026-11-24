import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { timeAgo } from "@/lib/dates";
import { cx, fmtCompact, fmtNum } from "@/lib/format";
import { adminDeleteUser, adminSetAdmin, adminSignOutEverywhere } from "@/lib/actions/admin";
import { Avatar } from "@/components/avatar";
import { AdminReset } from "@/components/admin-reset";
import { ConfirmButton } from "@/components/forms";
import { Panel } from "@/components/ui";

export const metadata = { title: "Admin" };

const PAGE = 50;

type Row = {
  id: number;
  username: string;
  display_name: string;
  color: string;
  created_at: number;
  is_admin: number;
  is_demo: number;
  must_change_password: number;
  challenges: number;
  sets: number;
  last_set: number | null;
  last_seen: number | null;
};

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; role?: string }> }) {
  const admin = await requireAdmin();
  const { q = "", page = "1", role } = await searchParams;
  const d = db();
  const pageNo = Math.max(1, Number(page) || 1);
  const like = `%${q.trim()}%`;
  const where = `(? = '' OR u.username LIKE ? OR u.display_name LIKE ?) ${role === "admins" ? "AND u.is_admin = 1" : role === "demo" ? "AND u.is_demo = 1" : ""}`;
  const args = [q.trim(), like, like];
  const total = (d.prepare(`SELECT COUNT(*) AS n FROM users u WHERE ${where}`).get(...args) as { n: number }).n;
  const rows = d
    .prepare(
      `SELECT u.id, u.username, u.display_name, u.color, u.created_at, u.is_admin, u.is_demo, u.must_change_password,
         (SELECT COUNT(*) FROM challenge_members m WHERE m.user_id = u.id) AS challenges,
         (SELECT COUNT(*) FROM entries e WHERE e.user_id = u.id) AS sets,
         (SELECT MAX(created_at) FROM entries e WHERE e.user_id = u.id) AS last_set,
         (SELECT MAX(created_at) FROM sessions s WHERE s.user_id = u.id) AS last_seen
       FROM users u WHERE ${where} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...args, PAGE, (pageNo - 1) * PAGE) as Row[];
  const stats = d
    .prepare(
      `SELECT (SELECT COUNT(*) FROM users) AS users,
              (SELECT COUNT(*) FROM users WHERE created_at > ?) AS new_week,
              (SELECT COUNT(*) FROM users WHERE is_admin = 1) AS admins,
              (SELECT COUNT(DISTINCT user_id) FROM entries WHERE created_at > ?) AS active_week,
              (SELECT COUNT(*) FROM challenges) AS challenges,
              (SELECT COUNT(*) FROM teams) AS teams,
              (SELECT COUNT(*) FROM entries) AS sets,
              (SELECT COUNT(*) FROM messages) AS messages`,
    )
    .get(Date.now() - 7 * 86_400_000, Date.now() - 7 * 86_400_000) as Record<string, number>;
  const logRows = d.prepare("SELECT admin_name, action, target_name, created_at FROM admin_log ORDER BY created_at DESC LIMIT 25").all() as {
    admin_name: string;
    action: string;
    target_name: string | null;
    created_at: number;
  }[];
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const href = (extra: Record<string, string | undefined>) => {
    const qs = new URLSearchParams(Object.entries({ q: q || undefined, role, ...extra }).filter(([, v]) => v) as [string, string][]).toString();
    return `/admin${qs ? `?${qs}` : ""}`;
  };
  const lastActive = (r: Row) => Math.max(r.last_set ?? 0, r.last_seen ?? 0) || null;

  return (
    <div className="space-y-6">
      <div>
        <div className="eyebrow">Signed in as @{admin.username}</div>
        <h1 className="display mt-1 text-5xl uppercase">Admin</h1>
      </div>

      <section className="overflow-hidden rounded-lg border border-line bg-surface">
        <div className="-mb-px -mr-px grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 [&>*]:border-b [&>*]:border-r [&>*]:border-line">
        {(
          [
            ["People", stats.users],
            ["New this week", stats.new_week],
            ["Active this week", stats.active_week],
            ["Admins", stats.admins],
            ["Challenges", stats.challenges],
            ["Teams", stats.teams],
            ["Sets logged", stats.sets],
            ["Messages", stats.messages],
          ] as const
        ).map(([label, n]) => (
          <div key={label} className="p-4">
            <div className="eyebrow">{label}</div>
            <div className="display mt-1 text-3xl">{fmtCompact(n)}</div>
          </div>
        ))}
        </div>
      </section>

      <Panel
        flush
        title="People"
        actions={
          <div className="flex text-xs font-semibold">
            {([
              [undefined, "All"],
              ["admins", "Admins"],
              ["demo", "Demo"],
            ] as const).map(([r, label]) => (
              <Link key={label} href={href({ role: r, page: undefined })} className={cx("border-b-2 px-2 py-1", role === r ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink")}>
                {label}
              </Link>
            ))}
          </div>
        }
      >
        <form className="flex gap-2 border-b border-line p-3">
          {role && <input type="hidden" name="role" value={role} />}
          <input name="q" defaultValue={q} className="input h-10 text-sm" placeholder="Search by username or name" aria-label="Search people" />
          <button className="btn-ghost h-10">Search</button>
          {q && (
            <Link href={href({ q: undefined, page: undefined })} className="btn-ghost h-10">
              Clear
            </Link>
          )}
        </form>
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-muted">Nobody matches that.</p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start gap-x-4 gap-y-3 px-4 py-3">
                <Link href={`/u/${r.username}`} className="flex min-w-0 flex-1 basis-56 items-center gap-3">
                  <Avatar user={r} size={34} />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate font-semibold hover:underline">{r.display_name}</span>
                      {r.is_admin ? <span className="tag border-ink text-ink">Admin</span> : null}
                      {r.is_demo ? <span className="tag">Demo</span> : null}
                      {r.must_change_password ? <span className="tag border-signal/40 text-signal">Temp password</span> : null}
                    </span>
                    <span className="block truncate text-xs text-muted">@{r.username}</span>
                  </span>
                </Link>
                <dl className="grid shrink-0 grid-cols-4 gap-4 text-xs sm:w-96">
                  <div>
                    <dt className="text-faint">Joined</dt>
                    <dd className="font-medium">{new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}</dd>
                  </div>
                  <div>
                    <dt className="text-faint">Last active</dt>
                    <dd className="font-medium">{lastActive(r) ? timeAgo(lastActive(r)!) : "never"}</dd>
                  </div>
                  <div>
                    <dt className="text-faint">Challenges</dt>
                    <dd className="tnum font-medium">{fmtNum(r.challenges)}</dd>
                  </div>
                  <div>
                    <dt className="text-faint">Sets</dt>
                    <dd className="tnum font-medium">{fmtNum(r.sets)}</dd>
                  </div>
                </dl>
                <div className="flex w-full shrink-0 flex-wrap items-start justify-end gap-2 sm:w-auto">
                  <AdminReset userId={r.id} username={r.username} />
                  <details className="relative">
                    <summary className="btn-ghost h-8 cursor-pointer list-none px-2.5 text-xs [&::-webkit-details-marker]:hidden" aria-label={`More actions for ${r.username}`}>
                      More
                    </summary>
                    <div className="card absolute right-0 z-10 mt-1 w-52 space-y-0.5 p-1 text-sm shadow-lg">
                      <ConfirmButton
                        action={adminSignOutEverywhere.bind(null, r.id)}
                        message={`Sign @${r.username} out on every device?`}
                        className="w-full rounded px-3 py-1.5 text-left hover:bg-surface-2"
                      >
                        Sign out everywhere
                      </ConfirmButton>
                      {r.id !== admin.id && (
                        <ConfirmButton
                          action={adminSetAdmin.bind(null, r.id, !r.is_admin)}
                          message={r.is_admin ? `Remove admin access from @${r.username}?` : `Make @${r.username} an admin? They'll be able to reset anyone's password.`}
                          className="w-full rounded px-3 py-1.5 text-left hover:bg-surface-2"
                        >
                          {r.is_admin ? "Remove admin" : "Make admin"}
                        </ConfirmButton>
                      )}
                      {r.id !== admin.id && (
                        <ConfirmButton
                          action={adminDeleteUser.bind(null, r.id)}
                          message={`Permanently delete @${r.username}? Their sets and messages are removed; challenges and teams they own pass to another member.`}
                          className="w-full rounded px-3 py-1.5 text-left text-bad hover:bg-surface-2"
                        >
                          Delete account
                        </ConfirmButton>
                      )}
                    </div>
                  </details>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-xs text-muted">
          <span>
            {fmtNum(total)} {total === 1 ? "person" : "people"}
            {pages > 1 && ` · page ${pageNo} of ${pages}`}
          </span>
          {pages > 1 && (
            <span className="flex gap-2">
              {pageNo > 1 && <Link href={href({ page: String(pageNo - 1) })} className="font-semibold hover:text-ink">← Newer</Link>}
              {pageNo < pages && <Link href={href({ page: String(pageNo + 1) })} className="font-semibold hover:text-ink">Older →</Link>}
            </span>
          )}
        </div>
      </Panel>

      <Panel flush title="Admin log" actions={<span className="text-xs text-muted">Last 25 actions</span>}>
        {logRows.length ? (
          <ul className="divide-y divide-line text-sm">
            {logRows.map((l, i) => (
              <li key={i} className="flex justify-between gap-3 px-4 py-2.5">
                <span>
                  <b>@{l.admin_name}</b> <span className="text-muted">{l.action}</span>
                  {l.target_name && <b> @{l.target_name}</b>}
                </span>
                <span className="shrink-0 text-xs text-faint">{timeAgo(l.created_at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-4 text-sm text-muted">No admin actions yet.</p>
        )}
      </Panel>
    </div>
  );
}

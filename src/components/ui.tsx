import Link from "next/link";
import { cx, fmtNum, fmtPct } from "@/lib/format";
import type { Status } from "@/lib/stats";
import { CheckIcon, GlobeIcon, LockIcon, TrendDownIcon, TrendUpIcon } from "./icons";

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className={cx("h-2.5 w-full overflow-hidden rounded-full bg-series-1/15", className)} role="progressbar" aria-valuenow={Math.round(v * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-series-1 transition-[width] duration-700" style={{ width: `${v * 100}%` }} />
    </div>
  );
}

export function ProgressRing({ value, size = 148, stroke = 12, children }: { value: number; size?: number; stroke?: number; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--series-1)" strokeOpacity={0.15} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--series-1)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: "stroke-dashoffset 900ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

export function StatTile({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "good" | "bad" }) {
  return (
    <div className="card p-3.5 sm:p-4">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="tnum mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{value}</div>
      {sub && <div className={cx("mt-0.5 flex items-center gap-1 text-xs", tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : "text-muted")}>{sub}</div>}
    </div>
  );
}

export function PaceDelta({ aheadBy, unit }: { aheadBy: number; unit: string }) {
  const ahead = aheadBy >= 0;
  return (
    <span className={cx("inline-flex items-center gap-1 font-medium", ahead ? "text-good" : "text-bad")}>
      {ahead ? <TrendUpIcon size={14} /> : <TrendDownIcon size={14} />}
      {fmtNum(Math.abs(aheadBy), 0)} {unit} {ahead ? "ahead" : "behind"}
    </span>
  );
}

export function StatusPill({ status, reached }: { status: Status; reached?: boolean }) {
  if (reached)
    return (
      <span className="pill border-good/30 text-good">
        <CheckIcon size={12} /> Goal hit
      </span>
    );
  const map = { upcoming: "Starts soon", active: "Live", finished: "Finished" } as const;
  return (
    <span className={cx("pill", status === "active" && "border-accent/30 text-accent")}>
      {status === "active" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />}
      {map[status]}
    </span>
  );
}

export function VisibilityPill({ visibility }: { visibility: "public" | "private" }) {
  return visibility === "public" ? (
    <span className="pill"><GlobeIcon size={12} /> Public</span>
  ) : (
    <span className="pill"><LockIcon size={12} /> Private</span>
  );
}

export function Empty({ title, children, action }: { title: string; children?: React.ReactNode; action?: { href: string; label: string } }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-10 text-center">
      <div className="font-semibold">{title}</div>
      {children && <div className="max-w-sm text-sm text-muted">{children}</div>}
      {action && (
        <Link href={action.href} className="btn-primary mt-2">
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function Pct({ value }: { value: number | null }) {
  return value == null ? null : <>{fmtPct(value)}</>;
}

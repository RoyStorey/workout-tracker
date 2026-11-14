import Link from "next/link";
import { cx, fmtNum } from "@/lib/format";
import type { Status } from "@/lib/stats";

export function ProgressBar({ value, className, color = "var(--series-1)" }: { value: number; className?: string; color?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div
      className={cx("h-2 w-full overflow-hidden rounded-[3px]", className)}
      style={{ background: `color-mix(in srgb, ${color} 16%, transparent)` }}
      role="progressbar"
      aria-valuenow={Math.round(v * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full rounded-[3px] transition-[width] duration-700" style={{ width: `${v * 100}%`, background: color }} />
    </div>
  );
}

/** Label over a number. Used in rows separated by hairlines, not boxed. */
export function Stat({ label, value, sub, tone, big }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "good" | "bad"; big?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="eyebrow truncate">{label}</div>
      <div className={cx("display mt-1", big ? "text-4xl" : "text-[28px]", tone === "good" && "text-good", tone === "bad" && "text-bad")}>{value}</div>
      {sub && <div className="mt-0.5 truncate text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function PaceNote({ aheadBy, unit }: { aheadBy: number; unit: string }) {
  const ahead = aheadBy >= 0;
  return (
    <span className={cx("font-semibold", ahead ? "text-good" : "text-bad")}>
      {ahead ? "▲" : "▼"} {fmtNum(Math.abs(aheadBy), 0)} {unit} {ahead ? "ahead of pace" : "behind pace"}
    </span>
  );
}

export function StatusTag({ status, reached }: { status: Status; reached?: boolean }) {
  if (reached) return <span className="tag border-good/40 text-good">Goal hit</span>;
  if (status === "active")
    return (
      <span className="tag border-signal/40 text-signal">
        <span className="h-1.5 w-1.5 rounded-full bg-signal" /> Live
      </span>
    );
  return <span className="tag">{status === "upcoming" ? "Upcoming" : "Finished"}</span>;
}

export function Empty({ title, children, action }: { title: string; children?: React.ReactNode; action?: { href: string; label: string } }) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong px-6 py-10 text-center">
      <div className="font-semibold">{title}</div>
      {children && <div className="mx-auto mt-1 max-w-sm text-sm text-muted">{children}</div>}
      {action && (
        <Link href={action.href} className="btn-primary mt-4">
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function SectionHead({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="display text-2xl uppercase">{title}</h2>
      {children}
    </div>
  );
}

/** Colour swatch for a squad slot (0-7); colours follow the validated categorical order. */
export const squadColor = (slot: number) => `var(--cat-${(slot % 8) + 1})`;

export function SquadDot({ slot, size = 10 }: { slot: number; size?: number }) {
  return <span aria-hidden className="inline-block shrink-0 rounded-[2px]" style={{ width: size, height: size, background: squadColor(slot) }} />;
}

export function VisibilityPill({ visibility }: { visibility: "public" | "private" }) {
  return <span className="tag">{visibility === "public" ? "Public" : "Private"}</span>;
}

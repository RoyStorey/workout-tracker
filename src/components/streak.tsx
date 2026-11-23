import { cx } from "@/lib/format";
import { tierFor, type Tier } from "@/lib/streaks";

/** A flame with a lighter core, drawn rather than an emoji so it can take each tier's colour. */
export function FlameGlyph({ color, size = 16, className }: { color: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className={className}>
      <path
        d="M12 22c4.4 0 7.5-3 7.5-7.2 0-3.9-2.6-6.6-4.3-9.9-.4 2.3-1.5 3.6-2.8 4.3.2-3.2-1.1-5.8-3.6-7.2.3 3.4-1.6 5.6-3.3 7.8C4.1 11.6 4.5 13 4.5 14.8 4.5 19 7.6 22 12 22z"
        fill={color}
      />
      <path d="M12 21c2 0 3.5-1.4 3.5-3.4 0-1.9-1.3-3-2.1-4.6-.3 1.2-.9 1.8-1.7 2.1.1-1.5-.5-2.6-1.4-3.3-.1 2-1.8 2.8-1.8 5.2C8.5 19.6 10 21 12 21z" fill="#fff" fillOpacity={0.55} />
    </svg>
  );
}

const fx = (t: Tier) => cx("streak-flicker", t.glow && "streak-glow", t.shimmer && "streak-shimmer");

/**
 * The flair shown next to someone's name while their streak is alive (3+ days).
 * Renders nothing otherwise, so a broken streak simply disappears.
 */
export function StreakFlame({ days, size = "sm", atRisk }: { days: number; size?: "sm" | "md" | "lg"; atRisk?: boolean }) {
  const t = tierFor(days);
  if (!t) return null;
  const s = size === "lg" ? { icon: 22, text: "text-xl", pad: "px-2.5 py-1 gap-1.5" } : size === "md" ? { icon: 16, text: "text-sm", pad: "px-2 py-0.5 gap-1" } : { icon: 13, text: "text-xs", pad: "px-1.5 py-px gap-0.5" };
  return (
    <span
      title={`${t.name}: ${days}-day streak${atRisk ? " (log today to keep it)" : ""}`}
      className={cx("inline-flex shrink-0 items-center rounded-full border align-middle font-bold leading-none", s.pad, fx(t), atRisk && "opacity-60")}
      style={{ "--tier": t.color, borderColor: `color-mix(in srgb, ${t.color} 45%, transparent)`, background: `color-mix(in srgb, ${t.color} 12%, transparent)` } as React.CSSProperties}
    >
      <FlameGlyph color={t.color} size={s.icon} />
      <span className={cx("streak-num tnum", s.text)}>{days}</span>
    </span>
  );
}

/** Style for an avatar's streak ring: a tier-coloured halo, pulsing at the higher tiers. */
export function streakRing(days: number | undefined): { style?: React.CSSProperties; className?: string } {
  const t = days ? tierFor(days) : null;
  if (!t) return {};
  const ring = `0 0 0 2px var(--surface), 0 0 0 4px ${t.color}`;
  return {
    style: { "--ring": ring, "--tier": t.color, boxShadow: t.glow ? `${ring}, 0 0 10px ${t.color}` : ring } as React.CSSProperties,
    className: t.glow ? "avatar-glow" : undefined,
  };
}

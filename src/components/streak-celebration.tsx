"use client";

import { useEffect, useMemo } from "react";
import { FlameGlyph } from "./streak";
import { TIERS, nextTier } from "@/lib/streaks";

/** Full-screen moment when a streak reaches a new tier. Click anywhere (or wait) to dismiss. */
export function StreakCelebration({ tier, days, onDone }: { tier: { name: string; min: number; color: string }; days: number; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4200);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onDone();
    window.addEventListener("keydown", esc);
    try {
      navigator.vibrate?.([30, 60, 30, 60, 120]);
    } catch {}
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", esc);
    };
  }, [onDone]);

  const pieces = useMemo(() => {
    const palette = [tier.color, "#ffffff", "#f5a524", tier.color, "#f26b30"];
    return Array.from({ length: 70 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      dur: 1.8 + Math.random() * 1.6,
      drift: `${(Math.random() - 0.5) * 30}vw`,
      spin: `${(Math.random() - 0.5) * 1080}deg`,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 10,
      color: palette[i % palette.length],
      round: Math.random() < 0.3,
    }));
  }, [tier.color]);

  const upNext = nextTier(days);
  const rank = TIERS.findIndex((t) => t.name === tier.name) + 1;

  return (
    <div role="alertdialog" aria-label={`New streak tier: ${tier.name}`} onClick={onDone} className="fixed inset-0 z-[60] flex cursor-pointer items-center justify-center overflow-hidden bg-black/70 backdrop-blur-sm">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti pointer-events-none absolute top-0"
          style={{
            left: `${p.left}%`,
            width: p.w,
            height: p.round ? p.w : p.h,
            background: p.color,
            borderRadius: p.round ? "50%" : 2,
            animation: `confetti-fall ${p.dur}s cubic-bezier(.2,.6,.4,1) ${p.delay}s both`,
            ["--drift" as string]: p.drift,
            ["--spin" as string]: p.spin,
          }}
        />
      ))}
      <div className="relative mx-4 w-full max-w-sm text-center text-white" style={{ animation: "pop-in 600ms cubic-bezier(.2,.9,.3,1.3) both" }}>
        <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-full" style={{ background: `radial-gradient(circle, ${tier.color}55 0%, transparent 70%)` }}>
          <span className="streak-glow" style={{ ["--tier" as string]: tier.color }}>
            <FlameGlyph color={tier.color} size={110} />
          </span>
        </div>
        <div className="eyebrow mt-2 text-white/70" style={{ animation: "rise 500ms 250ms both" }}>
          New streak tier · {rank} of {TIERS.length}
        </div>
        <div className="display mt-2 text-6xl uppercase" style={{ animation: "rise 500ms 350ms both" }}>
          {tier.name}
        </div>
        <div className="mt-2 text-lg font-semibold" style={{ animation: "rise 500ms 450ms both" }}>
          {days} days in a row
        </div>
        <div className="mt-4 text-sm text-white/70" style={{ animation: "rise 500ms 600ms both" }}>
          {upNext ? `${upNext.min - days} more to reach ${upNext.name}.` : "The top tier. Legendary."} Everyone can see your flame now.
        </div>
        <div className="mt-6 text-xs text-white/50">Tap anywhere to keep going</div>
      </div>
    </div>
  );
}

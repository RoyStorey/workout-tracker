"use client";

import { useEffect, useState } from "react";

type Mode = "system" | "light" | "dark";

export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("system");
  useEffect(() => {
    try {
      const t = localStorage.getItem("theme");
      if (t === "light" || t === "dark") setMode(t);
    } catch {}
  }, []);
  const cycle = () => {
    const next: Mode = mode === "system" ? "dark" : mode === "dark" ? "light" : "system";
    setMode(next);
    try {
      if (next === "system") {
        localStorage.removeItem("theme");
        delete document.documentElement.dataset.theme;
      } else {
        localStorage.setItem("theme", next);
        document.documentElement.dataset.theme = next;
      }
    } catch {}
  };
  return (
    <button onClick={cycle} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2">
      Theme <span className="text-xs text-muted capitalize">{mode}</span>
    </button>
  );
}

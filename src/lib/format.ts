export function fmtNum(n: number, maxFrac = 1): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: maxFrac }).format(n);
}

export function fmtCompact(n: number): string {
  if (Math.abs(n) < 10_000) return fmtNum(n);
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function fmtPct(p: number): string {
  return `${Math.floor(p * 100)}%`;
}

export function plural(n: number, word: string, pluralWord = word + "s") {
  return `${fmtNum(n)} ${Math.abs(n) === 1 ? word : pluralWord}`;
}

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

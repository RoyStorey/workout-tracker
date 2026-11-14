"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/format";

export function NavLink({ href, exact, tab, icon, children }: { href: string; exact?: boolean; tab?: boolean; icon?: React.ReactNode; children: React.ReactNode }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + "/");
  if (tab)
    return (
      <Link href={href} className={cx("flex flex-col items-center gap-1 text-[11px] font-semibold", active ? "text-ink" : "text-faint")}>
        {icon}
        {children}
      </Link>
    );
  return (
    <Link
      href={href}
      className={cx("relative py-1 text-sm font-semibold transition-colors", active ? "text-ink after:absolute after:inset-x-0 after:-bottom-[17px] after:h-0.5 after:bg-ink" : "text-muted hover:text-ink")}
    >
      {children}
    </Link>
  );
}

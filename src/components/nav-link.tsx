"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/format";

export function NavLink({
  href,
  exact,
  tab,
  icon,
  children,
}: {
  href: string;
  exact?: boolean;
  tab?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + "/");
  if (tab)
    return (
      <Link href={href} className={cx("flex flex-col items-center gap-0.5 text-[11px] font-medium", active ? "text-accent" : "text-muted")}>
        {icon}
        {children}
      </Link>
    );
  return (
    <Link
      href={href}
      className={cx("rounded-lg px-3 py-1.5 text-sm font-medium", active ? "bg-surface-2 text-ink" : "text-muted hover:text-ink")}
    >
      {children}
    </Link>
  );
}

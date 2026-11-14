import Link from "next/link";
import { cx, initials } from "@/lib/format";

type U = { username: string; display_name: string; color: string };

export function Avatar({ user, size = 32, className }: { user: U; size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cx("inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white", className)}
      style={{ width: size, height: size, background: user.color, fontSize: Math.max(10, size * 0.38) }}
    >
      {initials(user.display_name || user.username)}
    </span>
  );
}

export function UserChip({ user, size = 28, sub }: { user: U; size?: number; sub?: React.ReactNode }) {
  return (
    <Link href={`/u/${user.username}`} className="group flex min-w-0 items-center gap-2.5">
      <Avatar user={user} size={size} />
      <span className="min-w-0">
        <span className="block truncate font-medium group-hover:underline">{user.display_name}</span>
        {sub && <span className="block truncate text-xs text-muted">{sub}</span>}
      </span>
    </Link>
  );
}

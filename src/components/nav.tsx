import Link from "next/link";
import { APP_NAME } from "@/lib/config";
import type { User } from "@/lib/auth";
import { logout } from "@/lib/actions/auth";
import { Avatar } from "./avatar";
import { BoltIcon, CompassIcon, HomeIcon, PlusIcon, UserIcon, UsersIcon } from "./icons";
import { NavLink } from "./nav-link";
import { ThemeToggle } from "./theme-toggle";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-ink">
        <BoltIcon size={18} />
      </span>
      {APP_NAME}
    </Link>
  );
}

export function Nav({ user }: { user: User | null }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
        <Logo />
        {user && (
          <nav className="hidden items-center gap-1 sm:flex">
            <NavLink href="/" exact>Home</NavLink>
            <NavLink href="/explore">Explore</NavLink>
            <NavLink href="/teams">Teams</NavLink>
          </nav>
        )}
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <Link href="/challenges/new" className="btn-primary hidden py-2 sm:inline-flex">
                <PlusIcon size={16} /> New challenge
              </Link>
              <details className="relative">
                <summary className="flex cursor-pointer list-none items-center rounded-full p-0.5 ring-accent/40 hover:ring-2 [&::-webkit-details-marker]:hidden">
                  <Avatar user={user} size={34} />
                  <span className="sr-only">Account menu</span>
                </summary>
                <div className="card absolute right-0 mt-2 w-56 overflow-hidden p-1 shadow-xl">
                  <div className="px-3 py-2">
                    <div className="truncate font-semibold">{user.display_name}</div>
                    <div className="truncate text-xs text-muted">@{user.username}</div>
                  </div>
                  <MenuLink href={`/u/${user.username}`}>Profile & stats</MenuLink>
                  <MenuLink href="/settings">Settings</MenuLink>
                  <ThemeToggle />
                  <form action={logout}>
                    <button className="w-full rounded-lg px-3 py-2 text-left text-sm text-bad hover:bg-surface-2">Log out</button>
                  </form>
                </div>
              </details>
            </>
          ) : (
            <>
              <NavLink href="/explore">Explore</NavLink>
              <Link href="/login" className="btn-ghost py-2">Log in</Link>
              <Link href="/signup" className="btn-primary py-2">Sign up</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function MenuLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="block rounded-lg px-3 py-2 text-sm hover:bg-surface-2">
      {children}
    </Link>
  );
}

export function BottomNav({ username }: { username: string }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center">
        <NavLink href="/" exact tab icon={<HomeIcon />}>Home</NavLink>
        <NavLink href="/explore" tab icon={<CompassIcon />}>Explore</NavLink>
        <Link href="/challenges/new" aria-label="New challenge" className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-ink shadow-lg active:scale-95">
          <PlusIcon size={24} />
        </Link>
        <NavLink href="/teams" tab icon={<UsersIcon />}>Teams</NavLink>
        <NavLink href={`/u/${username}`} tab icon={<UserIcon />}>Me</NavLink>
      </div>
    </nav>
  );
}

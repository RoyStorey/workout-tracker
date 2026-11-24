import Link from "next/link";
import { APP_NAME } from "@/lib/config";
import type { User } from "@/lib/auth";
import { logout } from "@/lib/actions/auth";
import { Avatar } from "./avatar";
import { CompassIcon, HomeIcon, PlusIcon, UserIcon, UsersIcon } from "./icons";
import { NavLink } from "./nav-link";
import { ThemeToggle } from "./theme-toggle";

/** Goalpost: two uprights, a crossbar and the post, with the ball through the middle. */
export function GoalPostMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 2.5v10h14v-10M12 12.5v9M8.5 21.5h7" />
      <circle cx="12" cy="7" r="2.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label={`${APP_NAME} home`}>
      <GoalPostMark />
      <span className="display text-[22px] uppercase leading-none">{APP_NAME}</span>
    </Link>
  );
}

export function Nav({ user, streak }: { user: User | null; streak?: number }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur-md" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto flex h-14 max-w-[84rem] items-center gap-8 px-4 sm:px-6 lg:px-10 2xl:px-14">
        <Logo />
        {user && (
          <nav className="hidden items-center gap-6 sm:flex">
            <NavLink href="/" exact>Today</NavLink>
            <NavLink href="/explore">Explore</NavLink>
            <NavLink href="/teams">Teams</NavLink>
          </nav>
        )}
        <div className="ml-auto flex items-center gap-3">
          {user ? (
            <>
              <Link href="/challenges/new" className="btn-primary hidden h-9 sm:inline-flex">
                <PlusIcon size={16} /> New challenge
              </Link>
              <details className="relative">
                <summary className="flex cursor-pointer list-none items-center rounded-full [&::-webkit-details-marker]:hidden">
                  <Avatar user={user} size={32} streak={streak} />
                  <span className="sr-only">Account menu</span>
                </summary>
                <div className="card absolute right-0 mt-2 w-56 overflow-hidden p-1 shadow-lg">
                  <div className="border-b border-line px-3 pb-2 pt-1.5">
                    <div className="truncate text-sm font-semibold">{user.display_name}</div>
                    <div className="truncate text-xs text-muted">@{user.username}</div>
                  </div>
                  <MenuLink href={`/u/${user.username}`}>Profile</MenuLink>
                  <MenuLink href="/settings">Settings</MenuLink>
                  {user.is_admin ? <MenuLink href="/admin">Admin</MenuLink> : null}
                  <ThemeToggle />
                  <form action={logout} className="border-t border-line pt-1">
                    <button className="w-full rounded px-3 py-2 text-left text-sm text-muted hover:bg-surface-2 hover:text-ink">Log out</button>
                  </form>
                </div>
              </details>
            </>
          ) : (
            <>
              <NavLink href="/explore">Explore</NavLink>
              <Link href="/login" className="text-sm font-semibold text-muted hover:text-ink">Log in</Link>
              <Link href="/signup" className="btn-primary h-9">Sign up</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function MenuLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="block rounded px-3 py-2 text-sm hover:bg-surface-2">
      {children}
    </Link>
  );
}

export function BottomNav({ username }: { username: string }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface sm:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center">
        <NavLink href="/" exact tab icon={<HomeIcon />}>Today</NavLink>
        <NavLink href="/explore" tab icon={<CompassIcon />}>Explore</NavLink>
        <Link href="/challenges/new" aria-label="New challenge" className="mx-auto flex h-11 w-11 items-center justify-center rounded-md bg-primary text-primary-ink active:translate-y-px">
          <PlusIcon size={22} />
        </Link>
        <NavLink href="/teams" tab icon={<UsersIcon />}>Teams</NavLink>
        <NavLink href={`/u/${username}`} tab icon={<UserIcon />}>Me</NavLink>
      </div>
    </nav>
  );
}

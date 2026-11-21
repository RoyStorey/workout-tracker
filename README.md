# GoalPost

Group fitness challenges for units, teams and training partners. Pick an exercise, set a goal and a timeframe, share the link, and grind it out together. GoalPost does the spreadsheet math for you.

## Features

- **Any exercise, any unit, any timeframe**: pushups, miles, plank minutes and so on. Challenges can have an end date or run forever (lifetime trackers).
- **Three formats**: *personal goal* (everyone chases the same number), *group goal* (everyone adds to one total), or *squad battle*. The target is optional: leave it blank for a "most wins" leaderboard.
- **Team vs team**: existing teams enter a challenge and compete. A team's leader taps "Enter my team" and the whole team is signed up; anyone who joins the team later can jump in. Score by total or average per member.
- **Squad battles**: split people into up to 8 squads (Alpha, Bravo…) that compete over the timeframe. Score by total, or by average per member so uneven squads stay fair. People pick a squad when they join, the organizer can move anyone, and the organizer doesn't have to be on a squad.
- **Public or private**: public challenges are listed on Explore. Private ones are visible only through an invite link (or to the hosting team).
- **Teams**: your regular crew, at a permanent link (`/t/a3f9c21b`) that survives renames. Join with an invite link or by typing the code on the Teams page. Host challenges under a team, track combined lifetime totals, and see who has been busiest this week.
- **Stats**: total and remaining, needed per day, today's target to stay on pace, ahead or behind pace, projected finish date, projected total, streaks, best set, best day, average set, and active days.
- **Charts**: cumulative total vs. even pace, plus daily bars, with hover tooltips and a table view.
- **Spreadsheet view**: one row per day and one column per person, with heat shading, frozen headers, a totals row, and CSV download (daily totals or every set).
- **Fast logging**: one-tap quick-add buttons (set per challenge), custom amounts, backdating, notes, undo, and a **tally counter** you can tap with your nose during pushups.
- **Real time**: when anyone logs, edits, joins, or gives kudos, every open page watching that challenge updates within a second, with no refresh. Uses Server-Sent Events; nothing extra to run.
- **Social**: activity feed, kudos, leaderboards (all-time, this week, today), badges (🔥 streaks, 👑 MVP, 🏆 goal crushed, ⚡ finished early, and more).
- **Profiles**: lifetime totals per exercise, an activity heatmap, and earned badges.
- **Mobile-first**: bottom tab bar, installable to your home screen (PWA manifest), dark mode (follows the system or toggles from the account menu).

## Running it

Requires **Node.js 22.13 or newer**. The database engine is built into Node, so nothing gets compiled on install. Check with `node -v`. If you use nvm, run `nvm install 22`, then `nvm use` that version.

```bash
npm install
npm run build
npm run start            # serves on 0.0.0.0:3000
```

To use a different port:

```bash
PORT=8080 npm run start
```

Forward that port on your router to the machine and share `http://<your-public-ip>:<port>`.

All data lives in one SQLite file, `data/app.db`, which is created automatically. Nothing else needs to run.

### Updating

```bash
git pull
npm install
npm run build
```

Then restart `npm run start`. Database migrations run automatically on startup.

### Demo data

```bash
npm run seed                          # adds 22 demo users, 4 teams, 12 challenges, weeks of sets
npm run seed -- --join <username>     # also adds your real account to some demo challenges, with history
npm run seed -- --clear               # removes all demo data; real accounts are never touched
```

Demo accounts all use the password `password`. In PowerShell, quote the dashes: `npm run seed '--' --clear`.

### Admin chores

```bash
npm run reset-password -- <username> <new-password>   # no email recovery, so this is how you reset
npm run backup                                         # copies the DB to data/backups/ (safe while running)
```

### Environment variables (all optional)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Port to listen on |
| `DATABASE_PATH` | `./data/app.db` | Where the SQLite file lives |
| `NEXT_PUBLIC_APP_NAME` | `GoalPost` | Rename the app (set it at build time) |
| `COOKIE_SECURE` | auto | `true` forces secure cookies. Leave unset over plain HTTP, otherwise login won't stick. It's detected automatically behind an HTTPS proxy. |
| `ALLOWED_ORIGINS` | none | Extra origins (comma-separated) for form submissions if you put it behind a proxy or domain whose host differs |

### Adding HTTPS later

Plain HTTP over a public IP works, but passwords travel unencrypted. When you get a domain, the easiest upgrade is [Caddy](https://caddyserver.com) in front of the app (`reverse_proxy localhost:3000`), which gets free certificates automatically.

### Troubleshooting (Windows)

- **`EPERM: operation not permitted, rmdir ... node_modules`**: something has files in `node_modules` open. Stop any running `npm run start` or `npm run dev`, close editors and terminals that are in the folder, delete `node_modules`, and run `npm install` again. Antivirus scanning or a synced folder (OneDrive) can also cause this.
- **"This app needs Node.js 22.13 or newer"**: upgrade Node as described above.

## Stack

Next.js 16 (App Router, Server Actions), React 19, TypeScript, Tailwind CSS 4, SQLite via Node's built-in `node:sqlite` (no native dependencies). Passwords are hashed with scrypt, and sessions are random tokens stored hashed in the DB with httpOnly cookies.

```
src/
  app/            pages (dashboard, /c/[slug] challenge, /t/[slug] team, /u/[username] profile, explore, settings…)
  components/     UI: quick-log, progress chart, heatmap, feed, forms…
  lib/
    db.ts         SQLite connection + migrations (append-only list)
    auth.ts       passwords, sessions, viewer time zone, rate limiting
    stats.ts      all challenge math + badges
    queries.ts    read queries and access rules
    actions/      server actions (auth, challenges & logging, teams)
scripts/          seed (demo data), reset-password, backup
```

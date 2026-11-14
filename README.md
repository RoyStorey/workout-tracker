# RepRally

Group fitness challenges with friends. Pick an exercise, set a goal and a timeframe, share the link, and grind it out together. RepRally does the spreadsheet math for you.

## Features

- **Any exercise, any unit, any timeframe**: pushups, miles, plank minutes and so on. Challenges can have an end date or run forever (lifetime trackers).
- **Two goal types**: *everyone hits the target* (individual race) or *one target, together* (shared team total). The target is optional: leave it blank for a "most wins" leaderboard.
- **Public or private**: public challenges are listed on Explore. Private ones are visible only through an invite link (or to the hosting team).
- **Teams**: your regular crew. Host challenges under a team, track combined lifetime totals, and see who has been busiest this week.
- **Stats**: total and remaining, needed per day, today's target to stay on pace, ahead or behind pace, projected finish date, projected total, streaks, best set, best day, average set, and active days.
- **Charts**: cumulative total vs. even pace, plus daily bars, with hover tooltips and a table view.
- **Spreadsheet view**: one row per day and one column per member, like the old sheet.
- **Fast logging**: one-tap quick-add buttons (set per challenge), custom amounts, backdating, notes, undo, and a **tally counter** you can tap with your nose during pushups.
- **Social**: activity feed, kudos, leaderboards (all-time, this week, today), badges (🔥 streaks, 👑 MVP, 🏆 goal crushed, ⚡ finished early, and more).
- **Profiles**: lifetime totals per exercise, an activity heatmap, and earned badges.
- **Mobile-first**: bottom tab bar, installable to your home screen (PWA manifest), dark mode (follows the system or toggles from the account menu).

## Running it

Requires Node 20.9+.

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
| `NEXT_PUBLIC_APP_NAME` | `RepRally` | Rename the app (set it at build time) |
| `COOKIE_SECURE` | auto | `true` forces secure cookies. Leave unset over plain HTTP, otherwise login won't stick. It's detected automatically behind an HTTPS proxy. |
| `ALLOWED_ORIGINS` | none | Extra origins (comma-separated) for form submissions if you put it behind a proxy or domain whose host differs |

### Adding HTTPS later

Plain HTTP over a public IP works, but passwords travel unencrypted. When you get a domain, the easiest upgrade is [Caddy](https://caddyserver.com) in front of the app (`reverse_proxy localhost:3000`), which gets free certificates automatically.

## Stack

Next.js 16 (App Router, Server Actions), React 19, TypeScript, Tailwind CSS 4, SQLite via better-sqlite3. Passwords are hashed with scrypt, and sessions are random tokens stored hashed in the DB with httpOnly cookies.

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
scripts/          reset-password, backup
```

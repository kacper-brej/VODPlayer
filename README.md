# VOD platform

A video streaming app I built for my own media library. It works like a small Netflix: accounts, profiles per account, a browsable catalog with artwork, resume playback across devices, and a watch party mode so a few people can watch the same episode in sync.

Live at [vod.kacper-brej.pl](https://vod.kacper-brej.pl).

## What it does

- Email and password accounts, with email verification and password reset
- QR code login, so you can sign in on a TV without typing a password
- Several profiles under one account, each with its own watch history
- Browsing by genre, collections, favourites, watchlist and a continue watching row
- HLS playback with signed, short lived URLs, so the video files are never public
- Watch party: synced playback and a chat next to the player
- Admin panel for uploading media and deciding which users can see which series
- Series and episode metadata pulled from TMDB, with Jikan for anime

## Tech stack

Next.js 16 with the App Router, React 19 and TypeScript. Styling is Tailwind CSS 4 on top of CSS variables that hold the dark theme colors.

There is no separate backend service. The server side runs on Node.js and is written in the same TypeScript codebase as the frontend: server actions and route handlers under `app/api`, with the actual logic kept in `lib/`.

Data sits in MySQL and is queried with mysql2 through a connection pool and a transaction helper in `lib/db`. No ORM, just SQL.

Auth is written by hand: bcryptjs for password hashing, jose for signed session cookies, and nodemailer for the account emails.

Video files live in Backblaze B2 and are read through its S3 compatible API. The player is Vidstack with hls.js underneath, and every playback URL is signed on the server before it reaches the browser.

Tests run on Vitest.

## Running it locally

You need Node 20.9 or newer and a MySQL database.

```bash
npm install
cp .env.example .env.local
npm run dev
```

The app then runs on http://localhost:3000.

Before the first start, fill in `.env.local`. `.env.example` is committed to the repo and lists every variable with a short note next to it. These are the ones worth filling in first:

| Variable | What it is |
| --- | --- |
| `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | MySQL connection |
| `SESSION_SECRET` | secret used to sign session cookies |
| `NEXT_PUBLIC_APP_URL` | public URL, used in links inside emails |
| `SMTP_*` | mail server for verification and password reset emails |
| `B2_*` | Backblaze bucket and keys for the video files |
| `TMDB_READ_TOKEN` | TMDB API token for metadata and artwork |
| `VIDEO_SIGNING_SECRET` | secret used to sign playback URLs |
| `PARTY_REALTIME_KEY` | realtime channel key, only needed for watch party |

## Scripts

```bash
npm run dev     # dev server
npm run build   # production build
npm run start   # run the production build
npm run lint    # eslint
npm run test    # vitest
```

## Project structure

```
app/          routes (App Router), grouped into public, app, profiles and watch
components/   React components, grouped by feature
lib/          server logic: auth, db, player, media, party, catalog, mail
public/       static files
```

Most of the real logic is in `lib/`. Each folder there has its own `__tests__` next to it.

## Deployment

Deployed on Vercel. The database and the media storage are hosted separately, so the app only needs the environment variables above to connect to them.

# Rank Up

A single-page app for a chess coach: students, sessions, schedule, repertoire,
assignments, tournaments, games and payments, with an app for students and
parents.

The whole app lives in `index.html` and runs in two places:

- **On the web** (GitHub Pages + Supabase), at https://reemshr1.github.io/Rank-Up-Chess/. Everyone signs in with an email and a
  password. The data is stored in Supabase, in one `docs` table with access
  rules: the coach can do everything; students and parents read only their own
  pages and can only send messages to the coach. The first account to sign in
  on a fresh install is asked whether it is the coach.
- **As a claude.ai artifact.** There it uses the artifact's own storage instead.

## Files

- `index.html` — the app. The Supabase project address and public key are near
  `const SUPABASE` (both are meant to be public).
- `supabase/schema.sql` — creates the tables and access rules. Run it once in
  Supabase → SQL Editor; running it again is safe.
  It also sets up the nightly backup: every night (00:00 UTC) a copy of the
  coach's records goes into the `backups` table, kept 30 days, scheduled with
  pg_cron. Settings → Backup lists and downloads them. It also creates the
  private "books" storage folder for book PDFs and who may open them.
  It also sets up several coaches (tables `coaches` and `coach_codes`); run on
  a database from before that, it moves it over, and that coach becomes the
  first coach and the admin. `supabase/rollback-multi-coach.sql` undoes the move.
- `supabase/functions/ratings` — fetches official FIDE and ICF ratings.
- `supabase/functions/push` — sends phone alerts (push notifications). To set
  it up: run `supabase/schema.sql` again in the SQL Editor; then in Supabase →
  Edge Functions, create a function named `push`, paste in `index.ts`, Deploy,
  and switch **Verify JWT** off (the function checks sign-in itself, like
  `ratings`). It makes its own keys the first time it runs.
- `welcome/` — the public page about Rank Up (`index.html`, `privacy.html` and the pictures), at
  `…/Rank-Up-Chess/welcome/`. Its "leave your details" form saves to the `leads` table
  (set up by `supabase/schema.sql`); the admin sees the list in Settings → Coaches.
- `vendor/supabase.js` — the Supabase browser library (supabase-js 2.117.2, MIT).
- `manifest.webmanifest`, `sw.js`, `icons/` — let phones install the app from
  the browser ("Add to Home Screen").
- Publishing: GitHub Pages serves the `live` branch. Work happens on other
  branches; merging into `live` publishes it. `.nojekyll` makes Pages serve the
  files exactly as they are.
- `netlify.toml` — the earlier Netlify hosting (rank-up-chess.netlify.app),
  which now shows a "moved" notice.

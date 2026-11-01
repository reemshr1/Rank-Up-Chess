# Tests

Browser tests for the app, run with Playwright against `index.html` (no server needed).
`fakesupa.js` stands in for Supabase, keeping everything in the test browser's localStorage, so one page can be
the coach and another the student. It doesn't check the database's access rules.

    NODE_PATH=$(npm root -g) tests/run.sh          # all of them
    NODE_PATH=$(npm root -g) node tests/lichess.test.js

- `pages.test.js` — every page of the coach's, a student's, a parent's and a player's app opens without errors,
  on a computer and a phone, in English and Hebrew.
- `lichess.test.js` — Lichess puzzles added to a player's practice log by themselves.
- `lichess-student.test.js` — the same for a coach's student, reaching the coach's records.

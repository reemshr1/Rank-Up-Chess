# Tests

Browser tests for the app, run with Playwright against `index.html` (no server needed).
`fakesupa.js` stands in for Supabase, keeping everything in the test browser's localStorage, so one page can be
the coach and another the student. It follows the database's access rules for the docs table and has the
database functions the app calls (become_coach, leave_player, close_player, coach_list, remove_coach).
`lib.js` has what the tests share.

    NODE_PATH=$(npm root -g) tests/run.sh          # all of them
    NODE_PATH=$(npm root -g) node tests/coach-today.test.js

## Rebuilding the lost suite (in progress)

The old suite (82 browser tests, the Postgres rule tests and the push-function harness) was lost when the
session's temporary folder was wiped. It is being rebuilt here; nothing is merged until it is complete.

Done (all passing unless noted):
- pages — every page of every app opens, phone and computer, English and Hebrew
- coach-today — Today: tiles, requests, payment reports, needs attention, nudge (old: test, test56, testpayreport, testcheckin coach side)
- coach-students — Students list, add/edit/archive/delete, levels in Hebrew, Updated marker, search (old: testsearch, testlevels, testlevelhe, testname, testupdated)
- coach-student-page — overview, ratings, notes, invite/link/disconnect, family, weekly slots, lessons, summary, My chess (old: test5feat, testsession, testme, testportal part)
- coach-practice — practice log, tactics stats, fitness goal, workouts, sleep, books by page range, book PDFs, book library (old: testfitness, testfit2, testfitmin, testcalis, testbookparts, testbookpdf, testbooklib)
- coach-games — PGN import, games, tournaments (rounds, dates, expected/actual, rating change, assistance), model games, repertoire (old: testtour, testrounds, testassist, testgames2, testrep)
- coach-payments — ledger, lesson payments, oldest first, charges, edit, reminder, show to student, Payments page, CSV (old: testpaylesson, testpayedit, testpayshare)
- coach-schedule — week, tournament clash and handled, move with confirmation, free time with a place, club classes, attendance — ONE CHECK STILL FAILING: changing one club date's time (old: testweek, testclashok, testtwoplaces, testoffers, testclub, testclubstu, testattend)
- lichess, lichess-student — Lichess puzzles added by themselves
- kids, kid, player-backup, close-account, orphan, two-parents — recovered from the session history

Still to rebuild:
- coach: assignments (group, library, PGN, review), notifications (testnotice, testnotice2), hiding bubbles (testhide),
  settings (links, backup and restore, nightly copies — testlinks, testbackup, testlogs), ratings sync (testratings),
  Student view (testpreview), admin page and coach codes (testcoaches), welcome page (testwelcome), club free time (testclubfree), group (testgroup)
- student and parent: sign-in screens (testweb, testsignin, testreal, testempty, testmoved), the student app end to end
  (testportal, testboth, testtwo, testswitch, testnew, testmedals, testcheckin, testcomingup, testpush, testpushfail),
  two coaches (testtwocoaches, testcoaches)
- players: testplayer, testtips, testmove, testplayerpdf, testendgames, testplayerrating, testplayeralerts, testghpages
- Hebrew: testhe and the untranslated-strings crawl
- database rules (Postgres) and the push function's Deno harness

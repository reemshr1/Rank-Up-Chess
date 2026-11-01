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
- coach-schedule — week, tournament clash (handled, Undo, cleared by a move), move with confirmation, free time with a place and a second place, club classes (one date's time, back to usual, cancel a date), attendance (old: testweek, testclashok, testtwoplaces, testoffers, testclub, testclubstu, testattend)
- coach-assignments — new assignment, PGN paste and upload (split), game notes, student opens and marks done, feedback and review, filters, library, whole group (old: testgroup, testlib parts)
- coach-notices — {name} and [boy|girl], who gets it, 🔔 counts, Mark read, Read X of Y, edit (Edited), delete, 7-day expiry (old: testnotice, testnotice2)
- coach-settings — coaching details, Useful links (add/remove/restore, reach the student), backup download, nightly copies, restore, folder on this computer, rating check, hiding bubbles and tiles, Student view sends nothing (old: testlinks, testbackup, testlogs, testratings, testhide, testpreview)
- admin — admin page: requests, status, notes, codes, joining as a coach, used codes, accounts (keep / delete everything), the website form (old: testcoaches parts, testwelcome)
- signin — sign-in screen, wrong password, new account, short password, existing email, reset password, code already used, sign out (this device), lost session, the old Netlify address (old: testweb, testsignin, testmoved)
- student-lessons — Request a lesson in free time (club hours and booked times left out, two places), approval, Can't make it (move, switch, withdraw), declined move answered, own training (old: testportal parts, testclubfree, testtwoplaces student side, testoffers)
- deploy — the site under /Rank-Up-Chess/ over http: no missing files, manifest, icons, service worker files (old: testghpages)
- lichess, lichess-student — Lichess puzzles added by themselves
- kids, kid, player-backup, close-account, orphan, two-parents — recovered from the session history

Still to rebuild:
- student and parent (next: student-home): logging practice and changes waiting for the coach, updates and New badges, check-in, medals, Coming up;
  the parent app (read only, payments, I've paid, switching children); testreal, testempty, testboth, testtwo, testswitch, testpush, testpushfail,
  two coaches (testtwocoaches, testcoaches)
- players: testplayer, testtips, testmove, testplayerpdf, testendgames, testplayerrating, testplayeralerts, testghpages
- Hebrew: testhe and the untranslated-strings crawl
- database rules (Postgres) and the push function's Deno harness

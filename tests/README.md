# Tests

Browser tests for the app, run with Playwright against `index.html` (no server needed).
`fakesupa.js` stands in for Supabase, keeping everything in the test browser's localStorage, so one page can be
the coach and another the student. It follows the database's access rules for the docs table and has the
database functions the app calls (become_coach, leave_player, close_player, coach_list, remove_coach).
`lib.js` has what the tests share.

    NODE_PATH=$(npm root -g) tests/run.sh          # all of them
    NODE_PATH=$(npm root -g) node tests/coach-today.test.js

`db.test.js` checks the database's own rules in a real Postgres: start it once with `tests/sql/start-pg.sh` (a local
Postgres on port 5499; `tests/sql/supabase-stub.sql` stands in for what Supabase adds: auth, storage, pg_cron, pg_net).

`push-fn.test.js` and `lichess-fn.test.js` run the real functions (`supabase/functions/push` and `lichess`) in Deno. They need Deno and the
`http_ece` package: `npm i deno http_ece` in a folder of your choice, then `DENO=<folder>/node_modules/.bin/deno`
and that folder's `node_modules` added to NODE_PATH.

## What's covered

The old suite (82 browser tests, the Postgres rule tests and the push-function harness) was lost when the session's
temporary folder was wiped, and rebuilt here: 41 files, 825 checks, all passing together (`tests/run.sh`, about
23 minutes). The browser tests load the app over http (`serve.js`), as a real site.

Files:
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
- student-home — Updated by the coach's app, changes waiting, tiles, medal and its warning, Updates marked New with menu counts, Mark all as read, Coming up in order, logging practice, the check-in (old: testportal parts, testmedal, testcheckin student side, testcoming)
- parent-app — two children, the Balance, I've paid, statement, read only, lesson requests, no check-in (old: testparent, testfamily, testpaid)
- two-coaches — Add a coach with a code, history sent, both coaches' lessons and tasks, which coach for a request, Share per coach, Also works with (old: testtwocoaches, testcoaches)
- push — phone alerts on/off (coach Settings, the 🔔 window), test alert, a moved lesson and a notification become alerts, blocked, not allowed, Edge on Android with the Chrome tip, iPhone Home Screen, function not set up, sign out turns it off (old: testpush, testpushfail)
- student-live — live updates both ways without reloading; a new coach and a just-linked student: every page opens cleanly (old: testreal, testempty)
- student-accounts — two students isolated (also at the database), student and parent of one child, switching accounts on one device (old: testboth, testtwo, testswitch)
- player — sign-up with a player code, Welcome to Rank Up, rating from a FIDE number, Home, practice to their own records, tasks, Progress rating card, Check now, Add rating (old: testplayer, testplayerrating)
- player-tips — every kind of tip, at most 3 in order, the next tournament tile, a parent's board, Hebrew, none for coaches (old: testtips)
- player-move — Connect to a coach: wrong code, everything moves, From their own board, Moved to a coach on the admin page, a parent's board with the family code (old: testmove)
- pay-lessons — a parent pays for several lessons at once: tick boxes, the amount adding up, waiting per lesson, one payment per lesson on confirm, the rest towards the balance
- player-review — fixes from the 4 Nov review: a parent's board talks about the child, Hebrew names in Your children, one sign-in card, no double check-in, no empty charts, no Reviewed with coach for players, Add practice starts on the last site
- player-books — a player's book PDFs (attach, open, replace, remove), endgames by type, PDFs copied to the coach on moving (old: testplayerpdf, testendgames)
- push-fn — the push function in Deno: the hourly player reminders (17:00 practice, 19:00 tournament or task tomorrow, a parent's board with two children, Hebrew, once only, a gone device forgotten) and the app's key / subscribe / unsubscribe / send rules (old: testplayeralerts and the Deno push harness)
- hebrew — every page of every app in Hebrew, right to left, and the windows their buttons open (67), with no English left on screen apart from typed data, notation and site names (old: testhe and the untranslated-strings crawl)
- db — the database rules in Postgres: schema.sql on a new project, twice, and on a database from before several coaches; codes; each coach's records; links get their coach from the code; boards, messages, a second coach's link; book files; leave_player, close_player, remove_coach (keep / wipe / a moved player's copy); nightly copies; the website form; phone-alert tables; the hourly player reminders (old: the Postgres rule tests)
- deploy — the site under /Rank-Up-Chess/ over http: no missing files, manifest, icons, service worker files (old: testghpages)
- lichess, lichess-student — Lichess puzzles added by themselves
- streaks — practice days in a row (a missed day ends it, earned medals stay), fitness weeks each judged by its own goal, 0-minute entries not practice
- lichess-fn — the hourly Lichess job (supabase/functions/lichess) in Deno: a player's record, a student's outbox, the app's rules, deleted entries, links not shared, Lichess busy, a record saved meanwhile
- lichess-sync — the app's side of the hourly job: an entry it leaves in the outbox, taken in once; a deleted entry remembered on the record (liGone) and never brought back
- kids, kid, player-backup, close-account, orphan, two-parents — recovered from the session history


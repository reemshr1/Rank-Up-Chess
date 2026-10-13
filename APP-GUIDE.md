# Rank Up — app guide

What the app does, page by page, for each of its three views: the **coach**
(Raem), the **student** and the **parent**. The last part explains how the
views connect. Keep this file up to date when a feature changes.

Rank Up (עולים בדרגה) is one web app at
https://reemshr1.github.io/Rank-Up-Chess/. Everyone signs in with an email and
a password. What a person sees depends on their account:

| Account | How it gets there | What it sees |
|---|---|---|
| Coach | The first account on a fresh install chooses "I'm the coach". | Everything. |
| Student | Signs up, then enters the invite code from the coach. | Their own board. |
| Parent | Signs up, then enters the family invite code from the coach. | Their children's boards, one at a time, plus payments. |

The app works in English and Hebrew. The coach chooses the language in
Settings; students and parents use the עברית / English button at the top.
In Hebrew, students and parents see the coach's name instead of "your coach".
On a phone the app can be installed from the browser ("Add to Home Screen").

Dates are always day first (dd/mm/yyyy) and times are always 24-hour (17:00),
whatever language the phone or computer is set to. Date and time fields are typed
(e.g. 5/10/2026, 1730) or chosen with the 📅 / clock button; an impossible date or
time is shown in red and the form is not saved until it is fixed.

---

## 1. Coach view

Menu: **Today · Students · Schedule · Assignments · Payments · Settings**, and
**My chess** if the coach keeps a profile for their own chess. A search box at
the top finds students, lessons, games, openings, assignments, tournaments
and books.

### Today

The daily overview.

- **Top buttons:** 🔔 Notifications, Record payment, Plan session.
- **Tiles** (title on top, number below): active students; **Sessions this
  week** split into **Total** (this week's lessons, not cancelled) and **Left**
  (planned lessons that haven't ended yet); money outstanding; money received
  this month.
- **Backup reminder** if no backup has been saved for over a week. When a backup folder is set and Chrome
  asks for permission again, a **Save backup** button instead (one click saves today's file).
- **Problems with the student and parent app:** a change sent by a student or
  parent that couldn't be taken in. It can be retried or discarded; nothing
  is lost.
- **Lesson requests:** new lessons, cancellations and moves that students or
  parents asked for. Approve or decline each one. When the coach declines a
  move, the student answers (keep the lesson, cancel it, or ask for another
  time) and the answer shows under **Answers to declined moves**.
- **Payments reported in the app:** a parent (or a student the coach shows
  their payments to) pressed "I've paid", marked "by the parent" or "by the
  student". Confirm it (it becomes a real payment) or mark it as not received.
- **Needs attention**, in three columns:
  - lessons in the past still marked as planned (marking them done adds the
    fee to the balance);
  - students with no lesson planned;
  - students with no practice logged for 2+ days, with their check-in answer
    if they gave one and a **Nudge** button that prepares a friendly message.
- **Coming up this week**, **Who owes you**, **Tournaments ahead** (students
  playing the same tournament are grouped) and **Assignments due** (due
  within 3 days, or done and waiting for review).

**Notifications window** (🔔 on Today):
- Write a message. `{name}` becomes the child's name, and `[boy|girl]` picks
  the right word using the student's Boy/Girl field (useful in Hebrew).
- Choose who gets it: each child has a **Student** and a **Parent** checkbox.
  Quick buttons pick everyone, no one, private students, or a club group,
  for parents, students or both.
- Earlier notifications show **Read X of Y**, and a counter shows new reads
  since the coach last looked.
- Each sent notification has **Edit** (fix the text; each child keeps their
  own name, read marks stay, students see "Edited") and **Delete** (removes
  it for everyone).
- Notifications disappear from the app **7 days** after they're sent.

### Students

The list of students, with search and an Active / Archived / All filter.
Each row shows rating and its last change, the next lesson, and the balance
(or a "Club" tag for club-only students). Private students come first, then
one section per club group, with the group's monthly workout challenge. A
student in both appears in both. **Add student** opens the profile form. The
page also says when FIDE and Israeli Chess Federation ratings were last
checked: they are fetched automatically once a month, or on demand.

**Student profile form:** full name, first name in Hebrew, boy or girl,
FIDE and ICF ids, main rating, level, birth year, phone or email, parent or
guardian, lessons (private, club only, or both) and club group, fee per
session, active or archived, goals, and coach notes (and whether the student
sees them). "Who is this?" marks the coach's own profile (My chess).

### A student's page

The header shows name, rating, title and level, what they owe, links to their
FIDE and ICF pages, **👁 Student view** and **Edit profile**.

**Student view** opens the student's app over the page, built from exactly what
their app receives, at computer or phone size. Nothing in it is saved or sent
(anything that would send shows "Preview — nothing was sent"); **Exit student
view** or Escape closes it.

Six tabs:

**Overview**
- Five tiles, each linking to its tab: next lesson, balance, open
  assignments, opening lines to review, last practice.
- **Rating history** chart, with a switch between rating lists (FIDE,
  FIDE Rapid, FIDE Blitz, ICF, Online), plus Add rating and Official ratings.
- **Goals & notes:** goals are always visible to the student; coach notes
  are private unless the coach presses "Show to student".
- **Student app** panel: create an invite code, send the invite message,
  see whether the student is connected, disconnect.
- **Parent app** panel: the same for the family (a parent account can follow
  several children; add a child to an existing family or start a new one).
  Not shown for club-only students.
- **Details:** lessons done and hours, last lesson, next tournament, books
  being read, contact.

**Lessons**
- **Weekly slots:** a recurring lesson time (e.g. every Tuesday 17:00). The
  app plans lessons from slots 8 weeks ahead automatically.
- **Planned** and **History** lists. Each lesson shows Done / Planned /
  Cancelled / Not marked, and Paid when it's covered. Buttons:
  - **Mark done** adds the fee to the balance;
  - **Send summary** prepares a lesson summary message (English or Hebrew,
    with or without notes);
  - **Edit** changes date, time, length, in person or online, topics, notes,
    and whether the notes are shown to the student.
- The student's **own training plan** for the last two weeks, if they plan
  training in their app.

**Practice** (three sub-tabs)
- **Daily work:** minutes per day over the last week, the days-in-a-row
  streak, every practice entry (tactics with site and score, game analysis,
  reading, openings, ChessBase files…), and **Tactics statistics** for 7 / 30
  / 90 days / all time. Entries the student logged are tagged "by student".
- **Fitness:** workouts this week against the **weekly goal** (the coach
  sets it in workouts per week, minutes per week, or both; with both, a week
  counts when both are reached), the last 8 weeks as bars, the weeks-in-a-row streak, quick-log
  buttons, the list of workouts, the club group's monthly challenge, and
  **Sleep before tournaments** (hours slept the night before each tournament
  day, and how the scores compare after 8 h or more vs less).
- **Books:** each book with its status (Reading / Want to read / Finished),
  a bar showing which page ranges were read, the percentage, and when it was
  last read.

**Games** (four sub-tabs)
- **Tournaments:** upcoming and past tournaments, rounds and dates, the
  expected score and the actual score (worked out from the games once the
  tournament is over, or once every round has a game), rating change ("Add to
  rating history" adds it to the last rating from before the first round),
  performance (FIDE's table), the games
  played there, and **tournament assistance** (charged per tournament day,
  by default half the lesson fee; the price can be changed with a reason).
- **Guy's games** (the student sees **My games**): the student's own games, imported from PGN or added by
  hand, with a score summary (overall, as White, as Black) and an analysis
  status (Not analysed / In analysis / Reviewed). Games open on a board, also
  in Lichess.
- **Model games:** games by other players that the student studies, with
  themes and hours of analysis.
- **Repertoire:** opening lines with a status: Developing, Learning,
  Studied, or Needs review (automatic after a while without review). On top,
  **Openings in games** shows which openings opponents played against the
  student, the score in each, and which ones have no prepared line yet.
  Pressing an opening (or its number of games) opens those games.

**Assignments:** the student's assignments (see Assignments below).

**Payments** (hidden for club-only students and for My chess)
- Balance, the oldest unpaid charge if overdue, and a **ledger** with every
  charge (lessons done, tournament assistance, extra charges) and payment,
  with a running balance.
- Buttons: Send reminder, Add charge, Record payment. Payments can be edited.
- **Show payments in Guy's app:** gives the student a Payments tab (balance,
  statement, how to pay) and lets them report payments, for students who
  manage their own payments. **Hide** takes it away again.

### Schedule

The week, or the next 4 weeks as a list. On a phone it shows a few days at a
time.
- Lessons, club classes, tournaments, assignment due dates and students' own
  training, with clashes flagged.
- **Past sessions still marked as planned**, to mark done.
- **Free time for lessons:** the hours when students may ask for a lesson.
  Students see these hours, minus what's already booked.
  Each slot can have a **Where**: not set (students choose in person or online),
  **At home**, **Online**, **At \<club\>** (from the club classes' places; "At the
  club" when there are none) or another place typed in. The place is written
  under the time on the calendar (same green), and on the student's start times.
  Club class hours are left out of free time. An Online slot books an online
  lesson, any other place an in-person one, and the lesson keeps the place
  everywhere it's listed. Approving a request or editing a lesson has an
  optional **Place**.
- **Club classes:** classes taught at the club (weekly or one-off, with place
  and pay per class). They show on the schedule, block lesson requests at
  those times, and count the club hours and pay for the month.
- Click a lesson to mark it done, cancel it, move it (including switching
  in person / online) or edit it. **Add weekly slot** and **Plan session**
  add lessons.

### Assignments

Tasks for students: Analyse your game, Study model games, Tactics,
Calculation, Endgames, Opening preparation, Strategy, Reading, Other.
- Filters: Assigned · Done (to review) · Reviewed · All.
- An assignment has a title, type, due date, instructions, optional **PGN
  games** (upload, paste or drop a file; big files are split), a note per
  game, and **Coach feedback**.
- An assignment can go to one student or to a whole club group (each
  student gets their own copy, reviewed separately).
- The **Assignment library** keeps reusable assignments.
- Status: the coach assigns; the student marks it done; the coach reviews.

### Payments

All the money in one place.
- **Outstanding**, students overdue, received this month.
- **Balances:** charged, paid, balance and last payment for each student;
  overdue is anything older than the number of days set in Settings.
- **Income** by month for a chosen year (lessons, charged, received), with
  CSV downloads by month and of all payments.
- **Recent payments**, editable. **Record payment** picks the student.
- A payment that isn't linked to a lesson counts toward the oldest unpaid
  lessons.

### Settings

- **Coaching details:** name (and in Hebrew), currency, default fee, days
  before a balance counts as overdue, language, **How to pay** (shown to
  parents), the app link used in invite messages, the first day of the week.
- **Phone alerts:** turn alerts on for this device and **Send a test alert**
  (see Phone alerts below).
- **Account:** which email is signed in, Sign out.
- **Useful links:** the sites shown to students and parents on their Practice
  page (suggested: Chess.com, Lichess, Lichess puzzles, ChessTempo, Chessable,
  Chess-Results, Israel Chess Federation). Add, edit, remove, or restore the
  suggested list.
- **Backup:** download all records as a file, or restore from one.
  - **Every night:** Supabase saves a copy of all the coach's records at 00:00 UTC and keeps 30 days
    (table `backups`, set up by `supabase/schema.sql` with pg_cron). Settings lists the copies, newest first
    (5, then "Show all"), each with **Download**. A downloaded copy is the same kind of file as
    "Download backup", so "Restore from backup" reads it. Only the coach can read the copies.
  - **Folder on this computer** (Chrome or Edge on a computer): **Choose a folder**, and the app saves
    `rank-up-backup-<date>.json` into it once a day, when the app is opened on that computer. The folder is
    remembered by that browser only. **Save now**, **Change folder**, **Stop**. Other browsers and phones
    see a line saying this needs Chrome or Edge on a computer.

### My chess

The coach's own profile, if there is one: the same tabs as a student,
without payments, for the coach's own rating, games and openings.

---

### Hiding bubbles
Every bubble in the coach's view has a **Hide** button on its title line. A hidden
bubble folds to its title line and stays where it is, with a **Show** button that
opens it again. The number tiles (Today, Payments, a student's overview and
payments) can be hidden too: the eye appears when the mouse is over a tile, and a
hidden tile keeps its title with **Show**. The main lists that make up a page
(Students, Assignments, Games, Model games, Books) can't be hidden.
What's hidden is saved in the settings, so it's the same on all the coach's
devices. Bubbles that need action (lesson requests, problems updating a student's
board, answers to declined moves) can't be hidden. Students and parents don't
have this.

## 2. Student view

Menu: **Home · Tasks · Practice · Games · Progress · Schedule**. At the top:
**Request a lesson** and **🔔 Notifications**. Menu items show a count of
new things.

### Home
- Greeting, and when the coach's app last updated the board (if changes are
  still waiting, it says so).
- Tiles: next lesson, assignments to do, practice minutes this week, rating.
- **Answer needed:** when the coach declined a lesson move, the student
  chooses: keep the lesson, cancel it, or ask for another time.
- **Practice check-in:** after 2 days without practice: "What's going on?".
  The student logs practice, or answers (busy with school, sick, short
  break, something else). It asks again every 2 days without practice.
- **Medals:** the current practice and fitness medal, with a warning inside
  the badge when a streak is in danger ("Practice today to keep your
  streak", "N more workouts this week to keep your streak").
- On a tournament day: a reminder to log last night's sleep.
- **Updates:** what changed in the last 2 days (new assignments, feedback,
  lessons, notifications…), marked **New**.
- **Coming up:** lessons (with "Can't make it?"), club classes, tournaments,
  and requests waiting for the coach.
- **Assignments** to do.

### Tasks
Assignments split into **To do** and **Done**. Opening one shows the
instructions, the games on a board and the coach's feedback; the student
marks it done.

### Practice
- **Daily practice:** log practice (tactics, game analysis, openings,
  reading…), see the week and the streak.
- **Fitness:** log workouts (quick log for the usual ones), see the weekly
  goal, the group challenge and sleep before tournaments.
- **Reading:** books, logged by page range ("pages 40–55"), with the bar of
  read sections.
- **Useful links** (under Daily practice): the coach's list of sites, each with
  the student's username there. The student adds or changes their username;
  on Chess.com and Lichess it links to their profile. The coach sees and edits
  the same cards on the student's Practice tab; parents see them read-only.
  **Change order** lets the student put the sites they use most at the top
  (↑ ↓ on each card); each student keeps their own order.
- **Medals** (Pawn → Knight → Bishop → Rook → Queen → King):
  - practice: days in a row (3 / 7 / 14 / 30 / 60 / 100); missing 2 days in
    a row drops 2 levels, never below Pawn;
  - fitness: weeks in a row at the weekly goal, in workouts and/or minutes
    (2 / 4 / 8 / 12 / 20 / 30).

### Games
- **Tournaments:** add tournaments, rounds, results.
- **My games:** add games or import PGN, mark analysis progress.
- **Model games** and **Openings** (the opening lines, shown first, and how
  they score in the student's games; pressing an opening opens its games).

### Progress
Rating chart, practice per week, what the practice went on, tactics and
puzzle bests, recent lessons, goals, assignments and reading.

### Schedule
The student's lessons, club classes, tournaments, assignment due dates and
own training. **Plan training** adds the student's own training sessions.

### Payments (only if the coach turns it on)
The same page parents get: balance, statement, how to pay, and "I've made a
payment" to report a payment for the coach to confirm.

### Request a lesson
Pick a day and a start time inside the coach's free time (times already
booked by others are hidden), the length, in person or online, and a note.
Times with a place say so ("18:00 · At the club", "20:00 · Online"); for those
there's no in person / online choice. Clicking inside the calendar's free time
opens the request at that time.
For an existing lesson: cancel it, move it to another time, or switch it
between in person and online. Every request waits for the coach's approval.

### Notifications
The 🔔 button shows a count of unread notifications. The window lists them;
**Mark read** removes one, and the coach sees that it was read. Below the
list, **Turn on phone alerts** (see Phone alerts below).

---

## 3. Parent view

The same pages as the student, for one child at a time; a family with
several children picks the child at the top. Differences:

- Home is titled "*Name*'s board" and has a **Balance** panel: amount to pay
  or in credit, overdue days, charges not made yet (e.g. booked tournament
  assistance), last payment, **How to pay**, and **I've paid** to report a
  payment to the coach.
- An extra **Payments** page: the statement for the last two years, how to
  pay, what's coming up.
- **Read only**, except for: requesting, cancelling or moving lessons,
  answering a declined move, reporting a payment, and marking notifications
  read. Parents don't log practice, workouts, games or books, and get no
  practice check-in.
- Club-only students have no parent app.

---

## Phone alerts

Alerts on the phone (push notifications), even when Rank Up is closed.

- **Who turns them on:** each student and parent, on each device, from the
  🔔 window (**Turn on phone alerts**). The coach can turn them on in
  Settings to send a test alert. Signing out turns them off on that device.
- **iPhone:** alerts work only from the Home Screen app (Share → Add to Home
  Screen, then open Rank Up from there). Android and computers work in the
  browser.
- **What sends an alert** (to the student and/or the parent, in the language
  their app is in, titled with the coach's name):
  - a new notification from the coach (not an edit);
  - an answer to a lesson request: approved, declined, a move that doesn't
    work (asks them to choose), a cancellation;
  - a lesson the coach moved (time, day, or in person/online), cancelled, or
    added in the next 2 weeks. Lessons planned automatically by a weekly
    slot don't alert. More than 2 changes at once become one alert;
  - students only: the practice check-in, when they reach 2 days without
    practice, then every 2 days, between 8:00 and 21:00.
- **How:** alerts are sent by the coach's app when it updates the boards
  (like everything else students see), through the Supabase function `push`.
  If the coach's app isn't open, alerts go out the next time it is.

---

## 4. How the views connect

**The coach's records are the source of truth.** Students and parents never
change them directly.

1. **Coach → student/parent.** The coach's app writes a copy of each linked
   student's board (and each family's) to the student's account: lessons,
   assignments, games, ratings, goals, shared notes, free time, club classes,
   notifications, and for parents the balance and statement. It is updated
   when something changes and every 30 minutes while the coach's app is open.
   Private things stay out: coach notes (unless shared), lesson notes (unless
   shared), the tournament assistance price, other students.
2. **Student/parent → coach.** What a student or parent does (log practice,
   add a game, request a lesson, report a payment, mark a notification read…)
   is sent as a message to the coach's app. Their own screen shows it right
   away. The coach's app takes it in **the next time the coach opens Rank
   Up**, checks it is allowed, and adds it to the records; until then the
   student sees "N changes waiting for your coach's app".
3. **What each side may change:**

| | Coach | Student | Parent |
|---|---|---|---|
| Lessons | Plan, move, cancel, mark done | Request, cancel, move (needs approval) | Same as student |
| Practice, fitness, sleep, books, own training | Yes | Yes (deletes only their own) | No |
| Games, tournaments, openings | Yes | Yes | No |
| Assignments | Create, review, feedback | Mark done | No |
| Payments | Record, edit, charge, show to a student | Report "I've paid", if shown their payments | Report "I've paid" |
| Notifications | Send | Read | Read |
| Goals, notes, profile | Yes | No | No |

4. **Linking.** The coach creates an invite code on the student's page
   (Student app or Parent app panel) and sends the invite message. The
   student or parent signs up at the app link and enters the code; the
   coach's app links that account and deletes the code. **A code works
   once:** another device must sign in with the same email and password.
   Disconnecting stops access; the records stay with the coach.
5. **Ratings** from FIDE and the Israeli Chess Federation are fetched by the
   coach's app once a month, and appear for the student too.

---

## 5. Where things live (technical)

- The whole app is `index.html`. Data is in Supabase (one `docs` table with
  access rules, see `supabase/schema.sql`).
- Coach records: `data/users/<coach>/…`. Each student or parent account:
  `portal/<account>` (link status, language, read marks), `…/view/*` (the copy
  of the board), `…/inbox/*` (changes waiting for the coach's app).
- Student changes are applied by `applyOp`; the lists a student may edit are
  `PORTAL_KEYS`, and a parent's allowed changes are `PARENT_OPS`. What a
  student's copy contains is built by `studentView` (and `familyDocs` for
  parents).
- Phone alerts: `supabase/functions/push` sends them; it keeps its own
  signing keys (`push_keys`) and each device's address (`push_subs`), tables
  the app itself can't read. The coach's app decides what to send
  (`boardAlerts`, comparing each board before and after it's written, and
  `checkinAlerts`). `sw.js` shows the alert and opens the app when tapped.
- Publishing: work happens on a branch; merging into the `live` branch
  publishes to GitHub Pages.

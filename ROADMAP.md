# Rank Up — roadmap

Ideas for the app and how far each one got. When picking up work on the app,
check here first, and update this file as things move.

How a feature moves: **Ideas → In progress → Waiting to publish → Done.**
Work happens on a branch; nothing reaches the live app until Raem says
"merge" (see `README.md`).

## Ideas

Raem's own ideas, in the order Raem wants them.

- _(add here)_

## Suggested (not decided)

Ideas Claude suggested; none chosen yet.

- **Edit or delete a sent notification**, for a typo spotted after sending.
- **WhatsApp for parents who aren't on the app:** the same notification,
  with the child's name filled in, opens in WhatsApp ready to send.
- **Phone push notifications** for new notifications, lesson changes and the
  practice check-in, even when the app is closed.
- **Tournament prep plan:** a countdown before a tournament (openings to
  review, puzzle targets, sleep reminders) and a short "how did it go" form
  after each round.
- **Puzzle of the week:** the coach posts a position, students answer in the
  app, solvers get a streak or medal.
- **Lesson notes for parents:** a one-line summary after each lesson that
  parents see automatically.
- **One-tap group attendance** for club classes, with a monthly view.
- **Group leaderboard** for practice and fitness streaks in a club group
  (opt-in).
- **Monthly payment reminder:** on a chosen date, parents with a balance get
  a notification with the amount and how to pay.

## Parked problems

- **A student connected on the computer but not on the phone (Oct 2026).**
  The phone was signed in to a different account, and the student's invite
  code had already been used, so the phone showed "That code wasn't
  recognised". Workarounds: sign in on the phone with the computer's email,
  or Disconnect and send a new invite code to use on the phone.
  Fix to build: show students and parents **"Signed in as name@email"**, and
  on the code screen say "Already using Rank Up on another device? Sign out
  and sign in with that account" and "This code was already used".

## In progress

- _(nothing)_

## Waiting to publish

On the branch, not live yet.

- _(nothing)_

## Done

Live on https://reemshr1.github.io/Rank-Up-Chess/. Newest first.

- **Notifications** from the coach (🔔 on Today): choose Student and/or
  Parent for each child; students and parents read them and "Mark read"; the
  coach sees who read what.
- **Practice check-in:** after 2 days without practice the student is asked
  what's going on; the coach sees it in Needs attention, with a Nudge.
- **Chess medals Pawn → King** for practice (days in a row; missing 2 days
  drops 2 levels) and fitness (weeks at the weekly goal), with warnings
  before a streak is lost.
- **Lesson format switch** (in person / online) when moving a lesson, for the
  coach and in students' requests.
- **New badges** on things changed in the last 2 days, with counts in the
  menu.
- **Fitness:** workouts against a weekly goal, quick log, "Other sport",
  ping pong, club group challenge, sleep before tournaments.
- **Reading by page range**, with a bar showing which parts of the book were
  read.
- **Club students:** club-only students, club groups, group assignments,
  separate sections in the Students list.
- **Payments:** payments without a lesson count toward the oldest lessons;
  the coach can edit payment records.
- **Simpler menus:** students and parents get Home · Tasks · Practice · Games
  · Progress · Schedule (+ Payments for parents); the coach's student page
  has 6 tabs.
- **Student app** and **parents' view (families)**, linked with invite codes.
  Parents see the balance and payments and can request, cancel or move
  lessons.
- Invite messages, "how to pay" for parents, payment reminders, lesson
  reminders, visible sync problems, and safe editing on two devices.
- **Tournament assistance:** charged per tournament day (by default half the
  lesson fee), added to the balance once the tournament is played; students
  never see the price.
- **"Open in Lichess"** in the game viewer, at the move being viewed.
- Moved from Netlify to **GitHub Pages + Supabase**, with email and password
  sign-in.

## Decided against (for now)

- Minimum notice for lesson requests.
- Prepaid lesson packages (not used).
- Blocking free time on tournament days; students asking for tournament
  assistance from their app; income split by lessons and tournaments.
- Skill levels per student (the stored `skills` data is unused).
- A "cancelled but charged" status for late cancellations.

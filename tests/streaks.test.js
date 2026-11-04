// How streaks and medals count. Practice: days in a row with practice (up to today, or yesterday while today has
// none yet); a missed day ends it; medals earned (the best streak ever) stay. Fitness: weeks in a row reaching the
// weekly goal, each week judged by the goal set for it, so raising the goal keeps the streak and medals. A practice
// entry with 0 minutes isn't practice: not for the streak, the check-in, Needs attention or the reminders.
const { URL, t, addDays, weekday, stu, check, out, start, fillForm } = require('./lib.js');
const W = (days, min = 30) => days.map((d, i) => ({ id: 'w' + i + '-' + d, date: addDays(t, d), what: 'Tactics', minutes: min, by: 'student' }));
const range = (from, n, step = 1) => Array.from({ length: n }, (_, i) => from - i * step);
const me = (name, extra) => stu('st-me', name, Object.assign({ self: true, setup: 'self', rate: 0 }, extra));
// the start of this week and earlier weeks (Sunday first)
const ws = (() => { let d = t; while (weekday(d) !== 0) d = addDays(d, -1); return d; })(), wk = i => addDays(ws, -7 * i);
(async () => {
  const T = await start();
  const fit = []; for (let i = 1; i <= 4; i++) for (const k of [0, 2]) fit.push({ id: 'f' + i + k, date: addDays(wk(i), k), activity: 'Running', minutes: 30 });
  await T.seed({ coach: 'coach', coaches: ['p1', 'p2', 'p3', 'p4', 'p5'], players: ['p1', 'p2', 'p3', 'p4', 'p5'], docs: {
    'data/users/coach/settings': { coachName: 'Raem', lang: 'en', weekStart: 0 },
    // a 0-minute entry today, the last practice 3 days ago
    'data/users/coach/st-z': stu('st-z', 'Zoe Bar', { portal: { uid: 'u-z', linkedAt: addDays(t, -30) }, worklog: W([-3]).concat([{ id: 'zero', date: t, what: 'Openings', minutes: 0, by: 'student' }]) }),
    'portal/u-z': { code: 'Z1', linked: true, role: 'student', coach: 'coach', linkedAt: addDays(t, -30) },
    'data/users/p1/settings': { coachName: 'Ada', lang: 'en' }, 'data/users/p1/st-me': me('Ada', { worklog: W(range(-60, 20)) }),             // 20 in a row, then 60 days off
    'data/users/p2/settings': { coachName: 'Ben', lang: 'en' }, 'data/users/p2/st-me': me('Ben', { worklog: W(range(0, 30, 2)) }),            // every other day for 60 days
    'data/users/p3/settings': { coachName: 'Cal', lang: 'en' }, 'data/users/p3/st-me': me('Cal', { worklog: W([0].concat(range(-31, 30))) }), // 30 in a row, 30 off, today
    'data/users/p4/settings': { coachName: 'Dov', lang: 'en' }, 'data/users/p4/st-me': me('Dov', { worklog: W(range(0, 8)) }),               // 8 in a row, today too
    'data/users/p5/settings': { coachName: 'Eli', lang: 'en', weekStart: 0 }, 'data/users/p5/st-me': me('Eli', { fitnessGoal: 2, fitness: fit }) } });
  const home = async uid => { const p = await T.open(uid, '#/home'); await p.waitForTimeout(3000); return p; };
  const medals = async p => { await p.goto(URL + '#/progress'); await p.waitForTimeout(700); return T.text(p); };
  // 8 in a row: the plain case
  let p = await home('p4'); let v = await T.text(p);
  check(v.includes('8-day practice streak') && !v.includes('Practice today to keep'), '8 days in a row, today too: an 8-day streak, nothing to warn');
  v = await medals(p); check(/Now: 8 days in a row/.test(v) && /Best: 8 days/.test(v) && /6 days more to Bishop/.test(v) && v.includes('Miss a day and the streak starts again'), 'medals: now 8, best 8, 6 days more to Bishop; the rule in words');
  await p.close();
  // 60 days off after a 20-day run
  p = await home('p1'); v = await T.text(p);
  check(!/practice streak/.test(v) && !(await p.$('.medal-line')), '20 in a row, then 60 days off: no streak on Home (it used to say “3-day streak”)');
  v = await medals(p); check(/Now: 0 days in a row/.test(v) && /Best: 20 days/.test(v) && /30 days more to Rook/.test(v), 'medals: now 0, best 20, and Rook needs a fresh 30-day run');
  check(await p.$$eval('.medal-track', ts => ts[0].querySelectorAll('.won').length) === 3, 'and the three medals earned (Pawn, Knight, Bishop) stay');
  await p.close();
  // every other day
  p = await home('p2'); v = await T.text(p);
  check(!/practice streak/.test(v), 'every other day for 60 days: no streak (it used to say “30 days in a row”)');
  v = await medals(p); check(/Best: 1 day\b/.test(v), 'best: 1 day');
  await p.close();
  // back after a break
  p = await home('p3'); v = await T.text(p);
  check(!/practice streak/.test(v) && !/\d+-day practice streak — great work/.test(v), 'back today after 30 days off: no streak yet, and no “great work” tip for one');
  v = await medals(p); check(/Now: 1 day in a row/.test(v) && /Best: 30 days/.test(v), 'medals: now 1, best 30 (Rook stays)');
  await p.close();
  // fitness: raising the goal keeps the streak and medals
  p = await home('p5'); v = await T.text(p);
  check(v.includes('4-week fitness streak'), 'fitness: goal 2 workouts, reached 4 weeks running: a 4-week streak');
  await p.goto(URL + '#/student/st-me/fitness'); await p.waitForTimeout(600);
  await p.click('[data-a=fitGoal]'); await p.waitForSelector('#modal[open] #f_goal'); await fillForm(p, { goal: '3', mins: '0' });
  const rec = await T.student(p, 'p5', 'st-me');
  check(+rec.fitnessGoal === 3 && rec.fitGoals.length === 2 && rec.fitGoals[0].from === '' && +rec.fitGoals[0].n === 2 && rec.fitGoals[1].from === ws && +rec.fitGoals[1].n === 3, 'the new goal is kept with the week it starts (the old one for the weeks before)');
  check(await p.$$eval('.wbars .bar', bs => bs.slice(3, 7).every(b => /green/.test(b.getAttribute('style') || ''))), 'the past weeks are still green: they reached the goal they had');
  await p.goto(URL + '#/home'); await p.waitForTimeout(600); v = await T.text(p);
  check(v.includes('4-week fitness streak'), 'and the streak is still 4 weeks (it used to drop to 0)');
  v = await medals(p); check(await p.$$eval('.medal-track', ts => ts[1].querySelectorAll('.won').length) === 2, 'the fitness medals earned (Pawn, Knight) stay');
  await p.close();
  // a 0-minute entry isn't practice
  const z = await T.open('u-z', '#/home'); const c = await T.open('coach', '#/dashboard'); await c.waitForTimeout(3500); await z.reload(); await z.waitForTimeout(3500);
  v = await T.text(z);
  check(v.includes('No practice logged for 3 days'), 'a 0-minute entry today: Zoe is still asked about 3 days without practice');
  await c.reload(); await c.waitForTimeout(2500);
  check((await T.text(c)).includes('Zoe') && /No practice for 2\+ days/.test(await T.text(c)), 'and the coach’s Needs attention still lists her');
  await z.screenshot({ path: out('streaks'), fullPage: true });
  await T.finish();
})();

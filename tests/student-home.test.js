// The student's Home: when the coach's app last updated the board (and changes still waiting for it), the tiles,
// the practice medal with its warning, Updates marked New (with counts in the menu, and Mark all as read), Coming up
// in date order (lessons, club classes, tournaments), logging practice that reaches the coach, and the practice
// check-in after 2 days without practice (an answer, and "Something else" needing a few words).
const { URL, t, addDays, weekday, stu, les, check, out, start, fillForm } = require('./lib.js');
const w = (id, d, min) => ({ id, date: addDays(t, d), what: 'Tactics', site: 'Other', exercise: 'Exercises', minutes: min, by: 'student' });
(async () => {
  const T = await start();
  const clubDay = addDays(t, 1);
  await T.seed({ coach: 'coach', docs: {
    'data/users/coach/settings': { coachName: 'Raem', currency: '₪', lang: 'en', weekStart: 0,
      club: [{ id: 'cl1', name: 'Diamond Class', kind: 'weekly', weekday: weekday(clubDay), from: '16:00', to: '17:30', place: 'Haifa club', start: addDays(t, -30), end: '' }] },
    'data/users/coach/st-a': stu('st-a', 'Maya Cohen', { clubIds: ['cl1'], rating: '1540', ratings: [{ date: addDays(t, -9), value: 1540, source: 'FIDE' }], portal: { uid: 'u-a', linkedAt: addDays(t, -30) },
      worklog: [w('w1', -2, 30), w('w2', -3, 25), w('w3', -4, 20)], sessions: [les('l1', addDays(t, 2), '17:00', 'Rook endings')],
      tournaments: [{ id: 'tr1', name: 'Haifa Open', start: addDays(t, 4), end: addDays(t, 5) }] }),
    'data/users/coach/st-d': stu('st-d', 'Dan Peretz', { portal: { uid: 'u-d', linkedAt: addDays(t, -30) }, worklog: [w('d1', -3, 30)] }),
    'data/users/coach/as-1': { id: 'as-1', studentId: 'st-a', title: 'Lucena', type: 'Endgames', status: 'Assigned', due: addDays(t, 3), assigned: t, games: [] },
    'portal/u-a': { code: 'A1', linked: true, role: 'student', coach: 'coach', linkedAt: addDays(t, -30) },
    'portal/u-d': { code: 'D1', linked: true, role: 'student', coach: 'coach', linkedAt: addDays(t, -30) } } });
  let c = await T.open('coach'); await c.waitForTimeout(3500);
  const m = await T.open('u-a', '#/home'); await m.waitForTimeout(3500);
  let v = await T.text(m);
  check(v.includes('Updated by Raem’s app just now'), 'Home says Raem’s app updated the board just now (the coach’s name instead of “your coach”)');
  check(/Good (morning|afternoon|evening), Maya/.test(v), 'greets Maya');
  check(v.includes('Next lesson') && v.includes('17:00') && /1\s*Tasks to do/.test(v) && /75\s*Practice minutes this week/.test(v) && /1540\s*FIDE rating/.test(v), 'tiles: next lesson, 1 task to do, 75 practice minutes this week, FIDE rating 1540');
  check(v.includes('3-day practice streak') && await m.$('.medal-line .medal'), 'the practice medal: a 3-day streak');
  check(v.includes('Practice today to keep your streak'), 'with the warning inside it (yesterday missed, nothing yet today)');
  // updates marked New, with counts in the menu
  check(v.includes('Updates') && v.includes('New task: Lucena'), 'Updates: the new task');
  check(await m.$$eval('#view .tag', ts => ts.some(x => x.textContent === 'New')), 'marked New');
  const badge = await m.$eval('#nav a:has-text("Tasks") .nav-badge', e => e.textContent).catch(() => '');
  check(badge === '1', 'the menu shows 1 new on Tasks');
  await m.click('[data-a=seenAll]'); await m.waitForTimeout(600);
  check(!(await m.$$eval('#view .tag', ts => ts.some(x => x.textContent === 'New'))) && !(await m.$('#nav a:has-text("Tasks") .nav-badge')), 'Mark all as read clears New and the count');
  // Coming up, in date order: the club class tomorrow, the lesson, the tournament
  const cu = await m.$$eval('.panel', ps => (ps.find(p => /Coming up/.test(p.querySelector('h2') ? p.querySelector('h2').textContent : '')) || {}).textContent || '');
  const iClub = cu.indexOf('Diamond Class'), iLes = cu.indexOf('Lesson'), iTour = cu.indexOf('Haifa Open');
  check(iClub >= 0 && iLes > iClub && iTour > iLes, 'Coming up in date order: club class, lesson, tournament');
  // log practice with the coach's app closed: it waits, then reaches the coach
  await c.close();
  await m.click('[data-a=log]'); await m.waitForSelector('#modal[open] #f_minutes');
  await fillForm(m, { minutes: '35', what: 'Openings' }, false); await m.click('#modal[open] button[type=submit]'); await m.waitForTimeout(800);
  v = await T.text(m);
  check(v.includes('3-day practice streak') || v.includes('4-day practice streak'), 'logged today: the streak goes on');
  check(!v.includes('Practice today to keep your streak'), 'and the warning goes');
  await m.reload(); await m.waitForTimeout(3000);
  check((await T.text(m)).includes('1 change waiting for Raem’s app'), 'with the coach’s app closed: “1 change waiting for Raem’s app”');
  c = await T.open('coach'); await c.waitForTimeout(4000);
  const a = await T.eventually(async () => { const x = await T.student(c, 'coach', 'st-a'); return x.worklog.some(y => y.what === 'Openings' && +y.minutes === 35) && x; });
  check(!!a && a.worklog.find(y => y.what === 'Openings').by === 'student', 'once the coach’s app opens, the practice is in Maya’s records (by student)');
  await m.waitForTimeout(2500); await m.reload(); await m.waitForTimeout(3000);
  check(!(await T.text(m)).includes('waiting for Raem’s app'), 'and nothing waits any more');
  // Dan: 3 days without practice → the check-in
  const d = await T.open('u-d', '#/home'); await d.waitForTimeout(3500);
  v = await T.text(d);
  check(v.includes('No practice logged for 3 days') && v.includes('Raem would like to know'), 'Dan is asked what’s going on (3 days without practice)');
  await d.click('[data-a=checkin][data-id=other]'); await d.waitForSelector('#modal[open] #f_note');
  await d.click('#modal[open] button[type=submit]'); await d.waitForTimeout(300);
  check((await d.textContent('#modal .form-err')).includes('Write a few words'), '“Something else” needs a few words');
  await fillForm(d, { note: 'Exams this week' });
  check((await d.textContent('#toast')).includes('Raem will see it') && !(await T.text(d)).includes('No practice logged for'), 'the answer is sent and the question goes');
  await c.reload(); await c.waitForTimeout(4000);
  const dc = await T.eventually(async () => { const x = await T.student(c, 'coach', 'st-d'); return (x.checkins || []).length && x; });
  check(!!dc && dc.checkins[0].reason === 'other' && dc.checkins[0].note === 'Exams this week', 'the coach gets Dan’s answer');
  await c.goto(URL + '#/dashboard'); await c.waitForTimeout(800);
  check((await T.text(c)).includes('Exams this week'), 'and sees it in Needs attention');
  await m.screenshot({ path: out('student-home'), fullPage: true });
  await T.finish();
})();

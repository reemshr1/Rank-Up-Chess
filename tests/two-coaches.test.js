// A student with two coaches: Maya (Raem's student) adds Ben with his code and sends him what she logged so far (her
// own entries only); one app shows both coaches' lessons and tasks, each with its coach; Request a lesson asks which
// coach; what she logs goes to every coach she shares with (Share per coach); each coach sees the other by name only.
const { URL, t, addDays, stu, les, check, out, start, fillForm } = require('./lib.js');
(async () => {
  const T = await start();
  await T.seed({ coach: 'coach', coaches: ['ben'], docs: {
    'data/users/coach/settings': { coachName: 'Raem', currency: '₪', lang: 'en', weekStart: 0 },
    'data/users/coach/st-maya': stu('st-maya', 'Maya Cohen', { portal: { uid: 'u-m', linkedAt: t }, sessions: [les('r1', addDays(t, 2), '17:00', 'Rook endings')],
      worklog: [{ id: 'w-own', date: addDays(t, -2), what: 'Tactics', minutes: 25, by: 'student' }, { id: 'w-coach', date: addDays(t, -3), what: 'Openings', minutes: 40 }] }),
    'data/users/coach/as-r': { id: 'as-r', studentId: 'st-maya', title: 'Raem task', type: 'Tactics', status: 'Assigned', due: addDays(t, 4), assigned: t, games: [] },
    'portal/u-m': { code: 'M1', linked: true, role: 'student', coach: 'coach', linkedAt: t },
    'data/users/ben/settings': { coachName: 'Ben Gal', currency: '₪', lang: 'en', weekStart: 0 },
    'data/users/ben/st-m2': stu('st-m2', 'Maya', { rate: 150, invite: { code: 'BEN234', created: t }, sessions: [les('b1', addDays(t, 3), '18:00', 'Sicilian')] }),
    'data/users/ben/as-b': { id: 'as-b', studentId: 'st-m2', title: 'Ben task', type: 'Openings', status: 'Assigned', due: addDays(t, 5), assigned: t, games: [] } } });
  const raem = await T.open('coach'); await raem.waitForTimeout(3500);
  const m = await T.open('u-m', '#/home'); await m.waitForTimeout(3500);
  check((await T.text(m)).includes('Working with another coach too?'), 'Home: Working with another coach too? → Add a coach');
  await m.click('[data-a=addCoach]'); await m.waitForSelector('#modal[open] #f_code');
  await fillForm(m, { code: 'BEN234', history: 'yes' }); await m.waitForTimeout(2500);
  check((await T.doc(m, 'portal/u-m.2') || {}).coach === 'ben', 'a second link, to Ben');
  const ben = await T.open('ben'); await ben.waitForTimeout(6000);
  let b = await T.eventually(async () => { const x = await T.student(ben, 'ben', 'st-m2'); return x.portal && x.portal.uid === 'u-m.2' && x; }) || await T.student(ben, 'ben', 'st-m2');
  check(b.portal && b.portal.uid === 'u-m.2', 'Ben’s app links her as his Maya');
  b = await T.eventually(async () => { const x = await T.student(ben, 'ben', 'st-m2'); return (x.worklog || []).some(w => w.id === 'w-own') && x; }) || b;
  check((b.worklog || []).some(w => w.id === 'w-own') && !(b.worklog || []).some(w => w.id === 'w-coach'), 'her history reaches Ben: her own practice, not what Raem entered');
  // one app with both
  await m.reload(); await m.waitForTimeout(4000);
  let v = await T.text(m);
  check(v.includes('Your coaches') && v.includes('Raem') && v.includes('Ben Gal'), 'Your coaches: Raem and Ben Gal');
  check(v.includes('Rook endings') && v.includes('Sicilian') && v.includes('with Raem') && v.includes('with Ben Gal'), 'both coaches’ lessons, each “with” its coach');
  await m.goto(URL + '#/student/st-maya/assignments'); await m.waitForTimeout(800);
  v = await T.text(m); check(v.includes('Raem task') && v.includes('Ben task') && v.includes('from Ben Gal'), 'Tasks: both, each from its coach');
  // a lesson request: which coach?
  await m.goto(URL + '#/home'); await m.waitForTimeout(600);
  await m.click('[data-a=req]'); await m.waitForSelector('#modal[open] #f_coach');
  const benLink = await m.$$eval('#f_coach option', xs => xs.find(x => /Ben/.test(x.textContent)).value);
  await m.selectOption('#f_coach', benLink); await m.click('#modal[open] button[type=submit]'); await m.waitForSelector('#modal[open] #f_time');
  await fillForm(m, { date: addDays(t, 8), time: '15:00', note: 'For Ben' });
  await ben.reload(); await raem.reload(); await ben.waitForTimeout(4500);
  check(!!(await T.eventually(async () => ((await T.student(ben, 'ben', 'st-m2')).requests || []).some(r => r.note === 'For Ben'))) && !((await T.student(raem, 'coach', 'st-maya')).requests || []).length, 'the request reaches Ben, not Raem');
  // practice goes to both; then sharing off for Ben
  await m.click('[data-a=log]'); await m.waitForSelector('#modal[open] #f_minutes'); await fillForm(m, { minutes: '33', what: 'Openings' }); await m.waitForTimeout(1500);
  await ben.reload(); await raem.reload(); await ben.waitForTimeout(4500);
  check(!!(await T.eventually(async () => (await T.student(ben, 'ben', 'st-m2')).worklog.some(w => +w.minutes === 33))) && !!(await T.eventually(async () => (await T.student(raem, 'coach', 'st-maya')).worklog.some(w => +w.minutes === 33))), 'what she logs goes to both coaches');
  await m.goto(URL + '#/home'); await m.waitForTimeout(600);
  await m.uncheck('[data-share="' + benLink + '"]'); await m.waitForTimeout(1200);
  await m.click('[data-a=log]'); await m.waitForSelector('#modal[open] #f_minutes'); await fillForm(m, { minutes: '44', what: 'Openings' }); await m.waitForTimeout(1500);
  await ben.reload(); await raem.reload(); await ben.waitForTimeout(4500);
  check(!!(await T.eventually(async () => (await T.student(raem, 'coach', 'st-maya')).worklog.some(w => +w.minutes === 44))) && !(await T.student(ben, 'ben', 'st-m2')).worklog.some(w => +w.minutes === 44), 'with Share off for Ben, only Raem gets it');
  // each coach sees the other by name only
  await raem.goto(URL + '#/student/st-maya/overview'); await raem.waitForTimeout(1000);
  await ben.goto(URL + '#/student/st-m2/overview'); await ben.waitForTimeout(1000);
  check((await T.text(raem)).includes('Also works with') && (await T.text(raem)).includes('Ben Gal') && !(await T.text(raem)).includes('Sicilian'), 'Raem sees “Also works with: Ben Gal”, and none of Ben’s lessons');
  check((await T.text(ben)).includes('Also works with') && (await T.text(ben)).includes('Raem') && !(await T.text(ben)).includes('Rook endings'), 'and Ben sees Raem, and none of Raem’s');
  check(!(await T.denied(raem)).length && !(await T.denied(ben)).length && !(await T.denied(m)).length, 'nobody tried to read or write what isn’t theirs');
  await m.screenshot({ path: out('two-coaches'), fullPage: true });
  await T.finish();
})();

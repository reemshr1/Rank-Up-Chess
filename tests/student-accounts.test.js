// Accounts side by side. Two students of one coach each see only their own board (and the database gives them nothing
// of the other's); a student and their parent both see the child's lessons, while only the parent sees the money and
// the student's practice reaches the parent's board; one device signed out of one account and into another shows
// nothing of the first (student → parent → another student).
const { URL, t, addDays, stu, les, check, out, start, fillForm } = require('./lib.js');
const auth = async (p, email, pass) => { await p.waitForSelector('#authF', { timeout: 8000 }); await p.fill('#aEmail', email); await p.fill('#aPass', pass);
  await p.click('#authF button[type=submit]'); await p.waitForTimeout(3500); };
const signOut = async p => { await p.locator('[data-signout]:visible').first().click(); await p.waitForSelector('#modal[open] button[type=submit]');
  await p.click('#modal[open] button[type=submit]'); await p.waitForSelector('#authF', { timeout: 8000 }); };
(async () => {
  const T = await start();
  await T.seed({ coach: 'coach', users: { 'maya@x.co': { id: 'u-a', password: 'mayapass99' }, 'dan@x.co': { id: 'u-d', password: 'danpass999' }, 'mom@x.co': { id: 'u-par', password: 'mompass99' } }, docs: {
    'data/users/coach/settings': { coachName: 'Raem', currency: '₪', defaultRate: 100, lang: 'en', weekStart: 0, payInfo: 'Bit to 054-1234567',
      families: [{ id: 'fam-c', name: 'Cohen family', studentIds: ['st-a'], portal: { uid: 'u-par', linkedAt: t } }] },
    'data/users/coach/st-a': stu('st-a', 'Maya Cohen', { portal: { uid: 'u-a', linkedAt: t }, rate: 100,
      sessions: [les('a0', addDays(t, -5), '17:00', 'Pins', { status: 'done', fee: 100 }), les('a1', addDays(t, 2), '17:00', 'Rook endings')],
      worklog: [{ id: 'wa', date: addDays(t, -1), what: 'Tactics', minutes: 30, by: 'student' }] }),
    'data/users/coach/st-d': stu('st-d', 'Dan Peretz', { portal: { uid: 'u-d', linkedAt: t }, sessions: [les('d1', addDays(t, 3), '16:00', 'Kings Indian')],
      tournaments: [{ id: 'td', name: 'Dan Open', start: addDays(t, 9) }] }),
    'data/users/coach/as-d': { id: 'as-d', studentId: 'st-d', title: 'Dan task', type: 'Tactics', status: 'Assigned', due: addDays(t, 4), assigned: t, games: [] },
    'portal/u-a': { code: 'A1', linked: true, role: 'student', coach: 'coach', linkedAt: t },
    'portal/u-d': { code: 'D1', linked: true, role: 'student', coach: 'coach', linkedAt: t },
    'portal/u-par': { code: 'F1', linked: true, role: 'parent', coach: 'coach', linkedAt: t } } });
  const c = await T.open('coach'); await c.waitForTimeout(4000);
  // two students: each sees only their own
  const m = await T.open('u-a', '#/home'), d = await T.open('u-d', '#/home'); await m.waitForTimeout(3500);
  let v, mv = await T.text(m), dv = await T.text(d);
  check(mv.includes('Rook endings') && !mv.includes('Kings Indian') && !mv.includes('Dan Open'), 'Maya sees her lesson, nothing of Dan’s');
  check(dv.includes('Kings Indian') && dv.includes('Dan Open') && !dv.includes('Rook endings'), 'Dan sees his, nothing of Maya’s');
  await d.goto(URL + '#/student/st-d/assignments'); await d.waitForTimeout(600);
  check((await T.text(d)).includes('Dan task'), 'Dan has his task');
  await m.goto(URL + '#/student/st-a/assignments'); await m.waitForTimeout(600);
  check(!(await T.text(m)).includes('Dan task'), 'Maya doesn’t');
  const peek = await m.evaluate(async () => { const r = await Promise.all(['portal/u-d/view', 'data/users/coach', 'portal/u-par/view'].map(col => window.supabase.createClient().from('docs').select('*').eq('col', col))); return r.map(x => (x.data || []).length); });
  check(peek.every(n => n === 0), 'asking the database for Dan’s board, the coach’s records or the parent’s board gives Maya nothing: ' + peek.join(','));
  const write = await m.evaluate(async () => { const r = await window.supabase.createClient().from('docs').upsert({ col: 'portal/u-d/inbox', id: 'op-x', data: { type: 'log' } }); return !!r.error; });
  check(write && !(await m.evaluate(() => localStorage.getItem('fdb:portal/u-d/inbox/op-x'))), 'and she can’t write into Dan’s');
  // a student and her parent: both see the lesson; only the parent sees the money
  const p = await T.open('u-par', '#/home'); await p.waitForTimeout(3500);
  const pv = await T.text(p);
  await m.goto(URL + '#/home'); await m.waitForTimeout(600); mv = await T.text(m);
  check(pv.includes('Maya’s board') && pv.includes('Rook endings') && mv.includes('Rook endings'), 'Maya and her parent both see the lesson');
  check(pv.includes('Balance') && pv.includes('Bit to 054-1234567') && !mv.includes('Balance') && !mv.includes('Bit to 054'), 'only the parent sees the Balance and how to pay');
  await m.goto(URL + '#/payments'); await m.waitForTimeout(600);
  v = await T.text(m); check(!v.includes('Statement') && !v.includes('₪') && !v.includes('Pins'), 'Maya has no Payments page: no statement, no amounts (the coach hasn’t shared them with her)');
  // Maya logs practice: it reaches the coach, then her parent's board
  await m.goto(URL + '#/home'); await m.waitForTimeout(500);
  await m.click('[data-a=log]'); await m.waitForSelector('#modal[open] #f_minutes'); await fillForm(m, { minutes: '41', what: 'Openings' });
  const reached = await T.eventually(async () => (await T.student(c, 'coach', 'st-a')).worklog.some(w => +w.minutes === 41), 12000);
  check(!!reached, 'Maya’s practice reaches the coach');
  await p.goto(URL + '#/student/st-a/work'); await p.waitForTimeout(500);
  check(!!(await T.eventually(async () => (await T.text(p)).includes('41 min'), 12000)), 'and then her parent’s board');
  for (const x of [m, d, p]) await x.close();
  // one device: Maya signs out, her parent signs in, then Dan
  const s = await T.open(null); await auth(s, 'maya@x.co', 'mayapass99');
  check(/Good (morning|afternoon|evening), Maya/.test(await T.text(s)), 'one device: Maya signs in');
  await s.click('[data-a=seenAll]').catch(() => {});
  await signOut(s); await auth(s, 'mom@x.co', 'mompass99');
  v = await T.text(s);
  check(v.includes('Maya’s board') && v.includes('Balance') && !/Good (morning|afternoon|evening), Maya/.test(v), 'her parent signs in on the same device: the parent’s app, not Maya’s');
  check(await s.evaluate(() => document.body.classList.contains('parent-mode')), 'in parent mode');
  await signOut(s); await auth(s, 'dan@x.co', 'danpass999');
  v = await T.text(s);
  check(/Good (morning|afternoon|evening), Dan/.test(v) && v.includes('Kings Indian') && !v.includes('Rook endings') && !v.includes('Balance'), 'then Dan: his own board, nothing of Maya’s or the parent’s');
  check(!(await s.evaluate(() => document.body.classList.contains('parent-mode'))), 'no longer in parent mode');
  await s.goto(URL + '#/student/st-d/work'); await s.waitForTimeout(600);
  check(!(await T.text(s)).includes('41 min'), 'Maya’s practice isn’t on Dan’s screen');
  check(!(await T.denied(c)).length && !(await T.denied(s)).length, 'the apps themselves never tried to read or write what isn’t theirs');
  await s.screenshot({ path: out('student-accounts'), fullPage: true });
  await T.finish();
})();

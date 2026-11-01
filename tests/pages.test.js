// Every page of the coach's app, a student's, a parent's and a player's opens without errors, on a computer and a
// phone, in English and Hebrew, and nothing runs off a phone's screen.
const { chromium } = require('playwright');
const { FAKE_SUPA } = require('./fakesupa.js');
const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '../index.html');
const pad = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const addDays = (s, n) => { const d = new Date(s + 'T00:00'); d.setDate(d.getDate() + n); return iso(d); };
const t = iso(new Date());
let fails = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fails++; };
const stu = (id, name, extra) => Object.assign({ id, name, active: true, rate: 100, noId: true, ratingType: 'FIDE', rating: '', ratings: [{ date: addDays(t, -40), value: 1500, source: 'FIDE' }, { date: addDays(t, -5), value: 1540, source: 'FIDE' }],
  sessions: [{ id: 'l1', date: addDays(t, 2), time: '17:00', duration: 60, format: 'In person', status: 'planned', topics: 'Rook endings' }, { id: 'l0', date: addDays(t, -7), time: '17:00', duration: 60, format: 'In person', status: 'done', fee: 100, topics: 'Pins', notes: 'Good work' }],
  tasks: [], worklog: [{ id: 'w1', date: addDays(t, -1), what: 'Tactics', site: 'Lichess', exercise: 'Puzzles (rated)', minutes: 30, attempted: 20, correct: 15, by: 'student' }, { id: 'w2', date: addDays(t, -3), what: 'Endgames', minutes: 25, src: 'Book', by: 'student' }],
  repertoire: [{ id: 'r1', color: 'White', name: 'Italian Game', firstMove: '1.e4' }], tournaments: [{ id: 'tr1', name: 'Haifa Open', start: addDays(t, 9), end: addDays(t, 11) }, { id: 'tr0', name: 'Rapid Cup', start: addDays(t, -14), result: '4/6', expected: '3/6', rounds: 6 }],
  payments: [{ id: 'p1', date: addDays(t, -6), amount: 100, method: 'Bit' }], charges: [], books: [{ id: 'bk1', title: 'Silman', status: 'Reading', pages: 500, page: 100 }], slots: [], training: [], requests: [],
  fitness: [{ id: 'f1', date: addDays(t, -2), activity: 'Running', minutes: 25 }], fitnessGoal: 2, sleep: [], createdAt: addDays(t, -90) }, extra);
const coachPages = ['#/dashboard', '#/students', '#/student/st-a/overview', '#/student/st-a/sessions', '#/student/st-a/work', '#/student/st-a/fitness', '#/student/st-a/books', '#/student/st-a/tournaments',
  '#/student/st-a/games', '#/student/st-a/studied', '#/student/st-a/repertoire', '#/student/st-a/assignments', '#/student/st-a/payments', '#/schedule', '#/club', '#/assignments', '#/assignment/as-1', '#/payments', '#/settings'];
const studentPages = id => ['#/home', '#/student/' + id + '/assignments', '#/student/' + id + '/work', '#/student/' + id + '/fitness', '#/student/' + id + '/books', '#/student/' + id + '/tournaments',
  '#/student/' + id + '/games', '#/student/' + id + '/studied', '#/student/' + id + '/repertoire', '#/progress', '#/schedule', '#/payments'];
(async () => {
  const b = await chromium.launch();
  // the coach's app builds the student's and parent's boards; keep that storage for the others
  for (const [vw, size] of [['computer', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]]) for (const lng of ['en', 'he']) {
    const ctx = await b.newContext({ viewport: size }); await ctx.route('https://lichess.org/**', r => r.abort());
    const errors = [], wide = [];
    const p = await ctx.newPage(); await p.addInitScript(FAKE_SUPA(null)); await p.goto(URL);
    await p.evaluate(({ a, bb, tom, t, LNG }) => { localStorage.clear(); localStorage.setItem('fcoaches', JSON.stringify(['coach', 'tom'])); localStorage.setItem('fplayers', JSON.stringify(['tom'])); localStorage.setItem('fadmin', 'coach');
      const put = (k, v) => localStorage.setItem('fdb:' + k, JSON.stringify(v));
      put('data/users/coach/settings', { coachName: 'Raem', currency: '₪', defaultRate: 100, weekStart: 0, lang: LNG, showPay: true,
        families: [{ id: 'fam', name: 'Cohen family', studentIds: ['st-a', 'st-b'], portal: { uid: 'u-par', linkedAt: t } }] });
      put('data/users/coach/st-a', a); put('data/users/coach/st-b', bb);
      put('data/users/coach/as-1', { id: 'as-1', studentId: 'st-a', title: '30 puzzles on pins', type: 'Tactics', status: 'Assigned', due: t, assigned: t, games: [] });
      put('data/users/coach/gm-1', { id: 'gm-1', studentId: 'st-a', date: t, white: 'Maya', black: 'X', result: '1-0', color: 'White', pgn: '1. e4 e5 *' });
      put('portal/u-a', { code: 'AAA234', linked: true, role: 'student', coach: 'coach', linkedAt: t }); put('portal/u-par', { code: 'FAM234', linked: true, role: 'parent', coach: 'coach', linkedAt: t });
      put('data/users/tom/settings', { coachName: 'Tom', lang: LNG }); put('data/users/tom/st-me', tom); },
    { t, LNG: lng, a: stu('st-a', 'Maya Cohen', { portal: { uid: 'u-a', linkedAt: t }, pay: true }), bb: stu('st-b', 'Yoni Cohen'), tom: stu('st-me', 'Tom Levi', { self: true, setup: 'self', sessions: [], rate: 0 }) });
    await p.close();
    { const c = await ctx.newPage(); await c.addInitScript(FAKE_SUPA('coach')); await c.goto(URL); await c.waitForTimeout(4000); await c.close(); } // the coach's app writes the student's and parent's boards
    for (const [who, pages] of [['coach', coachPages], ['u-a', studentPages('st-a')], ['u-par', studentPages('st-a')], ['tom', studentPages('st-me')]]) {
      const p = await ctx.newPage(); p.on('pageerror', e => errors.push(`${who} ${p.url().split('#')[1] || ''}: ${e.message}`)); await p.addInitScript(FAKE_SUPA(who)); await p.goto(URL); await p.waitForTimeout(3500);
      { const want = { coach: 'Maya Cohen', 'u-a': 'Rook endings', 'u-par': 'Yoni', tom: 'Haifa Open' }[who], body = await p.textContent('body');
        if (!body.includes(want)) errors.push(who + ': the app shows no data (' + want + ' missing)'); }
      if (who === 'u-a' || who === 'u-par') { const he = await p.evaluate(() => document.documentElement.lang === 'he'); if ((lng === 'he') !== he) { await p.locator('[data-lang]:visible').first().click().catch(() => {}); await p.waitForTimeout(500); } }
      for (const h of pages) { await p.goto(URL + h); await p.waitForTimeout(450);
        if (vw === 'phone') { const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); if (ov > 1) wide.push(who + ' ' + h + ' (' + ov + 'px)'); } }
      await p.close(); }
    check(!errors.length, `${vw}, ${lng}: every page opens without errors ` + errors.slice(0, 5).join(' | '));
    if (vw === 'phone') check(!wide.length, `phone, ${lng}: no page is wider than the screen ` + wide.join(', '));
    await ctx.close(); }
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();

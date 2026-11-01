// A coach's student with a Lichess username: their app adds the puzzles, and they reach the coach's records.
const { chromium } = require('playwright');
const { FAKE_SUPA } = require('./fakesupa.js');
const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '../index.html');
const pad = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const addDays = (s, n) => { const d = new Date(s + 'T00:00'); d.setDate(d.getDate() + n); return iso(d); };
const t = iso(new Date());
const dayStart = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
let fails = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fails++; };
const stu = (id, name, extra) => Object.assign({ id, name, active: true, rate: 100, noId: true, ratingType: 'FIDE', rating: '', ratings: [], sessions: [], tasks: [], worklog: [], repertoire: [], tournaments: [], payments: [], charges: [], books: [], slots: [], training: [], requests: [], fitness: [], fitnessGoal: 0, sleep: [], createdAt: addDays(t, -60) }, extra);
const feed = [{ interval: { start: dayStart(addDays(t, -1)), end: dayStart(t) }, puzzles: { score: { win: 15, loss: 5, draw: 0, rp: { before: 1600, after: 1612 } } } }];
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1100, height: 900 } }); const errors = [];
  await ctx.route('https://lichess.org/api/user/**', r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(feed) }));
  const open = async (uid, hash = '') => { const p = await ctx.newPage(); p.on('pageerror', e => errors.push(uid + ': ' + e.message)); await p.addInitScript(FAKE_SUPA(uid)); await p.goto(URL + hash); return p; };
  const first = await open(null);
  await first.evaluate(({ dan, t }) => { localStorage.clear(); localStorage.setItem('fcoaches', JSON.stringify(['coach'])); localStorage.setItem('fadmin', 'coach');
    const put = (k, v) => localStorage.setItem('fdb:' + k, JSON.stringify(v));
    put('data/users/coach/settings', { coachName: 'Raem', currency: '₪', lang: 'en' }); put('data/users/coach/st-dan', dan);
    put('portal/u-dan', { code: 'DAN234', linked: true, role: 'student', coach: 'coach', linkedAt: t }); },
  { t, dan: stu('st-dan', 'Dan Peretz', { usernames: { 'lichess.org': 'danp' }, portal: { uid: 'u-dan', linkedAt: t } }) });
  await first.close();
  const coach = await open('coach'); await coach.waitForTimeout(3500);
  const dan = await open('u-dan'); await dan.waitForTimeout(6000);
  check((await dan.evaluate(() => document.body.classList.contains('student-mode'))), "Dan has the student app");
  await coach.waitForTimeout(4000);
  const rec = await coach.evaluate(() => { const s = JSON.parse(localStorage.getItem('fdb:data/users/coach/st-dan'));
    const logs = Object.keys(localStorage).filter(k => k.startsWith('fdb:data/users/coach/lg-')).map(k => JSON.parse(localStorage.getItem(k)));
    return (s.worklog || []).concat(...logs.map(l => l.worklog || [])); });
  const y = rec.find(x => x.id === 'li-' + addDays(t, -1) + '-puzzles');
  check(y && y.attempted === 20 && y.correct === 15 && y.prating === 1612 && y.by === 'student', "the puzzles Dan’s app added reach the coach’s records: " + JSON.stringify(y));
  await coach.goto(URL + '#/student/st-dan/work'); await coach.waitForTimeout(1200);
  const cv = await coach.textContent('#view');
  check(cv.includes('Lichess Puzzles (rated)') && cv.includes('15/20 correct') && !cv.includes('Check now'), 'the coach sees them on Dan’s Practice tab (the checking is the student’s app’s)');
  check(!errors.length, 'no page errors ' + errors.join(' | '));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();

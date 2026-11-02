// A parent with two coaches: Dana (parent in Raem's Cohen family, for Maya) adds Ben, who coaches Maya too and her
// brother Yoni, with Ben's family code. One parent app: Maya once, with both coaches' lessons; Yoni from Ben only;
// requests and payments go to the right coach, naming the child as that coach knows them.
const { chromium } = require('playwright');
const { FAKE_SUPA } = require('./fakesupa.js');
const path = require('path');
const URL = require('./serve.js').BASE + 'index.html';
const pad = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const addDays = (s, n) => { const d = new Date(s + 'T00:00'); d.setDate(d.getDate() + n); return iso(d); };
const t = iso(new Date());
let fails = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fails++; };
const stu = (id, name, extra) => Object.assign({ id, name, active: true, rate: 100, noId: true, ratingType: 'FIDE', rating: '', ratings: [], sessions: [], tasks: [], worklog: [], repertoire: [], tournaments: [], payments: [], charges: [], books: [], slots: [], training: [], requests: [], fitness: [], fitnessGoal: 0, sleep: [], createdAt: addDays(t, -60) }, extra);
const les = (id, d, time, topics, extra) => Object.assign({ id, date: d, time, duration: 60, format: 'In person', status: 'planned', topics }, extra || {});
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 1100, height: 900 } }); const errors = [];
  const open = async (uid) => { const p = await ctx.newPage(); p.on('pageerror', e => errors.push(uid + ': ' + e.message)); await p.addInitScript(FAKE_SUPA(uid)); await p.goto(URL); return p; };
  const rec = (p, coach, id) => p.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), 'fdb:data/users/' + coach + '/' + id);
  const first = await open('coach');
  await first.evaluate(d => { localStorage.clear(); localStorage.setItem('fcoach', 'coach'); localStorage.setItem('fcoaches', JSON.stringify(['ben']));
    const put = (k, v) => localStorage.setItem('fdb:' + k, JSON.stringify(v));
    put('data/users/coach/settings', { coachName: 'Raem', currency: '₪', defaultRate: 100, weekStart: 0, lang: 'en', usedCodes: [{ code: 'FAMR11', at: d.t }],
      families: [{ id: 'fam-r', name: 'Cohen family', studentIds: ['st-maya'], portal: { uid: 'dana', linkedAt: d.t, email: 'dana@test' } }] });
    put('data/users/coach/st-maya', d.maya); put('portal/dana', { code: 'FAMR11', linked: true, role: 'parent', coach: 'coach', linkedAt: d.t, email: 'dana@test' });
    put('data/users/ben/settings', { coachName: 'Ben Gal', currency: '₪', defaultRate: 150, weekStart: 0, lang: 'en', families: [{ id: 'fam-b', name: 'Cohen', studentIds: ['st-m2', 'st-yoni'], invite: { code: 'FAMB22', created: d.t } }] });
    put('data/users/ben/st-m2', d.m2); put('data/users/ben/st-yoni', d.yoni); },
  { t, maya: stu('st-maya', 'Maya Cohen', { sessions: [les('lr1', addDays(t, 1), '17:00', 'Rook endings'), les('lr0', addDays(t, -7), '17:00', 'Pawns', { status: 'done', fee: 100 })] }),
    m2: stu('st-m2', 'Maya', { rate: 150, sessions: [les('lb1', addDays(t, 2), '18:00', 'Sicilian'), les('lb0', addDays(t, -5), '18:00', 'Najdorf', { status: 'done', fee: 150 })] }),
    yoni: stu('st-yoni', 'Yoni Cohen', { rate: 150, sessions: [les('ly1', addDays(t, 3), '16:00', 'Mates')] }) });
  await first.close();
  const raem = await open('coach'); await raem.waitForTimeout(3000);
  // 1. Dana adds Ben with his family code
  const dana = await open('dana'); await dana.waitForTimeout(3000);
  check((await dana.textContent('#view')).includes('Does your child have another coach too?'), 'the parent sees how to add another coach');
  await dana.click('[data-a=addCoach]'); await dana.waitForSelector('#modal[open] #f_code');
  const ft = await dana.textContent('#modal[open]');
  check(ft.includes('Family code from the coach') && !ft.includes('Send them what you logged'), 'a parent is asked for a family code (nothing to send)');
  await dana.fill('#f_code', 'FAMB22'); await dana.click('#modal button[type=submit]'); await dana.waitForTimeout(2000);
  check((await dana.evaluate(() => JSON.parse(localStorage.getItem('fdb:portal/dana.2') || '{}').coach)) === 'ben', 'a second link, to Ben');
  const ben = await open('ben'); await ben.waitForTimeout(6000);
  const bf = (await rec(ben, 'ben', 'settings')).families[0];
  check(bf.portal && bf.portal.uid === 'dana.2', 'Ben\'s app links Dana as the Cohen family\'s parent');
  // 2. one parent app
  await dana.reload(); await dana.waitForTimeout(3500);
  const kids = await dana.$$eval('#childPick option', xs => xs.map(x => x.textContent));
  check(kids.length === 2 && kids.some(x => /Maya/.test(x)) && kids.some(x => /Yoni/.test(x)), 'Maya appears once, and Yoni too: ' + kids.join(', '));
  let hv = await dana.textContent('#view');
  check(hv.includes('with Raem') && hv.includes('with Ben Gal') && hv.includes('Rook endings') && hv.includes('Sicilian'), "Maya's board has both coaches' lessons, each with its coach");
  check(hv.includes('Your coaches') && hv.includes('Raem') && hv.includes('Ben Gal') && !(await dana.$('[data-share]')), 'Your coaches lists both (no sharing for a parent)');
  check(hv.includes('With Raem · Payments has each coach'), 'the Home balance says whose it is');
  await dana.screenshot({ path: path.join(__dirname, 'out-twop-home.png'), fullPage: true });
  // 3. a lesson request for Maya, with Ben: goes to Ben, for his Maya
  await dana.goto(URL + '#/schedule'); await dana.waitForTimeout(800);
  await dana.click('[data-a=req]'); await dana.waitForSelector('#modal[open] #f_coach');
  const bl = await dana.$$eval('#f_coach option', xs => xs.find(x => /Ben/.test(x.textContent)).value);
  await dana.selectOption('#f_coach', bl); await dana.click('#modal button[type=submit]'); await dana.waitForSelector('#modal[open] #f_time', { timeout: 5000 });
  await dana.fill('#f_date', addDays(t, 6)).catch(() => {}); await dana.fill('#f_time', '15:00').catch(() => {}); await dana.click('#modal button[type=submit]'); await dana.waitForTimeout(5000);
  check(((await rec(ben, 'ben', 'st-m2')).requests || []).length === 1 && ((await rec(raem, 'coach', 'st-maya')).requests || []).length === 0, 'the request reaches Ben, for his Maya, and not Raem');
  // 4. payments: one tab per coach
  await dana.goto(URL + '#/payments'); await dana.waitForTimeout(1200);
  const tabs = await dana.$$eval('[data-paycoach]', xs => xs.map(x => x.textContent));
  check(tabs.length === 2, 'Payments has a tab per coach: ' + tabs.join(', '));
  await dana.screenshot({ path: path.join(__dirname, 'out-twop-pay.png') });
  // 5. Yoni is only Ben's
  await dana.goto(URL + '#/home'); await dana.waitForTimeout(500);
  const yId = await dana.$$eval('#childPick option', xs => xs.find(x => /Yoni/.test(x.textContent)).value);
  await dana.selectOption('#childPick', yId); await dana.waitForTimeout(1200);
  hv = await dana.textContent('#view');
  check(hv.includes('Mates') && !hv.includes('Rook endings'), "Yoni's board has only Ben's lessons");
  // 6. each coach sees the other by name only
  await raem.goto(URL + '#/student/st-maya'); await raem.waitForTimeout(1500);
  await ben.goto(URL + '#/student/st-m2'); await ben.waitForTimeout(1500);
  check((await raem.textContent('#view')).includes('Also works with') && (await raem.textContent('#view')).includes('Ben Gal'), "Raem's Parent app box: Dana also works with Ben");
  check((await ben.textContent('#view')).includes('Also works with') && (await ben.textContent('#view')).includes('Raem'), 'and Ben sees Raem');
  // Hebrew
  await dana.locator('[data-lang]:visible').first().click(); await dana.waitForTimeout(1200);
  check((await dana.textContent('#view')).includes('המאמנים שלך'), 'in Hebrew');
  check(!errors.length, 'no page errors ' + errors.join(' | '));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();

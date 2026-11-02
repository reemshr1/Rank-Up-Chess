// Deleting a connected student tells their app its access ended (as Disconnect does); and a connected account
// whose student is already gone from the board (deleted before this) is disconnected after a minute.
const { chromium } = require('playwright');
const { FAKE_SUPA } = require('./fakesupa.js');
const path = require('path');
const URL = require('./serve.js').BASE + 'index.html';
const pad = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const t = iso(new Date());
let fails = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fails++; };
const stu = (id, name, uid) => ({ id, name, active: true, rate: 100, noId: true, ratingType: 'FIDE', rating: '', ratings: [], sessions: [], tasks: [], worklog: [], repertoire: [], tournaments: [], payments: [], charges: [], books: [], slots: [], training: [], requests: [], fitness: [], fitnessGoal: 0, sleep: [], createdAt: t, portal: { uid, linkedAt: t } });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 1100, height: 900 } }); const errors = [];
  const open = async (uid) => { const p = await ctx.newPage(); p.on('pageerror', e => errors.push(uid + ': ' + e.message)); await p.addInitScript(FAKE_SUPA(uid)); await p.goto(URL); return p; };
  const portal = (p, uid) => p.evaluate(u => JSON.parse(localStorage.getItem('fdb:portal/' + u) || 'null'), uid);
  const first = await open('coach');
  await first.evaluate(d => { localStorage.clear(); localStorage.setItem('fcoach', 'coach');
    const put = (k, v) => localStorage.setItem('fdb:' + k, JSON.stringify(v));
    put('data/users/coach/settings', { coachName: 'Raem', currency: '₪', lang: 'en' });
    put('data/users/coach/st-a', d.a); put('portal/u-a', { code: 'AAA111', linked: true, role: 'student', coach: 'coach' });
    put('portal/u-old', { code: 'OLD111', linked: true, role: 'student', coach: 'coach' }); // its student was deleted before the fix
    put('portal/u-old/view/student', { id: 'st-old', name: 'Old Test' }); },
  { a: stu('st-a', 'Test Player', 'u-a') });
  await first.close();
  const c = await open('coach'); await c.waitForTimeout(3000);
  check((await portal(c, 'u-a')).linked === true, 'Test Player is connected');
  // delete Test Player without disconnecting first
  await c.goto(URL + '#/student/st-a'); await c.waitForTimeout(800);
  await c.click('text=Edit profile'); await c.waitForSelector('#modal[open]');
  await c.click('#modal[open] button.danger'); await c.waitForSelector('#modal[open] button[type=submit]'); await c.click('#modal[open] button[type=submit]'); await c.waitForTimeout(1500);
  const pa = await portal(c, 'u-a');
  check(pa && pa.linked === false && pa.unlinked === true, 'deleting the student tells their app its access ended: ' + JSON.stringify(pa));
  check(!(await c.evaluate(() => Object.keys(localStorage).some(k => k.startsWith('fdb:portal/u-a/view/')))), 'and their copy of the board is gone');
  check(!(await c.evaluate(() => localStorage.getItem('fdb:data/users/coach/st-a'))), 'the student is deleted (and not saved back)');
  // the older leftover: disconnected after a minute
  check((await portal(c, 'u-old')).linked === true, 'a leftover connection from before stays for now');
  await c.waitForTimeout(63000);
  const po = await portal(c, 'u-old');
  check(po && po.linked === false && po.unlinked === true, 'after a minute, the leftover connection is closed: ' + JSON.stringify(po));
  // the student's app says so
  const s = await open('u-old'); await s.waitForTimeout(2500);
  check((await s.textContent('#view')).includes('closed access'), "the old account's app says the coach closed access");
  check(!errors.length, 'no page errors ' + errors.join(' | '));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();

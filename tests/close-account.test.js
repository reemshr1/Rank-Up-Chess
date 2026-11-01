// A player closes their own account (Progress → Your data → Close my account): after typing DELETE everything goes,
// they land on the sign-in screen and can't sign in again; on a parent's board the child's app is told access ended.
const { chromium } = require('playwright');
const { FAKE_SUPA } = require('./fakesupa.js');
const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '../index.html');
const pad = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const t = iso(new Date());
let fails = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fails++; };
const blank = (id, extra) => Object.assign({ id, name: '', active: true, rate: 0, noId: true, ratingType: 'FIDE', rating: '', ratings: [], sessions: [], tasks: [], worklog: [], repertoire: [], tournaments: [], payments: [], charges: [], books: [], slots: [], training: [], requests: [], fitness: [], fitnessGoal: 0, sleep: [], createdAt: t }, extra);
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1100, height: 900 } }); const errors = [];
  const open = async (uid) => { const p = await ctx.newPage(); p.on('pageerror', e => errors.push((uid || 'anon') + ': ' + e.message)); await p.addInitScript(FAKE_SUPA(uid)); await p.goto(URL); return p; };
  const keys = (p, pre) => p.evaluate(pre => Object.keys(localStorage).filter(k => k.startsWith(pre)), pre);
  const signIn = async (p, email) => { await p.waitForSelector('#authF', { timeout: 8000 }); await p.fill('#aEmail', email); await p.fill('#aPass', 'longenough1'); await p.click('#authF button[type=submit]'); };
  const first = await open('coach');
  await first.evaluate(({ t, tom, maya }) => { localStorage.clear(); localStorage.setItem('fcoach', 'coach');
    localStorage.setItem('fcoaches', JSON.stringify(['tom', 'dana'])); localStorage.setItem('fplayers', JSON.stringify(['tom', 'dana']));
    localStorage.setItem('fusers', JSON.stringify({ 'tom@test': { id: 'tom', password: 'longenough1' }, 'dana@test': { id: 'dana', password: 'longenough1' }, 'maya@test': { id: 'maya', password: 'longenough1' } }));
    const put = (k, v) => localStorage.setItem('fdb:' + k, JSON.stringify(v));
    put('data/users/coach/settings', { coachName: 'Raem', currency: '₪' }); put('data/users/coach/st-x', { id: 'st-x', name: 'Coach Student', active: true });
    put('data/users/tom/settings', { coachName: 'Tom Levi', lang: 'en' }); put('data/users/tom/st-me', tom); put('data/users/tom/as-1', { id: 'as-1', studentId: 'st-me', title: 'x', status: 'Assigned' });
    localStorage.setItem('fstore:books/st-me/bk-1.pdf', JSON.stringify({ owner: 'tom', data: 'x' })); localStorage.setItem('fbackups', '{}'); localStorage.setItem('fbackups:tom', JSON.stringify({ [t]: { docs: {} } }));
    put('data/users/dana/settings', { coachName: 'Maya Cohen', lang: 'he' }); put('data/users/dana/st-m', maya);
    put('portal/maya', { code: 'KIDOLD', linked: true, role: 'student', coach: 'dana', linkedAt: t }); },
  { t, tom: blank('st-me', { name: 'Tom Levi', self: true, setup: 'self' }), maya: blank('st-m', { name: 'Maya Cohen', self: true, setup: 'parent', portal: { uid: 'maya', linkedAt: t } }) });
  await first.close();
  // Tom
  const tom = await open('tom'); await tom.waitForTimeout(2500);
  await tom.goto(URL + '#/progress'); await tom.waitForTimeout(1200);
  check((await tom.textContent('#view')).includes('Close your account') && !!(await tom.$('[data-a=closeAcc]')), 'Progress → Your data has Close my account');
  await tom.click('[data-a=closeAcc]'); await tom.waitForSelector('#modal[open] #f_word');
  const mt = await tom.textContent('#modal');
  check(mt.includes('Close your account?') && mt.includes("It can't be undone") && mt.includes('download a backup first'), 'it says what goes, that it can’t be undone, and to download a backup first');
  await tom.fill('#f_word', 'delete it'); await tom.click('#modal button[type=submit]'); await tom.waitForTimeout(400);
  check((await tom.textContent('#modal .form-err')).includes('Type DELETE to confirm') && (await keys(tom, 'fdb:data/users/tom/')).length === 3, 'without DELETE typed, nothing happens');
  await tom.fill('#f_word', 'delete'); await tom.click('#modal button[type=submit]');
  await tom.waitForSelector('#authF', { timeout: 10000 }).catch(() => {}); await tom.waitForTimeout(500);
  check((await tom.textContent('#gate')).includes('Your account and everything on it were deleted.'), 'they land on the sign-in screen, which says the account was deleted');
  check(!(await keys(tom, 'fdb:data/users/tom/')).length && !(await keys(tom, 'fstore:books/')).length && !(await tom.evaluate(() => localStorage.getItem('fbackups:tom'))), 'the board, book PDFs and nightly copies are gone');
  check(!(await tom.evaluate(() => JSON.parse(localStorage.getItem('fplayers')).includes('tom') || !!JSON.parse(localStorage.getItem('fusers'))['tom@test'])), 'and the account');
  check((await keys(tom, 'fdb:data/users/coach/')).length === 2, "nobody else's records are touched");
  await tom.fill('#aEmail', 'tom@test'); await tom.fill('#aPass', 'longenough1'); await tom.click('#authF button[type=submit]'); await tom.waitForTimeout(800);
  check(!!(await tom.$('#authF')), "signing in with the old password doesn't work");
  // Dana, a parent, in Hebrew
  const dana = await open('dana'); await dana.waitForTimeout(2500);
  await dana.goto(URL + '#/progress'); await dana.waitForTimeout(1200);
  check((await dana.textContent('#view')).includes('סגירת החשבון'), 'in Hebrew');
  await dana.click('[data-a=closeAcc]'); await dana.waitForSelector('#modal[open] #f_word');
  check((await dana.textContent('#modal')).includes('הכניסות של הילדים מנותקות') && (await dana.textContent('#modal')).includes('לאישור, יש להקליד מחיקה'), "the parent is told the children's sign-ins are disconnected, and to type מחיקה");
  await dana.screenshot({ path: path.join(__dirname, 'out-close-he.png') });
  await dana.fill('#f_word', 'מחיקה'); await dana.click('#modal button[type=submit]'); await dana.waitForTimeout(2500);
  const pm = await dana.evaluate(() => JSON.parse(localStorage.getItem('fdb:portal/maya') || 'null'));
  check(pm && pm.linked === false && pm.unlinked === true && !(await keys(dana, 'fdb:data/users/dana/')).length, "Dana's board is gone and Maya's link is closed");
  const maya = await open('maya'); await maya.waitForTimeout(2500);
  check((await maya.textContent('#view')).includes('closed access'), "Maya's app says access was closed");
  // a coach's own app has no such button
  const c = await open('coach'); await c.goto(URL + '#/student/st-x/overview'); await c.waitForTimeout(1500);
  check(!(await c.$('[data-a=closeAcc]')), "a coach's app has no Close my account");
  check(!errors.length, 'no page errors ' + errors.join(' | '));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
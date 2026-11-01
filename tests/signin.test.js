// Signing in: the sign-in screen (app hidden until signed in, "What is Rank Up?"), a wrong password, creating an
// account (too short a password, an email already registered), resetting a password, a new account's "enter the
// code" screen, signing out (this device only), a lost session going back to the sign-in screen, a code already
// used by another account, and the old Netlify address sending people to the new one.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const { URL, t, stu, check, start, fillForm, FAKE_SUPA, done } = require('./lib.js');
const auth = async (p, email, pass, mode) => { await p.waitForSelector('#authF', { timeout: 8000 }); if (mode) { await p.click('[data-m=' + mode + ']'); await p.waitForSelector('#authF'); }
  await p.fill('#aEmail', email); if (await p.$('#aPass')) await p.fill('#aPass', pass); await p.click('#authF button[type=submit]'); await p.waitForTimeout(500); };
(async () => {
  const T = await start();
  await T.seed({ coach: 'coach', users: { 'raem@x.co': { id: 'coach', password: 'longenough1' }, 'maya@x.co': { id: 'u-a', password: 'mayapass99' } }, docs: {
    'data/users/coach/settings': { coachName: 'Raem', lang: 'en', usedCodes: [{ code: 'MAYA77', at: t }] },
    'data/users/coach/st-a': stu('st-a', 'Maya Cohen', { portal: { uid: 'u-a', linkedAt: t } }),
    'portal/u-a': { code: 'MAYA77', linked: true, role: 'student', coach: 'coach', linkedAt: t } } });
  const p = await T.open(null);
  await p.waitForSelector('#authF');
  check(await p.isVisible('#gate h1:has-text("Sign in")') && !(await p.isVisible('.app')), 'signed out: the sign-in screen, and the app hidden');
  check((await p.getAttribute('a:has-text("What is Rank Up?")', 'href') || '').includes('welcome'), '“What is Rank Up?” links to the public page');
  await auth(p, 'raem@x.co', 'wrongpass1');
  check((await p.textContent('#gate')).includes("That email and password don't match"), 'a wrong password says so');
  // create an account
  await auth(p, 'new@x.co', 'short', 'signup');
  check((await p.textContent('#gate')).includes('Use at least 8 characters'), 'too short a password: at least 8 characters');
  await p.fill('#aEmail', 'raem@x.co'); await p.fill('#aPass', 'longenough1'); await p.click('#authF button[type=submit]'); await p.waitForTimeout(500);
  check((await p.textContent('#gate')).includes("There's already an account with this email"), 'an email already registered says so');
  await p.fill('#aEmail', 'noa@x.co'); await p.fill('#aPass', 'noapass123'); await p.click('#authF button[type=submit]'); await p.waitForTimeout(2500);
  check(!!(await p.$('#linkCode')) && !!(await p.$('#beCoach')) && !!(await p.$('#bePlayer')), 'a new account: enter the code from your coach (or coach / player code)');
  // the code Maya already used
  const c = await T.open('coach'); await c.waitForTimeout(2500);
  await p.fill('#linkCode', 'MAYA77'); await p.click('#linkF button[type=submit]'); await p.waitForTimeout(5000); await p.reload(); await p.waitForTimeout(2500);
  check((await T.text(p, 'body')).includes('This code was already used'), 'a code already used by another account: “This code was already used”, with what to do');
  check((await T.doc(c, 'data/users/coach/st-a')).portal.uid === 'u-a', 'Maya keeps her connection');
  // forgot the password
  const f = await T.open(null); await auth(f, 'raem@x.co', '', 'forgot');
  check((await f.evaluate(() => window.__resetSent)) === 1 && /email|link/i.test(await f.textContent('#gate')), 'Reset the password sends an email');
  // sign in as the coach, then sign out
  const s = await T.open(null); await auth(s, 'raem@x.co', 'longenough1'); await s.waitForSelector('#view h1', { timeout: 8000 });
  check(!(await s.evaluate(() => document.body.classList.contains('student-mode'))), 'the coach signs in to the coach’s app');
  await s.goto(URL + '#/settings'); await s.waitForSelector('#view [data-signout]'); await s.click('#view [data-signout]'); await s.waitForSelector('#modal[open]');
  await s.click('#modal[open] button[type=submit]'); await s.waitForSelector('#authF', { timeout: 8000 });
  check(true, 'Sign out goes back to the sign-in screen');
  check((await s.evaluate(() => sessionStorage.getItem('fscope'))) === 'local', 'signing out signs out this device only');
  // a session lost while the app is open
  const l = await T.open('coach'); await l.waitForTimeout(2500);
  await l.evaluate(() => window.__killSession()); await l.waitForSelector('#authF', { timeout: 8000 }).catch(() => {});
  check(!!(await l.$('#authF')), 'a lost session goes back to the sign-in screen');
  await T.browser.close();
  // the old Netlify address
  const ROOT = path.resolve(__dirname, '..');
  // the old address, answered from the repository's files by the test browser itself
  const b2 = await chromium.launch(); const c2 = await b2.newContext();
  await c2.route('http://rankup-old.netlify.app/**', r => { const u = new globalThis.URL(r.request().url()); let f = path.join(ROOT, decodeURIComponent(u.pathname)); if (f.endsWith('/')) f += 'index.html';
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ status: 200, contentType: f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream', body: fs.readFileSync(f) }); });
  const p2 = await c2.newPage(); await p2.addInitScript(FAKE_SUPA(null)); await p2.goto('http://rankup-old.netlify.app/'); await p2.waitForTimeout(1500);
  const mv = await p2.textContent('body');
  check(mv.includes('Rank Up has moved') && (await p2.getAttribute('a:has-text("Open Rank Up")', 'href')) === 'https://reemshr1.github.io/Rank-Up-Chess/', 'the old address says Rank Up has moved, with the new link');
  await p2.click('#gOld'); await p2.waitForTimeout(800);
  check(!!(await p2.$('#authF')), '“Open the old version anyway” still lets the coach in');
  await b2.close();
  check(!T.errors.length, 'no page errors ' + T.errors.join(' | '));
  done();
})().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });

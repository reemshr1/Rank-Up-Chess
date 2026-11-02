// Live updates and empty accounts. With both apps open, what the coach changes shows on the student's screen without
// reloading, and what the student logs shows on the coach's; a brand-new coach (no students) and a student just
// linked (nothing on their board yet) get every page with an empty message, never "undefined", "NaN" or an error.
const { URL, t, addDays, stu, les, check, out, start, fillForm } = require('./lib.js');
const coachPages = ['#/dashboard', '#/students', '#/schedule', '#/club', '#/assignments', '#/payments', '#/settings'];
const studentPages = id => ['#/home', '#/student/' + id + '/assignments', '#/student/' + id + '/work', '#/student/' + id + '/fitness', '#/student/' + id + '/books',
  '#/student/' + id + '/tournaments', '#/student/' + id + '/games', '#/student/' + id + '/studied', '#/student/' + id + '/repertoire', '#/progress', '#/schedule', '#/payments'];
const junk = v => (v.match(/undefined|NaN|\[object Object\]|Invalid Date|null(?!\w)/g) || []);
(async () => {
  const T = await start();
  await T.seed({ coach: 'coach', coaches: ['newc'], docs: {
    'data/users/coach/settings': { coachName: 'Raem', currency: '₪', lang: 'en', weekStart: 0 },
    'data/users/coach/st-a': stu('st-a', 'Maya Cohen', { portal: { uid: 'u-a', linkedAt: t }, sessions: [les('l1', addDays(t, 2), '17:00', 'Rook endings')] }),
    'portal/u-a': { code: 'A1', linked: true, role: 'student', coach: 'coach', linkedAt: t },
    'data/users/coach/st-n': stu('st-n', 'Noa Bar', { portal: { uid: 'u-n', linkedAt: t } }),
    'portal/u-n': { code: 'N1', linked: true, role: 'student', coach: 'coach', linkedAt: t } } });
  const c = await T.open('coach', '#/student/st-a/sessions'); await c.waitForTimeout(3500);
  const m = await T.open('u-a', '#/home'); await m.waitForTimeout(3500);
  check((await T.text(m)).includes('17:00'), 'Maya sees her 17:00 lesson');
  // the coach moves the lesson: Maya's open Home changes by itself
  await c.click('[data-a=edit][data-id="l1"]'); await c.waitForSelector('#modal[open] #f_topics');
  await fillForm(c, { topics: 'Lucena and Philidor', time: '18:30' }); await c.keyboard.press('Escape');
  const seen = await T.eventually(async () => { const v = await T.text(m); return v.includes('18:30') && v.includes('Lucena and Philidor'); }, 12000);
  check(!!seen, 'the coach’s change reaches Maya’s open app without reloading');
  check(!(await T.text(m)).includes('17:00'), 'and the old time is gone');
  // Maya logs practice: the coach's open page shows it without reloading
  await c.goto(URL + '#/student/st-a/work'); await c.waitForTimeout(800);
  await m.click('[data-a=log]'); await m.waitForSelector('#modal[open] #f_minutes'); await fillForm(m, { minutes: '27', what: 'Openings' });
  const got = await T.eventually(async () => (await T.text(c)).includes('27 min'), 12000);
  check(!!got, 'what Maya logs shows on the coach’s open Practice page without reloading'); 
  check(!(await T.text(m)).includes('waiting for'), 'and her app has nothing waiting');
  // the moment a change leaves her outbox it is already in the coach's saved records (closing the coach's app then loses nothing)
  await m.click('[data-a=log]'); await m.waitForSelector('#modal[open] #f_minutes');
  const watching = c.evaluate(() => new Promise(done => { const t0 = Date.now(), inbox = () => Object.keys(localStorage).filter(k => k.startsWith('fdb:portal/u-a/inbox/'));
    const saved = () => Object.keys(localStorage).filter(k => /^fdb:data\/users\/coach\/(st-a|lg-st-a)/.test(k)).some(k => (JSON.parse(localStorage.getItem(k)).worklog || []).some(w => +w.minutes === 19));
    let seen = false; const tick = () => { const n = inbox().length; if (n) seen = true; if (seen && !n) return done(saved() ? 'saved' : 'NOT saved');
      if (Date.now() - t0 > 12000) return done(seen ? 'still in the inbox' : 'never in the inbox'); setTimeout(tick, 5); }; tick(); }));
  await fillForm(m, { minutes: '19', what: 'Openings' }); const atRemoval = await watching;
  check(atRemoval === 'saved', 'when her practice leaves the outbox, it is already in the coach’s saved records: ' + atRemoval);
  // a student just linked, nothing on the board yet
  const n = await T.open('u-n', '#/home'); await n.waitForTimeout(3500);
  let v = await T.text(n);
  check(/Good (morning|afternoon|evening), Noa/.test(v), 'Noa’s Home opens');
  check(!(await n.$('.medal-line .medal')) && !v.includes('practice streak'), 'no medal or streak before any practice');
  for (const pg of studentPages('st-n')) {
    await n.goto(URL + pg); await n.waitForTimeout(500); v = await T.text(n);
    check(v.trim().length > 20 && !junk(v).length, 'student, nothing yet: ' + pg + ' opens cleanly' + (junk(v).length ? ' (' + junk(v).join(', ') + ')' : ''));
  }
  // a brand-new coach with no students
  const z = await T.open('newc', '#/dashboard'); await z.waitForTimeout(3500);
  for (const pg of coachPages) {
    await z.goto(URL + pg); await z.waitForTimeout(500); v = await T.text(z);
    check(v.trim().length > 20 && !junk(v).length, 'new coach, no students: ' + pg + ' opens cleanly' + (junk(v).length ? ' (' + junk(v).join(', ') + ')' : ''));
  }
  await z.goto(URL + '#/students'); await z.waitForTimeout(500);
  check(/Set up your coaching board/.test(await T.text(z)) && !!(await z.$('text=Add a student')), 'Students: “Set up your coaching board”, with Add a student');
  check(!(await T.denied(z)).length && !(await T.denied(n)).length, 'nothing read or written that isn’t theirs');
  await n.screenshot({ path: out('student-empty'), fullPage: true });
  await T.finish();
})();

// The parent's app: a family with two children, picked at the top; "Maya's board" with the Balance (owed, overdue,
// how to pay, last payment, charges not made yet), I've paid (the coach confirms it), the Payments statement; read
// only (no logging practice, games or books; forms say "View only"), but lesson requests are allowed; no check-in.
const { URL, t, addDays, stu, les, check, out, start, fillForm } = require('./lib.js');
(async () => {
  const T = await start();
  await T.seed({ coach: 'coach', docs: {
    'data/users/coach/settings': { coachName: 'Raem', currency: '₪', defaultRate: 100, overdueDays: 30, lang: 'en', weekStart: 0, payInfo: 'Bit to 054-1234567',
      families: [{ id: 'fam-c', name: 'Cohen family', studentIds: ['st-a', 'st-b'], portal: { uid: 'u-par', linkedAt: t } }] },
    'data/users/coach/st-a': stu('st-a', 'Maya Cohen', { rate: 100, sessions: [les('l0', addDays(t, -40), '17:00', 'Pins', { status: 'done', fee: 100 }), les('l1', addDays(t, 3), '17:00', 'Rook endings')],
      payments: [{ id: 'p1', date: addDays(t, -20), amount: 50, method: 'Cash' }], worklog: [{ id: 'w1', date: addDays(t, -6), what: 'Tactics', minutes: 30, by: 'student' }],
      tournaments: [{ id: 'tr1', name: 'Haifa Open', start: addDays(t, 6), end: addDays(t, 7), assist: true, assistFee: 50 }] }),
    'data/users/coach/st-b': stu('st-b', 'Yoni Cohen', { sessions: [les('m1', addDays(t, 4), '18:00', 'Mating patterns')] }),
    'portal/u-par': { code: 'F1', linked: true, role: 'parent', coach: 'coach', linkedAt: t } } });
  const c = await T.open('coach'); await c.waitForTimeout(3500);
  const p = await T.open('u-par', '#/home'); await p.waitForTimeout(4000);
  let v = await T.text(p);
  const kids = await p.$$eval('#childPick option', xs => xs.map(x => x.textContent));
  check(kids.length === 2 && kids.some(k => /Maya/.test(k)) && kids.some(k => /Yoni/.test(k)), 'the parent picks between Maya and Yoni: ' + kids.join(', '));
  const first = /Maya/.test(await p.$eval('#childPick', s => s.options[s.selectedIndex].textContent)) ? 'Maya' : 'Yoni';
  if (first !== 'Maya') { await p.selectOption('#childPick', 'st-a'); await p.waitForTimeout(1500); v = await T.text(p); }
  check(v.includes('Maya’s board') && v.includes('Rook endings'), '“Maya’s board”, with her lesson');
  check(v.includes('Balance') && v.includes('50') && v.includes('Bit to 054-1234567'), 'Balance: ₪50 to pay, and how to pay');
  check(/overdue/i.test(v), 'overdue (the lesson was 40 days ago)');
  check(v.includes('Not charged yet') && v.includes('Haifa Open'), 'charges not made yet: the tournament assistance');
  check(v.includes('Last payment') && v.includes('Cash') || v.includes('Last payment'), 'the last payment');
  check(!v.includes('No practice logged for') && !(await p.$('.checkin')), 'no practice check-in for a parent');
  check(!(await p.isVisible('[data-a=log]')), 'no Log practice');
  // I've paid
  await p.click('#iPaid'); await p.waitForSelector('#modal[open] #f_amount');
  await fillForm(p, { amount: '50', method: (await p.$$eval('#f_method option', xs => xs.map(x => x.value)))[0] });
  check((await T.text(p)).includes('Payment sent'), 'I’ve paid: the balance shows the payment waiting for the coach');
  await c.reload(); await c.waitForTimeout(4000);
  const a = await T.eventually(async () => { const x = await T.student(c, 'coach', 'st-a'); return (x.payReports || []).length && x; });
  check(!!a && a.payReports[0].by === 'parent' && +a.payReports[0].amount === 50, 'the coach gets it, marked “by the parent”');
  await c.goto(URL + '#/dashboard'); await c.waitForTimeout(800);
  await c.click('[data-a=prOk]'); await c.waitForTimeout(3500);
  await p.reload(); await p.waitForTimeout(3500);
  if (/Yoni/.test(await p.$eval('#childPick', s => s.options[s.selectedIndex].textContent))) { await p.selectOption('#childPick', 'st-a'); await p.waitForTimeout(1500); }
  v = await T.text(p); check(v.includes('Paid up') || v.includes('in credit') || !v.includes('money-owed') && /₪0/.test(v), 'once confirmed, Maya’s balance is paid');
  // the statement
  await p.goto(URL + '#/payments'); await p.waitForTimeout(800);
  v = await T.text(p); check(v.includes('Statement') && v.includes('Pins') && v.includes('How to pay'), 'Payments: the statement and how to pay');
  // read only
  await p.goto(URL + '#/student/st-a/work'); await p.waitForTimeout(800);
  check(!(await p.isVisible('[data-a=addLog]')) && !(await p.isVisible('[data-un]')), 'Practice: read only (no logging, no usernames)');
  if (await p.$('[data-a=addLog]')) { await p.$eval('[data-a=addLog]', b => b.click()); await p.waitForTimeout(300);
    check((await p.textContent('#toast')).includes('View only') && !(await p.evaluate(() => document.querySelector('#modal').open)), 'pressed anyway, it says View only and opens nothing'); }
  await p.goto(URL + '#/student/st-a/games'); await p.waitForTimeout(800);
  check(!(await p.isVisible('[data-a=addGame]')) && !(await p.isVisible('label[for=gImport]')), 'Games: read only (no Add game, no Import PGN)');
  await p.goto(URL + '#/student/st-a/studied'); await p.waitForTimeout(800);
  check(!(await p.isVisible('[data-a=addS]')) && !(await p.isVisible('label[for=sImport]')), 'Model games: read only (no Import PGN)');
  await p.goto(URL + '#/student/st-a/books'); await p.waitForTimeout(800);
  check(!(await p.isVisible('[data-a=add]')), 'Books: read only');
  // but a lesson request is allowed
  await p.goto(URL + '#/home'); await p.waitForTimeout(800);
  await p.click('[data-a=req]'); await p.waitForSelector('#modal[open] #f_date');
  await fillForm(p, { date: addDays(t, 9), time: '16:00', note: 'For Maya' });
  check((await p.textContent('#toast')).includes('Request sent'), 'the parent can ask for a lesson');
  await c.reload(); await c.waitForTimeout(4000);
  check(!!(await T.eventually(async () => ((await T.student(c, 'coach', 'st-a')).requests || []).some(r => r.note === 'For Maya'))), 'it reaches the coach for Maya');
  // Yoni
  await p.selectOption('#childPick', 'st-b'); await p.waitForTimeout(1500);
  v = await T.text(p); check(v.includes('Yoni’s board') && v.includes('Mating patterns') && !v.includes('Rook endings'), 'switching to Yoni shows his board only');
  await p.screenshot({ path: out('parent'), fullPage: true });
  await T.finish();
})();

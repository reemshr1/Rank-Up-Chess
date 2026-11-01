// Payments: a student's ledger (lessons done charged, extra charges, payments with a running balance), a payment
// for a given lesson ("Paid" on that lesson) and one that counts toward the oldest lessons, editing a payment,
// the reminder message, overdue days; showing payments in the student's app (and hiding them again); the
// Payments page: outstanding, balances, income by month, recent payments and the CSV downloads.
const { URL, t, addDays, stu, les, check, out, start, fillForm } = require('./lib.js');
const fs = require('fs');
(async () => {
  const T = await start();
  await T.seed({ coach: 'coach', docs: {
    'data/users/coach/settings': { coachName: 'Raem', currency: '₪', defaultRate: 100, overdueDays: 30, lang: 'en', weekStart: 0, payInfo: 'Bit to 054-1234567' },
    'data/users/coach/st-a': stu('st-a', 'Maya Cohen', { rate: 100, contact: '0541112222', portal: { uid: 'u-a', linkedAt: addDays(t, -50) },
      sessions: [les('l1', addDays(t, -45), '17:00', 'Pins', { status: 'done', fee: 100 }), les('l2', addDays(t, -20), '17:00', 'Forks', { status: 'done', fee: 100 }),
        les('l3', addDays(t, -6), '17:00', 'Mates', { status: 'done', fee: 100 }), les('l4', addDays(t, 2), '17:00', 'Next')] }),
    'portal/u-a': { code: 'AAA234', linked: true, role: 'student', coach: 'coach', linkedAt: addDays(t, -50) },
    'data/users/coach/st-b': stu('st-b', 'Yoni Levi', { rate: 150, sessions: [les('m1', addDays(t, -3), '18:00', 'X', { status: 'done', fee: 150 })], payments: [{ id: 'p0', date: addDays(t, -2), amount: 150, method: 'Cash' }] }) } });
  const c = await T.open('coach', '#/student/st-a/payments'); await c.waitForTimeout(3000);
  let v = await T.text(c);
  check(v.includes('300') && /Oldest unpaid charge is from .* — 45 days ago/.test(v), 'three lessons done: ₪300 owed, the oldest overdue (over 30 days)');
  // a payment for the newest lesson
  await c.click('[data-a=pay]'); await c.waitForSelector('#modal[open] #f_amount');
  const opts = await c.$$eval('#f_sessionId option', xs => xs.map(x => x.value + '=' + x.textContent));
  check(opts.some(o => o.startsWith('l3=')), 'a payment can be for a given lesson');
  await fillForm(c, { amount: '100', method: 'Bit / PayBox', sessionId: 'l3' });
  let a = await T.eventually(async () => { const x = await T.student(c, 'coach', 'st-a'); return x.payments.length === 1 && x; }) || await T.student(c, 'coach', 'st-a');
  check(a.payments.length === 1 && a.payments[0].sessionId === 'l3', 'paid for the 6-days-ago lesson');
  await c.goto(URL + '#/student/st-a/sessions'); await c.waitForTimeout(600);
  const paidRow = await c.$$eval('li', xs => xs.filter(x => /Mates/.test(x.textContent)).map(x => x.textContent).join(' '));
  check(/Paid/.test(paidRow), 'that lesson shows Paid');
  // a payment for no lesson counts toward the oldest
  await c.goto(URL + '#/student/st-a/payments'); await c.waitForTimeout(500);
  await c.click('[data-a=pay]'); await c.waitForSelector('#modal[open] #f_amount'); await fillForm(c, { amount: '100' });
  await c.goto(URL + '#/student/st-a/sessions'); await c.waitForTimeout(600);
  const pins = await c.$$eval('li', xs => xs.filter(x => /Pins/.test(x.textContent)).map(x => x.textContent).join(' '));
  const forks = await c.$$eval('li', xs => xs.filter(x => /Forks/.test(x.textContent)).map(x => x.textContent).join(' '));
  check(/Paid/.test(pins) && !/Paid/.test(forks), 'a payment for no lesson pays the oldest one first (Pins, not Forks)');
  // an extra charge
  await c.goto(URL + '#/student/st-a/payments'); await c.waitForTimeout(500);
  await c.click('[data-a=charge]'); await c.waitForSelector('#modal[open] #f_amount');
  await fillForm(c, { amount: '40', note: 'Book: My System' });
  v = await T.text(c);
  check(v.includes('Book: My System') && v.includes('140'), 'an extra charge: the balance is ₪140 (Forks ₪100 + ₪40)');
  // edit a payment
  a = await T.student(c, 'coach', 'st-a'); const loose = a.payments.find(p => !p.sessionId);
  await c.click('[data-a=editPay][data-id="' + loose.id + '"]'); await c.waitForSelector('#modal[open] #f_amount');
  await fillForm(c, { amount: '120' });
  a = await T.eventually(async () => { const x = await T.student(c, 'coach', 'st-a'); return +x.payments.find(p => p.id === loose.id).amount === 120 && x; }) || await T.student(c, 'coach', 'st-a'); check(+a.payments.find(p => p.id === loose.id).amount === 120, 'a payment can be edited');
  v = await T.text(c); check(v.includes('120'), 'and the balance follows: ₪120');
  // reminder
  await c.click('[data-a=remind]'); await c.waitForTimeout(600);
  const rem = await c.inputValue('#msgTxt'); check(rem.includes('120') && rem.includes('Bit to 054-1234567'), 'the reminder has the balance and how to pay');
  await c.keyboard.press('Escape');
  // show payments in the student's app
  await c.click('[data-a=payShow]'); await c.waitForTimeout(600);
  a = await T.student(c, 'coach', 'st-a'); check(a.pay === true || a.payShared === true || !!a.showPay, 'Show payments in Maya’s app');
  const m = await T.open('u-a', '#/home'); await m.waitForTimeout(4000);
  check((await T.text(m, '#nav')).includes('Payments'), 'Maya’s app gets a Payments tab');
  await m.goto(URL + '#/payments'); await m.waitForTimeout(800);
  v = await T.text(m); check(v.includes('120') && v.includes('Bit to 054-1234567') && v.includes('Statement'), 'with her balance, how to pay and the statement');
  await c.click('[data-a=payHide]'); await c.waitForTimeout(3000); await m.reload(); await m.waitForTimeout(3000);
  check(!(await T.text(m, '#nav')).includes('Payments'), 'Hide takes the tab away again');
  // the Payments page
  await c.goto(URL + '#/payments'); await c.waitForTimeout(800);
  v = await T.text(c);
  check(v.includes('Outstanding') && v.includes('Maya Cohen') && v.includes('Yoni Levi') && v.includes('Received this month'), 'Payments: outstanding, balances per student, received this month');
  check(v.includes('Income') && v.includes('Recent payments'), 'income by month and recent payments');
  const [dl] = await Promise.all([c.waitForEvent('download'), c.click('text=/CSV|Download/ >> nth=0')]);
  const csv = fs.readFileSync(await dl.path(), 'utf8');
  check(/\.csv$/.test(dl.suggestedFilename()) && csv.split('\n').length >= 2, 'a CSV download: ' + dl.suggestedFilename());
  await c.screenshot({ path: out('payments'), fullPage: true });
  await T.finish();
})();

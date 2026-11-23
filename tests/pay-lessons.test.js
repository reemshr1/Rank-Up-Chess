// A parent pays for several lessons at once: "I've paid" lists the unpaid lessons with a tick box each; the amount adds
// itself up (and none ticked is towards the balance); the ticked lessons wait for the coach and can't be reported
// twice; the coach sees "for the lessons on …" and Confirm records one payment per lesson, oldest first, with anything
// more towards the balance; the parent then sees each lesson Paid.
const { URL, t, addDays, stu, les, check, out, start, fillForm } = require('./lib.js');
const done = (id, d, fee) => les(id, addDays(t, d), '17:00', 'Lesson ' + id, { status: 'done', fee });
(async () => {
  const T = await start();
  await T.seed({ coach: 'coach', docs: {
    'data/users/coach/settings': { coachName: 'Raem', currency: '₪', defaultRate: 100, lang: 'en', weekStart: 0,
      families: [{ id: 'fam', name: 'Cohen family', studentIds: ['st-a', 'st-b'], portal: { uid: 'u-par', linkedAt: t } }] },
    'data/users/coach/st-a': stu('st-a', 'Maya Cohen', { rate: 100, sessions: [done('a1', -21, 100), done('a2', -14, 120), done('a3', -7, 100), les('a4', addDays(t, 5), '17:00', 'Next')] }),
    'data/users/coach/st-b': stu('st-b', 'Yoni Cohen', { rate: 100, sessions: [done('b1', -14, 100), done('b2', -7, 100)] }),
    'portal/u-par': { code: 'F1', linked: true, role: 'parent', coach: 'coach', linkedAt: t } } });
  const c = await T.open('coach'); await c.waitForTimeout(3500);
  const p = await T.open('u-par', '#/home'); await p.waitForTimeout(3500);
  if (!/Maya/.test(await p.$eval('#childPick', s => s.options[s.selectedIndex].textContent))) { await p.selectOption('#childPick', 'st-a'); await p.waitForTimeout(1200); }
  await p.click('#iPaid'); await p.waitForSelector('#modal[open] [data-checks=sessionIds]');
  const boxes = await p.$$eval('#modal[open] [data-checks=sessionIds] input', xs => xs.map(x => [x.value, x.checked]));
  check(boxes.map(b => b[0]).sort().join() === 'a1,a2,a3,a4', 'I’ve paid lists Maya’s unpaid lessons, each with a tick box (and the upcoming one)');
  check(boxes.filter(b => b[1]).length === 1 && (await p.inputValue('#modal[open] #f_amount')) === '100', 'one lesson ticked to start, with its price');
  const tick = async (id, on) => { const sel = '#modal[open] [data-checks=sessionIds] input[value="' + id + '"]'; if (on) await p.check(sel); else await p.uncheck(sel); await p.waitForTimeout(100); };
  for (const id of ['a1', 'a2', 'a3']) await tick(id, true);
  check((await p.inputValue('#modal[open] #f_amount')) === '320', 'three lessons ticked: the amount adds up to ₪320');
  for (const id of ['a1', 'a2', 'a3']) await tick(id, false);
  check((await p.inputValue('#modal[open] #f_amount')) === '320', 'none ticked: the whole balance (₪320)');
  for (const id of ['a1', 'a2', 'a3']) await tick(id, true);
  await fillForm(p, { note: 'Three lessons' }); await p.waitForTimeout(400);
  if (await p.$('#psOk')) await p.click('#psOk');
  // waiting for the coach, lesson by lesson
  await p.goto(URL + '#/payments'); await p.waitForTimeout(800);
  let v = await T.text(p);
  check((v.match(/Waiting for Raem/g) || []).length >= 3 && v.includes('3 lessons'), 'each of the three lessons shows Waiting for Raem; the report says 3 lessons');
  check((await p.textContent('#iPaid')).includes('Report another payment'), 'and Payments offers “Report another payment”');
  await p.click('#iPaid'); await p.waitForSelector('#modal[open] #f_amount');
  check(JSON.stringify(await p.$$eval('#modal[open] [data-checks=sessionIds] input', xs => xs.map(x => x.value))) === '["a4"]', 'reporting again: the three waiting lessons aren’t offered a second time');
  await p.keyboard.press('Escape');
  // the coach
  await c.reload(); await c.waitForTimeout(4000);
  const a = await T.eventually(async () => { const x = await T.student(c, 'coach', 'st-a'); return (x.payReports || []).length && x; });
  check(!!a && a.payReports[0].sessionIds.slice().sort().join() === 'a1,a2,a3' && +a.payReports[0].amount === 320, 'the coach gets one report for the three lessons');
  await c.goto(URL + '#/dashboard'); await c.waitForTimeout(800);
  v = await T.text(c);
  check(v.includes('for the lessons on') && v.includes('₪320') && !v.includes('Possible duplicate'), 'Today: “for the lessons on …”, ₪320');
  await c.click('[data-a=prOk]'); await c.waitForTimeout(1500);
  let s = await T.student(c, 'coach', 'st-a');
  const pays = s.payments.map(x => x.sessionId + ':' + x.amount).sort().join();
  check(pays === 'a1:100,a2:120,a3:100', 'Confirm records one payment per lesson: ' + pays);
  check(s.payReports[0].status === 'confirmed' && s.payReports[0].paymentIds.length === 3, 'the report is confirmed, with its three payments');
  await c.goto(URL + '#/student/st-a/payments'); await c.waitForTimeout(800);
  check((await T.text(c)).includes('for the lesson on'), 'the coach’s ledger shows each payment for its lesson');
  await p.waitForTimeout(2500); await p.goto(URL + '#/payments'); await p.reload(); await p.waitForTimeout(3500);
  if (!/Maya/.test(await p.$eval('#childPick', x => x.options[x.selectedIndex].textContent))) { await p.selectOption('#childPick', 'st-a'); await p.waitForTimeout(1200); }
  v = await T.text(p);
  check((v.match(/\bPaid\b/g) || []).length >= 3 && !v.includes('Waiting for Raem'), 'the parent sees the three lessons Paid');
  // paying more than the ticked lessons: the rest towards the balance
  await p.goto(URL + '#/home'); await p.waitForTimeout(500);
  await p.selectOption('#childPick', 'st-b'); await p.waitForTimeout(1500);
  await p.click('#iPaid'); await p.waitForSelector('#modal[open] [data-checks=sessionIds]');
  await tick('b1', true); await tick('b2', true);
  await fillForm(p, { amount: '250' }); await p.waitForTimeout(400); if (await p.$('#psOk')) await p.click('#psOk');
  await c.reload(); await c.waitForTimeout(4000);
  await T.eventually(async () => ((await T.student(c, 'coach', 'st-b')).payReports || []).length);
  await c.goto(URL + '#/dashboard'); await c.waitForTimeout(800); await c.click('[data-a=prOk]'); await c.waitForTimeout(1500);
  s = await T.student(c, 'coach', 'st-b');
  const pb = s.payments.map(x => (x.sessionId || 'balance') + ':' + x.amount).sort().join();
  check(pb === 'b1:100,b2:100,balance:50', 'paying ₪250 for two ₪100 lessons: one payment each, and ₪50 towards the balance (' + pb + ')');
  check(!(await T.denied(c)).length && !(await T.denied(p)).length, 'nobody tried to read or write what isn’t theirs');
  await c.screenshot({ path: out('pay-lessons'), fullPage: true });
  await T.finish();
})();

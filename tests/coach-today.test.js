// The coach's Today page: tiles, lesson requests (approve, decline, cancel, move), payments reported in the app,
// Needs attention (a past lesson to mark done, nothing planned, no practice) and the lists below.
const { t, addDays, stu, les, check, out, start, fillForm } = require('./lib.js');
(async () => {
  const T = await start();
  await T.seed({ coach: 'coach', docs: {
    'data/users/coach/settings': { coachName: 'Raem', currency: '₪', defaultRate: 100, overdueDays: 30, weekStart: 0, lang: 'en', lastBackup: t },
    'data/users/coach/st-a': stu('st-a', 'Maya Cohen', { rate: 120, contact: 'maya@x.co',
      sessions: [les('l-past', addDays(t, -1), '17:00', 'Pins'), les('l-next', addDays(t, 3), '18:00', 'Rook endings'), les('l-old', addDays(t, -10), '17:00', 'Forks', { status: 'done', fee: 120 })],
      requests: [{ id: 'r1', date: addDays(t, 5), time: '16:00', duration: 60, format: 'Online', note: 'Sicilian please', status: 'pending', at: t },
        { id: 'r2', kind: 'cancel', sessionId: 'l-next', was: { date: addDays(t, 3), time: '18:00' }, status: 'pending', at: t }],
      payReports: [{ id: 'pr1', date: t, amount: 120, method: 'Bit', by: 'parent', status: 'pending' }],
      tournaments: [{ id: 'tr1', name: 'Haifa Open', start: addDays(t, 6), end: addDays(t, 8) }],
      worklog: [{ id: 'w1', date: addDays(t, -5), what: 'Tactics', minutes: 30, by: 'student' }], portal: { uid: 'u-a', linkedAt: addDays(t, -30) } }),
    'data/users/coach/st-b': stu('st-b', 'Yoni Levi', { tournaments: [{ id: 'tr2', name: 'Haifa Open', start: addDays(t, 6), end: addDays(t, 8) }] }),
    'data/users/coach/as-1': { id: 'as-1', studentId: 'st-b', title: 'Lucena', type: 'Endgames', status: 'Assigned', due: addDays(t, 2), assigned: t, games: [] } } });
  const c = await T.open('coach'); await c.waitForTimeout(3000);
  let v = await T.text(c);
  check(/Good (morning|afternoon|evening), Raem/.test(v), 'greets the coach by name');
  check(v.includes('Active students') && /^\s*2\s*Active/.test(await c.textContent('.stats-top .stat')), 'tile: 2 active students');
  check(v.includes('Sessions this week') && v.includes('Outstanding') && v.includes('Received this month'), 'the four tiles');
  check(v.includes('Lesson requests (2)') && v.includes('Sicilian please'), 'two lesson requests wait');
  check(v.includes('Payments reported in the app') || v.includes('reported'), 'the payment the parent reported is listed');
  check(v.includes('Needs attention') && v.includes('Yoni Levi'), 'Needs attention lists Yoni (nothing planned)');
  check(v.includes('Haifa Open') && v.includes('Tournaments ahead'), 'Tournaments ahead, Maya and Yoni grouped in one Haifa Open');
  check((v.match(/Haifa Open/g) || []).length === 1, 'the tournament once, for both students');
  check(v.includes('Assignments due') && v.includes('Lucena'), 'assignment due within 3 days');
  await c.screenshot({ path: out('today'), fullPage: true });
  // approve the new lesson
  await c.click('[data-a=approve][data-id="st-a|r1"]'); await c.waitForSelector('#modal[open] #f_date');
  check((await c.inputValue('#f_topics')) === 'Sicilian please' && (await c.inputValue('#f_format')) === 'Online', 'the approve form starts from the request');
  await fillForm(c, {}); await c.waitForTimeout(500);
  check(/added|Lesson/.test(await c.textContent('#modal[open]').catch(() => '')), 'then a message to send the student about it');
  await c.keyboard.press('Escape'); await c.waitForTimeout(300);
  let a = await T.doc(c, 'data/users/coach/st-a');
  const r1 = a.requests.find(x => x.id === 'r1'), made = a.sessions.find(x => x.id === r1.sessionId);
  check(r1.status === 'approved' && made && made.date === addDays(t, 5) && made.time === '16:00' && made.format === 'Online' && made.fee === 120, 'approving adds the lesson at the asked time, with Maya’s fee');
  // the cancellation
  await c.click('[data-a=approve][data-id="st-a|r2"]'); await c.waitForSelector('#modal[open] button[type=submit]'); await c.click('#modal[open] button[type=submit]'); await c.waitForTimeout(500);
  await c.keyboard.press('Escape'); await c.waitForTimeout(300);
  a = await T.doc(c, 'data/users/coach/st-a');
  check(a.sessions.find(x => x.id === 'l-next').status === 'cancelled' && a.requests.find(x => x.id === 'r2').status === 'approved', 'approving the cancellation cancels the lesson');
  check(!(await T.text(c)).includes('Lesson requests'), 'no requests left');
  // the reported payment
  await c.click('[data-a=prOk][data-id="st-a|pr1"]'); await c.waitForTimeout(500);
  a = await T.doc(c, 'data/users/coach/st-a');
  check(a.payments.some(p => p.amount === 120 && /parent/.test(p.note)) && a.payReports[0].status === 'confirmed', 'confirming the report records the payment');
  // mark the past lesson done
  await c.click('[data-a=done][data-id="st-a|l-past"]'); await c.waitForSelector('#modal[open] #f_fee');
  check((await c.inputValue('#f_fee')) === '120', 'the fee is Maya’s');
  await fillForm(c, { topics: 'Pins and skewers', notes: 'Good', shareNotes: '1' });
  a = await T.doc(c, 'data/users/coach/st-a'); const lp = a.sessions.find(x => x.id === 'l-past');
  check(lp.status === 'done' && lp.fee === '120' || lp.fee === 120, 'marked done with the fee: ' + JSON.stringify(lp));
  check(lp.topics === 'Pins and skewers' && lp.shareNotes === true, 'topics and shared notes saved');
  check((await c.textContent('#toast')).includes('added to Maya’s balance'), 'the toast says the fee went to the balance');
  // decline: a move request
  await c.evaluate(t => { const k = 'fdb:data/users/coach/st-a', s = JSON.parse(localStorage.getItem(k));
    s.sessions.push({ id: 'l-mv', date: t, time: '20:00', duration: 60, format: 'In person', status: 'planned' });
    s.requests.push({ id: 'r3', kind: 'move', sessionId: 'l-mv', date: t, time: '21:00', was: { date: t, time: '20:00' }, status: 'pending', at: t }); localStorage.setItem(k, JSON.stringify(s)); }, addDays(t, 4));
  await c.reload(); await c.waitForTimeout(2500);
  await c.click('[data-a=decline][data-id="st-a|r3"]'); await c.waitForSelector('#modal[open] #f_note');
  await fillForm(c, { note: 'How about Sunday?' }); await c.keyboard.press('Escape'); await c.waitForTimeout(300);
  a = await T.doc(c, 'data/users/coach/st-a'); const r3 = a.requests.find(x => x.id === 'r3');
  check(r3.status === 'declined' && r3.needsAnswer && r3.reply === 'How about Sunday?', 'declining a move asks the student to answer, with the coach’s note');
  check((await T.text(c)).includes('Answers to declined moves') && (await T.text(c)).includes('waiting for their answer'), 'Today follows the answer');
  // the nudge message
  await c.click('[data-a=nudge][data-id="st-a"]').catch(() => {}); await c.waitForTimeout(500);
  const nm = (await c.textContent('#modal').catch(() => '')) + ' ' + (await c.inputValue('#msgTxt').catch(() => ''));
  check(/Nudge — Maya Cohen/.test(nm) && /no practice has been logged for \d+ days/.test(nm), 'Nudge prepares a message about the days without practice');
  await T.finish();
})();

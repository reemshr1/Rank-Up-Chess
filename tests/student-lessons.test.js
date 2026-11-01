// The student and their lessons: Request a lesson inside the coach's free time (club class hours and times booked by
// other students are left out; a time at two places offers both), the coach approving it, "Can't make it?" on a lesson
// (cancel, move, switch to online), the coach declining a move and the student answering (keep / cancel / another
// time), withdrawing a request, and planning their own training (which the coach sees).
const { URL, t, addDays, weekday, stu, les, check, out, start, fillForm } = require('./lib.js');
(async () => {
  const T = await start();
  const D = addDays(t, 3), dow = weekday(D);
  await T.seed({ coach: 'coach', docs: {
    'data/users/coach/settings': { coachName: 'Raem', currency: '₪', defaultRate: 100, lang: 'en', weekStart: 0,
      free: [{ id: 'fr1', kind: 'weekly', weekday: dow, from: '15:00', to: '19:00', start: t, end: '', place: 'At home', place2: 'Online' }],
      club: [{ id: 'cl1', name: 'Diamond Class', kind: 'weekly', weekday: dow, from: '15:00', to: '16:00', place: 'Haifa club', start: addDays(t, -30), end: '' }] },
    'data/users/coach/st-a': stu('st-a', 'Maya Cohen', { portal: { uid: 'u-a', linkedAt: t }, sessions: [les('l1', addDays(t, 5), '17:00', 'Rook endings')] }),
    'data/users/coach/st-b': stu('st-b', 'Yoni Levi', { sessions: [les('y1', D, '18:00', 'Booked')] }),
    'portal/u-a': { code: 'A1', linked: true, role: 'student', coach: 'coach', linkedAt: t } } });
  const c = await T.open('coach'); await c.waitForTimeout(3500);
  const m = await T.open('u-a', '#/home'); await m.waitForTimeout(3500);
  const coachSees = async (fn, label) => { await c.reload(); await c.waitForTimeout(3500); const a = await T.eventually(async () => { const x = await T.student(c, 'coach', 'st-a'); return fn(x) && x; }); return check(!!a, label); };
  // request a lesson: only 16:00 or 17:00 for an hour (15–16 is the club class, 18–19 is Yoni's)
  await m.click('[data-a=req]'); await m.waitForSelector('#modal[open] #f_date');
  const dates = await m.$$eval('#f_date option', xs => xs.map(x => x.value));
  check(dates.includes(D), 'the day with free time is offered: ' + dates.slice(0, 3).join(', '));
  await m.selectOption('#f_date', D); await m.waitForTimeout(200);
  const times = await m.$$eval('#f_time option', xs => xs.map(x => x.textContent));
  check(times.some(x => /^16:00 · At home/.test(x)) && times.some(x => /^17:00 · Online/.test(x)), 'start times with their places, both places offered: ' + times.join(' | '));
  check(!times.some(x => /^15:/.test(x)) && !times.some(x => /^18:/.test(x)), 'the club class hour and Yoni’s booked hour are left out');
  check(!(await m.isVisible('#f_format')), 'a time with a place has no in person / online choice');
  const online17 = await m.$$eval('#f_time option', xs => (xs.find(x => /^17:00 · Online/.test(x.textContent)) || {}).value);
  await m.selectOption('#f_time', online17); await fillForm(m, { note: 'Sicilian please' });
  check((await m.textContent('#toast')).includes('Request sent'), 'Request sent to your coach');
  check((await T.text(m)).includes('Lesson request'), 'Home shows the request waiting');
  await coachSees(a => (a.requests || []).some(r => r.date === D && r.time === '17:00' && r.format === 'Online' && r.status === 'pending' && r.note === 'Sicilian please'), 'the request reaches the coach: 17:00, online, with the note');
  // the coach approves
  const rid = (await T.student(c, 'coach', 'st-a')).requests[0].id;
  await c.goto(URL + '#/dashboard'); await c.waitForTimeout(800);
  await c.click('[data-a=approve][data-id="st-a|' + rid + '"]'); await c.waitForSelector('#modal[open] #f_date'); await fillForm(c, {}); await c.keyboard.press('Escape'); await c.waitForTimeout(3000);
  await m.reload(); await m.waitForTimeout(3000);
  let mv = await T.text(m);
  check(mv.includes('approved') || mv.includes('Approved'), 'Maya sees her lesson approved');
  // Can't make it? — move the 17:00 lesson in 5 days
  await m.click('[data-a=les][data-id=l1]'); await m.waitForSelector('#modal[open] #f_what');
  await m.selectOption('#f_what', 'move'); await m.waitForTimeout(200);
  await m.selectOption('#f_date', D).catch(() => {}); await m.waitForTimeout(200);
  const mt = await m.$$eval('#f_time option', xs => (xs.find(x => /^16:00/.test(x.textContent)) || {}).value).catch(() => null);
  if (mt) await m.selectOption('#f_time', mt);
  await m.click('#modal[open] button[type=submit]'); await m.waitForTimeout(800);
  check((await T.text(m)).includes('Move request') || (await T.text(m)).includes('New time asked') || /move/i.test(await m.textContent('#toast')), 'a move request is sent');
  await coachSees(a => (a.requests || []).some(r => r.kind === 'move' && r.sessionId === 'l1' && r.status === 'pending'), 'the coach gets the move request for that lesson');
  // the coach can't: Maya keeps the lesson
  const mr = (await T.student(c, 'coach', 'st-a')).requests.find(r => r.kind === 'move');
  await c.goto(URL + '#/dashboard'); await c.waitForTimeout(800);
  await c.click('[data-a=decline][data-id="st-a|' + mr.id + '"]'); await c.waitForSelector('#modal[open] #f_note'); await fillForm(c, { note: 'Sorry, busy then.' }); await c.keyboard.press('Escape'); await c.waitForTimeout(3000);
  await m.reload(); await m.waitForTimeout(3000);
  mv = await T.text(m);
  check(mv.includes('Answer needed') || mv.includes('choose what to do'), 'Maya is asked what to do: keep, cancel or another time');
  check(!!(await m.$('[data-a=ans][data-id="' + mr.id + '|keep"]')) && !!(await m.$('[data-a=ans][data-id="' + mr.id + '|cancel"]')), 'with Keep and Cancel buttons');
  await m.click('[data-a=ans][data-id="' + mr.id + '|keep"]'); await m.waitForTimeout(500);
  if (await m.$('#modal[open] button[type=submit]')) { await m.click('#modal[open] button[type=submit]'); await m.waitForTimeout(500); }
  await coachSees(a => (a.requests || []).some(r => r.id === mr.id && r.answer === 'keep' && !r.needsAnswer), 'her answer reaches the coach: she keeps the lesson');
  // ask to switch it to online, then withdraw
  await m.click('[data-a=les][data-id=l1]'); await m.waitForSelector('#modal[open] #f_what');
  await m.selectOption('#f_what', 'switch'); await m.click('#modal[open] button[type=submit]'); await m.waitForTimeout(800);
  await m.click('[data-a=les][data-id=l1]'); await m.waitForSelector('#modal[open] button[type=submit]');
  check((await m.textContent('#modal')).includes('Withdraw your request?'), 'a lesson with a request waiting offers to withdraw it');
  await m.click('#modal[open] button[type=submit]'); await m.waitForTimeout(800);
  await coachSees(a => !(a.requests || []).some(r => r.kind === 'move' && r.status === 'pending' && r.id !== mr.id), 'withdrawn: nothing waits for the coach');
  // plan own training
  await m.goto(URL + '#/schedule'); await m.waitForTimeout(800);
  await m.click('[data-a=train]').catch(async () => { await m.click('text=Plan training'); }); await m.waitForSelector('#modal[open] #f_date');
  await fillForm(m, { date: addDays(t, 1), time: '18:00', duration: '45', note: 'Lucena and Philidor' });
  check((await T.text(m)).includes('Lucena and Philidor') || (await T.text(m)).includes('18:00'), 'her own training is on her schedule');
  await coachSees(a => (a.training || []).some(x => x.date === addDays(t, 1) && x.time === '18:00'), 'the coach gets her training plan');
  await c.goto(URL + '#/student/st-a/sessions'); await c.waitForTimeout(800);
  check((await T.text(c)).includes('Lucena and Philidor') || /training/i.test(await T.text(c)), 'and sees it on her Lessons tab');
  await m.screenshot({ path: out('student-lessons'), fullPage: true });
  await T.finish();
})();

// Schedule and Club classes: the week with lessons, club classes, tournaments and due dates; a lesson on a
// tournament day is flagged, and "Mark as handled" stops it (and Undo); moving a lesson (asking the student to
// confirm, or straight away); free time with a place, and a second place; club classes (add, Hebrew name,
// change one date's time, cancel one date), the group and its challenge, attendance (one tap, everyone's here,
// the month table) and club hours and pay.
const { URL, t, addDays, weekday, stu, les, check, out, start, fillForm } = require('./lib.js');
(async () => {
  const T = await start();
  const d2 = addDays(t, 2);
  await T.seed({ coach: 'coach', docs: {
    'data/users/coach/settings': { coachName: 'Raem', currency: '₪', defaultRate: 100, lang: 'en', weekStart: 0 },
    'data/users/coach/st-a': stu('st-a', 'Maya Cohen', { portal: { uid: 'u-a', linkedAt: t },
      sessions: [les('l1', d2, '17:00', 'Rook endings'), les('l0', addDays(t, -2), '17:00', 'Pins')],
      tournaments: [{ id: 'tr1', name: 'Haifa Open', start: d2, end: d2 }] }),
    'portal/u-a': { code: 'AAA234', linked: true, role: 'student', coach: 'coach', linkedAt: t },
    'data/users/coach/st-b': stu('st-b', 'Yoni Levi', { fullHe: 'יוני לוי' }), 'data/users/coach/st-c': stu('st-c', 'Dana Bar'),
    'data/users/coach/as-1': { id: 'as-1', studentId: 'st-a', title: 'Lucena', type: 'Endgames', status: 'Assigned', due: addDays(t, 1), assigned: t, games: [] } } });
  const c = await T.open('coach', '#/schedule'); await c.waitForTimeout(3000);
  let v = await T.text(c);
  check(v.includes('Maya') && v.includes('Haifa Open') && v.includes('Lucena'), 'the week: a lesson, a tournament and a due date');
  check(/Past sessions still marked as planned/.test(v) || v.includes('Pins'), 'the past lesson still planned is listed to mark done');
  check(/clash|tournament day|same day/i.test(v), 'the lesson on the tournament day is flagged');
  // mark the clash as handled, then undo
  await c.click('[data-a=tourOk]'); await c.waitForTimeout(500);
  let a = await T.student(c, 'coach', 'st-a');
  check(a.sessions.find(x => x.id === 'l1').tourOk || a.sessions.find(x => x.id === 'l1').clashOk || JSON.stringify(a).includes('Ok'), 'Mark tournament as handled');
  check(!/Mark tournament as handled/.test(await T.text(c)), 'and it’s no longer flagged');
  // move the lesson, asking Maya to confirm
  await c.click('[data-a=open][data-id="st-a|l1"]').catch(async () => { await c.click('text=Rook endings'); }); await c.waitForTimeout(500);
  await c.click('#modal[open] >> text=Move').catch(() => {}); await c.waitForSelector('#modal[open] #f_date');
  await fillForm(c, { date: addDays(t, 3), time: '18:00' }); await c.keyboard.press('Escape'); await c.waitForTimeout(300);
  a = await T.student(c, 'coach', 'st-a'); const l1 = a.sessions.find(x => x.id === 'l1');
  check(l1.date === d2 && (a.offers || []).some(o => o.date === addDays(t, 3) && o.time === '18:00' && o.status === 'pending'), 'with the student on the app, the move waits for her to confirm (the lesson stays put)');
  const m = await T.open('u-a', '#/home'); await m.waitForTimeout(3500);
  check((await T.text(m)).includes('New lesson time') || (await T.text(m)).includes('New time proposed'), 'Maya sees the new time');
  await m.click('[data-a=offer][data-id$="|accept"]'); await m.waitForSelector('#modal[open] button[type=submit]'); await m.click('#modal[open] button[type=submit]'); await m.waitForTimeout(4000);
  a = await T.eventually(async () => { const x = await T.student(c, 'coach', 'st-a'); return x.sessions.find(y => y.id === 'l1').date === addDays(t, 3) && x; }) || await T.student(c, 'coach', 'st-a');
  check(a.sessions.find(x => x.id === 'l1').date === addDays(t, 3) && a.sessions.find(x => x.id === 'l1').time === '18:00', 'once she confirms, the lesson moves');
  // free time, with a place and a second place
  await c.goto(URL + '#/schedule'); await c.waitForTimeout(600);
  await c.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true)); await c.click('[data-a=addFree]'); await c.waitForSelector('#modal[open] #f_kind');
  const places = await c.$$eval('#f_place option', xs => xs.map(x => x.value));
  await fillForm(c, { kind: 'weekly', date: addDays(t, 4), from: '16:00', to: '19:00', place: places.find(p => /Online/.test(p)) || places[1] });
  const fr = ((await T.doc(c, 'data/users/coach/settings')).free || [])[0];
  check(fr && fr.from === '16:00' && fr.to === '19:00' && /Online/.test(fr.place || ''), 'free time every week, 16:00–19:00, online');
  await c.reload(); await c.waitForTimeout(2500);
  check((await T.text(c)).includes('Online'), 'the place is written under the time');
  // club classes
  await c.goto(URL + '#/club'); await c.waitForTimeout(800);
  await c.click('[data-a=addClub]'); await c.waitForSelector('#modal[open] #f_name');
  await fillForm(c, { name: 'Diamond Class', nameHe: 'כיתת יהלום', kind: 'weekly', date: addDays(t, -14), from: '16:00', to: '17:30', place: 'Haifa club', rate: '120', fitTarget: '8' });
  let st = await T.doc(c, 'data/users/coach/settings'); const cl = (st.club || []).find(x => x.name === 'Diamond Class');
  check(cl && cl.nameHe === 'כיתת יהלום' && +cl.rate === 120 && cl.from === '16:00', 'a weekly club class with a Hebrew name, hourly pay and a workout challenge');
  // students join the group from their profile
  for (const id of ['st-b', 'st-c']) await c.evaluate(([id, cid]) => { const k = 'fdb:data/users/coach/' + id, s = JSON.parse(localStorage.getItem(k)); s.clubIds = [cid]; localStorage.setItem(k, JSON.stringify(s)); }, [id, cl.id]);
  await c.reload(); await c.waitForTimeout(2500);
  v = await T.text(c); check(v.includes('Yoni Levi') && v.includes('Dana Bar'), 'the group’s students');
  check(/hours|Pay|pay/.test(v) && v.includes('₪'), 'this month’s club hours and pay');
  // attendance: one tap, then everyone
  const attBtns = await c.$$('[data-a=att]');
  if (attBtns.length) { await attBtns[0].click(); await c.waitForTimeout(500); }
  st = await T.doc(c, 'data/users/coach/settings');
  const att = ((st.club || []).find(x => x.id === cl.id) || {}).att || {};
  check(Object.values(att).some(l => (l || []).length === 1), 'one tap marks a student here: ' + JSON.stringify(att));
  const all = await c.$('text=Everyone’s here'); if (all) { await all.click(); await c.waitForTimeout(500); }
  st = await T.doc(c, 'data/users/coach/settings');
  check(Object.values(((st.club || []).find(x => x.id === cl.id) || {}).att || {}).some(l => (l || []).length === 2), 'Everyone’s here marks the whole group');
  check((await T.text(c)).includes('✓'), 'the month table shows who came');
  // the class on the schedule; change one date's time
  await c.goto(URL + '#/schedule'); await c.waitForTimeout(800);
  check((await T.text(c)).includes('Diamond Class'), 'the class is on the schedule');
  const cbtn = await c.$('[data-a=club]');
  if (cbtn) { await cbtn.click(); await c.waitForTimeout(500); await c.click('#modal[open] >> text=/Change the time|change time|Change time/').catch(() => {}); await c.waitForTimeout(300);
    if (await c.$('#modal[open] #f_from')) { await fillForm(c, { from: '17:00' }); }
    st = await T.doc(c, 'data/users/coach/settings'); const cc = (st.club || []).find(x => x.id === cl.id);
    check(JSON.stringify(cc).includes('17:00') && cc.from === '16:00', 'one date moved to 17:00, the usual time kept'); }
  else check(false, 'a club class can be opened from the schedule');
  // in Hebrew
  await c.evaluate(() => { const k = 'fdb:data/users/coach/settings', s = JSON.parse(localStorage.getItem(k)); s.lang = 'he'; localStorage.setItem(k, JSON.stringify(s)); });
  await c.goto(URL + '#/club'); await c.reload(); await c.waitForTimeout(2500);
  v = await T.text(c); check(v.includes('כיתת יהלום') && v.includes('יוני'), 'in Hebrew: the class’s Hebrew name and children’s Hebrew names');
  await c.screenshot({ path: out('club'), fullPage: true });
  await T.finish();
})();

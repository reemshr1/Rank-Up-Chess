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
  a = await T.eventually(async () => { const x = await T.student(c, 'coach', 'st-a'); return (x.sessions.find(y => y.id === 'l1').tourOk || []).includes('tr1') && x; }) || a;
  check((a.sessions.find(x => x.id === 'l1').tourOk || []).includes('tr1'), 'Mark tournament as handled (the lesson remembers the Haifa Open as handled)');
  check(!/Mark tournament as handled/.test(await T.text(c)), 'and it’s no longer flagged');
  // the lesson's window: ✓ Handled, with Undo
  await c.click('[data-a=open][data-id="st-a|l1"]'); await c.waitForSelector('#modal[open] [data-unok]');
  check((await c.textContent('#modal')).includes('✓ Handled'), 'the lesson’s window shows ✓ Handled');
  await c.click('#modal[open] [data-unok]'); await c.waitForTimeout(500);
  a = await T.eventually(async () => { const x = await T.student(c, 'coach', 'st-a'); return !x.sessions.find(y => y.id === 'l1').tourOk && x; }) || await T.student(c, 'coach', 'st-a');
  check(!a.sessions.find(x => x.id === 'l1').tourOk, 'Undo flags it again');
  await c.click('#modal[open] [data-ok]'); await c.waitForTimeout(500);
  a = await T.eventually(async () => { const x = await T.student(c, 'coach', 'st-a'); return (x.sessions.find(y => y.id === 'l1').tourOk || []).length && x; }) || a;
  check((a.sessions.find(x => x.id === 'l1').tourOk || []).includes('tr1'), 'Mark as handled from the lesson’s window');
  await c.keyboard.press('Escape'); await c.waitForTimeout(200);
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
  check(!a.sessions.find(x => x.id === 'l1').tourOk, 'moving it to another date clears the handled mark');
  // free time, with a place and a second place
  await c.goto(URL + '#/schedule'); await c.waitForTimeout(600);
  await c.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true)); await c.click('[data-a=addFree]'); await c.waitForSelector('#modal[open] #f_kind');
  const places = await c.$$eval('#f_place option', xs => xs.map(x => x.value));
  await fillForm(c, { kind: 'weekly', date: addDays(t, 4), from: '16:00', to: '19:00', place: places.find(p => /Online/.test(p)) || places[1] });
  const fr = ((await T.doc(c, 'data/users/coach/settings')).free || [])[0];
  check(fr && fr.from === '16:00' && fr.to === '19:00' && /Online/.test(fr.place || ''), 'free time every week, 16:00–19:00, online');
  await c.reload(); await c.waitForTimeout(2500);
  check((await T.text(c)).includes('Online'), 'the place is written under the time');
  // a second place: at home, and also online
  await c.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true)); await c.click('[data-a=addFree]'); await c.waitForSelector('#modal[open] #f_kind');
  await fillForm(c, { kind: 'once', date: addDays(t, 5), from: '10:00', to: '12:00', place: 'At home' }, false);
  await c.waitForSelector('#modal[open] #f_place2'); await fillForm(c, { place2: 'Online' });
  const fr2 = ((await T.doc(c, 'data/users/coach/settings')).free || []).find(x => x.from === '10:00');
  check(fr2 && fr2.place === 'At home' && fr2.place2 === 'Online' && fr2.date === addDays(t, 5), 'free time at home and also online, on one date');
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
  const key = await c.$eval('[data-a=club]', b => b.dataset.id).catch(() => '');
  const day = key.split('|')[1];
  check(!!day, 'a club class date can be opened from the schedule');
  const clubNow = async () => (((await T.doc(c, 'data/users/coach/settings')).club || []).find(x => x.id === cl.id)) || {};
  if (day) {
    await c.click('[data-a=club][data-id="' + key + '"]'); await c.waitForSelector('#modal[open] #cdTime');
    check((await c.textContent('#modal')).includes('the other weeks stay as usual'), 'the date’s window says only this date changes');
    await c.click('#cdTime'); await c.waitForSelector('#modal[open] #f_from');
    await c.fill('#f_from', '17:00'); await c.dispatchEvent('#f_from', 'change'); await c.waitForTimeout(200);
    check((await c.inputValue('#f_to')) === '18:30', 'moving the start keeps the class length (17:00–18:30)');
    await c.click('#modal[open] button[type=submit]'); await c.waitForTimeout(600);
    let cc = await T.eventually(async () => { const x = await clubNow(); return x.times && x.times[day] && x; }) || await clubNow();
    check(cc.times && cc.times[day] && cc.times[day].from === '17:00' && cc.times[day].to === '18:30' && cc.from === '16:00', 'that date is at 17:00–18:30; the usual time stays 16:00');
    check((await T.text(c)).includes('17:00'), 'and the schedule shows it at 17:00');
    await c.click('[data-a=club][data-id="' + key + '"]'); await c.waitForSelector('#modal[open] #cdUsual');
    await c.click('#cdUsual'); await c.waitForTimeout(600);
    cc = await T.eventually(async () => { const x = await clubNow(); return !(x.times || {})[day] && x; }) || await clubNow();
    check(!(cc.times || {})[day], 'Back to the usual time undoes it');
    await c.click('[data-a=club][data-id="' + key + '"]'); await c.waitForSelector('#modal[open] #cdCancel');
    await c.click('#cdCancel'); await c.waitForTimeout(600);
    cc = await T.eventually(async () => { const x = await clubNow(); return (x.skip || []).includes(day) && x; }) || await clubNow();
    check((cc.skip || []).includes(day), 'Cancel this date cancels just that date');
  }
  // in Hebrew
  await c.evaluate(() => { const k = 'fdb:data/users/coach/settings', s = JSON.parse(localStorage.getItem(k)); s.lang = 'he'; localStorage.setItem(k, JSON.stringify(s)); });
  await c.goto(URL + '#/club'); await c.reload(); await c.waitForTimeout(2500);
  v = await T.text(c); check(v.includes('כיתת יהלום') && v.includes('יוני'), 'in Hebrew: the class’s Hebrew name and children’s Hebrew names');
  await c.screenshot({ path: out('club'), fullPage: true });
  await T.finish();
})();

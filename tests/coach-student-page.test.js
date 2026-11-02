// A student's page: the overview (tiles, rating history and Add rating, goals and notes, Show to student), inviting
// the student (code, message, linking, Disconnect), the parent app (a family), and the Lessons tab (weekly slot,
// Plan session, Edit, Mark done, Send summary). Also My chess: the coach's own profile.
const { URL, t, addDays, weekday, stu, les, check, out, start, fillForm } = require('./lib.js');
(async () => {
  const T = await start();
  await T.seed({ coach: 'coach', docs: {
    'data/users/coach/settings': { coachName: 'Raem', currency: '₪', defaultRate: 100, lang: 'en', weekStart: 0, appLink: 'https://reemshr1.github.io/Rank-Up-Chess/' },
    'data/users/coach/st-a': stu('st-a', 'Maya Cohen', { rate: 120, rating: '1540', goals: 'Reach 1600', notes: 'Works hard on endgames',
      ratings: [{ date: addDays(t, -60), value: 1480, source: 'FIDE' }, { date: addDays(t, -5), value: 1540, source: 'FIDE' }],
      sessions: [les('l1', addDays(t, -7), '17:00', 'Pins', { status: 'done', fee: 120, notes: 'Strong', shareNotes: true }), les('l2', addDays(t, 1), '17:00', 'Rook endings')],
      books: [{ id: 'bk1', title: 'Silman', status: 'Reading', pages: 400, page: 80 }] }),
    'data/users/coach/st-me': stu('st-me', 'Raem Sherman', { self: true, rate: 0, rating: '2350' }) } });
  const c = await T.open('coach', '#/student/st-a/overview'); await c.waitForTimeout(3000);
  let v = await T.text(c);
  check(v.includes('Maya Cohen') && v.includes('1540') && v.includes('Edit profile') && v.includes('Student view'), 'the header: name, rating, Edit profile, Student view');
  check(v.includes('Owed') && v.includes('Open assignments') && v.includes('Reach 1600') && v.includes('Works hard on endgames'), 'tiles, goals and coach notes');
  check(v.includes('Rating history') && (await c.$('svg.chart')), 'the rating chart');
  // add a rating
  await c.click('[data-a=addRating]'); await c.waitForSelector('#modal[open] #f_value');
  await fillForm(c, { source: 'FIDE', date: t, value: '1562' });
  let a = await T.doc(c, 'data/users/coach/st-a');
  check(a.ratings.some(r => +r.value === 1562 && r.date === t) && String(a.rating) === '1562', 'Add rating adds it and makes it the current rating');
  // show notes to the student
  await c.keyboard.press('Escape'); await c.waitForTimeout(300);
  await c.click('[data-a=shareNotes]'); await c.waitForTimeout(600);
  check((await T.doc(c, 'data/users/coach/st-a')).notesShared === true, 'Show to student shares the coach notes');
  // invite the student
  await c.click('[data-a=invite]'); await c.waitForTimeout(800);
  a = await T.doc(c, 'data/users/coach/st-a'); const code = a.invite && a.invite.code;
  check(/^[A-Z0-9]{6}$/.test(code || ''), 'Invite makes a 6-character code: ' + code);
  await c.click('[data-a=sendInv]'); await c.waitForTimeout(600);
  const msg = await c.inputValue('#msgTxt').catch(() => '');
  check(msg.includes(code) && msg.includes('index.html') && msg.includes('create an account'), 'the invite message has the code, the app’s own link and the steps');
  await c.keyboard.press('Escape');
  // Maya signs up and enters it
  const m = await T.open('u-maya'); await m.waitForSelector('#linkCode', { timeout: 8000 });
  await m.fill('#linkCode', 'WRONG1'); await m.click('#linkF button[type=submit]'); await m.waitForTimeout(1500);
  check((await T.text(m, 'body')).includes("wasn't recognised") || (await T.text(m, 'body')).includes('not recognised'), 'a wrong code isn’t recognised');
  await m.fill('#linkCode', code.toLowerCase()); await m.click('#linkF button[type=submit]'); await m.waitForTimeout(5000);
  a = await T.doc(c, 'data/users/coach/st-a');
  check(a.portal && a.portal.uid === 'u-maya' && !a.invite, "the coach's app links Maya and the code is used up");
  await m.reload(); await m.waitForTimeout(3000);
  check((await T.text(m)).includes('Rook endings') && (await m.evaluate(() => document.body.classList.contains('student-mode'))), 'Maya has her board, with her next lesson');
  await c.goto(URL + '#/student/st-a/overview'); await c.waitForTimeout(800);
  v = await T.text(c); check(v.includes('connected') && v.includes('Disconnect'), "the Student app box says she's connected");
  // a parent: start a family
  await c.click('[data-a=famNew]'); await c.waitForTimeout(400);
  if (await c.$('#modal[open] input')) { await c.fill('#modal[open] input', 'Cohen family').catch(() => {}); await c.click('#modal[open] button[type=submit]'); }
  await c.waitForTimeout(500);
  const fam = ((await T.doc(c, 'data/users/coach/settings')).families || [])[0];
  check(fam && fam.studentIds.includes('st-a'), 'a family for Maya’s parents');
  // Lessons: a weekly slot plans 8 weeks ahead
  await c.goto(URL + '#/student/st-a/sessions'); await c.waitForTimeout(800);
  await c.click('[data-a=addSlot]'); await c.waitForSelector('#modal[open] #f_weekday');
  await fillForm(c, { weekday: String(weekday(addDays(t, 2))), time: '18:30', start: addDays(t, 2) });
  a = await T.doc(c, 'data/users/coach/st-a');
  const weekly = a.sessions.filter(x => x.time === '18:30' && x.status === 'planned');
  check(a.slots.length === 1 && weekly.length >= 8 && weekly.length <= 9, 'a weekly slot plans its lessons 8 weeks ahead: ' + weekly.length);
  check(weekly.every(x => weekday(x.date) === weekday(addDays(t, 2))), 'all on the same weekday');
  // Plan session (one-off)
  await c.click('[data-a=add]'); await c.waitForSelector('#modal[open] #f_date');
  await fillForm(c, { date: addDays(t, 4), time: '10:00', topics: 'Openings' }); await c.keyboard.press('Escape');
  a = await T.doc(c, 'data/users/coach/st-a');
  check(a.sessions.some(x => x.date === addDays(t, 4) && x.time === '10:00' && x.topics === 'Openings'), 'Plan session adds a lesson');
  // edit a lesson
  await c.click('[data-a=edit][data-id="l2"]'); await c.waitForSelector('#modal[open] #f_topics');
  await fillForm(c, { topics: 'Rook endings: Lucena', time: '17:30' }); await c.keyboard.press('Escape');
  a = await T.doc(c, 'data/users/coach/st-a');
  check(a.sessions.find(x => x.id === 'l2').topics === 'Rook endings: Lucena' && a.sessions.find(x => x.id === 'l2').time === '17:30', 'editing a lesson saves it');
  // Send summary
  await c.click('[data-a=sum][data-id="l1"]'); await c.waitForTimeout(1200);
  const sm = await c.inputValue('#sumTxt').catch(() => '');
  check(sm.includes('Pins') && sm.includes('Maya'), 'Send summary writes the lesson summary: ' + sm.slice(0, 80));
  await c.keyboard.press('Escape');
  // disconnect
  await c.goto(URL + '#/student/st-a/overview'); await c.waitForTimeout(600);
  await c.click('[data-a=unlink]'); await c.waitForSelector('#modal[open] button[type=submit]'); await c.click('#modal[open] button[type=submit]'); await c.waitForTimeout(1200);
  const pm = await T.doc(c, 'portal/u-maya');
  check(!(await T.doc(c, 'data/users/coach/st-a')).portal && pm.linked === false && pm.unlinked === true, 'Disconnect closes her access; her records stay');
  await m.reload(); await m.waitForTimeout(2500);
  check((await T.text(m, 'body')).includes('closed access'), 'her app says access was closed');
  // My chess
  await c.goto(URL + '#/dashboard'); await c.waitForTimeout(500);
  check((await T.text(c, '#nav')).includes('My chess'), 'the menu has My chess');
  await c.goto(URL + '#/student/st-me/overview'); await c.waitForTimeout(600);
  v = await T.text(c); check(v.includes('2350') && !v.includes('Student app'), 'My chess: the coach’s own rating, no student-app box');
  await c.goto(URL + '#/students'); await c.waitForTimeout(400);
  check((await T.text(c)).includes('1 active'), 'the coach isn’t counted as a student');
  await c.screenshot({ path: out('student-page'), fullPage: true });
  await T.finish();
})();

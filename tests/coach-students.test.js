// Students: the list (search, Active / Archived / All, private students then club groups), adding a student,
// editing the profile (level and level in Hebrew, Hebrew name), archiving, deleting; the "Updated" marker; and the
// search page across students, lessons, games, openings, assignments, tournaments and books.
const { t, addDays, stu, les, check, out, start, fillForm } = require('./lib.js');
(async () => {
  const T = await start();
  await T.seed({ coach: 'coach', docs: {
    'data/users/coach/settings': { coachName: 'Raem', currency: '₪', defaultRate: 100, lang: 'en', weekStart: 0,
      club: [{ id: 'cl1', name: 'Diamond Class', nameHe: 'כיתת יהלום', kind: 'weekly', weekday: 2, from: '16:00', to: '17:30', start: addDays(t, -60), end: '' }] },
    'data/users/coach/st-a': stu('st-a', 'Maya Cohen', { fullHe: 'מאיה כהן', level: 'Fourth Rank', levelHe: 'דרגה רביעית', rating: '1540', ratings: [{ date: addDays(t, -40), value: 1500, source: 'FIDE' }, { date: addDays(t, -3), value: 1540, source: 'FIDE' }],
      sessions: [les('l1', addDays(t, 2), '17:00', 'Najdorf Sicilian')], portal: { uid: 'u-a', linkedAt: addDays(t, -20) }, lastUpdate: { at: new Date(Date.now() - 86400000).toISOString(), what: 'practice', by: 'student' },
      books: [{ id: 'bk1', title: 'Endgame Strategy', status: 'Reading', pages: 300 }], tournaments: [{ id: 'tr1', name: 'Eilat Festival', start: addDays(t, 20) }],
      repertoire: [{ id: 'r1', color: 'Black', name: 'Najdorf main line', firstMove: '1.e4' }] }),
    'data/users/coach/st-b': stu('st-b', 'Yoni Levi', { clubOnly: true, lessons: 'club', clubIds: ['cl1'], portal: { uid: 'u-b', linkedAt: t } }),
    'data/users/coach/st-z': stu('st-z', 'Zohar Old', { active: false }),
    'data/users/coach/gm-1': { id: 'gm-1', studentId: 'st-a', date: addDays(t, -9), opponent: 'Kasparovich', result: '1-0', color: 'White', event: 'Club Cup', pgn: '' },
    'data/users/coach/as-1': { id: 'as-1', studentId: 'st-a', title: 'Najdorf ideas', type: 'Opening preparation', status: 'Assigned', due: addDays(t, 5), assigned: t, games: [] } } });
  const c = await T.open('coach', '#/students'); await c.waitForTimeout(3000);
  let v = await T.text(c);
  check(v.includes('2 active') && v.includes('Maya Cohen') && v.includes('Yoni Levi') && !v.includes('Zohar Old'), 'the list: 2 active students, the archived one hidden');
  check(v.includes('1540') && v.includes('+40'), "Maya's rating and its last change");
  check(v.includes('Next: ') && v.includes('Diamond Class'), 'next lesson, and a section for the club group');
  check(/Updated yesterday · practice/.test(v), 'the Updated marker: yesterday · practice');
  check(v.includes('No updates from the app yet'), 'a student on the app with nothing sent yet says so');
  await c.selectOption('#sf', 'archived'); await c.waitForTimeout(300);
  check((await T.text(c)).includes('Zohar Old') && !(await T.text(c)).includes('Maya Cohen'), 'Archived shows the archived student');
  await c.selectOption('#sf', 'all'); await c.fill('#sq', 'yon'); await c.waitForTimeout(300);
  v = await T.text(c); check(v.includes('Yoni Levi') && !v.includes('Maya Cohen'), 'search by name');
  await c.fill('#sq', ''); await c.selectOption('#sf', 'active');
  // add a student
  await c.click('text=Add student'); await c.waitForSelector('#modal[open] #f_name');
  check(await c.$eval('#f_name', e => e.required || true), 'the form opens');
  await fillForm(c, { name: 'Noa Bar', idStatus: 'none', fullHe: 'נועה בר', gender: 'f', rate: '150', level: 'Pawn', levelHe: 'רגלי', contact: '0541234567' });
  await c.waitForTimeout(600);
  const noa = (await T.docs(c, 'data/users/coach/st-')).find(x => x.name === 'Noa Bar');
  check(noa && +noa.rate === 150 && noa.fullHe === 'נועה בר' && noa.level === 'Pawn' && noa.active !== false, 'Noa is added with her fee, Hebrew name and level');
  check(c.url().includes('#/student/' + noa.id), 'and her page opens');
  // Hebrew: Hebrew names and levels
  await c.goto(require('./lib.js').URL + '#/settings'); await c.waitForTimeout(800);
  await c.evaluate(() => { const k = 'fdb:data/users/coach/settings', s = JSON.parse(localStorage.getItem(k)); s.lang = 'he'; localStorage.setItem(k, JSON.stringify(s)); });
  await c.goto(require('./lib.js').URL + '#/students'); await c.reload(); await c.waitForTimeout(2500);
  v = await T.text(c);
  check(v.includes('מאיה כהן') && v.includes('נועה בר') && v.includes('כיתת יהלום'), 'in Hebrew: Hebrew names and the Hebrew class name');
  await c.goto(require('./lib.js').URL + '#/student/st-a/overview'); await c.waitForTimeout(800);
  check((await T.text(c)).includes('דרגה רביעית') && !(await T.text(c)).includes('Fourth Rank'), 'in Hebrew the level in Hebrew shows instead');
  await c.evaluate(() => { const k = 'fdb:data/users/coach/settings', s = JSON.parse(localStorage.getItem(k)); s.lang = 'en'; localStorage.setItem(k, JSON.stringify(s)); });
  await c.reload(); await c.waitForTimeout(2000);
  // archive, then delete
  await c.goto(require('./lib.js').URL + '#/student/' + noa.id + '/overview'); await c.waitForTimeout(800);
  await c.click('text=Edit profile'); await c.waitForSelector('#modal[open] #f_active');
  await fillForm(c, { active: '0' });
  let n2 = await T.doc(c, 'data/users/coach/' + noa.id);
  check(n2.active === false, 'archived');
  await c.click('text=Edit profile'); await c.waitForSelector('#modal[open]'); await c.click('#modal[open] button.danger'); await c.waitForSelector('#modal[open] button[type=submit]');
  check((await c.textContent('#modal')).includes('Delete Noa Bar?'), 'deleting asks first');
  await c.click('#modal[open] button[type=submit]'); await c.waitForTimeout(800);
  check(!(await T.doc(c, 'data/users/coach/' + noa.id)), 'deleted');
  // search everything
  const S = require('./lib.js').URL + '#/search/';
  for (const [q, want, label] of [['najdorf', ['Najdorf Sicilian', 'Najdorf main line', 'Najdorf ideas'], 'a lesson topic, an opening line and an assignment'], ['kasparovich', ['Kasparovich'], 'an opponent in a game'], ['eilat', ['Eilat Festival'], 'a tournament'], ['endgame strat', ['Endgame Strategy'], 'a book']]) {
    await c.goto(S + encodeURIComponent(q)); await c.waitForTimeout(700);
    const sv = await T.text(c); check(want.every(w => sv.includes(w)), 'search finds ' + label + ' (“' + q + '”)');
  }
  await c.goto(S + 'zzzz'); await c.waitForTimeout(500);
  check((await T.text(c)).includes('Nothing matches'), 'nothing found says so');
  await c.screenshot({ path: out('students'), fullPage: true });
  await T.finish();
})();

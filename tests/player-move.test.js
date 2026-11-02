// A player starts with a coach: Have a coach? → Connect to a coach. A wrong code changes nothing; the right one moves
// everything they logged (practice, workouts, sleep, books, tournaments, games, tasks, ratings, FIDE number) to the
// coach's records, where the student's page says "From their own board" and what the coach entered stays; their app
// becomes the coach's student app; the admin page lists the old board as "Moved to a coach" with Delete the copy.
// A parent's board moves with the family code, and the parent becomes the family's parent account.
const { URL, ADMIN, t, addDays, stu, les, check, out, start, fillForm } = require('./lib.js');
const me = (name, extra) => stu('st-me', name, Object.assign({ self: true, setup: 'self', rate: 0 }, extra));
(async () => {
  const T = await start();
  await T.seed({ coach: 'coach', coaches: ['tom', 'dana'], players: ['tom', 'dana'], users: { 'tom@x.co': { id: 'tom', password: 'x' }, 'dana@x.co': { id: 'dana', password: 'x' } }, docs: {
    'data/users/coach/settings': { coachName: 'Raem', currency: '₪', lang: 'en', weekStart: 0,
      families: [{ id: 'fam-c', name: 'Cohen family', studentIds: ['st-m'], invite: { code: 'FAM777', created: t } }] },
    'data/users/coach/st-t': stu('st-t', 'Tom Levi', { invite: { code: 'TOM234', created: t }, sessions: [les('l1', addDays(t, 3), '17:00', 'Najdorf')], worklog: [{ id: 'wc', date: addDays(t, -20), what: 'Strategy', minutes: 60 }] }),
    'data/users/coach/st-m': stu('st-m', 'Maya Cohen', { invite: { code: 'MAYA88', created: t } }),
    'data/users/tom/settings': { coachName: 'Tom Levi', lang: 'en' },
    'data/users/tom/st-me': me('Tom Levi', { fideId: '2800001', ratingType: 'FIDE', rating: '1650', ratings: [{ date: addDays(t, -30), value: 1650, source: 'FIDE' }],
      worklog: [{ id: 'wt1', date: addDays(t, -2), what: 'Tactics', minutes: 30, by: 'student' }, { id: 'wt2', date: addDays(t, -3), what: 'Endgames', minutes: 25, by: 'student' }],
      fitness: [{ id: 'f1', date: addDays(t, -2), activity: 'Running', minutes: 30 }], sleep: [{ id: 'sl1', date: addDays(t, -40), hours: 8 }],
      books: [{ id: 'bk1', title: 'Silman’s Endgame Course', status: 'Reading', pages: 500, page: 120 }],
      tournaments: [{ id: 'tr1', name: 'Haifa Open', start: addDays(t, 9) }] }),
    'data/users/tom/gm-1': { id: 'gm-1', studentId: 'st-me', date: addDays(t, -6), opponent: 'Kasparovich', color: 'White', result: '1-0' },
    'data/users/tom/as-1': { id: 'as-1', studentId: 'st-me', title: 'Pins', type: 'Tactics', status: 'Assigned', due: addDays(t, 4), assigned: t, games: [], by: 'self' },
    'data/users/dana/settings': { coachName: 'Maya Cohen', lang: 'en' },
    'data/users/dana/st-me': me('Maya Cohen', { setup: 'parent', worklog: [{ id: 'wm1', date: addDays(t, -1), what: 'Openings', minutes: 40, by: 'student' }] }) } });
  const p = await T.open('tom', '#/home'); await p.waitForTimeout(3500);
  check((await T.text(p)).includes('Have a coach?'), 'a player’s Home: Have a coach?');
  // a wrong code changes nothing
  await p.click('[data-a=toCoach]'); await p.waitForSelector('#modal[open] #f_code');
  await fillForm(p, { code: 'NOPE99' }); await p.waitForTimeout(1500);
  check((await p.textContent('#modal .form-err')).includes("That code wasn't recognised."), 'a wrong code: “That code wasn’t recognised”');
  check((await p.evaluate(() => JSON.parse(localStorage.getItem('fplayers')))).includes('tom') && !(await T.doc(p, 'data/users/coach/st-t')).portal, 'and nothing changed: still a player, the coach’s Tom not linked');
  // the right one
  await fillForm(p, { code: 'tom 234' });
  check(!!(await T.eventually(async () => (await p.textContent('#toast')).includes('Connected! Opening your app'), 6000)), 'the coach’s code: “Connected! Opening your app…”');
  await p.waitForTimeout(3000);
  check((await p.evaluate(() => JSON.parse(localStorage.getItem('fmoved') || '[]'))).includes('tom'), 'the account is no longer a player’s: its kind is “moved” (leave_player)');
  // the coach's app takes it in
  const c = await T.open('coach', '#/student/st-t/overview'); await c.waitForTimeout(4500);
  const s = await T.eventually(async () => { const x = await T.student(c, 'coach', 'st-t'); return x.movedIn && x.worklog.some(w => w.id === 'wt1') && x; }, 10000) || await T.student(c, 'coach', 'st-t');
  check(s.portal && s.portal.uid === 'tom', 'the coach’s Tom is linked to the account');
  check(['wt1', 'wt2'].every(id => s.worklog.some(w => w.id === id)) && s.worklog.some(w => w.id === 'wc'), 'his practice arrives, and the practice the coach entered stays');
  check(s.fitness.some(f => f.id === 'f1') && s.sleep.some(x => x.id === 'sl1') && s.books.some(b => b.id === 'bk1' && +b.page === 120) && s.tournaments.some(x => x.name === 'Haifa Open'), 'workouts, sleep, books (with his page) and tournaments');
  check(s.fideId === '2800001' && s.ratings.some(r => +r.value === 1650 && r.source === 'FIDE'), 'his FIDE number and ratings');
  check(s.sessions.some(x => x.id === 'l1'), 'the lesson the coach planned stays');
  const games = (await T.docs(c, 'data/users/coach/gm-')).filter(g => g.studentId === 'st-t'), tasks = (await T.docs(c, 'data/users/coach/as-')).filter(a => a.studentId === 'st-t');
  check(games.some(g => g.opponent === 'Kasparovich') && tasks.some(a => a.title === 'Pins'), 'his games and tasks, now Tom’s in the coach’s records');
  await c.reload(); await c.waitForTimeout(3000);
  check((await T.text(c)).includes('From their own board') && (await T.text(c)).includes('Tom brought what they logged'), 'the student’s page: “From their own board”');
  // his app is the coach's student app now
  await p.reload(); await p.waitForTimeout(4000);
  let v = await T.text(p);
  check(v.includes('Najdorf') && v.includes('Raem') && !v.includes('Have a coach?') && !v.includes('Tips'), 'Tom’s app is now Raem’s student app (the lesson, the coach’s name, no Tips)');
  check((await p.$$eval('#nav a', xs => xs.map(x => x.textContent).join('|'))).includes('Schedule'), 'with a Schedule');
  // the admin page: Moved to a coach, Delete the copy
  const ad = await T.open('coach', '', ADMIN); await ad.waitForTimeout(3000);
  await ad.click('text=Accounts').catch(() => {}); await ad.waitForTimeout(800);
  v = await ad.textContent('body');
  check(v.includes('Moved to a coach') && v.includes('Delete the copy'), 'the admin page lists Tom as “Moved to a coach”, with Delete the copy');
  await ad.close();
  // a parent's board, with the family code
  const d = await T.open('dana', '#/home'); await d.waitForTimeout(3500);
  check((await T.text(d)).includes('Maya’s coach'), 'a parent’s board: “Maya’s coach”');
  await d.click('[data-a=toCoach]'); await d.waitForSelector('#modal[open] #f_code');
  check((await d.textContent('#modal')).includes('Family code from the coach'), 'it asks for the family code');
  await fillForm(d, { code: 'FAM777' }); await d.waitForTimeout(4000);
  await c.reload(); await c.waitForTimeout(4500);
  const fam = await T.eventually(async () => { const st = await T.doc(c, 'data/users/coach/settings'); const f = (st.families || []).find(x => x.id === 'fam-c'); return f && f.portal && f; });
  check(fam && fam.portal.uid === 'dana', 'the account becomes the Cohen family’s parent account');
  const m = await T.eventually(async () => { const x = await T.student(c, 'coach', 'st-m'); return x.worklog.some(w => w.id === 'wm1') && x; }, 10000);
  check(!!m && m.movedIn && m.movedIn.by === 'parent', 'Maya’s practice reaches the coach’s Maya, brought by the parent');
  await d.reload(); await d.waitForTimeout(4000);
  check(await d.evaluate(() => document.body.classList.contains('parent-mode')) && (await T.text(d)).includes('Maya’s board'), 'the parent’s app is now the family’s parent app');
  check(!(await T.denied(c)).length && !(await T.denied(p)).length && !(await T.denied(d)).length, 'nobody tried to read or write what isn’t theirs');
  await c.screenshot({ path: out('player-move'), fullPage: true });
  await T.finish();
})();

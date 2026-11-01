// Assignments: a new one for a student, with PGN games (pasted and uploaded; a file with many games is split), a
// note per game, the student opening it and marking it done, the coach's feedback and review, the filters; one for a
// whole club group (a copy each); the Assignment library (save, then start a new one from it).
const { URL, t, addDays, stu, check, out, start, fillForm } = require('./lib.js');
const game = (w, b, r, ev) => `[Event "${ev}"]\n[White "${w}"]\n[Black "${b}"]\n[Result "${r}"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 ${r}\n`;
(async () => {
  const T = await start();
  await T.seed({ coach: 'coach', docs: {
    'data/users/coach/settings': { coachName: 'Raem', currency: '₪', lang: 'en', weekStart: 0,
      club: [{ id: 'cl1', name: 'Diamond Class', kind: 'weekly', day: 2, from: '16:00', to: '17:30', start: addDays(t, -60) }] },
    'data/users/coach/st-a': stu('st-a', 'Maya Cohen', { portal: { uid: 'u-a', linkedAt: t } }),
    'portal/u-a': { code: 'AAA234', linked: true, role: 'student', coach: 'coach', linkedAt: t },
    'data/users/coach/st-b': stu('st-b', 'Yoni Levi', { clubIds: ['cl1'] }), 'data/users/coach/st-c': stu('st-c', 'Dana Bar', { clubIds: ['cl1'] }) } });
  const c = await T.open('coach', '#/assignments'); await c.waitForTimeout(3000);
  // a new assignment for Maya
  await c.click('#asNew'); await c.waitForSelector('#modal[open] #f_title');
  await fillForm(c, { studentId: 'st-a', title: 'Ruy Lopez model games', type: 'Study model games', due: addDays(t, 5), instructions: 'Find the plans for White.' });
  let as = (await T.docs(c, 'data/users/coach/as-')).find(x => x.title === 'Ruy Lopez model games');
  check(as && as.studentId === 'st-a' && as.status === 'Assigned' && as.due === addDays(t, 5), 'an assignment for Maya, assigned, due in 5 days');
  check(c.url().includes('#/assignment/' + as.id), 'its page opens');
  // games: paste one, upload a file with two
  await c.click('[data-a=paste]'); await c.waitForSelector('#modal[open] #f_pgn');
  await fillForm(c, { pgn: game('Capablanca', 'Marshall', '1-0', 'New York 1918') }); await c.waitForTimeout(400);
  await c.setInputFiles('#pgnFile', { name: 'two.pgn', mimeType: 'text/plain', buffer: Buffer.from(game('Fischer', 'Spassky', '1-0', 'Reykjavik 1972') + '\n' + game('Karpov', 'Kasparov', '1/2-1/2', 'Moscow 1985')) });
  as = await T.eventually(async () => { const x = (await T.docs(c, 'data/users/coach/as-')).find(y => y.id === as.id); return (x.games || []).length === 3 && x; }) || as;
  check((as.games || []).length === 3, 'three games: one pasted, two from a file (split)');
  check(as.games.some(g => g.white === 'Fischer' && g.black === 'Spassky'), 'with the players read from the PGN');
  // a note on a game
  await c.click('[data-a=gnote]'); await c.waitForSelector('#modal[open] #f_note');
  await fillForm(c, { note: 'Look at move 23.' });
  as = await T.eventually(async () => { const x = (await T.docs(c, 'data/users/coach/as-')).find(y => y.id === as.id); return x.games.some(g => g.note) && x; }) || as;
  check(as.games.some(g => g.note === 'Look at move 23.'), 'a note for one game');
  // save it to the library
  await c.click('[data-a=lib]'); await c.waitForTimeout(500);
  const lib = (await T.doc(c, 'data/users/coach/settings')).asLib || [];
  check(lib.length === 1 && lib[0].title === 'Ruy Lopez model games' && lib[0].games.length === 3, 'Save to library keeps the title, instructions and games');
  // Maya opens it and marks it done
  const m = await T.open('u-a', '#/home'); await m.waitForTimeout(4000);
  check((await T.text(m)).includes('Ruy Lopez model games'), 'Maya sees the assignment on Home');
  await m.goto(URL + '#/assignment/' + as.id); await m.waitForTimeout(800);
  let mv = await T.text(m);
  check(mv.includes('Find the plans for White.') && mv.includes('Fischer') && mv.includes('Look at move 23.'), 'she sees the instructions, the games and the note');
  check(!(await m.$('[data-a=paste]')) && !(await m.$('#pgnFile')), 'she can’t add or change games');
  await m.click('[data-a=view]'); await m.waitForTimeout(600);
  check(await m.$('#modal[open] .board, #modal[open] [class*=board], #modal[open] svg, #modal[open] cg-board, #modal[open] table'), 'a game opens on a board');
  await m.keyboard.press('Escape'); await m.waitForTimeout(200);
  await m.click('[data-a=status][data-id=Submitted]'); await m.waitForTimeout(3500);
  as = await T.eventually(async () => { const x = (await T.docs(c, 'data/users/coach/as-')).find(y => y.id === as.id); return x.status === 'Submitted' && x; }) || as;
  check(as.status === 'Submitted' && as.submitted === t, 'marking it done reaches the coach (Done · to review)');
  // the coach's filters and review
  await c.goto(URL + '#/assignments'); await c.waitForTimeout(700);
  await c.click('[data-a=f][data-id=review]'); await c.waitForTimeout(300);
  check((await T.text(c)).includes('Ruy Lopez model games') && (await T.text(c)).includes('Done · to review (1)'), 'the Done (to review) filter lists it');
  await c.goto(URL + '#/assignment/' + as.id); await c.waitForTimeout(700);
  await c.fill('#fb', 'Well found: the minority attack.'); await c.click('[data-a=fbdone]'); await c.waitForTimeout(600);
  as = await T.eventually(async () => { const x = (await T.docs(c, 'data/users/coach/as-')).find(y => y.id === as.id); return x.status === 'Reviewed' && x; }) || as;
  check(as.status === 'Reviewed' && as.feedback === 'Well found: the minority attack.' && as.reviewedOn === t, 'feedback saved and marked reviewed');
  await m.waitForTimeout(3500); await m.reload(); await m.waitForTimeout(2500);
  await m.goto(URL + '#/assignment/' + as.id); await m.waitForTimeout(800);
  check((await T.text(m)).includes('Well found: the minority attack.'), 'Maya sees the feedback');
  // a whole club group, from the library
  await c.goto(URL + '#/assignments'); await c.waitForTimeout(500);
  await c.click('#asNew'); await c.waitForSelector('#modal[open] #f_tpl');
  await c.selectOption('#f_tpl', lib[0].id); await c.waitForTimeout(300);
  check(!(await c.isVisible('#f_title')) && !(await c.isVisible('#f_instructions')), 'From library: title, type and instructions come from the library (their fields hide)');
  await fillForm(c, { studentId: 'club:cl1', due: addDays(t, 7) });
  const grp = (await T.docs(c, 'data/users/coach/as-')).filter(x => x.title === 'Ruy Lopez model games' && x.id !== as.id);
  check(grp.length === 2 && grp.some(x => x.studentId === 'st-b') && grp.some(x => x.studentId === 'st-c') && grp.every(x => x.games.length === 3), 'the whole group: a copy each, with the games');
  await c.goto(URL + '#/assignments'); await c.waitForTimeout(500);
  await c.click('[data-a=f][data-id=open]'); await c.waitForTimeout(300);
  check(/Assigned \(2\)/.test(await T.text(c)), 'Assigned (2): the two group copies');
  await c.screenshot({ path: out('assignments'), fullPage: true });
  await T.finish();
})();

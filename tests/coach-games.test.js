// Games: importing a PGN (matched to the student's side and to the tournament), adding a game by hand, the score
// summary and analysis filters; Tournaments: rounds on consecutive days or on separate dates, the expected and
// actual score (worked out from the games), the rating change added to the rating history, tournament assistance
// charged per day (and its price changed with a reason); Model games; Repertoire lines and Openings in games.
const { URL, t, addDays, stu, check, out, start, fillForm } = require('./lib.js');
const PGN = d => `[Event "Haifa Open"]\n[Date "${d.replace(/-/g, '.')}"]\n[Round "1"]\n[White "Cohen, Maya"]\n[Black "Levi, Dan"]\n[Result "1-0"]\n[WhiteElo "1540"]\n[BlackElo "1620"]\n\n1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 1-0\n\n` +
  `[Event "Haifa Open"]\n[Date "${d.replace(/-/g, '.')}"]\n[Round "2"]\n[White "Bar, Noa"]\n[Black "Cohen, Maya"]\n[Result "1/2-1/2"]\n[WhiteElo "1580"]\n\n1. d4 d5 2. c4 e6 1/2-1/2\n`;
(async () => {
  const T = await start();
  const d0 = addDays(t, -8);
  await T.seed({ coach: 'coach', docs: {
    'data/users/coach/settings': { coachName: 'Raem', currency: '₪', defaultRate: 200, lang: 'en', weekStart: 0 },
    'data/users/coach/st-a': stu('st-a', 'Maya Cohen', { rate: 200, ratingType: 'FIDE', ratings: [{ date: addDays(t, -30), value: 1540, source: 'FIDE' }] }) } });
  const c = await T.open('coach', '#/student/st-a/tournaments'); await c.waitForTimeout(3000);
  // a tournament, played over 2 days, with assistance
  await c.click('[data-a=add]'); await c.waitForSelector('#modal[open] #f_name');
  await fillForm(c, { name: 'Haifa Open', start: d0, end: addDays(d0, 1), rounds: '2', expected: '1/2', location: 'Haifa', assist: '1' });
  let a = await T.student(c, 'coach', 'st-a'); const tr = a.tournaments.find(x => x.name === 'Haifa Open');
  check(tr && +tr.rounds === 2 && tr.expected === '1/2' && tr.assist, 'a tournament with 2 rounds, an expected score and assistance');
  check(+tr.assistFee === 100, 'assistance at half the lesson fee: ₪100 a day');
  // import the games
  await c.goto(URL + '#/student/st-a/games'); await c.waitForTimeout(600);
  await c.setInputFiles('#gImport', { name: 'haifa.pgn', mimeType: 'application/x-chess-pgn', buffer: Buffer.from(PGN(d0)) }); await c.waitForTimeout(1500);
  const gs = (await T.docs(c, 'data/users/coach/gm-')).filter(g => g.studentId === 'st-a');
  check(gs.length === 2, 'both games imported');
  const g1 = gs.find(g => g.result === '1-0'), g2 = gs.find(g => g.result === '½-½');
  check(g1 && g1.color === 'White' && g1.opponent && /Levi/.test(g1.opponent) && g2 && g2.color === 'Black', 'Maya’s side found in each (White in one, Black in the other)');
  check(g1.tournamentId === tr.id && g2.tournamentId === tr.id, 'both matched to the Haifa Open');
  let v = await T.text(c);
  check(/2 games/.test(v) && v.includes('1 win, 1 draw'), 'the score summary: 1 win, 1 draw');
  check(v.includes('Not analysed (2)'), 'both not analysed yet');
  // add a game by hand
  await c.click('[data-a=addGame]'); await c.waitForSelector('#modal[open] #f_opponent');
  await fillForm(c, { opponent: 'Yoni Levi', date: addDays(t, -2), color: 'Black', result: '0-1', timeControl: 'Rapid' });
  v = await T.text(c); check(/3 games/.test(v) && v.includes('2 wins'), 'a game added by hand counts too');
  // the tournament's result from the games, against the expectation
  await c.goto(URL + '#/student/st-a/tournaments'); await c.waitForTimeout(600);
  v = await T.text(c);
  check(v.includes('Played') && v.includes('Haifa Open') && /1\.5\/2|1½\/2/.test(v), 'the result worked out from the games: 1½/2');
  check(/\+½|\+0\.5|beat|Above/i.test(v) || v.includes('Met or beat the expected score in'), 'compared with the expected 1/2');
  // the rating change, added to the rating history
  await c.click('[data-a=edit][data-id="' + tr.id + '"]'); await c.waitForSelector('#modal[open] #f_ratingChange');
  await fillForm(c, { ratingChange: '12' }, false);
  if (await c.$('#f_addRating:visible')) await c.selectOption('#f_addRating', 'FIDE');
  await c.click('#modal[open] button[type=submit]'); await c.waitForTimeout(600);
  a = await T.student(c, 'coach', 'st-a');
  check(+a.tournaments.find(x => x.id === tr.id).ratingChange === 12 && a.ratings.some(r => +r.value === 1552), 'rating change +12 added to the history: 1540 → 1552');
  // assistance is charged once it's played; change the price with a reason
  await c.click('[data-a=aprice][data-id="' + tr.id + '"]'); await c.waitForSelector('#modal[open] #f_fee');
  await fillForm(c, { fee: '80' });
  check((await c.textContent('#modal .form-err')).length > 0, 'a price other than half the fee needs a reason');
  await fillForm(c, { why: 'Two students at the same tournament' });
  a = await T.student(c, 'coach', 'st-a'); const tr2 = a.tournaments.find(x => x.id === tr.id);
  check(+tr2.assistFee === 80 && /Two students/.test(tr2.assistReason), 'the new price and its reason');
  await c.goto(URL + '#/student/st-a/payments'); await c.waitForTimeout(700);
  v = await T.text(c); check(v.includes('Haifa Open') && v.includes('160'), 'the payments ledger charges 2 days × ₪80');
  // separate dates
  await c.goto(URL + '#/student/st-a/tournaments'); await c.waitForTimeout(500);
  await c.click('[data-a=add]'); await c.waitForSelector('#modal[open] #f_name');
  await fillForm(c, { name: 'Club League', sched: 'dates' }, false);
  await c.click('[data-adddate=roundDates]'); await c.click('[data-adddate=roundDates]'); await c.waitForTimeout(200);
  await c.click('#modal[open] button[type=submit]'); await c.waitForTimeout(600);
  a = await T.student(c, 'coach', 'st-a'); const cl = a.tournaments.find(x => x.name === 'Club League');
  check(cl && String(cl.roundDates || '').split(',').filter(Boolean).length === 2, 'a tournament played on separate dates keeps its round dates');
  // model games and openings
  await c.goto(URL + '#/student/st-a/studied'); await c.waitForTimeout(500);
  await c.click('[data-a=addS]'); await c.waitForSelector('#modal[open]');
  const fields = await c.$$eval('#modal[open] [id^=f_]', xs => xs.map(x => x.id));
  if (fields.includes('f_white')) await c.fill('#f_white', 'Capablanca'); if (fields.includes('f_black')) await c.fill('#f_black', 'Tartakower');
  if (fields.includes('f_theme')) await c.fill('#f_theme', 'Rook endgame');
  await c.click('#modal[open] button[type=submit]'); await c.waitForTimeout(500);
  check((await T.docs(c, 'data/users/coach/gm-')).some(g => g.kind === 'study' && g.white === 'Capablanca'), 'a model game');
  await c.goto(URL + '#/student/st-a/repertoire'); await c.waitForTimeout(600);
  v = await T.text(c);
  check(v.includes('Openings in games') && /1\.e4/.test(v) && v.includes('No line'), 'Openings in games: 1.e4 from the games, with no line prepared yet');
  await c.click('[data-a=addp]'); await c.waitForSelector('#modal[open] #f_name');
  await fillForm(c, { color: 'White', name: 'Open Sicilian with 3.d4' });
  a = await T.student(c, 'coach', 'st-a');
  check(a.repertoire.some(r => r.name === 'Open Sicilian with 3.d4' && r.color === 'White'), 'a repertoire line');
  await c.screenshot({ path: out('games'), fullPage: true });
  await T.finish();
})();

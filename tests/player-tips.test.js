// Tips for a player with no coach (worked out from what they log, at most 3, the most pressing first): a gap in
// practice, a tournament this week, games not analysed, tasks past their date, an area left alone, rook endgames
// missing, one topic taking over, puzzle accuracy too low or very high, streaks; Home's first tile is the next
// tournament; on a parent's board the tips talk about the child by name; in Hebrew; a coach's board has none.
const { URL, t, addDays, stu, check, out, start } = require('./lib.js');
const w = (d, what, min, extra) => Object.assign({ id: 'w' + Math.random().toString(36).slice(2, 8), date: addDays(t, d), what, minutes: min, by: 'student' }, extra);
const me = (name, extra) => stu('st-me', name, Object.assign({ self: true, setup: 'self', rate: 0 }, extra));
const tips = p => p.$$eval('.tips .tip-text', xs => xs.map(x => x.textContent));
(async () => {
  const T = await start();
  await T.seed({ coach: 'coach', coaches: ['tom', 'ana', 'ben', 'dana', 'eli'], players: ['tom', 'ana', 'ben', 'dana', 'eli'], docs: {
    'data/users/coach/settings': { coachName: 'Raem', lang: 'en' },
    'data/users/coach/st-a': stu('st-a', 'Maya Cohen', { worklog: [w(-9, 'Tactics', 30)] }),
    // Tom: 5 days without practice, a tournament in 2 days, 2 games not analysed, a task past its date (the 4th, so left out)
    'data/users/tom/settings': { coachName: 'Tom Levi', lang: 'en' },
    'data/users/tom/st-me': me('Tom Levi', { worklog: [w(-5, 'Tactics', 30), w(-6, 'Endgames', 30), w(-7, 'Calculation', 30), w(-8, 'Openings', 30)],
      tournaments: [{ id: 'tr1', name: 'Haifa Open', start: addDays(t, 2), end: addDays(t, 4) }, { id: 'tr2', name: 'Eilat Festival', start: addDays(t, 30) }] }),
    'data/users/tom/gm-1': { id: 'gm-1', studentId: 'st-me', date: addDays(t, -10), opponent: 'X', color: 'White', result: '1-0' },
    'data/users/tom/gm-2': { id: 'gm-2', studentId: 'st-me', date: addDays(t, -12), opponent: 'Y', color: 'Black', result: '0-1' },
    'data/users/tom/gm-3': { id: 'gm-3', studentId: 'st-me', date: addDays(t, -14), opponent: 'Z', color: 'Black', result: '½-½', analysis: 'Analysed' },
    'data/users/tom/as-1': { id: 'as-1', studentId: 'st-me', title: 'Pins', type: 'Tactics', status: 'Assigned', due: addDays(t, -2), assigned: addDays(t, -9), games: [], by: 'self' },
    // Ana: only tactics, every day (today too), 90% right; never endgames
    'data/users/ana/settings': { coachName: 'Ana Bar', lang: 'en' },
    'data/users/ana/st-me': me('Ana Bar', { worklog: [0, -1, -2, -3, -4].map(d => w(d, 'Tactics', 30, { attempted: 10, correct: 9 })) }),
    // Ben: balanced, 50% right, endgames typed but never rook ones, a 3-day streak not yet today (in Hebrew)
    'data/users/ben/settings': { coachName: 'Ben Gal', lang: 'he' },
    'data/users/ben/st-me': me('Ben Gal', { worklog: [w(-1, 'Tactics', 30, { attempted: 30, correct: 15 }), w(-2, 'Endgames', 30, { eg: ['pawn'] }), w(-3, 'Endgames', 30, { eg: ['pawn'] }),
      w(-3, 'Endgames', 20, { eg: ['pawn', 'bishop'] }), w(-2, 'Calculation', 30), w(-1, 'Openings', 30), w(-3, 'Strategy', 30)] }),
    // Dana: a parent; Maya hasn't practiced for 4 days
    'data/users/dana/settings': { coachName: 'Maya Cohen', lang: 'en' },
    'data/users/dana/st-me': me('Maya Cohen', { setup: 'parent', worklog: [w(-4, 'Tactics', 30), w(-5, 'Endgames', 30), w(-6, 'Calculation', 30), w(-7, 'Openings', 30)] }),
    'data/users/dana/as-1': { id: 'as-1', studentId: 'st-me', title: 'Lucena', type: 'Endgames', status: 'Assigned', due: addDays(t, -1), assigned: addDays(t, -8), games: [], by: 'self' },
    // Eli: practiced today and yesterday, a balanced fortnight
    'data/users/eli/settings': { coachName: 'Eli Ron', lang: 'en' },
    'data/users/eli/st-me': me('Eli Ron', { worklog: [w(0, 'Tactics', 30), w(-1, 'Endgames', 30), w(-1, 'Calculation', 30), w(-4, 'Openings', 30)] }) } });
  // Tom
  const p = await T.open('tom', '#/home'); await p.waitForTimeout(3500);
  let x = await tips(p);
  check(x.length === 3, 'Tom gets 3 tips (not more): ' + x.join(' / '));
  check(/^No practice for 5 days\. A short session today/.test(x[0]), '1st: no practice for 5 days');
  check(x[1] === '“Haifa Open” starts in 2 days. Warm up with tactics, look over your openings, and sleep well the nights before.', '2nd: the tournament in 2 days');
  check(/^2 games aren't analysed yet\./.test(x[2]), '3rd: 2 games not analysed (the analysed one isn’t counted)');
  check(!x.some(y => /past its date/.test(y)), 'the late task, a 4th tip, is left out');
  check((await p.$eval('#view .stats .stat', e => e.textContent)).includes('Next tournament') && (await p.$eval('#view .stats .stat', e => e.textContent)).includes(new Date(addDays(t, 2) + 'T00:00').getDate() + ''), 'Home’s first tile: the next tournament, Haifa Open’s date');
  // Ana
  const a = await T.open('ana', '#/home'); await a.waitForTimeout(3500);
  x = await tips(a);
  check(x[0] === 'No endgames logged yet — add a short endgames session this week.', 'Ana: no endgames logged yet: ' + x[0]);
  check(x[1] === 'Most of your practice this month is tactics (100%). Mix in other areas for a rounder game.', 'one topic taking over: tactics 100%');
  check(x[2] === 'Puzzle accuracy 90% — time for harder puzzles.', 'very high accuracy: time for harder puzzles (encouragement comes after the warnings)');
  check(await a.$$eval('.tips li', ls => ls[2].textContent.includes('✨') && ls[0].textContent.includes('💡')), '💡 for a warning, ✨ for encouragement');
  // Ben, in Hebrew
  const b = await T.open('ben', '#/home'); await b.waitForTimeout(3500);
  x = await tips(b);
  check(x[0] === 'עוד לא נרשמו סיומי צריחים — הם הנפוצים ביותר במשחקים אמיתיים.', 'Ben (Hebrew): no rook endgames yet: ' + x[0]);
  check(x[1] && x[1].startsWith('דיוק בתרגילים 50% בשבועיים האחרונים.'), 'accuracy 50%: slow down');
  check(x[2] === 'רצף תרגול של 3 ימים — תרגול היום ישמור עליו.', 'a 3-day streak, practice today to keep it');
  check((await b.textContent('#view')).includes('טיפים'), 'the card is called טיפים');
  // Dana's board: about Maya
  const d = await T.open('dana', '#/home'); await d.waitForTimeout(3500);
  x = await tips(d);
  check((await T.text(d)).includes('Maya’s board') && x[0] === "Maya hasn't practiced for 4 days. A short session today gets them back on track.", 'a parent’s board: “Maya hasn’t practiced for 4 days”');
  check(x[1] === '1 of Maya’s tasks is past its date.', 'and a task past its date: “1 of Maya’s tasks is past its date.”');
  // Eli: all is well
  const e = await T.open('eli', '#/home'); await e.waitForTimeout(3500);
  x = await tips(e);
  check(x.length === 1 && x[0] === 'A good balance lately — keep it up.', 'Eli, balanced and practicing: “A good balance lately — keep it up.” ' + x.join(' / '));
  // a coach's board has no tips
  const c = await T.open('coach', '#/student/st-a/overview'); await c.waitForTimeout(3000);
  check(!(await c.$('.tips')) && !(await T.text(c)).includes('Tips'), 'a coach’s student page has no Tips');
  await p.screenshot({ path: out('player-tips'), fullPage: true });
  await T.finish();
})();

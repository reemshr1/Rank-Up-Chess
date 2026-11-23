// When do you play best: the hourly job stores how online games went by hour (onlineStats, see lichess-fn.test.js);
// the Games tab shows a bar per hour with the score and the number of games, the best and worst hour (5 games or
// more each), and a switch between All / Rapid / Blitz / Bullet. The coach sees it on the student's Games tab; a
// student sees it on their own; nothing shows without games; in Hebrew too.
const { URL, t, stu, check, out, start } = require('./lib.js');
const stats = { days: 90, n: 34, hours: {
  all: { 9: [13, 4], 10: [2, 1], 18: [14, 10], 21: [5, 3] },
  rapid: { 9: [8, 2], 18: [9, 7] },
  blitz: { 9: [5, 2], 10: [2, 1], 18: [5, 3], 21: [5, 3] } } };
(async () => {
  const T = await start({ viewport: { width: 390, height: 844 } });
  await T.seed({ coach: 'coach', coaches: ['tom'], players: ['tom'], docs: {
    'data/users/coach/settings': { coachName: 'Raem', lang: 'en' },
    'data/users/coach/st-a': stu('st-a', 'Maya Cohen', { onlineStats: stats, portal: { uid: 'u-a', linkedAt: t } }),
    'data/users/coach/st-b': stu('st-b', 'Yoni Levi', { onlineStats: { days: 90, n: 0, hours: {} } }),
    'portal/u-a': { code: 'A1', linked: true, role: 'student', coach: 'coach', linkedAt: t },
    'data/users/tom/settings': { coachName: 'Tom', lang: 'en' },
    'data/users/tom/st-me': stu('st-me', 'Tom Levi', { self: true, setup: 'self', rate: 0, onlineStats: { days: 90, n: 3, hours: { all: { 7: [3, 1] }, blitz: { 7: [3, 1] } } } }) } });
  const c = await T.open('coach', '#/student/st-a/games'); await c.waitForTimeout(3500);
  let v = await T.text(c);
  check(v.includes('When does Maya play best?'), 'the coach sees “When does Maya play best?” on her Games tab');
  const bars = async pg => pg.$$eval('.play-hours > div', xs => xs.map(x => [...x.children].map(y => y.textContent).filter(Boolean).join(' ').trim()));
  let b = await bars(c);
  check(b.length === 13 && b[0] === '31% 09 13' && b[1] === '50% 10 2' && b[2] === '11' && b[9] === '71% 18 14', 'every hour from the first to the last, with score and games where there were any: score, hour, games (' + b.join(' | ') + ')');
  check(v.includes('Best: 18:00–19:00 · 71% (14 games)') && v.includes('Worst: 09:00–10:00 · 31% (13 games)'), 'best and worst hour, from hours with 5 games or more (10:00 has 2, so it isn’t the best at 50%)');
  check(v.includes('34 online games on Lichess and Chess.com in the last 3 months'), 'says what it is drawn from');
  const kinds = await c.$$eval('[data-a=ptk]', xs => xs.map(x => x.textContent));
  check(kinds.join() === 'All,Rapid,Blitz', 'the switch offers only the kinds she plays: ' + kinds.join());
  await c.click('[data-a=ptk][data-id=rapid]'); await c.waitForTimeout(400);
  b = await bars(c); v = await T.text(c);
  check(b.length === 10 && v.includes('Best: 18:00–19:00 · 78% (9 games)') && v.includes('Worst: 09:00–10:00 · 25% (8 games)'), 'Rapid: its own bars, best and worst');
  check((await c.$eval('[data-a=ptk].on', x => x.textContent)) === 'Rapid', 'and Rapid stays chosen');
  await c.screenshot({ path: out('play-times'), fullPage: true });
  await c.goto(URL + '#/student/st-b/games'); await c.waitForTimeout(800);
  check(!(await T.text(c)).includes('play best'), 'no games in 3 months: no card');
  // the student, on their own board
  const m = await T.open('u-a', '#/student/st-a/games'); await m.waitForTimeout(3500);
  v = await T.text(m);
  check(v.includes('When do you play best?') && (await bars(m)).length === 13, 'the student sees “When do you play best?” with the same bars');
  // a player on their own with 3 games: too few to compare
  const p = await T.open('tom', '#/student/st-me/games'); await p.waitForTimeout(3500);
  v = await T.text(p);
  check(v.includes('Not enough games in one hour yet to compare') && !(await p.$('[data-a=ptk]')), 'three games: bars, no best/worst yet, no switch for one kind');
  // Hebrew
  await p.evaluate(() => { const k = 'fdb:data/users/tom/settings', x = JSON.parse(localStorage.getItem(k)); x.lang = 'he'; localStorage.setItem(k, JSON.stringify(x)); });
  await p.reload(); await p.waitForTimeout(3000); v = await T.text(p);
  check(v.includes('מתי הכי טוב לך לשחק?') && v.includes('3 משחקים אונליין'), 'in Hebrew: מתי הכי טוב לך לשחק?');
  check(!(await T.denied(c)).length && !(await T.denied(m)).length, 'nobody tried to read or write what isn’t theirs');
  await T.finish();
})();

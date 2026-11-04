// Fixes from the review of the player app (4 Nov): on a parent's board the app talks about the child (Maya's
// progress, Maya's medals, Maya's own sign-in, fitness wording); Your children uses Hebrew names in Hebrew and holds
// the shown child's sign-in (no second card); the child isn't asked twice about days without practice; no empty
// charts; no "Reviewed with coach" for players; Add practice starts on the site last logged by hand.
const { URL, t, addDays, stu, check, out, start } = require('./lib.js');
const W = (id, d, extra) => Object.assign({ id, date: addDays(t, d), what: 'Tactics', minutes: 30, by: 'student' }, extra);
const kid = (id, name, extra) => stu(id, name, Object.assign({ self: true, setup: 'parent', rate: 0 }, extra));
(async () => {
  const T = await start({ viewport: { width: 390, height: 844 } });
  await T.seed({ coach: 'coach', coaches: ['dana', 'dina', 'tom'], players: ['dana', 'dina', 'tom'], docs: {
    'data/users/coach/settings': { coachName: 'Raem', lang: 'en' },
    // Dana: two children, Maya with her own sign-in
    'data/users/dana/settings': { coachName: 'Maya Cohen', lang: 'en' },
    'data/users/dana/st-m': kid('st-m', 'Maya Cohen', { fullHe: 'מאיה כהן', portal: { uid: 'u-kid', linkedAt: addDays(t, -30), email: 'maya@x.co' }, worklog: [W('m1', -3)] }),
    'data/users/dana/st-n': kid('st-n', 'Noa Cohen', { fullHe: 'נועה כהן', createdAt: addDays(t, -10) }),
    'portal/u-kid': { code: 'K1', linked: true, role: 'student', coach: 'dana', linkedAt: addDays(t, -30) },
    // Dina: one child, connected
    'data/users/dina/settings': { coachName: 'Yael', lang: 'en' },
    'data/users/dina/st-y': kid('st-y', 'Yael Bar', { fullHe: 'יעל בר', portal: { uid: 'u-y', linkedAt: addDays(t, -20), email: 'yael@x.co' } }),
    // Tom: on his own; tactics without counts, last logged by hand on ChessTempo, a Lichess entry added by itself
    'data/users/tom/settings': { coachName: 'Tom', lang: 'en' },
    'data/users/tom/st-me': stu('st-me', 'Tom Levi', { self: true, setup: 'self', rate: 0, worklog: [W('t1', -3, { site: 'ChessTempo', exercise: 'Tactics (rated)' }), W('t2', -1, { site: 'Lichess', exercise: 'Puzzles (rated)', auto: 'lichess' })] }),
    'data/users/tom/gm-1': { id: 'gm-1', studentId: 'st-me', date: addDays(t, -5), opponent: 'X', color: 'White', result: '1-0', analysis: 'Not analysed', by: 'student' } } });
  // a parent's board talks about the child
  const d = await T.open('dana', '#/home'); await d.waitForTimeout(3500);
  let v = await T.text(d);
  check(!v.includes('own sign-in') && /Your children/.test(v) && v.includes('Maya has been connected to the app since'), 'two children: the shown child’s sign-in is in her row of Your children, with no second card');
  await d.goto(URL + '#/progress'); await d.waitForTimeout(700); v = await T.text(d);
  check(v.includes('Maya’s progress') && !v.includes('Your progress'), 'Progress: “Maya’s progress”, not “Your progress”');
  check(v.includes('Maya’s medals') && !v.includes('My medals') && v.includes('A missed day starts the streak again; medals earned stay.'), 'and “Maya’s medals”, in words for the parent');
  check(!v.includes('Accuracy by week'), 'no empty accuracy chart before any puzzle counts');
  await d.goto(URL + '#/student/st-m/fitness'); await d.waitForTimeout(700); v = await T.text(d);
  check(v.includes('Log each workout') && !v.includes('Log one after each workout'), 'Fitness: wording for the parent');
  check(!(await d.$('.panel .wbars')), 'and no empty weeks chart before any workout');
  // Hebrew: the children by their Hebrew names
  await d.evaluate(() => { const k = 'fdb:data/users/dana/settings', x = JSON.parse(localStorage.getItem(k)); x.lang = 'he'; localStorage.setItem(k, JSON.stringify(x)); });
  await d.goto(URL + '#/home'); await d.reload(); await d.waitForTimeout(3000); v = await T.text(d);
  check(v.includes('מאיה כהן') && v.includes('נועה כהן') && !v.includes('Maya Cohen') && !v.includes('Noa Cohen'), 'in Hebrew, Your children lists מאיה כהן and נועה כהן');
  await d.close();
  // one child: the card by name
  const y = await T.open('dina', '#/home'); await y.waitForTimeout(3500); v = await T.text(y);
  check(v.includes('Yael’s own sign-in') && !v.includes("The player's own sign-in") && v.includes('Yael has been connected to the app since'), 'one child: “Yael’s own sign-in”, “has been connected since”');
  await y.evaluate(() => { const k = 'fdb:data/users/dina/settings', x = JSON.parse(localStorage.getItem(k)); x.lang = 'he'; localStorage.setItem(k, JSON.stringify(x)); });
  await y.reload(); await y.waitForTimeout(3000);
  check((await T.text(y)).includes('הכניסה של יעל'), 'in Hebrew: הכניסה של יעל');
  await y.close();
  // the child: asked once about the days without practice
  const m = await T.open('u-kid', '#/home'); await m.waitForTimeout(3500); v = await T.text(m);
  const tips = await m.$$eval('.tips .tip-text', xs => xs.map(x => x.textContent));
  check(v.includes('No practice logged for 3 days') && !tips.some(x => /No practice for 3 days/.test(x)), 'Maya is asked about 3 days without practice once (the check-in), not again in Tips');
  await m.close();
  // a player: no "Reviewed with coach"; Add practice starts where he last logged by hand
  const p = await T.open('tom', '#/student/st-me/games'); await p.waitForTimeout(3500); v = await T.text(p);
  check(!/Reviewed \(\d+\)/.test(v) && /Not analysed \(1\)/.test(v), 'Games: no “Reviewed” filter for a player');
  await p.click('[data-a=edit][data-id="gm-1"]').catch(async () => p.evaluate(() => { const b = [...document.querySelectorAll('[data-a]')].find(x => /edit/i.test(x.dataset.a) && x.dataset.id === 'gm-1'); b && b.click(); }));
  await p.waitForSelector('#modal[open] #f_analysis');
  check(!(await p.$$eval('#modal[open] #f_analysis option', os => os.map(o => o.value))).includes('Reviewed with coach'), 'nor “Reviewed with coach” in a game’s status');
  await p.keyboard.press('Escape');
  await p.goto(URL + '#/student/st-me/work'); await p.waitForTimeout(700);
  check(!(await T.text(p)).includes('Accuracy by week'), 'Practice: no empty accuracy chart');
  await p.click('[data-a=addLog]'); await p.waitForSelector('#modal[open] #f_site');
  check((await p.inputValue('#modal[open] #f_site')) === 'ChessTempo', 'Add practice starts on ChessTempo, where he last logged by hand (not the Lichess entry added by itself)');
  await p.screenshot({ path: out('player-review'), fullPage: true });
  await T.finish();
})();

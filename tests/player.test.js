// A player with no coach: signing up with a player code (a wrong one refused), Welcome to Rank Up (the name needed),
// a FIDE number that fills the rating in by itself, Home (next tournament first, Tips, no coach parts), practice
// saved straight to their own records, their own tasks (New task, Mark done), and Progress: the Rating card with
// Check now (a number that can't be read says so), Add rating by hand, practice sessions instead of lessons.
const { URL, t, addDays, check, out, start, fillForm } = require('./lib.js');
const fide = (id, r) => JSON.stringify({ fide: { [id]: r }, icf: {} });
(async () => {
  const T = await start();
  await T.seed({ coach: 'coach', docs: { 'data/users/coach/settings': { coachName: 'Raem', lang: 'en' } },
    ls: { fccodes: { PLAY2345: { code: 'PLAY2345', kind: 'player', note: '', made_at: t, used_by: null } }, 'ffn:ratings': fide('2800001', { std: 1650, rapid: 1600, title: '' }) } });
  const p = await T.open(null); await p.waitForSelector('#authF'); await p.click('[data-m=signup]'); await p.waitForSelector('#authF');
  await p.fill('#aEmail', 'tom@x.co'); await p.fill('#aPass', 'tompass999'); await p.click('#authF button[type=submit]');
  await p.waitForSelector('#bePlayer', { timeout: 8000 });
  check((await p.textContent('#view')).includes('Enter the code your coach (or your parent) gave you'), 'a new account: enter a code, or “I’m a player and have a player code”');
  // a wrong code, then the right one
  await p.click('#bePlayer'); await p.waitForSelector('#modal[open] #f_code');
  await fillForm(p, { code: 'WRONG999' }); await p.waitForTimeout(500);
  check((await p.textContent('#modal .form-err')).includes("That player code isn't valid or was already used."), 'a wrong player code is refused');
  await fillForm(p, { code: 'play 2345' });
  await p.waitForSelector('#modal[open] #f_name', { timeout: 10000 });
  const codes = await p.evaluate(() => JSON.parse(localStorage.getItem('fccodes')));
  check(codes.PLAY2345.used_by === 'u-tom' && (await p.evaluate(() => JSON.parse(localStorage.getItem('fplayers')))).includes('u-tom'), 'the code (spaces and case don’t matter) makes the account a player’s');
  check((await p.textContent('#modal header')).includes('Welcome to Rank Up') && !!(await p.$('#modal[open] #f_setup')), 'Welcome to Rank Up: who the account is for, and the player’s details');
  await fillForm(p, { name: '' }); await p.waitForTimeout(200);
  check((await p.textContent('#modal .form-err')).includes("Write the player's name."), 'the name is needed');
  await fillForm(p, { setup: 'self', name: 'Tom Levi', birthYear: '2010', fideId: '2800001' });
  const me = await T.eventually(async () => (await T.docs(p, 'data/users/u-tom/st-')).find(x => x.self && x.name === 'Tom Levi'));
  check(me && me.fideId === '2800001' && me.ratingType === 'FIDE' && me.setup === 'self', 'their own record: Tom Levi, FIDE number, the rating list is FIDE');
  check(!!(await T.eventually(async () => /Rating updated — 1650 FIDE/.test(await p.textContent('#toast')), 8000)), 'with a FIDE number the rating fills in by itself: “Rating updated — 1650 FIDE”');
  const fn = await p.evaluate(() => window.__fn.filter(f => f.name === 'ratings').map(f => f.body));
  check(fn.length === 1 && fn[0].fide[0] === '2800001', 'the ratings function was asked for that number');
  let r = await T.eventually(async () => { const x = (await T.docs(p, 'data/users/u-tom/st-')).find(y => y.self); return (x.ratings || []).length && x; });
  check(r && r.ratings.some(x => x.source === 'FIDE' && +x.value === 1650) && r.ratings.some(x => x.source === 'FIDE Rapid' && +x.value === 1600), 'standard and rapid ratings are recorded');
  // Home
  await p.goto(URL + '#/home'); await p.reload(); await p.waitForTimeout(3000);
  let v = await T.text(p);
  check(/Good (morning|afternoon|evening), Tom/.test(v), 'Home greets Tom');
  check((await p.$eval('#view .stats .stat', e => e.textContent)).includes('No tournament planned'), 'the first tile is about tournaments (none planned yet), not lessons');
  check(v.includes('Tips') && v.includes('Log your first practice'), 'Tips: log your first practice');
  const nav = await p.$$eval('#nav a', xs => xs.map(x => x.textContent.trim()).join('|'));
  check(!/Schedule|Payments/.test(nav) && /Tasks/.test(nav) && /Progress/.test(nav), 'the menu has Tasks and Progress, no Schedule or Payments: ' + nav);
  check(!(await p.$('[data-a=req]')) && !v.includes('Updated by') && !v.includes('your coach'), 'no lesson requests and nothing about a coach');
  // practice is saved straight to their own records
  await p.click('[data-a=log]'); await p.waitForSelector('#modal[open] #f_minutes'); await fillForm(p, { minutes: '35', what: 'Openings' });
  r = await T.eventually(async () => { const x = await T.student(p, 'u-tom', me.id); return x.worklog.some(w => +w.minutes === 35) && x; });
  check(!!r, 'practice is saved straight to Tom’s own records');
  check(!(await p.evaluate(() => Object.keys(localStorage).some(k => k.startsWith('fdb:portal/u-tom')))), 'with no coach, nothing goes through an inbox');
  v = await T.text(p); check(!v.includes('Log your first practice') && !v.includes('waiting for'), 'the first-practice tip goes, and nothing waits');
  // tasks
  await p.goto(URL + '#/student/' + me.id + '/assignments'); await p.waitForTimeout(600);
  await p.click('[data-a=new]'); await p.waitForSelector('#modal[open] #f_title');
  await fillForm(p, { title: '30 puzzles on pins', due: addDays(t, 3) });
  let task = await T.eventually(async () => (await T.docs(p, 'data/users/u-tom/as-')).find(a => a.title === '30 puzzles on pins'));
  check(task && task.studentId === me.id && task.status === 'Assigned', 'New task: saved as Tom’s own task');
  await p.click('[data-a=done][data-id="' + task.id + '"]'); await p.waitForTimeout(400);
  if (await p.$('#modal[open] button[type=submit]')) { await p.click('#modal[open] button[type=submit]'); await p.waitForTimeout(400); }
  task = await T.eventually(async () => { const a = await T.doc(p, 'data/users/u-tom/' + task.id); return a.status !== 'Assigned' && a; });
  check(task && /Done|Reviewed/.test(task.status), 'Mark done finishes it (no coach to review): ' + (task && task.status));
  // Progress: the rating card
  await p.goto(URL + '#/progress'); await p.waitForTimeout(800);
  v = await T.text(p);
  check(v.includes('1650') && v.includes('Check now'), 'Progress: the rating, with Check now');
  check(!v.includes('Recent lessons') && !/Coach goals/i.test(v), 'no recent lessons or coach goals on a player’s Progress');
  await p.evaluate(k => localStorage.setItem('ffn:ratings', k), fide('2800001', { error: 'No such player' }));
  await p.click('[data-a=rtNow]');
  check(!!(await T.eventually(async () => (await p.textContent('#toast')).includes("Couldn't read the rating for FIDE 2800001. Check the number in My profile."), 8000)), 'a number that can’t be read says so');
  await p.click('[data-a=addRt]'); await p.waitForSelector('#modal[open] #f_source');
  await fillForm(p, { source: 'Online', value: '1720' });
  r = await T.eventually(async () => { const x = (await T.docs(p, 'data/users/u-tom/st-')).find(y => y.self); return x.ratings.some(y => y.source === 'Online' && +y.value === 1720) && x; });
  check(!!r, 'Add rating by hand: an Online rating');
  await p.screenshot({ path: out('player'), fullPage: true });
  await T.finish();
})();

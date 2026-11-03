// The app's side of the hourly Lichess job: what the job leaves in a student's outbox shows in their app at once and
// reaches the coach's records like anything the student logs; a Lichess entry the student deletes is remembered on the
// record (liGone), so neither the job, nor another of the student's devices, nor the app itself brings it back; and a
// player's deletion is kept on their own record too.
const { URL, t, addDays, stu, check, out, start } = require('./lib.js');
const dayStart = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const feed = [{ interval: { start: dayStart(t), end: dayStart(t) + 86400000 }, puzzles: { score: { win: 9, loss: 3, draw: 0, rp: { after: 1852 } } } },
  { interval: { start: dayStart(addDays(t, -1)), end: dayStart(t) }, storm: { runs: 2, score: 30 } }];
// what the job writes: the same entry the app makes
const entry = { id: 'li-' + t + '-puzzles', what: 'Tactics', site: 'Lichess', date: t, by: 'student', auto: 'lichess', note: '', count: '', eg: [], exercise: 'Puzzles (rated)',
  attempted: 12, correct: 9, prating: 1852, minutes: 12, scores: [], score: '', autoMin: 12, autoN: 12 };
const op = item => ({ type: 'worklog.upsert', item, at: new Date().toISOString(), auto: 'lichess' });
(async () => {
  const T = await start();
  await T.ctx.route('https://lichess.org/api/user/**', r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(feed) }));
  await T.seed({ coach: 'coach', coaches: ['tom'], players: ['tom'], docs: {
    'data/users/coach/settings': { coachName: 'Raem', lang: 'en' },
    'data/users/coach/st-m': stu('st-m', 'Maya Cohen', { usernames: { 'lichess.org': 'mayac' }, portal: { uid: 'u-m', linkedAt: t } }),
    'portal/u-m': { code: 'M1', linked: true, role: 'student', coach: 'coach', linkedAt: t },
    'data/users/tom/settings': { coachName: 'Tom', lang: 'en' },
    'data/users/tom/st-me': stu('st-me', 'Tom Levi', { self: true, setup: 'self', rate: 0, usernames: { 'lichess.org': 'tomlevi' }, worklog: [Object.assign({}, entry, { id: 'li-' + addDays(t, -1) + '-storm', exercise: 'Puzzle Storm', attempted: '', correct: '', runs: 2, score: 30, scores: [30], minutes: 6, autoMin: 6, autoN: 2, date: addDays(t, -1) })] }) } });
  // the board as the coach's app last wrote it, without the new entry (the coach's app isn't open)
  const c0 = await T.open('coach'); await c0.waitForTimeout(3500);
  // then the hourly job leaves the new entry in Maya's outbox, while nobody has an app open
  await c0.close(); const j = await T.open(null); await j.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), ['fdb:portal/u-m/inbox/op-li-' + t + '-puzzles-12-', op(entry)]); await j.close();
  const m = await T.open('u-m', '#/student/st-m/work'); await m.waitForTimeout(4000);
  let v = await T.text(m);
  check(v.includes('Lichess Puzzles (rated)') && v.includes('9/12 correct'), 'what the job left in Maya’s outbox shows in her app at once');
  const outbox = () => m.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('fdb:portal/u-m/inbox/')).map(k => JSON.parse(localStorage.getItem(k))));
  const ob = (await outbox()).filter(o => o.item && o.item.id === entry.id);
  check(ob.length >= 1 && ob.every(o => JSON.stringify(Object.assign({}, o.item, { by: 'student' })) === JSON.stringify(Object.assign({}, entry, { by: 'student' }))), 'her own app, checking Lichess too, makes exactly the same entry (same id, same numbers)');
  // the coach's app takes it in
  const c = await T.open('coach', '#/student/st-m/work'); await c.waitForTimeout(4000);
  let s = await T.eventually(async () => { const x = await T.student(c, 'coach', 'st-m'); return x.worklog.some(w => w.id === entry.id) && x; });
  check(!!s && s.worklog.find(w => w.id === entry.id).by === 'student' && s.worklog.filter(w => w.id === entry.id).length === 1, 'the coach’s app takes it in, once, as the student’s');
  check(!!(await T.eventually(async () => !(await outbox()).length)), 'and her outbox is empty again');
  // Maya deletes it
  await m.reload(); await m.waitForTimeout(3500);
  await m.evaluate(id => { const el = [...document.querySelectorAll('[data-a=editLog]')].find(x => x.dataset.id === id); el && el.click(); }, entry.id);
  await m.waitForSelector('#modal[open]'); await m.click('#modal[open] button.danger'); await m.waitForSelector('#modal[open] button[type=submit]'); await m.click('#modal[open] button[type=submit]'); await m.waitForTimeout(800);
  s = await T.eventually(async () => { const x = await T.student(c, 'coach', 'st-m'); return !x.worklog.some(w => w.id === entry.id) && x; });
  check(!!s && (s.liGone || []).includes(entry.id), 'Maya deletes it: it leaves the coach’s records, which remember it was deleted (liGone)');
  // the job (or another of her devices) offers it again
  await m.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), ['fdb:portal/u-m/inbox/op-li-again', op(entry)]);
  await c.waitForTimeout(3000);
  s = await T.student(c, 'coach', 'st-m');
  check(!s.worklog.some(w => w.id === entry.id), 'offered again (by the job, or another device): the coach’s app doesn’t take it back');
  // her app on a fresh device (nothing remembered there) checks Lichess: the board says it was deleted
  await m.evaluate(() => localStorage.removeItem('rli-gone')); await m.reload(); await m.waitForTimeout(4000);
  await m.click('[data-a=liNow]').catch(() => {}); await m.waitForTimeout(1500);
  check(!(await T.text(m)).includes('9/12 correct') && !(await outbox()).some(o => o.type === 'worklog.upsert' && o.item.id === entry.id), 'her app on another device doesn’t add it back either (her board carries liGone)');
  // a player deletes an entry on their own board
  const p = await T.open('tom', '#/student/st-me/work'); await p.waitForTimeout(3500);
  const sid = 'li-' + addDays(t, -1) + '-storm';
  await p.evaluate(id => { const el = [...document.querySelectorAll('[data-a=editLog]')].find(x => x.dataset.id === id); el && el.click(); }, sid);
  await p.waitForSelector('#modal[open]'); await p.click('#modal[open] button.danger'); await p.waitForSelector('#modal[open] button[type=submit]'); await p.click('#modal[open] button[type=submit]'); await p.waitForTimeout(1200);
  const tom = await T.eventually(async () => { const x = await T.student(p, 'tom', 'st-me'); return !x.worklog.some(w => w.id === sid) && x; });
  check(!!tom && (tom.liGone || []).includes(sid), 'a player deletes one: their record remembers it (the job reads it there)');
  await p.evaluate(() => localStorage.removeItem('rli-gone')); await p.click('[data-a=liNow]'); await p.waitForTimeout(1500);
  check(!(await T.student(p, 'tom', 'st-me')).worklog.some(w => w.id === sid), 'and the app on another device doesn’t bring it back');
  check(!(await T.denied(c)).length && !(await T.denied(m)).length, 'nobody tried to read or write what isn’t theirs');
  await m.screenshot({ path: out('lichess-sync'), fullPage: true });
  await T.finish();
})();

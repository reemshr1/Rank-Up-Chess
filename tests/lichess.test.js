// Lichess puzzles added to the practice log by themselves, from the username in Useful links. Lichess's public
// activity feed is answered by the test (the real site isn't reached).
const { chromium } = require('playwright');
const { FAKE_SUPA } = require('./fakesupa.js');
const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '../index.html');
const pad = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const addDays = (s, n) => { const d = new Date(s + 'T00:00'); d.setDate(d.getDate() + n); return iso(d); };
const t = iso(new Date());
const dayStart = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)); // Lichess days start at midnight UTC
let fails = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fails++; };
const blank = (id, extra) => Object.assign({ id, name: '', active: true, rate: 0, noId: true, ratingType: 'FIDE', rating: '', ratings: [], sessions: [], tasks: [], worklog: [], repertoire: [], tournaments: [], payments: [], charges: [], books: [], slots: [], training: [], requests: [], fitness: [], fitnessGoal: 0, sleep: [], createdAt: addDays(t, -60) }, extra);
const day = (d, x) => Object.assign({ interval: { start: dayStart(d), end: dayStart(d) + 86400000 } }, x);
let feed = [
  day(t, { puzzles: { score: { win: 4, loss: 2, draw: 0, rp: { before: 1840, after: 1846 } } } }),
  day(addDays(t, -1), { puzzles: { score: { win: 19, loss: 6, draw: 0, rp: { before: 1830, after: 1850 } } }, storm: { runs: 2, score: 31 }, games: { blitz: { win: 2 } } }),
  day(addDays(t, -3), { puzzles: { score: { win: 10, loss: 2, draw: 0, rp: { before: 1820, after: 1830 } } }, racer: { runs: 3, score: 22 } }),
  day(addDays(t, -10), { puzzles: { score: { win: 30, loss: 5, draw: 0, rp: { before: 1800, after: 1820 } } } })];
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1100, height: 900 } }); const errors = [];
  let asked = [];
  await ctx.route('https://lichess.org/api/user/**', r => { asked.push(r.request().url()); r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(feed) }); });
  const open = async (uid, hash = '') => { const p = await ctx.newPage(); p.on('pageerror', e => errors.push(uid + ': ' + e.message)); await p.addInitScript(FAKE_SUPA(uid)); await p.goto(URL + hash); return p; };
  const log = p => p.evaluate(() => JSON.parse(localStorage.getItem('fdb:data/users/tom/st-me')).worklog);
  const first = await open(null);
  await first.evaluate(({ tom, noa }) => { localStorage.clear(); localStorage.setItem('fcoaches', JSON.stringify(['tom', 'noa'])); localStorage.setItem('fplayers', JSON.stringify(['tom', 'noa']));
    const put = (k, v) => localStorage.setItem('fdb:' + k, JSON.stringify(v));
    put('data/users/tom/settings', { coachName: 'Tom Levi', lang: 'en' }); put('data/users/tom/st-me', tom);
    put('data/users/noa/settings', { coachName: 'Noa', lang: 'en' }); put('data/users/noa/st-n', noa); },
  { tom: blank('st-me', { name: 'Tom Levi', self: true, setup: 'self', usernames: { 'lichess.org': 'tomlevi' },
      worklog: [{ id: 'w-hand', date: addDays(t, -3), what: 'Tactics', site: 'Lichess', exercise: 'Puzzles (rated)', minutes: 20, attempted: 12, correct: 10, by: 'student' }] }),
    noa: blank('st-n', { name: 'Noa Bar', self: true, setup: 'self' }) });
  await first.close();
  // 1. Tom opens the app: the last week's Lichess puzzles land in his log
  const tom = await open('tom'); await tom.waitForTimeout(4500);
  check(asked.length === 1 && /\/api\/user\/tomlevi\/activity$/.test(asked[0]), 'the app reads Tom’s public Lichess activity: ' + asked.join());
  let w = await log(tom); const by = id => w.find(x => x.id === id);
  const y = by('li-' + addDays(t, -1) + '-puzzles');
  check(y && y.what === 'Tactics' && y.site === 'Lichess' && y.exercise === 'Puzzles (rated)' && y.attempted === 25 && y.correct === 19 && y.prating === 1850 && y.minutes === 25 && y.auto === 'lichess' && y.by === 'student',
    "yesterday's puzzles: 25 tried, 19 solved, rating 1850, about 25 minutes: " + JSON.stringify(y));
  const st = by('li-' + addDays(t, -1) + '-storm');
  check(st && st.exercise === 'Puzzle Storm' && st.score === 31 && st.runs === 2 && st.minutes === 6 && st.note === '2 runs', 'Puzzle Storm: 2 runs, best 31, 6 minutes');
  check(by('li-' + t + '-puzzles') && by('li-' + t + '-puzzles').attempted === 6 && by('li-' + t + '-puzzles').minutes === 6, "today's 6 puzzles so far");
  check(!by('li-' + addDays(t, -3) + '-puzzles') && by('li-' + addDays(t, -3) + '-racer'), 'a day already logged by hand keeps its own entry; that day’s Racer is still added');
  check(!w.some(x => x.date === addDays(t, -10)), 'nothing older than a week');
  check(w.length === 5, '4 entries added to the one logged by hand: ' + w.length);
  check((await tom.textContent('#toast')).includes('Added from Lichess: 4 practice entries'), 'a toast says what was added');
  // 2. the Practice page
  await tom.goto(URL + '#/student/st-me/work'); await tom.waitForTimeout(800);
  let v = await tom.textContent('#view');
  check(v.includes('Lichess puzzles are added by themselves from') && v.includes('tomlevi') && v.includes('checked'), 'Practice says puzzles come from tomlevi, and when it was checked');
  check((await tom.$$eval('.tag', ts => ts.filter(x => x.textContent === 'auto').length)) === 4, 'each added entry is marked “auto”');
  check(v.includes('Accuracy'), 'the tactics statistics count them');
  await tom.screenshot({ path: path.join(__dirname, 'out-lichess-practice.png'), fullPage: true });
  // 3. today goes on: Check now brings today's entry up to date
  feed[0] = day(t, { puzzles: { score: { win: 9, loss: 3, draw: 0, rp: { before: 1840, after: 1858 } } } });
  await tom.click('[data-a=liNow]'); await tom.waitForTimeout(1200);
  w = await log(tom);
  check(by('li-' + t + '-puzzles').attempted === 12 && by('li-' + t + '-puzzles').minutes === 12 && by('li-' + t + '-puzzles').prating === 1858 && w.length === 5, "today's entry grows to 12 puzzles, no new entry");
  // 4. an entry Tom corrected stays as he wrote it
  await tom.evaluate(id => { const k = 'fdb:data/users/tom/st-me', s = JSON.parse(localStorage.getItem(k)); s.worklog.find(x => x.id === id).minutes = 40; localStorage.setItem(k, JSON.stringify(s)); }, 'li-' + t + '-puzzles');
  await tom.reload(); await tom.waitForTimeout(1000);
  feed[0] = day(t, { puzzles: { score: { win: 15, loss: 3, draw: 0, rp: { before: 1840, after: 1870 } } } });
  await tom.goto(URL + '#/student/st-me/work'); await tom.waitForTimeout(3500);
  w = await log(tom);
  check(by('li-' + t + '-puzzles').minutes === 40 && by('li-' + t + '-puzzles').attempted === 12, 'the entry he edited (40 minutes) is left as he wrote it');
  // 5. one he deleted isn't added back
  await tom.click('[data-a=editLog][data-id="li-' + addDays(t, -1) + '-storm"]').catch(async () => {
    await tom.evaluate(id => { const el = [...document.querySelectorAll('[data-a=editLog]')].find(x => x.dataset.id === id); el && el.click(); }, 'li-' + addDays(t, -1) + '-storm'); });
  await tom.waitForSelector('#modal[open]'); await tom.click('#modal[open] button.danger'); await tom.waitForSelector('#modal[open] button[type=submit]'); await tom.click('#modal[open] button[type=submit]'); await tom.waitForTimeout(600);
  await tom.click('[data-a=liNow]'); await tom.waitForTimeout(1200);
  w = await log(tom);
  check(!by('li-' + addDays(t, -1) + '-storm'), 'the Storm entry he deleted stays deleted');
  // 6. a second device doesn't add anything twice
  const tom2 = await open('tom', '#/student/st-me/work'); await tom2.waitForTimeout(4500);
  w = await log(tom2);
  check(w.filter(x => x.id === 'li-' + addDays(t, -1) + '-puzzles').length === 1 && new Set(w.map(x => x.id)).size === w.length, 'another device adds nothing twice');
  // 7. a player with no Lichess username is told how to turn it on
  const noa = await open('noa', '#/student/st-n/work'); await noa.waitForTimeout(3500);
  check(asked.every(u => !/noa/.test(u)) && (await noa.textContent('#view')).includes('Solve puzzles on Lichess? Add your Lichess username'), 'without a username: nothing is read, and Practice says how to turn it on');
  await noa.click('[data-un="lichess.org"]'); await noa.waitForSelector('#modal[open] #f_name');
  await noa.fill('#f_name', 'noabar'); await noa.click('#modal button[type=submit]'); await noa.waitForTimeout(600);
  await noa.click('[data-a=liNow]'); await noa.waitForTimeout(1500);
  check(asked.some(u => /\/noabar\/activity$/.test(u)) && (await noa.evaluate(() => JSON.parse(localStorage.getItem('fdb:data/users/noa/st-n')).worklog.length)) === 4, 'after adding it, Check now brings in her puzzles');
  // 8. Lichess not answering
  await ctx.unroute('https://lichess.org/api/user/**'); await ctx.route('https://lichess.org/api/user/**', r => r.abort());
  await noa.click('[data-a=liNow]'); await noa.waitForTimeout(800);
  check((await noa.textContent('#toast')).includes('Couldn’t reach Lichess'), 'when Lichess can’t be reached, Check now says so');
  // Hebrew
  await noa.locator('[data-lang]:visible').first().click(); await noa.waitForTimeout(800);
  check((await noa.textContent('#view')).includes('התרגילים מליצ׳ס נוספים כאן מעצמם'), 'in Hebrew');
  check(!errors.length, 'no page errors ' + errors.join(' | '));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();

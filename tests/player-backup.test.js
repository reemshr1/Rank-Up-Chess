// A player downloads their own backup from Progress → Your data, and any of the nightly copies; a parent's file has
// every child. Coaches' students don't get the card.
const { chromium } = require('playwright');
const { FAKE_SUPA } = require('./fakesupa.js');
const fs = require('fs');
const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '../index.html');
const pad = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const addDays = (s, n) => { const d = new Date(s + 'T00:00'); d.setDate(d.getDate() + n); return iso(d); };
const t = iso(new Date());
let fails = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fails++; };
const blank = (id, extra) => Object.assign({ id, name: '', active: true, rate: 0, noId: true, ratingType: 'FIDE', rating: '', ratings: [], sessions: [], tasks: [], worklog: [], repertoire: [], tournaments: [], payments: [], charges: [], books: [], slots: [], training: [], requests: [], fitness: [], fitnessGoal: 0, sleep: [], createdAt: addDays(t, -60) }, extra);
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1100, height: 900 }, acceptDownloads: true }); const errors = [];
  const open = async (uid) => { const p = await ctx.newPage(); p.on('pageerror', e => errors.push(uid + ': ' + e.message)); await p.addInitScript(FAKE_SUPA(uid)); await p.goto(URL); return p; };
  const first = await open('coach');
  await first.evaluate(({ t, tom, game, task, maya, noa, nightly }) => { localStorage.clear(); localStorage.setItem('fcoach', 'coach');
    localStorage.setItem('fcoaches', JSON.stringify(['tom', 'dana'])); localStorage.setItem('fplayers', JSON.stringify(['tom', 'dana']));
    const put = (k, v) => localStorage.setItem('fdb:' + k, JSON.stringify(v));
    put('data/users/coach/settings', { coachName: 'Raem', currency: '₪' });
    put('data/users/tom/settings', { coachName: 'Tom Levi', currency: '₪', lang: 'en' }); put('data/users/tom/st-me', tom); put('data/users/tom/gm-1', game); put('data/users/tom/as-1', task);
    put('data/users/dana/settings', { coachName: 'Maya Cohen', currency: '₪', lang: 'en' }); put('data/users/dana/st-m', maya); put('data/users/dana/st-n', noa);
    localStorage.setItem('fbackups', '{}'); localStorage.setItem('fbackups:tom', JSON.stringify(nightly)); },
  { t, tom: blank('st-me', { name: 'Tom Levi', self: true, setup: 'self', worklog: [{ id: 'w1', date: t, what: 'Tactics', minutes: 30, by: 'student' }], tournaments: [{ id: 'tr1', name: 'Haifa Open', start: addDays(t, 9) }] }),
    game: { id: 'gm-1', studentId: 'st-me', date: t, white: 'Tom', black: 'X', result: '1-0' },
    task: { id: 'as-1', studentId: 'st-me', title: '30 puzzles on pins', type: 'Tactics', status: 'Assigned', due: addDays(t, 3), assigned: t, games: [], by: 'self' },
    maya: blank('st-m', { name: 'Maya Cohen', self: true, setup: 'parent' }), noa: blank('st-n', { name: 'Noa Cohen', self: true, setup: 'parent', createdAt: addDays(t, -10) }),
    nightly: Object.fromEntries([1, 2].map(i => [addDays(t, -i), { app: 'rank-up', kind: 'nightly', exportedAt: addDays(t, -i) + 'T00:00:00Z',
      docs: { settings: { coachName: 'Tom Levi' }, 'st-me': { id: 'st-me', name: 'Tom Levi', self: true, worklog: [{ id: 'w0', date: addDays(t, -i), minutes: 10 }] }, 'as-1': { id: 'as-1', studentId: 'st-me', title: 'old task' } } }])) });
  await first.close();
  // Tom
  const tom = await open('tom'); await tom.waitForTimeout(2500);
  await tom.goto(URL + '#/progress'); await tom.waitForTimeout(1500);
  let v = await tom.textContent('#view');
  check(v.includes('Your data') && v.includes('Download everything on your board as one file') && v.includes('Book PDFs aren’t in it'), 'Progress has Your data, saying what the file holds');
  const [dl] = await Promise.all([tom.waitForEvent('download'), tom.click('[data-a=backup]')]);
  const file = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  check(dl.suggestedFilename() === 'rank-up-backup-' + t + '.json', 'the file is named by the day: ' + dl.suggestedFilename());
  check(file.app === 'rank-up' && file.students.length === 1 && file.students[0].worklog.length === 1 && file.students[0].tournaments[0].name === 'Haifa Open' && file.games.length === 1 && file.assignments[0].title === '30 puzzles on pins',
    "it holds Tom's practice, tournament, game and task");
  await tom.waitForTimeout(500);
  check((await tom.textContent('#view')).includes('Last downloaded:'), 'the card says when it was last downloaded');
  check(await tom.$$eval('#nightly li', e => e.length) === 2, 'the 2 nightly copies are listed');
  const [dn] = await Promise.all([tom.waitForEvent('download'), tom.click('#nightly [data-nb="' + addDays(t, -1) + '"]')]);
  const nf = JSON.parse(fs.readFileSync(await dn.path(), 'utf8'));
  check(nf.students[0].name === 'Tom Levi' && nf.assignments[0].title === 'old task', "a nightly copy downloads as a normal backup file");
  await tom.screenshot({ path: path.join(__dirname, 'out-pbackup.png'), fullPage: true });
  await tom.locator('[data-lang]:visible').first().click(); await tom.waitForTimeout(1000);
  v = await tom.textContent('#view');
  check(v.includes('הנתונים שלך') && v.includes('הורדת גיבוי') && v.includes('הורדה אחרונה'), 'in Hebrew');
  // a parent with two children
  const dana = await open('dana'); await dana.waitForTimeout(2500); await dana.goto(URL + '#/progress'); await dana.waitForTimeout(1500);
  v = await dana.textContent('#view');
  check(v.includes("each child’s practice") && v.includes('No nightly backup yet'), "the parent's card talks about each child; no nightly copy yet");
  const [dd] = await Promise.all([dana.waitForEvent('download'), dana.click('[data-a=backup]')]);
  const df = JSON.parse(fs.readFileSync(await dd.path(), 'utf8'));
  check(df.students.map(x => x.name).sort().join() === 'Maya Cohen,Noa Cohen', "the parent's file has both children");
  // a coach's student: no card
  const c = await open('coach'); await c.waitForTimeout(2000);
  check(!(await c.textContent('#view')).includes('Your data'), "the coach's app doesn't show it");
  check(!errors.length, 'no page errors ' + errors.join(' | '));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
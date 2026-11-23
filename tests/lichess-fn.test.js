// The "lichess" function (supabase/functions/lichess/index.ts), run as it is in Deno against a stand-in Supabase and
// a stand-in Lichess. The hourly job: refused without the database's secret; a player's board gets the entries
// straight in its record (the same entries the app makes, checked against the app's own code); a coach's student
// with the app gets them in their outbox, once; the rules: the last 7 days only, a day logged by hand left alone,
// a deleted entry never back (on the record, or a deletion still in the outbox), an untouched entry brought up to
// date and an edited one not; links not shared with this coach, or not this coach's, skipped; an inactive student
// skipped; Lichess busy (429) waited out; an unknown user reported, the rest carried on; a record saved meanwhile
// left for the next hour.
// Needs Deno (DENO=/path/to/deno, or deno on the PATH), like push-fn.test.js.
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto'), vm = require('vm'), { spawn } = require('child_process');
const { check, done } = require('./lib.js');
// "today" for the job: 2026-11-10, 18:00 in Israel
const NOW = '2026-11-10T16:00:00Z', T = '2026-11-10', D = n => new Date(Date.parse(T + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const dayStart = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const day = (d, x) => Object.assign({ interval: { start: dayStart(d), end: dayStart(d) + 86400000 } }, x);
const feeds = {
  tomlevi: [day(T, { puzzles: { score: { win: 9, loss: 3, draw: 0, rp: { before: 1840, after: 1852 } } } }), day(D(-1), { storm: { runs: 2, score: 30 }, racer: { runs: 1, score: 20 } }),
    day(D(-2), { puzzles: { score: { win: 5, loss: 0, draw: 0, rp: { after: 1830 } } } }), day(D(-3), { streak: { runs: 1, score: 14 } }), day(D(-9), { puzzles: { score: { win: 30, loss: 1, draw: 0 } } })],
  mayac: [day(T, { puzzles: { score: { win: 4, loss: 1, draw: 0, rp: { after: 1500 } } } }), day(D(-1), { storm: { runs: 1, score: 12 } }), day(D(-4), { puzzles: { score: { win: 7, loss: 3, draw: 0 } } })],
  shared: [day(T, { puzzles: { score: { win: 2, loss: 0, draw: 0 } } })] };
const st = (id, name, extra) => Object.assign({ id, name, active: true, worklog: [], usernames: {} }, extra);
const docs = {
  'data/users/tom': [{ id: 'settings', data: { coachName: 'Tom' } }, { id: 'st-me', data: st('st-me', 'Tom Levi', { self: true, usernames: { 'lichess.org': 'TomLevi', 'chess.com': 'TomCC' }, liGone: ['li-' + D(-3) + '-streak'],
    worklog: [{ id: 'hand', date: D(-1), what: 'Tactics', site: 'Lichess', exercise: 'Puzzle Racer', minutes: 10 }] }) }],
  'data/users/coach': [{ id: 'settings', data: { coachName: 'Raem' } },
    { id: 'st-m', data: st('st-m', 'Maya', { portal: { uid: 'u-m' }, usernames: { 'lichess.org': 'mayac' },
      worklog: [{ id: 'li-' + D(-4) + '-puzzles', date: D(-4), what: 'Tactics', site: 'Lichess', exercise: 'Puzzles (rated)', auto: 'lichess', attempted: 6, correct: 4, minutes: 20, autoMin: 6, autoN: 6, score: '', prating: '' }] }) },
    { id: 'st-x', data: st('st-x', 'Old', { active: false, usernames: { 'lichess.org': 'shared' } }) },
    { id: 'st-n', data: st('st-n', 'Noa', { portal: { uid: 'u-n' }, usernames: { 'lichess.org': 'shared' } }) },
    { id: 'st-g', data: st('st-g', 'Gal', { portal: { uid: 'u-g' }, usernames: { 'lichess.org': 'shared' } }) },
    { id: 'st-z', data: st('st-z', 'Zed', { usernames: { 'lichess.org': 'nobody', 'chess.com': 'nobodycc' } }) }],
  portal: [{ id: 'u-m', data: { coach: 'coach', linked: true } }, { id: 'u-n', data: { coach: 'coach', share: false } }, { id: 'u-g', data: { coach: 'someone-else' } }],
  'portal/u-m/inbox': [{ id: 'op-del', data: { type: 'worklog.delete', id: 'li-' + D(-1) + '-storm' } }] };
const updated = {}; const origLogs = Object.fromEntries(docs['data/users/coach'].filter(d => /^st-/.test(d.id)).map(d => [d.id, JSON.parse(JSON.stringify(d.data.worklog))])); Object.values(docs).flat().forEach(d => { d.updated_at = '2026-11-01T00:00:00.000000+00:00'; });
const db = { secret: 's3cret', coaches: [{ user_id: 'tom', kind: 'player' }, { user_id: 'coach', kind: 'coach' }, { user_id: 'moved', kind: 'moved' }] };
const writes = [];
const supa = http.createServer((req, res) => { let b = ''; req.on('data', c => b += c); req.on('end', () => {
  const u = new URL(req.url, 'http://x'), q = u.searchParams, send = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (req.headers.apikey !== 'svc') return send(401, {});
  if (u.pathname === '/rest/v1/lichess_job') return send(200, db.secret ? [{ secret: db.secret }] : []);
  if (u.pathname === '/rest/v1/coaches') { const kinds = (q.get('kind') || '').replace(/^in\.\(|\)$/g, '').split(','); return send(200, db.coaches.filter(c => kinds.includes(c.kind))); }
  if (u.pathname !== '/rest/v1/docs') return send(404, {});
  const col = (q.get('col') || '').replace(/^eq\./, ''), id = (q.get('id') || '').replace(/^eq\./, '');
  if (req.method === 'GET') return send(200, (docs[col] || []).filter(d => !id || d.id === id));
  if (req.method === 'POST') { const r = JSON.parse(b); writes.push({ how: 'POST', ...r }); const L = docs[r.col] = docs[r.col] || []; const i = L.findIndex(x => x.id === r.id);
    const row = { id: r.id, data: r.data, updated_at: r.updated_at }; if (i >= 0) L[i] = row; else L.push(row); return send(201, {}); }
  if (req.method === 'PATCH') { const r = JSON.parse(b), L = docs[col] || [], i = L.findIndex(x => x.id === id && x.updated_at === (q.get('updated_at') || '').replace(/^eq\./, ''));
    writes.push({ how: 'PATCH', col, id, hit: i >= 0, ...r }); if (i < 0) return send(200, []); L[i] = { id, data: r.data, updated_at: r.updated_at }; return send(200, [L[i]]); }
  send(404, {});
}); });
let busyOnce = true; const asked = [];
// ratings: Tom plays rapid on Lichess (blitz provisional, no classical games) and rapid and blitz on Chess.com; Maya rapid on Lichess
const profiles = { tomlevi: { perfs: { rapid: { games: 40, rating: 1650 }, blitz: { games: 3, rating: 1500, prov: true }, classical: { games: 0, rating: 1500, prov: true } } },
  mayac: { perfs: { rapid: { games: 12, rating: 1320 } } }, shared: { perfs: {} } };
const ccStats = { tomcc: { chess_rapid: { last: { rating: 1580, date: 1 } }, chess_blitz: { last: { rating: 1410, date: 1 } }, tactics: { highest: { rating: 2000 } } } };
const ccAsked = [];
const IL = (h, m = 10) => Date.UTC(2026, 10, 8, h - 2, m); // Israel is UTC+2 in November
const liGamesOf = { tomlevi: [
  { id: 'g1', variant: 'standard', speed: 'rapid', status: 'resign', createdAt: IL(9), winner: 'black', players: { white: { user: { id: 'tomlevi', name: 'TomLevi' } }, black: { user: { id: 'x' } } } },
  { id: 'g2', variant: 'standard', speed: 'blitz', status: 'mate', createdAt: IL(9, 40), winner: 'white', players: { white: { user: { id: 'y' } }, black: { user: { id: 'tomlevi' } } } },
  { id: 'g3', variant: 'standard', speed: 'rapid', status: 'outoftime', createdAt: IL(18), winner: 'white', players: { white: { user: { id: 'tomlevi' } }, black: { user: { id: 'z' } } } },
  { id: 'g4', variant: 'standard', speed: 'rapid', status: 'aborted', createdAt: IL(18, 30), players: { white: { user: { id: 'tomlevi' } }, black: { user: { id: 'z' } } } }] };
const ccArchive = { games: [
  { rules: 'chess', time_class: 'rapid', pgn: '[UTCDate "2026.11.08"]\n[UTCTime "07:20:00"]', end_time: 0, white: { username: 'TomCC', result: 'agreed' }, black: { username: 'q', result: 'agreed' } },
  { rules: 'chess', time_class: 'blitz', pgn: '[UTCDate "2026.11.08"]\n[UTCTime "16:05:00"]', end_time: 0, white: { username: 'q', result: 'resigned' }, black: { username: 'TomCC', result: 'win' } },
  { rules: 'bughouse', time_class: 'blitz', pgn: '', end_time: 1, white: { username: 'TomCC', result: 'win' }, black: { username: 'q', result: 'lose' } }] };
const chesscom = http.createServer((req, res) => {
  if (/^\/pub\/player\/tomcc\/games\/archives$/.test(req.url)) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ archives: ['https://api.chess.com/pub/player/tomcc/games/2026/06', 'https://api.chess.com/pub/player/tomcc/games/2026/11'] })); }
  if (/^\/pub\/player\/tomcc\/games\/2026\/11$/.test(req.url)) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(ccArchive)); }
  if (/\/games\//.test(req.url)) { ccAsked.push({ u: 'old-archive:' + req.url }); res.writeHead(404); return res.end('{}'); }
  const m = /^\/pub\/player\/([^/]+)\/stats$/.exec(req.url), u = m && decodeURIComponent(m[1]);
  ccAsked.push({ u, ua: req.headers['user-agent'] || '' });
  if (!ccStats[u]) { res.writeHead(404); return res.end('{}'); } res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(ccStats[u])); });
const liAsked = [];
const lichess = http.createServer((req, res) => {
  const gm = /^\/api\/games\/user\/([^/?]+)\?(.*)$/.exec(req.url);
  if (gm) { liAsked.push({ u: gm[1], q: gm[2], accept: req.headers.accept }); const L = liGamesOf[decodeURIComponent(gm[1]).toLowerCase()] || [];
    res.writeHead(200, { 'Content-Type': 'application/x-ndjson' }); return res.end(L.map(g => JSON.stringify(g)).join('\n') + '\n'); }
  const pm = /^\/api\/user\/([^/]+)$/.exec(req.url);
  if (pm) { const p = profiles[decodeURIComponent(pm[1]).toLowerCase()]; asked.push({ profile: pm[1], ua: req.headers['user-agent'] || '' });
    if (!p) { res.writeHead(404); return res.end('{}'); } res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(p)); }
  const m = /^\/api\/user\/([^/]+)\/activity$/.exec(req.url); const user = m && decodeURIComponent(m[1]).toLowerCase();
  asked.push({ user, ua: req.headers['user-agent'] || '' });
  if (user === 'mayac' && busyOnce) { busyOnce = false; res.writeHead(429); return res.end(); }
  if (!feeds[user]) { res.writeHead(404); return res.end('{}'); }
  res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(feeds[user])); });
const call = body => fetch('http://localhost:8001/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(async r => ({ status: r.status, body: await r.json() }));
const wait = ms => new Promise(r => setTimeout(r, ms));
const rec = (col, id) => (docs[col].find(d => d.id === id) || {}).data;
const inbox = l => (docs['portal/' + l + '/inbox'] || []).map(d => d.data).filter(o => o.type === 'worklog.upsert');
// the app's own liEntries, from index.html, to check the function makes the same entries
const appEntries = (() => { const src = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
  const a = src.indexOf('const LI_KINDS'), b = src.indexOf('// Adds what\'s new to the student\'s log'); const ctx = {}; vm.createContext(ctx);
  vm.runInContext(src.slice(a, b).replace(/^const liGone[\s\S]*?^function liForget[^\n]*\n/m, '') + ';this.liEntries = liEntries;', ctx); return ctx.liEntries; })();
(async () => {
  await new Promise(r => supa.listen(54331, r)); await new Promise(r => lichess.listen(54332, r)); await new Promise(r => chesscom.listen(54333, r));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lichessfn-'));
  const env = Object.assign({}, process.env, { SUPABASE_URL: 'http://localhost:54331', SUPABASE_SERVICE_ROLE_KEY: 'svc', LICHESS_URL: 'http://localhost:54332', CHESSCOM_URL: 'http://localhost:54333', LICHESS_PAUSE_MS: '20', LICHESS_BUSY_MS: '300',
    NO_PROXY: 'localhost,127.0.0.1', no_proxy: 'localhost,127.0.0.1', PORT: '8001' });
  const fn = spawn(process.env.DENO || 'deno', ['run', '--allow-net', '--allow-env', '--allow-read', '--allow-sys', path.join(dir, 'run.ts')], { cwd: dir, env, stdio: ['ignore', 'pipe', 'pipe'] });
  // the function as it is, on port 8001 (the push function's test uses 8000)
  fs.writeFileSync(path.join(dir, 'run.ts'), fs.readFileSync(path.resolve(__dirname, '../supabase/functions/lichess/index.ts'), 'utf8').replace('Deno.serve(async', 'Deno.serve({ port: 8001 }, async'));
  let log = ''; fn.stdout.on('data', d => log += d); fn.stderr.on('data', d => log += d);
  let up = false; for (let i = 0; i < 240 && !up; i++) { try { await fetch('http://localhost:8001/', { method: 'OPTIONS' }); up = true; } catch (e) { await wait(500); } }
  try {
    check(up, 'the function starts in Deno' + (up ? '' : ': ' + log.slice(-400)));
    const secret = crypto.createHash('sha256').update(db.secret).digest('hex');
    const bad = await call({ action: 'sync', secret: 'nope', now: NOW });
    check(bad.status === 403 && !asked.length && !writes.length, 'without the database’s secret: refused, Lichess not asked, nothing written');
    const r1 = await call({ action: 'sync', secret, now: NOW });
    check(r1.status === 200 && r1.body.records === 5 && r1.body.users === 4, 'one run: every active record with a username, each Lichess user read once ' + JSON.stringify(r1.body));
    check(asked.length && asked.every(a => /^RankUp/.test(a.ua)), 'Lichess is asked with the app’s name');
    check(r1.body.errors.some(e => /Couldn't read Lichess for nobody$/.test(e)) && r1.body.records === 5, 'an unknown Lichess user is reported, and the others carry on');
    check(asked.filter(a => a.user === 'mayac').length === 2, 'Lichess busy (429): it waits and asks again');
    // the player's board: straight into the record
    const tom = rec('data/users/tom', 'st-me'), ids = tom.worklog.map(w => w.id).sort();
    check(JSON.stringify(ids) === JSON.stringify(['hand', 'li-' + D(-1) + '-storm', 'li-' + D(-2) + '-puzzles', 'li-' + T + '-puzzles'].sort()), 'Tom’s record gets today’s puzzles, the Storm and older puzzles: ' + ids.join(', '));
    check(!ids.includes('li-' + D(-1) + '-racer'), 'not the Racer of a day he logged by hand');
    check(!ids.includes('li-' + D(-3) + '-streak'), 'not the Streak he deleted (liGone on the record)');
    check(!ids.includes('li-' + D(-9) + '-puzzles'), 'nothing older than 7 days');
    const pz = tom.worklog.find(w => w.id === 'li-' + T + '-puzzles'), mine = appEntries(T, feeds.tomlevi[0]).find(w => w.id === pz.id);
    check(JSON.stringify(pz) === JSON.stringify(mine) && pz.attempted === 12 && pz.correct === 9 && pz.prating === 1852 && pz.minutes === 12 && pz.auto === 'lichess', 'the entry is exactly the one the app makes (12 tried, 9 solved, rating 1852, 12 minutes, “auto”)');
    check(writes.some(w => w.how === 'PATCH' && w.id === 'st-me' && w.hit), 'written only if nobody saved the record meanwhile');
    // the coach's student: to her outbox
    const ops = inbox('u-m');
    check(ops.map(o => o.item.id).sort().join() === ['li-' + T + '-puzzles'].join() && ops[0].item.by === 'student', 'Maya’s outbox gets today’s puzzles, as from her own app');
    check(!ops.some(o => o.item.id === 'li-' + D(-1) + '-storm'), 'not the Storm she deleted (the deletion still waiting in her outbox)');
    check(!ops.some(o => o.item.id === 'li-' + D(-4) + '-puzzles'), 'not the entry the coach’s record has and someone edited (20 minutes): left as it is');
    check(!rec('data/users/coach', 'st-m').worklog.some(w => w.id === 'li-' + T + '-puzzles'), 'the coach’s records aren’t written: the coach’s app takes it in');
    check(!inbox('u-n').length && !inbox('u-g').length, 'not for a link that doesn’t share with this coach, or isn’t this coach’s');
    check(!writes.some(w => /st-x/.test(w.id || '')) && writes.filter(w => w.col === 'data/users/coach').every(w => JSON.stringify(w.data.worklog) === JSON.stringify(origLogs[w.id])), 'nothing for an inactive student; no practice straight into a coach’s records (only ratings and figures)');
    // ratings
    const rt = (col, id) => (rec(col, id).ratings || []).map(r => r.source + ':' + r.value + ':' + r.date).sort().join();
    check(rt('data/users/tom', 'st-me') === ['Chess.com Blitz:1410:' + T, 'Chess.com Rapid:1580:' + T, 'Lichess Rapid:1650:' + T].join(), 'first time with usernames: Tom’s Lichess Rapid and Chess.com Rapid and Blitz ratings, not the provisional or unplayed lists: ' + rt('data/users/tom', 'st-me'));
    check(rt('data/users/coach', 'st-m') === 'Lichess Rapid:1320:' + T, 'a coach’s student gets hers in the coach’s records');
    check(r1.body.ratings === 4 && r1.body.errors.some(e => /Chess.com for nobodycc/.test(e)), 'four ratings; an unknown Chess.com user is reported ' + JSON.stringify(r1.body));
    check(ccAsked.filter(a => !/^old-archive/.test(a.u)).every(a => /^RankUp \(.*https:\/\//.test(a.ua)) && ccAsked.some(a => a.u === 'tomcc'), 'Chess.com is asked with the app’s name and address, for the username in lower case');
    // when they play best
    const os = rec('data/users/tom', 'st-me').onlineStats;
    check(os && os.days === 90 && os.n === 5, 'Tom’s figures: 5 online games of the last 3 months (the aborted one and a bughouse game don’t count): ' + JSON.stringify(os));
    check(os && JSON.stringify(os.hours.all) === JSON.stringify({ 9: [3, 0.5], 18: [2, 2] }), 'by hour, Israel time: 09:00 three games, ½ point; 18:00 two games, two points');
    check(os && JSON.stringify(os.hours.rapid) === JSON.stringify({ 9: [2, 0.5], 18: [1, 1] }) && JSON.stringify(os.hours.blitz) === JSON.stringify({ 9: [1, 0], 18: [1, 1] }) && !os.hours.bullet, 'and by kind: rapid, blitz (no bullet played)');
    check(liAsked.some(a => a.u.toLowerCase() === 'tomlevi' && /since=\d+/.test(a.q) && /max=300/.test(a.q) && a.accept === 'application/x-ndjson'), 'Lichess: the last 3 months, at most 300 games, one per line');
    check(!ccAsked.some(a => /2026\/06/.test(a.u)), 'Chess.com: only the months in the last 3 months are read');
    check(JSON.stringify(rec('data/users/coach', 'st-m').onlineStats) === JSON.stringify({ days: 90, n: 0, hours: {} }), 'Maya has no online games: written once as none (so not asked again until the next morning)');
    check(r1.body.stats >= 2, 'figures written: ' + r1.body.stats);
    // again: nothing twice
    const n = writes.length; await call({ action: 'sync', secret, now: NOW });
    check(writes.length === n && inbox('u-m').length === 1, 'the next hour, nothing new: nothing written, nothing added twice');
    // the next morning (06:05 Israel): ratings checked again; a changed one updates the month’s entry, not a second one
    profiles.tomlevi.perfs.rapid.rating = 1662; const ccBefore = ccAsked.length;
    const rm = await call({ action: 'sync', secret, now: T + 'T04:05:00Z' });
    check(ccAsked.length > ccBefore && rec('data/users/tom', 'st-me').ratings.filter(r => r.source === 'Lichess Rapid').length === 1 && rec('data/users/tom', 'st-me').ratings.find(r => r.source === 'Lichess Rapid').value === 1662, 'each morning the ratings are checked again; a new Lichess Rapid rating updates this month’s entry (one per month)');
    check(rm.body.ratings === 1, 'only what changed is written: ' + JSON.stringify(rm.body));
    // more puzzles today: the untouched entry is brought up to date, an edited one isn't
    feeds.tomlevi[0].puzzles.score.win = 15; feeds.mayac[0].puzzles.score.win = 8;
    await call({ action: 'sync', secret, now: NOW });
    check(rec('data/users/tom', 'st-me').worklog.find(w => w.id === 'li-' + T + '-puzzles').attempted === 18, 'more puzzles today: Tom’s untouched entry is brought up to date (18)');
    const mops = inbox('u-m').filter(o => o.item.id === 'li-' + T + '-puzzles');
    check(mops.length === 2 && mops.some(o => o.item.attempted === 5) && mops.some(o => o.item.attempted === 9), 'Maya gets the update as one more change (her coach’s app applies them in order)');
    const tm = rec('data/users/tom', 'st-me'); tm.worklog.find(w => w.id === 'li-' + T + '-puzzles').minutes = 40; docs['data/users/tom'][1].updated_at = '2026-11-10T16:30:00.000000+00:00';
    feeds.tomlevi[0].puzzles.score.win = 25;
    await call({ action: 'sync', secret, now: NOW });
    check(rec('data/users/tom', 'st-me').worklog.find(w => w.id === 'li-' + T + '-puzzles').minutes === 40 && rec('data/users/tom', 'st-me').worklog.find(w => w.id === 'li-' + T + '-puzzles').attempted === 18, 'once Tom edited it (40 minutes), it’s left as he wrote it');
    // a record saved by the app a moment before: left for the next hour
    feeds.tomlevi.push(day(D(-5), { storm: { runs: 1, score: 9 } }));
    const realUpdated = docs['data/users/tom'][1].updated_at; docs['data/users/tom'][1].updated_at = 'changing';
    const orig = supa.listeners('request')[0]; supa.removeAllListeners('request');
    supa.on('request', (req, res) => { if (req.method === 'PATCH') { const row = docs['data/users/tom'][1]; row.updated_at = realUpdated; } orig(req, res); });
    const r6 = await call({ action: 'sync', secret, now: NOW });
    check(r6.body.errors.some(e => /Changed meanwhile/.test(e)) && !rec('data/users/tom', 'st-me').worklog.some(w => w.id === 'li-' + D(-5) + '-storm'), 'a record the app saved a moment before isn’t overwritten (the next hour tries again)');
    const r7 = await call({ action: 'sync', secret, now: NOW });
    check(rec('data/users/tom', 'st-me').worklog.some(w => w.id === 'li-' + D(-5) + '-storm'), 'and the next hour adds it');
    db.secret = null;
    check((await call({ action: 'sync', secret, now: NOW })).status === 500, 'without lichess-sync.sql run: says so');
  } catch (e) { check(false, 'the run stopped: ' + (e && e.stack || e) + '\n' + log.slice(-600)); }
  fn.kill(); supa.close(); lichess.close(); chesscom.close(); fs.rmSync(dir, { recursive: true, force: true });
  done();
})();

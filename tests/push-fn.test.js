// The "push" function (supabase/functions/push/index.ts), run as it is in Deno against a stand-in Supabase (REST and
// auth) and a stand-in push service that decrypts every alert as a phone would.
//  - The hourly players job: refused without the database's secret; at 17:00 a practice nudge after 2 days without
//    practice (in Hebrew for a Hebrew board), once, remembered on the board; at 19:00 a tournament or a task due
//    tomorrow; a parent's board with two children: the parent hears about each child and each child gets their own,
//    with marks kept per child, and practice a child sent but the parent's app hasn't taken in yet counts; a device
//    that's gone (410) is forgotten.
//  - The app's actions: key, subscribe and unsubscribe need a sign-in; a bad subscription is refused; only a coach may
//    send, and only to their own students and parents (a second coach's link "<account>.2" reaches the account).
// Needs Deno (DENO=/path/to/deno, or deno on the PATH) and the http_ece package (npm i deno http_ece).
const http = require('http'), https = require('https'), fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto'), { spawn, execFileSync } = require('child_process');
const ece = require('http_ece');
const { check, done } = require('./lib.js');
const id = n => n.repeat(8) + '-' + n.repeat(4) + '-' + n.repeat(4) + '-' + n.repeat(4) + '-' + n.repeat(12);
const TOM = id('a'), DANA = id('b'), KID1 = id('c'), KID2 = id('d'), BEN = id('e'), ELI = id('f'), COACH = id('1'), STU = id('2'), OTHER = id('3'), STRANGER = id('4');
// the phone's keys, as a browser makes them
const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys(); const authSecret = crypto.randomBytes(16);
const b64u = x => Buffer.from(x).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const sub = ep => ({ endpoint: 'https://localhost:54322/' + ep, keys: { p256dh: b64u(ecdh.getPublicKey()), auth: b64u(authSecret) } });
const row = (uid, ep) => ({ endpoint: sub(ep).endpoint, user_id: uid, sub: sub(ep) });
const st = (sid, name, extra) => Object.assign({ id: sid, name, self: true, setup: 'self', active: true, createdAt: '2026-10-01', worklog: [], tournaments: [] }, extra);
const db = {
  keys: [], coaches: [{ user_id: TOM, kind: 'player' }, { user_id: DANA, kind: 'player' }, { user_id: BEN, kind: 'player' }, { user_id: ELI, kind: 'player' }, { user_id: COACH, kind: 'coach' }, { user_id: OTHER, kind: 'coach' }],
  subs: [row(TOM, 'tom'), row(DANA, 'dana'), row(KID1, 'kid1'), row(KID2, 'kid2'), row(BEN, 'ben'), row(BEN, 'ben-gone'), row(COACH, 'coach'), row(STU, 'stu'), row(STRANGER, 'stranger')],
  docs: {
    ['data/users/' + TOM]: [{ id: 'settings', data: { lang: 'en' } }, { id: 'st-t', data: st('st-t', 'Tom Levi', { worklog: [{ id: 'w0', date: '2026-11-01', minutes: 20 }], tournaments: [{ id: 't1', name: 'Haifa Open', start: '2026-11-11' }, { id: 't2', name: 'Later Cup', start: '2026-11-20' }] }) },
      { id: 'lg-st-t-2026', data: { sid: 'st-t', worklog: [{ id: 'w1', date: '2026-11-07', minutes: 30 }] } },
      { id: 'as-1', data: { id: 'as-1', studentId: 'st-t', title: '30 puzzles on pins', status: 'Assigned', due: '2026-11-11' } },
      { id: 'as-2', data: { id: 'as-2', studentId: 'st-t', title: 'Already done', status: 'Reviewed', due: '2026-11-11' } }],
    ['data/users/' + DANA]: [{ id: 'settings', data: { lang: 'en' } },
      { id: 'st-m', data: st('st-m', 'Maya Cohen', { setup: 'parent', portal: { uid: KID1 }, worklog: [{ id: 'm1', date: '2026-11-06', minutes: 30 }], tournaments: [{ id: 'tm', name: 'Junior Cup', start: '2026-11-11' }] }) },
      { id: 'st-n', data: st('st-n', 'Noa Cohen', { setup: 'parent', portal: { uid: KID2 }, worklog: [{ id: 'n1', date: '2026-11-05', minutes: 30 }] }) }],
    ['portal/' + KID2 + '/inbox']: [{ id: 'op-1', data: { type: 'worklog.upsert', item: { id: 'n2', date: '2026-11-09', minutes: 25 } } }],
    ['data/users/' + BEN]: [{ id: 'settings', data: { lang: 'he' } }, { id: 'st-b', data: st('st-b', 'Ben Gal', { worklog: [{ id: 'b1', date: '2026-11-08', minutes: 30 }] }) }],
    ['data/users/' + ELI]: [{ id: 'settings', data: { lang: 'en' } }, { id: 'st-e', data: st('st-e', 'Eli Ron', { worklog: [{ id: 'e1', date: '2026-11-10', minutes: 30 }] }) }],
    portal: [{ id: STU, data: { coach: COACH } }, { id: STU + '.2', data: { coach: COACH } }, { id: STRANGER, data: { coach: OTHER } }] } };
const tokens = { 'tok-coach': COACH, 'tok-stu': STU, 'tok-tom': TOM };
const inList = v => (v || '').replace(/^in\.\(|\)$/g, '').split(',').map(x => x.replace(/^"|"$/g, ''));
const supa = http.createServer((req, res) => { let b = ''; req.on('data', c => b += c); req.on('end', () => {
  const u = new URL(req.url, 'http://x'), q = u.searchParams, send = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (req.headers.apikey !== 'svc') return send(401, {});
  const p = u.pathname;
  if (p === '/auth/v1/user') { const who = tokens[(req.headers.authorization || '').replace(/^Bearer /, '')]; return who ? send(200, { id: who }) : send(401, {}); }
  if (p === '/rest/v1/push_keys') { if (req.method === 'GET') return send(200, db.keys); if (!db.keys.length) db.keys.push(JSON.parse(b)); return send(201, {}); }
  if (p === '/rest/v1/coaches') return send(200, db.coaches.filter(c => (!q.get('kind') || 'eq.' + c.kind === q.get('kind')) && (!q.get('user_id') || 'eq.' + c.user_id === q.get('user_id'))).map(c => ({ user_id: c.user_id })));
  if (p === '/rest/v1/docs' && req.method === 'GET') { const col = (q.get('col') || '').replace(/^eq\./, ''); let L = db.docs[col] || [];
    if (q.get('data->>coach')) L = L.filter(d => 'eq.' + d.data.coach === q.get('data->>coach'));
    if (q.get('id')) { const ids = inList(q.get('id')); L = L.filter(d => ids.includes(d.id)); }
    return send(200, L); }
  if (p === '/rest/v1/docs' && req.method === 'POST') { const r = JSON.parse(b); const L = db.docs[r.col] = db.docs[r.col] || []; const i = L.findIndex(x => x.id === r.id);
    if (i >= 0) L[i] = { id: r.id, data: r.data }; else L.push({ id: r.id, data: r.data }); return send(201, {}); }
  if (p === '/rest/v1/push_subs' && req.method === 'GET') { const ids = inList(q.get('user_id')); return send(200, db.subs.filter(x => ids.includes(x.user_id))); }
  if (p === '/rest/v1/push_subs' && req.method === 'POST') { const r = JSON.parse(b); db.subs = db.subs.filter(x => x.endpoint !== r.endpoint).concat([r]); return send(201, {}); }
  if (p === '/rest/v1/push_subs' && req.method === 'DELETE') { const ep = (q.get('endpoint') || '').replace(/^eq\./, ''), who = (q.get('user_id') || '').replace(/^eq\./, '');
    db.subs = db.subs.filter(x => !(x.endpoint === ep && (!who || x.user_id === who))); return send(204, {}); }
  send(404, { p });
}); });
// a push service: a device whose address is "...-gone" no longer exists (410)
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pushfn-'));
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', dir + '/key.pem', '-out', dir + '/cert.pem', '-days', '2', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { stdio: 'ignore' });
fs.writeFileSync(dir + '/ca.pem', fs.readFileSync(dir + '/cert.pem', 'utf8') + '\n' + (fs.existsSync('/root/.ccr/ca-bundle.crt') ? fs.readFileSync('/root/.ccr/ca-bundle.crt', 'utf8') : ''));
const got = [];
const pushSvc = https.createServer({ key: fs.readFileSync(dir + '/key.pem'), cert: fs.readFileSync(dir + '/cert.pem') }, (req, res) => { const ch = []; req.on('data', c => ch.push(c)); req.on('end', () => {
  if (/-gone$/.test(req.url)) { res.writeHead(410); return res.end(); }
  try { got.push({ ep: req.url.slice(1), ttl: +req.headers.ttl, vapid: /^vapid t=/.test(req.headers.authorization || ''), msg: JSON.parse(ece.decrypt(Buffer.concat(ch), { version: 'aes128gcm', privateKey: ecdh, authSecret }).toString()) }); }
  catch (e) { got.push({ ep: req.url.slice(1), err: String(e) }); }
  res.writeHead(201); res.end(); }); });
const call = (body, tok) => fetch('http://localhost:8000/', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}), body: JSON.stringify(body) }).then(async r => ({ status: r.status, body: await r.json() }));
const wait = ms => new Promise(r => setTimeout(r, ms));
const to = ep => got.filter(g => g.ep === ep).map(g => g.msg && g.msg.body);
(async () => {
  await new Promise(r => supa.listen(54321, r)); await new Promise(r => pushSvc.listen(54322, r));
  const env = Object.assign({}, process.env, { SUPABASE_URL: 'http://localhost:54321', SUPABASE_SERVICE_ROLE_KEY: 'svc', NO_PROXY: 'localhost,127.0.0.1', no_proxy: 'localhost,127.0.0.1', DENO_CERT: dir + '/ca.pem', NODE_EXTRA_CA_CERTS: dir + '/cert.pem' });
  const fn = spawn(process.env.DENO || 'deno', ['run', '--allow-net', '--allow-env', '--allow-read', '--allow-sys', '--cert', dir + '/ca.pem', path.resolve(__dirname, '../supabase/functions/push/index.ts')], { cwd: dir, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; fn.stdout.on('data', d => log += d); fn.stderr.on('data', d => log += d); fn.on('error', e => { log += String(e); });
  let up = false; for (let i = 0; i < 240 && !up; i++) { try { await fetch('http://localhost:8000/', { method: 'OPTIONS' }); up = true; } catch (e) { await wait(500); } }
  try {
    check(up, 'the function starts in Deno' + (up ? '' : ': ' + log.slice(-400)));
    // ---- the hourly players job ----
    const bad = await call({ action: 'players', secret: 'nope', now: '2026-11-10T15:05:00Z' });
    check(bad.status === 403 && !got.length, 'without the database’s secret: refused, nothing sent');
    check(db.keys.length === 1 && db.keys[0].public_key && db.keys[0].private_key, 'its signing keys are made once and kept');
    const secret = crypto.createHash('sha256').update(db.keys[0].private_key).digest('hex');
    const r1 = await call({ action: 'players', secret, now: '2026-11-10T15:05:00Z' }); await wait(300); // 17:05 in Israel
    check(r1.status === 200 && r1.body.players === 4, '17:00: the 4 players’ boards are read ' + JSON.stringify(r1.body));
    check(to('tom')[0] === 'No practice logged for 3 days. A short session today gets you back on track.' && got.find(g => g.ep === 'tom').msg.title === 'Rank Up', 'Tom’s phone decrypts his practice nudge (3 days, counting his log documents)');
    check(got.length > 0 && got.every(g => g.vapid && g.ttl === 43200), 'signed with the function’s keys, kept 12 hours by the push service');
    check(to('dana').includes("Maya hasn't practiced for 4 days.") && to('kid1')[0] === 'No practice logged for 4 days. A short session today gets you back on track.', 'a parent’s board: Dana hears about Maya, and Maya’s own phone gets her nudge');
    check(!to('dana').some(b => /Noa/.test(b)) && !to('kid2').length, 'Noa sent practice the parent’s app hasn’t taken in yet: it counts, no nudge');
    check(to('ben')[0] === 'לא נרשם תרגול כבר 2 ימים. אימון קצר היום יחזיר אותך למסלול.' && got.find(g => g.ep === 'ben').msg.title === 'עולים בדרגה', 'a Hebrew board: the nudge in Hebrew, titled עולים בדרגה');
    check(!db.subs.some(s => s.endpoint.endsWith('ben-gone')) && db.subs.some(s => s.endpoint.endsWith('/ben')), 'a device that’s gone (410) is forgotten; the other stays');
    check(got.length > 0 && !got.some(g => /eli/.test(g.ep)) && got.every(g => !g.err), 'Eli practiced today: nothing for him; every alert decrypts');
    check(r1.body.sent === got.length && got.length === 4, 'sent: ' + r1.body.sent);
    const marks = uid => (db.docs['data/users/' + uid].find(x => x.id === 'alerts') || {}).data;
    check(marks(TOM).nudge === '2026-11-10' && marks(DANA).kids && marks(DANA).kids['st-m'].nudge === '2026-11-10' && !marks(DANA).kids['st-n'].nudge, 'remembered on each board (a parent’s per child)');
    check(marks(ELI) === undefined, 'nothing to send: nothing written');
    const n1 = got.length;
    const r2 = await call({ action: 'players', secret, now: '2026-11-10T15:35:00Z' }); await wait(200);
    check(r2.body.sent === 0 && got.length === n1, 'the same hour again: nothing more');
    const r3 = await call({ action: 'players', secret, now: '2026-11-10T16:05:00Z' }); await wait(200);
    check(r3.body.sent === 0, '18:00: nothing (practice is at 17:00, the evening before at 19:00)');
    // 19:00: tomorrow's tournament and task
    const r4 = await call({ action: 'players', secret, now: '2026-11-10T17:05:00Z' }); await wait(300);
    const tom = to('tom').slice(1);
    check(tom.includes('“Haifa Open” starts tomorrow. Sleep well tonight, and warm up with a few puzzles in the morning.') && tom.includes('Due tomorrow: “30 puzzles on pins”.'), '19:00: Haifa Open tomorrow, and the task due tomorrow');
    check(!tom.some(b => /Already done|Later Cup/.test(b)), 'not a finished task, or a tournament further off');
    check(to('dana').includes('Maya’s tournament “Junior Cup” starts tomorrow. An early night helps.') && to('kid1').includes('“Junior Cup” starts tomorrow. Sleep well tonight, and warm up with a few puzzles in the morning.'), 'Maya’s tournament: to her parent and to her');
    check(marks(TOM).tour.t1 === '2026-11-10' && marks(TOM).task['as-1'] === '2026-11-10' && marks(TOM).nudge === '2026-11-10', 'remembered, with the 17:00 nudge kept');
    const n4 = got.length;
    const r5 = await call({ action: 'players', secret, now: '2026-11-10T17:45:00Z' }); await wait(200);
    check(r5.body.sent === 0 && got.length === n4, 'and not sent twice');
    // 2 days later, still no practice: the nudge again; after practice: none
    db.docs['data/users/' + DANA].find(d => d.id === 'st-m').data.worklog.push({ id: 'm2', date: '2026-11-12', minutes: 30 });
    const r6 = await call({ action: 'players', secret, now: '2026-11-12T15:05:00Z' }); await wait(300);
    check(to('tom').slice(-1)[0] === 'No practice logged for 5 days. A short session today gets you back on track.' && !to('kid1').some(b => /5 days|6 days/.test(b)), 'two days on: Tom is nudged again (5 days); Maya practiced, so not her');
    // ---- the app's actions ----
    check((await call({ action: 'key' })).status === 401, 'key without a sign-in: refused');
    const key = await call({ action: 'key' }, 'tok-stu');
    check(key.status === 200 && key.body.key === db.keys[0].public_key, 'key: the public key');
    check((await call({ action: 'subscribe', sub: { endpoint: 'http://x/1', keys: {} } }, 'tok-stu')).status === 400, 'a bad subscription is refused');
    const sv = await call({ action: 'subscribe', sub: sub('stu-new') }, 'tok-stu');
    check(sv.status === 200 && db.subs.some(s => s.endpoint.endsWith('stu-new') && s.user_id === STU), 'subscribe saves the device for the signed-in account');
    await call({ action: 'unsubscribe', endpoint: sub('stu-new').endpoint }, 'tok-tom');
    check(db.subs.some(s => s.endpoint.endsWith('stu-new')), 'another account can’t remove it');
    await call({ action: 'unsubscribe', endpoint: sub('stu-new').endpoint }, 'tok-stu');
    check(!db.subs.some(s => s.endpoint.endsWith('stu-new')), 'unsubscribe removes it');
    const no = await call({ action: 'send', messages: [{ to: STU, title: 'x', body: 'y' }] }, 'tok-stu');
    check(no.status === 403, 'a student can’t send alerts');
    const before = got.length;
    const s1 = await call({ action: 'send', messages: [{ to: STU, title: 'Raem', body: 'Lesson moved to Thu 18:00.', tag: 'ls-1' }, { to: STU + '.2', title: 'Raem', body: 'For the second link', tag: 'x' },
      { to: STRANGER, title: 'Raem', body: 'Not mine', tag: 'x' }, { to: COACH, title: 'Rank Up', body: 'Test alert', tag: 'test' }] }, 'tok-coach'); await wait(300);
    const sent = got.slice(before);
    check(s1.status === 200 && s1.body.sent === 3, 'the coach sends: 3 alerts ' + JSON.stringify(s1.body));
    check(sent.filter(g => g.ep === 'stu').map(g => g.msg.body).sort().join('|') === 'For the second link|Lesson moved to Thu 18:00.', 'to the student, also through a second coach’s link (“<account>.2”)');
    check(!sent.some(g => g.ep === 'stranger'), 'never to another coach’s student');
    check(sent.some(g => g.ep === 'coach' && g.msg.body === 'Test alert' && g.ttl === 86400), 'and to the coach’s own phone (a test alert)');
  } catch (e) { check(false, 'the run stopped: ' + (e && e.stack || e) + '\n' + log.slice(-600)); }
  fn.kill(); supa.close(); pushSvc.close(); fs.rmSync(dir, { recursive: true, force: true });
  done();
})();

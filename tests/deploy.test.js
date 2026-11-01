// As published on GitHub Pages: the site under a folder (/Rank-Up-Chess/), served over http. Every page loads every
// file it asks for (no 404s), the install manifest and its icons are there, and the files the service worker keeps
// for offline use exist. Also: nothing in the repository's published folder that shouldn't be.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const { FAKE_SUPA } = require('./fakesupa.js');
const ROOT = path.resolve(__dirname, '..'), BASE = '/Rank-Up-Chess/';
let fails = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fails++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.css': 'text/css', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]);
  if (!u.startsWith(BASE)) { res.writeHead(404); return res.end(); }
  let f = path.join(ROOT, u.slice(BASE.length)); if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
(async () => {
  await new Promise(r => server.listen(0, r)); const origin = 'http://localhost:' + server.address().port;
  const b = await chromium.launch(); const ctx = await b.newContext();
  const missing = [], errors = [];
  ctx.on('response', r => { if (r.url().startsWith(origin) && r.status() >= 400) missing.push(r.status() + ' ' + r.url().slice(origin.length)); });
  for (const [page, uid] of [['', 'coach'], ['', null], ['admin/', 'coach'], ['welcome/', null], ['welcome/privacy.html', null]]) {
    if (page.endsWith('.html') && !fs.existsSync(path.join(ROOT, page))) continue;
    const p = await ctx.newPage(); p.on('pageerror', e => errors.push(page + ': ' + e.message));
    await p.addInitScript(FAKE_SUPA(uid)); await p.goto(origin + BASE + page); await p.waitForTimeout(2500);
    if (page === '' && uid) check((await p.textContent('body')).length > 100, 'the app opens under ' + BASE);
    await p.close();
  }
  check(!missing.length, 'no file is missing on any page ' + missing.join(', '));
  check(!errors.length, 'no page errors ' + errors.join(' | '));
  // the install manifest and its icons
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
  check(man.name && man.start_url && (man.icons || []).length, 'the manifest has a name, start URL and icons');
  check((man.icons || []).every(i => fs.existsSync(path.join(ROOT, i.src))), 'every icon it lists exists');
  check(!/^\//.test(man.start_url) || man.start_url.startsWith(BASE), 'the start URL works under the folder: ' + man.start_url);
  // what the service worker keeps for offline use
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), pre = (sw.match(/addAll\(\[([^\]]*)\]/) || [, ''])[1].match(/"([^"]+)"/g) || [];
  check(pre.length && pre.map(x => x.slice(1, -1)).every(f => f === './' || fs.existsSync(path.join(ROOT, f))), 'the files the service worker keeps exist: ' + pre.join(' '));
  check(fs.existsSync(path.join(ROOT, 'vendor/supabase.js')), 'the Supabase library is in the repository (no outside script needed)');
  check(fs.existsSync(path.join(ROOT, '.nojekyll')), '.nojekyll is there, so GitHub Pages serves every file as is');
  await b.close(); server.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();

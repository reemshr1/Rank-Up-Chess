// What the browser tests share: a browser with the Supabase stand-in, made-up records, and PASS / FAIL lines.
const { chromium } = require('playwright');
const { FAKE_SUPA } = require('./fakesupa.js');
const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '../index.html');
const ADMIN = 'file://' + path.resolve(__dirname, '../admin/index.html');
const pad = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const addDays = (s, n) => { const d = new Date(s + 'T00:00'); d.setDate(d.getDate() + n); return iso(d); };
const t = iso(new Date());
const weekday = s => new Date(s + 'T00:00').getDay();
// a student record as the coach's app keeps it
const stu = (id, name, extra) => Object.assign({ id, name, active: true, rate: 100, noId: true, ratingType: 'FIDE', rating: '', ratings: [], sessions: [], tasks: [], worklog: [],
  repertoire: [], tournaments: [], payments: [], charges: [], books: [], slots: [], training: [], requests: [], fitness: [], fitnessGoal: 0, sleep: [], createdAt: addDays(t, -60) }, extra);
const les = (id, date, time, topics, extra) => Object.assign({ id, date, time, duration: 60, format: 'In person', status: 'planned', topics: topics || '' }, extra);
let fails = 0;
const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fails++; return ok; };
const out = name => path.join(__dirname, 'out-' + name + '.png');
async function start(opts = {}) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1200, height: 900 }, acceptDownloads: true }, opts));
  await ctx.route('https://lichess.org/**', r => r.abort()); // nothing outside reached unless a test answers for it
  const errors = [];
  const open = async (uid, hash = '', url = URL) => { const p = await ctx.newPage(); p.on('pageerror', e => errors.push((uid || 'signed out') + ': ' + e.message));
    p.on('dialog', d => d.accept().catch(() => {})); await p.addInitScript(FAKE_SUPA(uid)); await p.goto(url + hash); return p; };
  // seed({coach, coaches, players, moved, users, docs:{'data/users/coach/settings': {...}}, ls:{key: value}})
  const seed = async s => { const p = await open(null); await p.evaluate(s => { localStorage.clear();
      if (s.coach) localStorage.setItem('fcoach', s.coach);
      localStorage.setItem('fcoaches', JSON.stringify(s.coaches || [])); localStorage.setItem('fplayers', JSON.stringify(s.players || []));
      if (s.moved) localStorage.setItem('fmoved', JSON.stringify(s.moved)); if (s.users) localStorage.setItem('fusers', JSON.stringify(s.users));
      Object.entries(s.docs || {}).forEach(([k, v]) => localStorage.setItem('fdb:' + k, JSON.stringify(v)));
      Object.entries(s.ls || {}).forEach(([k, v]) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v))); }, s); await p.close(); };
  const doc = (p, k) => p.evaluate(k => JSON.parse(localStorage.getItem('fdb:' + k) || 'null'), k);
  const docs = (p, prefix) => p.evaluate(pre => Object.keys(localStorage).filter(k => k.startsWith('fdb:' + pre)).map(k => Object.assign({ _key: k.slice(4) }, JSON.parse(localStorage.getItem(k)))), prefix);
  // a student's record with its practice log documents joined back in
  const student = (p, coach, id) => p.evaluate(([c, id]) => { const s = JSON.parse(localStorage.getItem('fdb:data/users/' + c + '/' + id) || 'null'); if (!s) return null;
    Object.keys(localStorage).filter(k => k.startsWith('fdb:data/users/' + c + '/lg-' + id)).forEach(k => { const l = JSON.parse(localStorage.getItem(k)); s.worklog = (s.worklog || []).concat(l.worklog || []); });
    return s; }, [coach, id]);
  const text = (p, sel = '#view') => p.textContent(sel);
  const denied = p => p.evaluate(() => window.__denied || []);
  const finish = async () => { check(!errors.length, 'no page errors ' + errors.join(' | ')); await browser.close();
    console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0); };
  return { browser, ctx, open, seed, doc, docs, student, text, denied, errors, finish };
}
// fill and send the open form: {name: value}; selects are chosen, checkboxes ticked
async function fillForm(p, values, submit = true) {
  for (const [k, v] of Object.entries(values)) { const sel = '#modal[open] #f_' + k; const el = await p.$(sel); if (!el) throw new Error('no field ' + k);
    const tag = await el.evaluate(e => e.tagName + ':' + (e.type || '')); if (tag.startsWith('SELECT')) await p.selectOption(sel, String(v)); else if (tag.endsWith('checkbox')) { if (v) await p.check(sel); else await p.uncheck(sel); } else await p.fill(sel, String(v)); }
  if (submit) { await p.click('#modal[open] button[type=submit]'); await p.waitForTimeout(500); }
}
module.exports = { URL, ADMIN, t, iso, addDays, weekday, stu, les, check, out, start, fillForm, FAKE_SUPA };

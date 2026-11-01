// A parent's board with more than one child: Dana has Maya's board and adds Noa. Each child has their own board,
// their own sign-in code and their own tasks; the menu switches between them; a child can be removed; and moving
// to a coach sends each child's history.
const { chromium } = require('playwright');
const { FAKE_SUPA } = require('./fakesupa.js');
const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '../index.html');
const pad = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const addDays = (s, n) => { const d = new Date(s + 'T00:00'); d.setDate(d.getDate() + n); return iso(d); };
const t = iso(new Date());
let fails = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fails++; };
const blank = (id, extra) => Object.assign({ id, name: '', active: true, rate: 0, noId: true, ratingType: 'FIDE', rating: '', ratings: [], sessions: [], tasks: [], worklog: [], repertoire: [], tournaments: [], payments: [], charges: [], books: [], slots: [], training: [], requests: [], fitness: [], fitnessGoal: 0, sleep: [], createdAt: addDays(t, -60) }, extra);
const cst = (id, name) => blank(id, { name, rate: 100, createdAt: t });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1100, height: 900 } }); const errors = [];
  const open = async (uid) => { const p = await ctx.newPage(); p.on('pageerror', e => errors.push(uid + ': ' + e.message)); await p.addInitScript(FAKE_SUPA(uid)); await p.goto(URL); return p; };
  const ls = (p, k) => p.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), k);
  const kids = p => p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('fdb:data/users/dana/st-')).map(k => JSON.parse(localStorage.getItem(k))).filter(x => x.self));
  const first = await open('coach');
  await first.evaluate(({ t, maya, as1, coachKids }) => { localStorage.clear(); localStorage.setItem('fcoach', 'coach');
    localStorage.setItem('fcoaches', JSON.stringify(['dana'])); localStorage.setItem('fplayers', JSON.stringify(['dana']));
    const put = (k, v) => localStorage.setItem('fdb:' + k, JSON.stringify(v));
    put('data/users/coach/settings', { coachName: 'Raem', currency: '₪', defaultRate: 100, weekStart: 0, families: [{ id: 'fam-c', name: 'Cohen family', studentIds: ['st-cm', 'st-cn'], invite: { code: 'FAM234', created: t } }] });
    put('data/users/coach/st-cm', coachKids[0]); put('data/users/coach/st-cn', coachKids[1]);
    put('data/users/dana/settings', { coachName: 'Maya Cohen', currency: '₪', lang: 'en' }); put('data/users/dana/st-m', maya); put('data/users/dana/as-m1', as1);
    put('portal/maya', { code: 'KIDOLD', linked: true, role: 'student', coach: 'dana', linkedAt: t }); },
  { t, maya: blank('st-m', { name: 'Maya Cohen', self: true, setup: 'parent', portal: { uid: 'maya', linkedAt: t, email: 'maya@test' },
      worklog: [{ id: 'm1', date: addDays(t, -1), what: 'Tactics', minutes: 20, by: 'student' }], tournaments: [{ id: 'tr1', name: 'Haifa Open', start: addDays(t, 10), by: 'student' }] }),
    as1: { id: 'as-m1', studentId: 'st-m', title: 'Maya rook endings', type: 'Endgames', status: 'Assigned', due: addDays(t, 3), assigned: t, games: [], by: 'self' },
    coachKids: [cst('st-cm', 'Maya Cohen'), cst('st-cn', 'Noa Cohen')] });
  await first.close();
  // 1. Dana adds Noa
  const dana = await open('dana'); await dana.waitForTimeout(3000);
  let v = await dana.textContent('#view');
  check(v.includes('Maya’s board') && v.includes('Another child playing chess?') && (await dana.isHidden('#childPick')), 'one child: Maya’s board, with a way to add another child (and no switcher yet)');
  await dana.click('[data-a=addKid]'); await dana.waitForSelector('#modal[open] #f_name');
  check(!(await dana.$('#modal[open] #f_setup')) && (await dana.textContent('#modal h2')).includes('Add a child'), 'the form asks about the new child only');
  await dana.fill('#f_name', 'Noa Cohen'); await dana.fill('#f_birthYear', '2016'); await dana.click('#modal button[type=submit]'); await dana.waitForTimeout(1500);
  let all = await kids(dana); const noa = all.find(x => x.name === 'Noa Cohen');
  check(all.length === 2 && noa && noa.setup === 'parent' && noa.birthYear == 2016, 'Noa has her own board on the account');
  v = await dana.textContent('#view');
  check(v.includes('Noa’s board') && !v.includes('Maya rook endings') && !v.includes('Haifa Open'), "Noa's board is shown, without Maya's task or tournament");
  const opts = await dana.$$eval('#childPick option', xs => xs.map(x => x.textContent));
  check(!(await dana.isHidden('#childPick')) && opts.join() === 'Maya Cohen,Noa Cohen', 'the menu switches between the children: ' + opts.join(', '));
  check(v.includes('Your children') && v.includes('Signs in on their own') && v.includes('No sign-in yet'), 'Your children lists both, with their sign-in');
  await dana.screenshot({ path: path.join(__dirname, 'out-kids-noa.png'), fullPage: true });
  // 2. a task for Noa stays Noa's
  await dana.goto(URL + '#/student/' + noa.id + '/assignments'); await dana.waitForTimeout(800);
  await dana.click('[data-a=new]'); await dana.waitForSelector('#modal[open] #f_title'); await dana.fill('#f_title', 'Noa mate in one'); await dana.click('#modal button[type=submit]'); await dana.waitForTimeout(1000);
  v = await dana.textContent('#view');
  check(v.includes('Noa mate in one') && !v.includes('Maya rook endings'), "Noa's Tasks has only her task");
  await dana.goto(URL + '#/progress'); await dana.waitForTimeout(800);
  // 3. switch to Maya
  await dana.selectOption('#childPick', 'st-m'); await dana.waitForTimeout(1000);
  await dana.goto(URL + '#/home'); await dana.waitForTimeout(800);
  v = await dana.textContent('#view');
  check(v.includes('Maya’s board') && v.includes('Maya rook endings') && v.includes('Haifa Open') && !v.includes('Noa mate in one'), "switched: Maya's board has her own task and tournament only");
  await dana.reload(); await dana.waitForTimeout(2500);
  check((await dana.textContent('#view h1')).includes('Maya’s board'), 'after a reload, the same child is shown');
  // 4. Noa's own sign-in
  await dana.click('[data-a=kid][data-id="' + noa.id + '"]'); await dana.waitForTimeout(1000);
  await dana.click('[data-a=kidInvite]'); await dana.waitForSelector('#modal[open] #f_msg', { timeout: 5000 }); await dana.waitForTimeout(1200);
  const code = ((await kids(dana)).find(x => x.id === noa.id).invite || {}).code;
  check(!!code && (await dana.inputValue('#f_msg')).includes(code) && code !== 'KIDOLD', "Noa gets her own invite code: " + code);
  await dana.keyboard.press('Escape');
  const kn = await open('noa'); await kn.waitForSelector('#linkCode', { timeout: 8000 });
  await kn.fill('#linkCode', code); await kn.click('#linkF button[type=submit]'); await kn.waitForTimeout(4500); await kn.reload(); await kn.waitForTimeout(2500);
  v = await kn.textContent('#view');
  check(v.includes('Noa') && !v.includes('Maya'), "Noa signs in and sees her own board");
  await kn.goto(URL + '#/student/' + noa.id + '/assignments'); await kn.waitForTimeout(1200);
  v = await kn.textContent('#view');
  check(v.includes('Noa mate in one') && !v.includes('Maya rook endings'), "Noa's app has her task, not Maya's");
  check(((await kids(dana)).find(x => x.id === noa.id).portal || {}).uid === 'noa', "the parent's board shows Noa is connected");
  // 5. each child's practice lands on their own board
  const km = await open('maya'); await km.waitForTimeout(3000);
  check((await km.textContent('#view')).includes('Maya') && !(await km.textContent('#view')).includes('Noa'), "Maya's app is still Maya's");
  const logIt = async (p, min) => { await p.goto(URL + '#/home'); await p.waitForTimeout(800); await p.click('[data-a=log]'); await p.waitForSelector('#modal[open] #f_minutes'); await p.selectOption('#f_what', 'Other'); await p.fill('#f_minutes', String(min)); await p.click('#modal button[type=submit]'); };
  await logIt(km, 33); await logIt(kn, 44); await dana.waitForTimeout(5000);
  const mins = await dana.evaluate(() => { const o = {}; Object.keys(localStorage).filter(k => k.startsWith('fdb:data/users/dana/')).forEach(k => { const x = JSON.parse(localStorage.getItem(k)); const sid = x.sid || x.id; (x.worklog || []).forEach(w => { (o[sid] = o[sid] || []).push(+w.minutes); }); }); return o; });
  check((mins['st-m'] || []).includes(33) && !(mins['st-m'] || []).includes(44) && (mins[noa.id] || []).includes(44) && !(mins[noa.id] || []).includes(33), "Maya's 33 minutes are Maya's, Noa's 44 are Noa's: " + JSON.stringify(mins));
  // 6. a third child, removed again
  await dana.goto(URL + '#/home'); await dana.waitForTimeout(800);
  await dana.click('[data-a=addKid]'); await dana.waitForSelector('#modal[open] #f_name'); await dana.fill('#f_name', 'Lior Cohen'); await dana.click('#modal button[type=submit]'); await dana.waitForTimeout(1200);
  check((await kids(dana)).length === 3 && (await dana.$$eval('#childPick option', xs => xs.length)) === 3, 'three children');
  await dana.click('[data-a=profile]'); await dana.waitForSelector('#modal[open] #f_name');
  check(!(await dana.$('#modal[open] #f_setup')), "with several children, the profile doesn't ask who the account is for");
  await dana.click('#modal[open] button.danger'); await dana.waitForSelector('#modal[open] button[type=submit]');
  check((await dana.textContent('#modal')).includes('Remove Lior Cohen?'), 'removing asks first');
  await dana.click('#modal[open] button[type=submit]'); await dana.waitForTimeout(1500);
  all = await kids(dana);
  check(all.length === 2 && !all.some(x => x.name === 'Lior Cohen') && (await dana.textContent('#view h1')).includes('Maya’s board'), 'Lior is removed, and Maya is shown');
  // removing a connected child disconnects their app
  await dana.click('[data-a=kid][data-id="' + noa.id + '"]'); await dana.waitForTimeout(800);
  await dana.click('[data-a=profile]'); await dana.waitForSelector('#modal[open] #f_name'); await dana.click('#modal[open] button.danger'); await dana.waitForSelector('#modal[open] button[type=submit]');
  check((await dana.textContent('#modal')).includes('Their own sign-in is disconnected'), 'removing a connected child says their sign-in is disconnected');
  await dana.keyboard.press('Escape'); await dana.waitForTimeout(300);
  // Hebrew
  await dana.goto(URL + '#/home'); await dana.waitForTimeout(500); await dana.locator('[data-lang]:visible').first().click(); await dana.waitForTimeout(1000);
  v = await dana.textContent('#view');
  check(v.includes('הילדים שלך') && v.includes('הוספת ילד/ה') && v.includes('מאמן לילדים'), 'in Hebrew');
  await dana.screenshot({ path: path.join(__dirname, 'out-kids-he.png'), fullPage: true });
  await dana.locator('[data-lang]:visible').first().click(); await dana.waitForTimeout(800);
  // 7. moving to a coach sends each child's history
  check((await dana.textContent('#view')).includes('Your children’s coach'), 'the coach box talks about the children');
  await dana.click('[data-a=toCoach]'); await dana.waitForSelector('#modal[open] #f_code');
  check((await dana.textContent('#modal')).includes('Each child’s history moves to the coach'), 'and so does the form');
  await dana.fill('#f_code', 'FAM234'); await dana.click('#modal button[type=submit]'); await dana.waitForTimeout(3500);
  const names = await dana.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('fdb:portal/dana/inbox/')).map(k => JSON.parse(localStorage.getItem(k))).filter(o => o.type === 'history' && o.part === 1).map(o => o.name).sort());
  check(names.join() === 'Maya Cohen,Noa Cohen', 'both children’s histories are sent: ' + names.join(', '));
  const coach = await open('coach'); await coach.waitForTimeout(7000);
  const cm = await ls(coach, 'fdb:data/users/coach/st-cm'), cn = await ls(coach, 'fdb:data/users/coach/st-cn');
  const hasT = (s, title) => coach.evaluate(([sid, title]) => Object.keys(localStorage).filter(k => k.startsWith('fdb:data/users/coach/as-')).map(k => JSON.parse(localStorage.getItem(k))).some(a => a.studentId === sid && a.title === title), [s, title]);
  check((cm.tournaments || []).some(x => x.name === 'Haifa Open') && await hasT('st-cm', 'Maya rook endings') && !(await hasT('st-cm', 'Noa mate in one')), "the coach's Maya gets Maya's history");
  check(await hasT('st-cn', 'Noa mate in one') && !(cn.tournaments || []).length, "and the coach's Noa gets Noa's");
  check(!errors.length, 'no page errors ' + errors.join(' | '));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();

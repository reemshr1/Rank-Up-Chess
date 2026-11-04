// A young player: the parent signs up with a player code and sets up the child's board, invites the child with a code,
// and the child logs their own practice and tasks; it all lands on the parent's board. The child's app has no coach parts.
const { chromium } = require('playwright');
const { FAKE_SUPA } = require('./fakesupa.js');
const path = require('path');
const URL = require('./serve.js').BASE + 'index.html', ADMIN = URL.replace(/index\.html$/, 'admin/index.html');
let fails = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fails++; };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 1100, height: 800 } }); const errors = [];
  const open = async (uid, url = URL) => { const p = await ctx.newPage(); p.on('pageerror', e => errors.push(uid + ': ' + e.message)); await p.addInitScript(FAKE_SUPA(uid)); await p.goto(url); return p; };
  const first = await open('coach');
  await first.evaluate(() => { localStorage.clear(); localStorage.setItem('fcoach', 'coach');
    localStorage.setItem('fdb:data/users/coach/settings', JSON.stringify({ coachName: 'Raem', currency: '₪', overdueDays: 30, defaultRate: 100, weekStart: 0 }));
    localStorage.setItem('fleads', JSON.stringify([{ id: 9, created_at: '2026-10-20T10:00:00Z', name: 'Dana Cohen', phone: '0541234567', email: 'dana@x.co', city: '', students: '', kind: '', note: 'For my daughter Maya, 9', who: 'parent', status: 'new', admin_note: '' }])); });
  await first.close();
  // the admin sends the parent a player code, with a message about setting it up for the child
  const admin = await open('coach', ADMIN); await admin.waitForSelector('[data-send="9"]', { timeout: 8000 });
  await admin.click('[data-send="9"]'); await admin.waitForSelector('#modal[open] #f_msg', { timeout: 5000 });
  const code = await admin.evaluate(() => JSON.parse(localStorage.getItem('fleads')).find(x => x.id === 9).code);
  check((await admin.inputValue('#f_msg')).includes('set up Rank Up for your child') && (await admin.textContent('#modal h2')).includes('parent'), 'the parent gets a message about setting it up for their child');
  await admin.close();
  // the parent signs up and sets up Maya's board
  const dana = await open('dana'); await dana.waitForSelector('#bePlayer', { timeout: 8000 });
  await dana.click('#bePlayer'); await dana.waitForSelector('#modal[open] #f_code'); await dana.fill('#f_code', code); await dana.click('#modal button[type=submit]');
  await dana.waitForSelector('#modal[open] #f_setup', { timeout: 10000 });
  await dana.selectOption('#f_setup', 'parent'); await dana.fill('#f_name', 'Maya Cohen'); await dana.click('#modal button[type=submit]'); await dana.waitForTimeout(1200);
  const rec = () => dana.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('fdb:data/users/dana/st-')).map(k => JSON.parse(localStorage.getItem(k))).find(x => x.self));
  let maya = await rec();
  check(maya && maya.setup === 'parent' && maya.name === 'Maya Cohen', 'the board is set up for the child');
  check((await dana.textContent('#view h1')).includes('Maya’s board') && (await dana.textContent('#view')).includes("Maya’s own sign-in"), "the parent sees Maya's board, with a way to invite her (“Maya’s own sign-in”)");
  await dana.screenshot({ path: path.join(__dirname, 'out-kid-parent.png') });
  await dana.click('[data-a=kidInvite]'); await dana.waitForSelector('#modal[open] #f_msg', { timeout: 5000 });
  await dana.waitForTimeout(1500); maya = await rec(); const kidCode = maya.invite && maya.invite.code;
  check(!!kidCode && (await dana.inputValue('#f_msg')).includes(kidCode), 'the parent gets a code and a message for the child: ' + kidCode);
  await dana.keyboard.press('Escape');
  // Maya signs in with it
  const kid = await open('maya'); await kid.waitForSelector('#linkCode', { timeout: 8000 });
  check((await kid.textContent('#view')).includes('or your parent'), "the child's sign-in mentions a parent's code too");
  await kid.fill('#linkCode', kidCode); await kid.click('#linkF button[type=submit]');
  await kid.waitForTimeout(4500); await kid.reload(); await kid.waitForTimeout(2500);
  const kv = await kid.textContent('#view'), kn = await kid.textContent('#nav');
  check(kv.includes('Maya') && !kn.includes('Schedule') && !(await kid.$('[data-a=req]')) && !kv.includes('Updated by'), "Maya sees her board, with no coach parts");
  await kid.screenshot({ path: path.join(__dirname, 'out-kid-child.png') });
  maya = await rec();
  check(maya.portal && maya.portal.uid === 'maya', "the parent's board shows Maya is connected");
  // Maya logs practice: it lands on the parent's board
  await kid.click('[data-a=log]'); await kid.waitForSelector('#modal[open] #f_minutes'); await kid.selectOption('#f_what', 'Other'); await kid.fill('#f_minutes', '25'); await kid.click('#modal button[type=submit]');
  await dana.waitForTimeout(4000);
  const logged = await dana.evaluate(() => Object.keys(localStorage).some(k => k.startsWith('fdb:data/users/dana/') && /"minutes":"?25"?/.test(localStorage.getItem(k))));
  check(logged, "Maya's practice is saved on the parent's board");
  // the parent adds a task; Maya finishes it
  await dana.goto(URL + '#/student/' + maya.id + '/assignments'); await dana.waitForTimeout(800);
  await dana.click('[data-a=new]'); await dana.waitForSelector('#modal[open] #f_title'); await dana.fill('#f_title', '20 mate-in-2 puzzles'); await dana.click('#modal button[type=submit]'); await dana.waitForTimeout(3000);
  await kid.goto(URL + '#/student/' + maya.id + '/assignments'); await kid.reload(); await kid.waitForTimeout(2500);
  check((await kid.textContent('#view')).includes('20 mate-in-2 puzzles') && !(await kid.$('[data-a=new]')), "Maya sees the task (the parent sets the tasks)");
  await kid.click('[data-a=done]'); await kid.waitForTimeout(800);
  check((await kid.textContent('#view')).includes('Done') && !(await kid.textContent('#view')).includes('Waiting for your coach'), 'marking it done says Done, not waiting for a coach');
  await dana.waitForTimeout(4000);
  const task = await dana.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('fdb:data/users/dana/as-')).map(k => JSON.parse(localStorage.getItem(k)))[0]);
  check(task && task.status === 'Reviewed', "the parent's board has it done: " + (task && task.status));
  // Maya goes quiet for 5 days: she's asked what's going on, for her parent, and her answer shows on the parent's board
  await dana.evaluate(id => { const k = 'fdb:data/users/dana/' + id; const s = JSON.parse(localStorage.getItem(k)); const d = new Date(); d.setDate(d.getDate() - 5); const old = d.toISOString().slice(0, 10);
    s.worklog = (s.worklog || []).map(w => Object.assign(w, { date: old })); s.portal.linkedAt = old; s.appSince = old; localStorage.setItem(k, JSON.stringify(s));
    Object.keys(localStorage).filter(x => x.startsWith('fdb:data/users/dana/lg-')).forEach(x => { const w = JSON.parse(localStorage.getItem(x)); w.date = old; localStorage.setItem(x, JSON.stringify(w)); }); }, maya.id);
  await dana.goto(URL + '#/home'); await dana.reload(); await dana.waitForTimeout(3000);
  check(!(await dana.$('.checkin')), "the parent isn't asked what's going on");
  await kid.goto(URL + '#/home'); await kid.reload(); await kid.waitForTimeout(3000);
  const box = await kid.textContent('.checkin').catch(() => '');
  check(box.includes('Your parent would like to know') && !box.includes('coach'), 'Maya is asked for her parent, not a coach: ' + box.replace(/\s+/g, ' ').slice(0, 120));
  await kid.click('.checkin [data-a=checkin][data-id=busy]'); await kid.waitForTimeout(500);
  check((await kid.textContent('#toast')).includes('your parent will see it'), 'the thanks says her parent will see it');
  await dana.waitForTimeout(4000); await dana.reload(); await dana.waitForTimeout(2500);
  check((await dana.textContent('#view')).includes('Maya says:') && (await dana.textContent('#view')).includes('Busy with school'), "the parent sees Maya's answer");
  await dana.screenshot({ path: path.join(__dirname, 'out-kid-says.png') });
  // Hebrew on the child's side
  await kid.goto(URL + '#/home'); await kid.waitForTimeout(800); await kid.locator('[data-lang]:visible').first().click(); await kid.waitForTimeout(1200);
  check((await kid.textContent('#view')).includes('רישום תרגול') && !(await kid.textContent('#nav')).includes('לוח זמנים'), "the child's app in Hebrew, still without a schedule");
  check(!errors.length, 'no page errors ' + errors.join(' | '));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();

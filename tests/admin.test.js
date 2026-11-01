// The admin page (admin/) and accounts: only the admin sees it; access requests (status, notes, filters, Send coach
// code → Code sent → Joined once used, Remove); codes (make a coach or player code with its message, remove an unused
// one, "Used by", "account removed"); a new coach joining with a code (a wrong or used code says so) and getting an
// empty board of their own; accounts (Remove keeping their records, or deleting everything); the website form.
const { URL, ADMIN, t, stu, check, out, start, fillForm } = require('./lib.js');
const path = require('path');
(async () => {
  const T = await start();
  await T.seed({ coach: 'coach', coaches: ['u-old'], users: { 'raem@x.co': { id: 'coach', password: 'longenough1' } }, docs: {
    'data/users/coach/settings': { coachName: 'Raem', lang: 'en' }, 'data/users/coach/st-a': stu('st-a', 'Maya Cohen'),
    // another coach, with a student on the app, to delete for good
    'data/users/u-old/settings': { coachName: 'Old Coach', lang: 'en' }, 'data/users/u-old/st-o': stu('st-o', 'Omer Old', { portal: { uid: 'u-om', linkedAt: t } }),
    'portal/u-om': { code: 'OM1', linked: true, role: 'student', coach: 'u-old', linkedAt: t }, 'portal/u-om/view/student': { id: 'st-o', name: 'Omer Old' } },
    ls: { fleads: [{ id: 1, created_at: '2026-10-20T10:00:00Z', name: 'Dana Coach', phone: '0541234567', email: 'dana@x.co', city: 'Haifa', students: '12', kind: 'private', note: 'I teach kids', who: 'coach', status: 'new' },
      { id: 2, created_at: '2026-10-21T10:00:00Z', name: 'Tom Player', phone: '0529999999', email: 'tom@x.co', who: 'player', status: 'contacted' }] } });
  // someone who isn't the admin
  const other = await T.open('u-x', '', ADMIN); await other.waitForTimeout(2000);
  check((await T.text(other)).includes('only for the Rank Up admin'), 'the admin page is only for the admin');
  const a = await T.open('coach', '', ADMIN); await a.waitForSelector('#leadsList li', { timeout: 8000 });
  let v = await T.text(a);
  check(v.includes('Dana Coach') && v.includes('I teach kids') && v.includes('Tom Player') && v.includes('Player'), 'access requests: a coach and a player, with their details and note');
  check(/Open \(2\)/.test(v), 'Open (2)');
  // status and notes
  await a.selectOption('[data-st="2"]', 'no'); await a.waitForTimeout(600);
  check((JSON.parse(await a.evaluate(() => localStorage.getItem('fleads'))).find(x => x.id === 2) || {}).status === 'no', 'status: Not interested');
  check(/Open \(1\)/.test(await T.text(a)), 'and it leaves Open');
  await a.fill('[data-note="1"]', 'Call after 6'); await a.click('h2'); await a.waitForTimeout(600);
  check((JSON.parse(await a.evaluate(() => localStorage.getItem('fleads'))).find(x => x.id === 1) || {}).admin_note === 'Call after 6', 'notes are saved');
  check((await a.getAttribute('a:has-text("WhatsApp") >> nth=0', 'href')).includes('wa.me/972541234567'), 'WhatsApp opens a chat with the number');
  // Send coach code
  await a.click('[data-send="1"]'); await a.waitForSelector('#modal[open] #f_msg');
  const msg = await a.inputValue('#f_msg'), code = (msg.match(/enter: ([A-Z0-9]{8})/) || [])[1];
  check(!!code && /I['’]m a coach and have a coach code/.test(msg), 'Send coach code: a code and the message to send: ' + code);
  await a.keyboard.press('Escape');
  const lead = JSON.parse(await a.evaluate(() => localStorage.getItem('fleads'))).find(x => x.id === 1);
  check(lead.code === code && lead.status === 'code', 'the request is marked Code sent');
  // Dana joins with it: a wrong code first, then hers
  const d = await T.open('u-dana'); await d.waitForSelector('#beCoach', { timeout: 8000 });
  await d.click('#beCoach'); await d.waitForSelector('#modal[open] #f_code');
  await fillForm(d, { code: 'NOPE2345' });
  check((await d.textContent('#modal .form-err')).length > 0, 'a wrong coach code says so');
  await fillForm(d, { code: code.toLowerCase() }); await d.waitForTimeout(3000);
  check((await d.evaluate(() => JSON.parse(localStorage.getItem('fcoaches')))).includes('u-dana'), 'Dana is a coach now');
  await d.reload(); await d.waitForTimeout(3000);
  check(!(await d.evaluate(() => document.body.classList.contains('student-mode'))) && !(await T.text(d, 'body')).includes('Maya Cohen'), 'with an empty board of her own (none of Raem’s students)');
  const e = await T.open('u-eve'); await e.waitForSelector('#beCoach'); await e.click('#beCoach'); await e.waitForSelector('#modal[open] #f_code');
  await fillForm(e, { code }); check((await e.textContent('#modal .form-err')).length > 0, 'the same code can’t be used twice');
  // the request turns Joined, the code shows Used by
  await a.reload(); await a.waitForTimeout(2500);
  check(JSON.parse(await a.evaluate(() => localStorage.getItem('fleads'))).find(x => x.id === 1).status === 'joined', 'once the code is used, the request turns Joined by itself');
  await a.click('[data-tab=codes]'); await a.waitForTimeout(800);
  v = await T.text(a); check(v.includes(code) && v.includes('Used by'), 'Codes: the code is Used by Dana');
  // a player code, and removing an unused one
  await a.click('[data-cc=new][data-kind=player]'); await a.waitForSelector('#modal[open] #f_note');
  await fillForm(a, { note: 'For Tom' }); await a.waitForSelector('#modal[open] #f_msg');
  const pmsg = await a.inputValue('#f_msg'), pcode = (pmsg.match(/enter: ([A-Z0-9]{8})/) || [])[1];
  check(!!pcode && pmsg.includes('player code'), 'a player code with its message');
  await a.keyboard.press('Escape'); await a.waitForTimeout(500);
  const codes = JSON.parse(await a.evaluate(() => localStorage.getItem('fccodes')));
  check(codes[pcode] && codes[pcode].kind === 'player' && codes[pcode].note === 'For Tom', 'saved as a player code, with who it’s for');
  await a.click('[data-cc=del][data-code="' + pcode + '"]'); await a.waitForSelector('#modal[open] button[type=submit]'); await a.click('#modal[open] button[type=submit]'); await a.waitForTimeout(600);
  check(!JSON.parse(await a.evaluate(() => localStorage.getItem('fccodes')))[pcode], 'an unused code can be removed');
  // accounts: remove Dana, keeping her records; then delete everything
  await a.click('[data-tab=coaches]'); await a.waitForTimeout(800);
  v = await T.text(a); check(v.includes('Your account') && v.includes('dana') , 'Accounts lists the coaches, the admin’s own marked');
  await a.click('[data-rc="u-dana"]'); await a.waitForSelector('#modal[open] #f_wipe');
  await fillForm(a, { wipe: 'keep' }); await a.waitForTimeout(800);
  let rem = await a.evaluate(() => window.__removed || []);
  check(rem.some(x => x.target === 'u-dana' && !x.wipe) && !(await a.evaluate(() => JSON.parse(localStorage.getItem('fcoaches')))).includes('u-dana'), 'Keep them: her coach access goes, her records stay');
  // delete another coach and everything in it
  await a.click('[data-rc="u-old"]'); await a.waitForSelector('#modal[open] #f_wipe');
  await fillForm(a, { wipe: 'wipe' }); await a.waitForSelector('#modal[open] button[type=submit]');
  check((await a.textContent('#modal')).includes('Delete Old Coach and all their data?'), 'deleting everything asks a second time');
  await a.click('#modal[open] button[type=submit]'); await a.waitForTimeout(800);
  const left = await a.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('fdb:data/users/u-old') || k.startsWith('fdb:portal/u-om')));
  check(!left.length && !(await a.evaluate(() => JSON.parse(localStorage.getItem('fcoaches')))).includes('u-old'), 'their records, their student’s link and board are deleted');
  check((await a.evaluate(() => JSON.parse(localStorage.getItem('fdb:data/users/coach/st-a')))).name === 'Maya Cohen', 'the admin’s own students are untouched');
  // remove the lead
  await a.click('[data-tab=requests]'); await a.waitForTimeout(600); await a.click('[data-f=all]'); await a.waitForTimeout(400);
  await a.click('[data-del="2"]'); await a.waitForSelector('#modal[open] button[type=submit]'); await a.click('#modal[open] button[type=submit]'); await a.waitForTimeout(600);
  check(!JSON.parse(await a.evaluate(() => localStorage.getItem('fleads'))).some(x => x.id === 2), 'Remove deletes a request');
  await a.screenshot({ path: out('admin'), fullPage: true });
  // the website form (welcome/): sent to the leads table
  const W = 'file://' + path.resolve(__dirname, '../welcome/index.html');
  let posted = null;
  await T.ctx.route('https://gzcwvnynkcepvqkzwvkb.supabase.co/rest/v1/leads', r => { const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST' };
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors }); posted = JSON.parse(r.request().postData() || '{}'); r.fulfill({ status: 201, headers: cors, body: '' }); });
  const w = await T.open(null, '', W); await w.waitForSelector('#leadForm');
  await w.check('input[name=who][value=player]'); await w.waitForTimeout(200);
  check(await w.$$eval('#leadForm .coach-only', xs => xs.length > 0 && xs.every(x => x.hidden)), 'a player isn’t asked the coach questions');
  await w.check('input[name=who][value=coach]');
  await w.fill('#lead_name', 'Noa Bar'); await w.fill('#lead_phone', '050-1111111'); await w.fill('#lead_email', 'noa@x.co'); await w.fill('#lead_city', 'Tel Aviv'); await w.fill('#lead_note', 'Two groups');
  await w.click('#leadBtn'); await w.waitForTimeout(500);
  check(!posted && (await w.textContent('#leadErr')).length > 0, 'without the consent box ticked, nothing is sent');
  await w.check('#lead_ok'); await w.click('#leadBtn'); await w.waitForTimeout(1200);
  check(posted && posted.name === 'Noa Bar' && posted.email === 'noa@x.co' && posted.who === 'coach' && posted.city === 'Tel Aviv' && posted.note === 'Two groups', 'sending the form saves their details: ' + JSON.stringify(posted));
  check(await w.isVisible('#leadDone'), 'and thanks them');
  await T.finish();
})();

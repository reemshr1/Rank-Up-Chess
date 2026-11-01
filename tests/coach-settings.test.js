// Settings: coaching details (name, Hebrew name, currency, fee, overdue days, language, how to pay, week start);
// Useful links (add, edit, remove, restore the suggested list) reaching the student's app; Backup: download, the
// nightly copies (5, then Show all), the folder on this computer, restoring a file, and the reminder on Today;
// official ratings (Check now, a number that can't be read); hiding and showing bubbles and tiles; Student view.
const { URL, t, addDays, stu, les, check, out, start, fillForm } = require('./lib.js');
const fs = require('fs');
(async () => {
  const T = await start();
  // a fake folder on this computer (Chrome's folder picker), keeping what the app writes in it
  // (a class, so the browser can store it the way it stores a real folder)
  await T.ctx.addInitScript(() => { window.__folder = {};
    class Dir { constructor() { this.name = 'Rank Up backups'; this.kind = 'directory'; }
      async queryPermission() { return 'granted'; } async requestPermission() { return 'granted'; }
      async getFileHandle(name) { return { createWritable: async () => { let buf = ''; return { write: async d => { buf += d; }, close: async () => { window.__folder[name] = buf; } }; } }; } }
    window.showDirectoryPicker = async () => new Dir(); });
  const docs = { coach: 'coach', docs: {
    'data/users/coach/settings': { coachName: 'Raem', currency: '₪', defaultRate: 100, overdueDays: 30, lang: 'en', weekStart: 0, lastBackup: addDays(t, -10) },
    'data/users/coach/st-a': stu('st-a', 'Maya Cohen', { fideId: '2812345', noId: false, portal: { uid: 'u-a', linkedAt: t }, sessions: [les('l1', addDays(t, 2), '17:00', 'Rook endings')] }),
    'data/users/coach/st-b': stu('st-b', 'Yoni Levi', { icfId: '99999', noId: false }),
    'portal/u-a': { code: 'A1', linked: true, role: 'student', coach: 'coach', linkedAt: t } },
    ls: { fbackups: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map(i => [addDays(t, -i), { app: 'rank-up', kind: 'nightly', exportedAt: addDays(t, -i) + 'T00:00:00Z',
      docs: { settings: { coachName: 'Raem' }, 'st-old': { id: 'st-old', name: 'From the night', worklog: [] } } }])),
      'ffn:ratings': { fide: { '2812345': { std: 1655, rapid: 1610, blitz: '', title: '' } }, icf: { '99999': { error: 'No answer for this ID' } } } } };
  await T.seed(docs);
  const c = await T.open('coach', '#/dashboard'); await c.waitForTimeout(3000);
  check((await T.text(c)).includes('download a fresh copy'), 'Today reminds that the last backup is over a week old');
  // coaching details
  await c.goto(URL + '#/settings'); await c.waitForTimeout(800);
  await c.fill('#s1', 'Raem Sherman'); await c.fill('#s9', 'רעם שרמן'); await c.fill('#s3', '150'); await c.fill('#s4', '21'); await c.fill('#s7', 'Bit to 054-0000000'); await c.selectOption('#s5', '1');
  await c.click('#setF button[type=submit]'); await c.waitForTimeout(600);
  let st = await T.eventually(async () => { const x = await T.doc(c, 'data/users/coach/settings'); return x.defaultRate === 150 && x; }) || await T.doc(c, 'data/users/coach/settings');
  check(st.coachName === 'Raem Sherman' && st.coachNameHe === 'רעם שרמן' && st.defaultRate === 150 && st.overdueDays === 21 && st.payInfo === 'Bit to 054-0000000' && st.weekStart === 1, 'coaching details saved');
  // useful links
  await c.click('[data-ln=add]'); await c.waitForSelector('#modal[open] #f_url');
  await fillForm(c, { name: 'Chessbase Online', url: 'https://database.chessbase.com', note: 'Search games' });
  st = await T.eventually(async () => { const x = await T.doc(c, 'data/users/coach/settings'); return Array.isArray(x.links) && x.links.some(l => l.name === 'Chessbase Online') && x; }) || st;
  check((st.links || []).some(l => l.name === 'Chessbase Online' && l.url === 'https://database.chessbase.com'), 'a link added (the suggested list becomes the coach’s own)');
  const lich = st.links.find(l => /lichess\.org\/?$/.test(l.url));
  await c.click('[data-ln=del][data-id="' + lich.id + '"]'); await c.waitForSelector('#modal[open] button[type=submit]'); await c.click('#modal[open] button[type=submit]'); await c.waitForTimeout(500);
  st = await T.eventually(async () => { const x = await T.doc(c, 'data/users/coach/settings'); return !x.links.some(l => l.id === lich.id) && x; }) || st;
  check(!st.links.some(l => l.id === lich.id), 'a link removed');
  const m = await T.open('u-a', '#/student/st-a/work'); await m.waitForTimeout(4500);
  let mv = await T.text(m);
  check(mv.includes('Chessbase Online') && mv.includes('Search games') && !/\blichess\.org\b(?!\/)/.test(mv.replace('lichess.org/training', '')), 'the student’s Useful links follow');
  await c.click('[data-ln=reset]'); await c.waitForSelector('#modal[open] button[type=submit]'); await c.click('#modal[open] button[type=submit]'); await c.waitForTimeout(500);
  st = await T.eventually(async () => { const x = await T.doc(c, 'data/users/coach/settings'); return !x.links && x; }) || st;
  check(!st.links, 'Restore the suggested list');
  // backup: download, nightly copies, restore
  const [dl] = await Promise.all([c.waitForEvent('download'), c.click('#exp')]);
  const file = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  check(dl.suggestedFilename() === 'rank-up-backup-' + t + '.json' && file.app === 'rank-up' && file.students.length === 2, 'Download backup: a file with every student');
  check(!!(await T.eventually(async () => (await T.doc(c, 'data/users/coach/settings')).lastBackup === t)), 'the download is remembered (lastBackup = today)');
  await c.waitForSelector('#nightly li'); check(await c.$$eval('#nightly li', x => x.length) === 5, 'the 5 newest nightly copies');
  await c.click('#nightly [data-nb=all]'); await c.waitForTimeout(300); check(await c.$$eval('#nightly li', x => x.length) === 7, 'Show all: 7');
  const [dn] = await Promise.all([c.waitForEvent('download'), c.click('#nightly [data-nb="' + addDays(t, -2) + '"]')]);
  const nf = JSON.parse(fs.readFileSync(await dn.path(), 'utf8'));
  check(nf.students[0].name === 'From the night', 'a nightly copy downloads as a backup file');
  await c.setInputFiles('#imp', { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(nf)) }); await c.waitForSelector('#modal[open] button[type=submit]');
  check((await c.textContent('#modal')).includes('This adds 1 students'), 'Restore says what it adds');
  await c.click('#modal[open] button[type=submit]'); await c.waitForTimeout(800);
  check(!!(await T.eventually(() => T.doc(c, 'data/users/coach/st-old'))), 'restored: the student from the file is back');
  // the folder on this computer
  await c.goto(URL + '#/settings'); await c.waitForTimeout(600);
  await c.click('[data-bf=choose]'); await c.waitForTimeout(800);
  const saved = await c.evaluate(() => Object.keys(window.__folder));
  check(saved.includes('rank-up-backup-' + t + '.json'), 'Choose a folder saves today’s backup into it');
  check(JSON.parse(await c.evaluate(n => window.__folder[n], 'rank-up-backup-' + t + '.json')).students.length === 3, 'the file in the folder is a full backup');
  check((await T.text(c)).includes('Rank Up backups') && (await T.text(c)).includes('Save now'), 'the folder is named, with Save now / Change folder / Stop');
  // ratings: Check now
  await c.goto(URL + '#/students'); await c.waitForTimeout(600);
  await c.click('#ratingsNow'); await c.waitForTimeout(1500);
  const ma = await T.eventually(async () => { const x = await T.student(c, 'coach', 'st-a'); return (x.ratings || []).some(r => +r.value === 1655) && x; }) || await T.student(c, 'coach', 'st-a');
  check(ma.ratings.some(r => +r.value === 1655 && r.source === 'FIDE') && ma.ratings.some(r => +r.value === 1610 && r.source === 'FIDE Rapid'), 'FIDE standard and rapid ratings fetched for Maya');
  check((await T.text(c)).includes('Yoni') && /Couldn't read|couldn’t/i.test(await T.text(c)), 'a number that can’t be read is listed');
  // hiding bubbles and tiles
  if (await c.evaluate(() => document.querySelector('#modal').open)) { check((await c.textContent('#modal')).includes('99999'), 'the rating check’s window says which number couldn’t be read'); await c.keyboard.press('Escape'); }
  await c.goto(URL + '#/dashboard'); await c.waitForTimeout(800);
  check(!(await T.text(c)).includes('download a fresh copy'), 'Today no longer asks for a backup');
  const key = await c.$eval('.panel [data-hide]', b => b.dataset.hide);
  await c.hover('.panel:has([data-hide="' + key + '"]) h2'); await c.click('[data-hide="' + key + '"]'); await c.waitForTimeout(500);
  st = await T.doc(c, 'data/users/coach/settings');
  check((st.hiddenPanels || []).includes(key) && await c.$('[data-unhide="' + key + '"]'), 'Hide folds a bubble to its title, with Show (saved in the settings)');
  await c.hover('.panel:has([data-unhide="' + key + '"]) h2'); await c.click('[data-unhide="' + key + '"]'); await c.waitForTimeout(500);
  check(!((await T.doc(c, 'data/users/coach/settings')).hiddenPanels || []).includes(key), 'Show opens it again');
  await c.hover('.stat >> nth=0'); await c.click('.stat [data-hide] >> nth=0'); await c.waitForTimeout(400);
  check(await c.$('.stat-folded'), 'a number tile can be hidden too');
  const m2 = await T.open('u-a', '#/home'); await m2.waitForTimeout(3500);
  check(!(await m2.$('[data-hide]')), 'students don’t have Hide');
  // Student view
  await c.goto(URL + '#/student/st-a/overview'); await c.waitForTimeout(600);
  await c.click('text=Student view'); await c.waitForSelector('#pvFrame'); await c.waitForTimeout(4000);
  const fr = c.frame({ url: /preview=st-a/ });
  const fv = fr ? await fr.textContent('#view') : '';
  check(fv.includes('Rook endings') && (await c.textContent('#pvWrap')).includes('Viewing as Maya'), 'Student view shows Maya’s app, with her lesson');
  if (fr) { await fr.click('[data-a=log]'); await fr.waitForSelector('#modal[open] #f_what'); await fr.selectOption('#f_what', 'Other'); await fr.click('#modal[open] button[type=submit]'); await c.waitForTimeout(600);
    check((await fr.textContent('#toast').catch(() => '')).includes('Preview — nothing was sent'), 'anything that would send says “Preview — nothing was sent”');
    check(!(await T.docs(c, 'portal/u-a/inbox/')).length && !((await T.student(c, 'coach', 'st-a')).worklog || []).length, 'and indeed nothing reached Maya’s account or records'); }
  await c.click('#pvExit'); await c.waitForTimeout(300); check(!(await c.$('#pvWrap')), 'Exit student view');
  await c.screenshot({ path: out('settings'), fullPage: true });
  await T.finish();
})();

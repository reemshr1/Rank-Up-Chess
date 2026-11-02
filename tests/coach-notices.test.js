// Notifications: the coach writes one with {name} and [boy|girl], picks who gets it (student and/or parent per child,
// quick choices), the student and the parent see it under 🔔 with a count and mark it read, the coach sees Read X of Y,
// edits it (each child keeps their own name, students see "Edited") and deletes it; notifications go after 7 days.
const { URL, t, addDays, stu, check, out, start } = require('./lib.js');
(async () => {
  const T = await start();
  await T.seed({ coach: 'coach', docs: {
    'data/users/coach/settings': { coachName: 'Raem', currency: '₪', lang: 'en', weekStart: 0,
      families: [{ id: 'fam-c', name: 'Cohen family', studentIds: ['st-a'], portal: { uid: 'u-par', linkedAt: t } }] },
    'data/users/coach/st-a': stu('st-a', 'Maya Cohen', { gender: 'f', portal: { uid: 'u-a', linkedAt: t },
      notices: [{ id: 'n-old', date: addDays(t, -8), to: ['student'], text: 'An old notice' }] }),
    'data/users/coach/st-b': stu('st-b', 'Yoni Levi', { gender: 'm', portal: { uid: 'u-b', linkedAt: t } }),
    'portal/u-a': { code: 'A1', linked: true, role: 'student', coach: 'coach', linkedAt: t }, 'portal/u-b': { code: 'B1', linked: true, role: 'student', coach: 'coach', linkedAt: t },
    'portal/u-par': { code: 'F1', linked: true, role: 'parent', coach: 'coach', linkedAt: t } } });
  const c = await T.open('coach', '#/dashboard'); await c.waitForTimeout(3000);
  let a = await T.student(c, 'coach', 'st-a');
  await c.click('#dNote'); await c.waitForTimeout(400);
  a = await T.eventually(async () => { const x = await T.student(c, 'coach', 'st-a'); return !(x.notices || []).some(n => n.id === 'n-old') && x; }) || a;
  check(!(a.notices || []).some(n => n.id === 'n-old'), 'a notification older than 7 days leaves the records');
  if (await c.$('#ntNew')) { await c.click('#ntNew'); await c.waitForTimeout(300); }
  await c.waitForSelector('#modal[open] #nt');
  await c.fill('#nt', 'Hi {name}, no lesson on Tuesday. You are a [star-boy|star-girl]!');
  await c.click('#modal[open] button[type=submit]'); await c.waitForTimeout(300);
  check((await c.textContent('#modal .form-err')).length > 0 || (await c.textContent('#ntCount')).includes('Choose who'), 'nobody chosen: it asks who gets it');
  await c.check('[data-sid="st-a"][data-who="student"]'); await c.check('[data-sid="st-a"][data-who="parent"]'); await c.check('[data-sid="st-b"][data-who="student"]');
  check((await c.textContent('#ntCount')).includes('1 parent') && (await c.textContent('#ntCount')).includes('2 students'), 'the count: 1 parent · 2 students');
  await c.click('#modal[open] button[type=submit]'); await c.waitForTimeout(800);
  a = await T.eventually(async () => { const x = await T.student(c, 'coach', 'st-a'); return (x.notices || []).length && x; }) || a;
  const b = await T.student(c, 'coach', 'st-b');
  const na = (a.notices || [])[0], nb = (b.notices || [])[0];
  check(na && nb && na.id === nb.id, 'one notification, for both children');
  check(na.text.includes('Hi Maya') && nb.text.includes('Hi Yoni') && !na.text.includes('{name}'), '{name} becomes each child’s name');
  check(na.text.includes('star-girl') && nb.text.includes('star-boy') && !na.text.includes('['), '[boy|girl] picks the right word for each child');
  check((na.to || []).includes('student') && (na.to || []).includes('parent') && (nb.to || []).join() === 'student', 'Maya: student and parent; Yoni: student only');
  // Maya's app
  const m = await T.open('u-a', '#/home'); await m.waitForTimeout(4500);
  check(/Notifications, 1 unread/.test(await m.$eval('[data-a=notes]', e => e.getAttribute('aria-label')).catch(() => '')), '🔔 shows 1 unread');
  await m.click('[data-a=notes]'); await m.waitForTimeout(400);
  check((await m.textContent('#modal')).includes('Hi Maya, no lesson on Tuesday'), 'the window lists it, with her name');
  await m.click('#modal [data-read]'); await m.waitForTimeout(3000);
  // the parent's app
  const p = await T.open('u-par', '#/home'); await p.waitForTimeout(4500);
  await p.click('[data-a=notes]'); await p.waitForTimeout(400);
  check((await p.textContent('#modal')).includes('Hi Maya'), 'the parent gets it too');
  // Yoni's app has it; he doesn't read it
  const y = await T.open('u-b', '#/home'); await y.waitForTimeout(4500);
  check(/1 unread/.test(await y.$eval('[data-a=notes]', e => e.getAttribute('aria-label')).catch(() => '')), 'Yoni has it, unread');
  // read counts for the coach
  await c.waitForTimeout(2000); await c.reload(); await c.waitForTimeout(3000);
  await c.click('#dNote'); await c.waitForTimeout(500);
  let cv = await c.textContent('#modal');
  check(/Read 1 of 3/.test(cv) && cv.includes('Maya'), 'the coach sees Read 1 of 3, by Maya: ' + (cv.match(/Read \d+ of \d+/) || [''])[0]);
  // edit
  await c.click('[data-ned]'); await c.waitForSelector('#modal[open] #f_text');
  check((await c.inputValue('#f_text')).includes('{name}'), 'editing shows the message with {name}');
  await c.fill('#f_text', 'Hi {name}, no lesson on Wednesday.'); await c.click('#modal[open] button[type=submit]'); await c.waitForTimeout(800);
  a = await T.eventually(async () => { const x = await T.student(c, 'coach', 'st-a'); return /Wednesday/.test((x.notices || [{}])[0].text) && x; }) || a;
  const ya = (await T.student(c, 'coach', 'st-b')).notices[0];
  check(a.notices[0].text === 'Hi Maya, no lesson on Wednesday.' && ya.text === 'Hi Yoni, no lesson on Wednesday.', 'edited: each child keeps their own name');
  check(a.notices[0].edited || a.notices[0].editedAt || JSON.stringify(a.notices[0]).includes('dit'), 'marked as edited');
  await y.waitForTimeout(3500); await y.reload(); await y.waitForTimeout(3000); await y.click('[data-a=notes]'); await y.waitForTimeout(400);
  const yv = await y.textContent('#modal');
  check(yv.includes('Wednesday') && yv.includes('Edited'), 'Yoni sees the new text, marked Edited');
  // delete
  await c.click('#dNote').catch(() => {}); await c.waitForTimeout(400);
  if (!(await c.$('#modal[open] [data-ndel]'))) { await c.keyboard.press('Escape'); await c.click('#dNote'); await c.waitForTimeout(400); }
  await c.click('#modal[open] [data-ndel]'); await c.waitForTimeout(300);
  if (await c.$('#modal[open] button[type=submit]')) await c.click('#modal[open] button[type=submit]'); await c.waitForTimeout(800);
  a = await T.eventually(async () => { const x = await T.student(c, 'coach', 'st-a'); return !(x.notices || []).length && x; }) || await T.student(c, 'coach', 'st-a');
  check(!(a.notices || []).length && !((await T.student(c, 'coach', 'st-b')).notices || []).length, 'Delete removes it for everyone');
  await c.screenshot({ path: out('notices'), fullPage: true });
  await T.finish();
})();

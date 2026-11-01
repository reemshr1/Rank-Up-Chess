// The coach on a student's Practice tab: logging practice (tactics with counts, endgames from a book), Tactics
// statistics; Fitness: weekly goal in workouts and minutes, quick log, a workout (Calisthenics, Other sport),
// sleep before tournaments; Books: adding a book, reading by page range (the bar of read parts), attaching,
// opening and removing a PDF; the Book library: a book with its PDF, given to a student and to a club group.
const { URL, t, addDays, stu, check, out, start, fillForm } = require('./lib.js');
const pdf = { name: 'silman.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%test\n') };
(async () => {
  const T = await start();
  await T.seed({ coach: 'coach', docs: {
    'data/users/coach/settings': { coachName: 'Raem', currency: '₪', lang: 'en', weekStart: 0,
      club: [{ id: 'cl1', name: 'Diamond Class', kind: 'weekly', day: 2, from: '16:00', to: '17:30', start: addDays(t, -60) }] },
    'data/users/coach/st-a': stu('st-a', 'Maya Cohen', { tournaments: [{ id: 'tr1', name: 'Rapid Cup', start: addDays(t, -3), result: '4/6' }] }),
    'data/users/coach/st-b': stu('st-b', 'Yoni Levi', { clubIds: ['cl1'] }), 'data/users/coach/st-c': stu('st-c', 'Dana Bar', { clubIds: ['cl1'] }) } });
  const c = await T.open('coach', '#/student/st-a/work'); await c.waitForTimeout(3000);
  // practice: tactics with counts
  await c.click('[data-a=addLog]'); await c.waitForSelector('#modal[open] #f_minutes');
  await fillForm(c, { minutes: '40', what: 'Tactics', site: 'ChessTempo' }, false);
  await c.selectOption('#f_exercise', 'Tactics (rated)');
  await fillForm(c, { attempted: '30', correct: '24', prating: '1710' });
  let a = await T.student(c, 'coach', 'st-a');
  const w1 = a.worklog.find(w => w.site === 'ChessTempo');
  check(w1 && +w1.minutes === 40 && +w1.attempted === 30 && +w1.correct === 24 && +w1.prating === 1710, 'a tactics session with puzzles tried, solved and rating');
  let v = await T.text(c);
  check(v.includes('40 min') && v.includes('24/30 correct (80%)'), 'listed with its result');
  check(v.includes('Tactics statistics') && v.includes('80%'), 'and in the tactics statistics');
  // more solved than tried is refused
  await c.click('[data-a=addLog]'); await c.waitForSelector('#modal[open] #f_minutes');
  await fillForm(c, { what: 'Tactics', site: 'ChessTempo' }, false); await c.selectOption('#f_exercise', 'Tactics (rated)');
  await fillForm(c, { attempted: '5', correct: '9' });
  check((await c.textContent('#modal .form-err')).includes("can't be more"), 'solved can’t be more than tried');
  await c.keyboard.press('Escape');
  // endgames from a book, with types
  await c.goto(URL + '#/student/st-a/books'); await c.waitForTimeout(600);
  await c.click('[data-a=add]'); await c.waitForSelector('#modal[open] #f_title');
  await fillForm(c, { title: 'Silman’s Endgame Course', author: 'Jeremy Silman', topic: 'Endgames', pages: '500', status: 'Reading' });
  await c.waitForTimeout(400); await c.keyboard.press('Escape');
  a = await T.student(c, 'coach', 'st-a'); const bk = a.books.find(b => b.title === 'Silman’s Endgame Course');
  check(bk && +bk.pages === 500 && bk.status === 'Reading', 'a book is added');
  // reading by page range: two parts
  for (const [from, to] of [['40', '55'], ['100', '120']]) {
    await c.click('[data-a=read][data-id="' + bk.id + '"]'); await c.waitForSelector('#modal[open] #f_minutes');
    await fillForm(c, { minutes: '20', pageFrom: from, page: to }); await c.waitForTimeout(300); }
  a = await T.student(c, 'coach', 'st-a');
  check(a.worklog.filter(w => w.bookId === bk.id).length === 2 && +a.books.find(b => b.id === bk.id).page === 120, 'two reading sessions, by page range; the book is at page 120');
  v = await T.text(c); check(/\b(7|8)%/.test(v), 'the book shows how much was read (36 of 500 pages): ' + (v.match(/\d+%/) || [''])[0]);
  check(await c.$('.book-bar, .bar-parts, .read-bar, [class*=bar]'), 'with the bar of read parts');
  // attach, open and remove a PDF
  const [fc] = await Promise.all([c.waitForEvent('filechooser'), c.click('[data-a=pdfUp][data-id="' + bk.id + '"]')]);
  await fc.setFiles(pdf); await c.waitForTimeout(1200);
  a = await T.student(c, 'coach', 'st-a');
  check(a.books.find(b => b.id === bk.id).pdf && a.books.find(b => b.id === bk.id).pdf.path === 'st-a/' + bk.id + '.pdf', 'the PDF is attached as <student>/<book>.pdf');
  check(await c.evaluate(p => !!localStorage.getItem('fstore:books/' + p), 'st-a/' + bk.id + '.pdf'), 'and stored');
  v = await T.text(c); check(v.includes('Open PDF') && v.includes('Replace') && v.includes('Remove'), 'Open PDF, Replace, Remove');
  // fitness: a weekly goal, quick log, a workout, sleep
  await c.goto(URL + '#/student/st-a/fitness'); await c.waitForTimeout(600);
  await c.click('[data-a=fitGoal]'); await c.waitForSelector('#modal[open] #f_goal');
  await fillForm(c, { goal: '2', mins: '60' });
  a = await T.student(c, 'coach', 'st-a'); check(+a.fitnessGoal === 2 && +a.fitnessMinGoal === 60, 'a weekly goal: 2 workouts and 60 minutes');
  await c.click('[data-a=addFit]'); await c.waitForSelector('#modal[open] #f_activity');
  await fillForm(c, { activity: 'Calisthenics', minutes: '35' });
  await c.click('[data-a=addFit]'); await c.waitForSelector('#modal[open] #f_activity');
  await fillForm(c, { activity: 'Other sport' }, false); await fillForm(c, { other: 'Climbing', minutes: '30' });
  a = await T.student(c, 'coach', 'st-a');
  check(a.fitness.some(f => f.activity === 'Calisthenics' && +f.minutes === 35) && a.fitness.some(f => f.other === 'Climbing'), 'workouts: Calisthenics, and another sport by name');
  v = await T.text(c); check(v.includes('Weekly goal reached') || v.includes('weeks in a row') || v.includes('2/2'), 'two workouts, 65 minutes: the week reaches the goal');
  await c.click('[data-a=sleep]'); await c.waitForSelector('#modal[open] #f_hours');
  await fillForm(c, { date: addDays(t, -3), hours: '8.5' });
  a = await T.student(c, 'coach', 'st-a'); check(a.sleep.some(x => +x.hours === 8.5), 'sleep the night before a tournament day');
  check((await T.text(c)).includes('Rapid Cup'), 'shown with the tournament');
  // the book library
  await c.goto(URL + '#/students'); await c.waitForTimeout(600);
  await c.click('[data-a=blAdd]').catch(async () => { await c.click('text=Book library'); await c.click('[data-a=blAdd]'); });
  await c.waitForSelector('#modal[open] #f_title'); await fillForm(c, { title: 'My System', author: 'Nimzowitsch', pages: '380' }, false);
  const [fc2] = await Promise.all([c.waitForEvent('filechooser'), c.click('#modal[open] button[type=submit]')]);
  await fc2.setFiles(Object.assign({}, pdf, { name: 'mysystem.pdf' })); await c.waitForTimeout(1200);
  const lib = ((await T.doc(c, 'data/users/coach/settings')).bookLib || []).find(b => b.title === 'My System');
  check(lib && lib.pdf && lib.pdf.path === 'library/' + lib.id + '.pdf', 'a library book with its PDF (library/<id>.pdf)');
  await c.click('[data-a=blGive][data-id="' + lib.id + '"]'); await c.waitForSelector('#modal[open] #f_to');
  await fillForm(c, { to: 'club:cl1' }); await c.waitForTimeout(1500);
  const yb = (await T.student(c, 'coach', 'st-b')).books.find(b => b.libId === lib.id), db = (await T.student(c, 'coach', 'st-c')).books.find(b => b.libId === lib.id);
  check(yb && db && yb.pdf && yb.pdf.path === 'st-b/' + yb.id + '.pdf' && db.pdf, 'given to the whole club group: each student gets the book and their own copy of the PDF');
  await c.click('[data-a=blGive][data-id="' + lib.id + '"]'); await c.waitForSelector('#modal[open] #f_to');
  await fillForm(c, { to: 'st-b' });
  check((await c.textContent('#modal .form-err')).includes('already have'), 'a student who has it isn’t given it twice');
  await c.keyboard.press('Escape');
  // remove the PDF from Maya's book
  await c.goto(URL + '#/student/st-a/books'); await c.waitForTimeout(600);
  await c.click('[data-a=pdfDel][data-id="' + bk.id + '"]'); await c.waitForTimeout(300);
  if (await c.$('#modal[open] button[type=submit]')) await c.click('#modal[open] button[type=submit]'); await c.waitForTimeout(800);
  a = await T.student(c, 'coach', 'st-a');
  check(!a.books.find(b => b.id === bk.id).pdf && !(await c.evaluate(p => !!localStorage.getItem('fstore:books/' + p), 'st-a/' + bk.id + '.pdf')), 'Remove deletes the PDF');
  await c.screenshot({ path: out('practice'), fullPage: true });
  await T.finish();
})();

// A player's books and endgames: attaching a PDF to their own book (stored as <their record>/<book>.pdf, theirs),
// opening, replacing and removing it; logging endgame practice from that book with the endgame types ticked, and
// "Endgames by type"; then, moving to a coach, the coach's app copies the PDF into the coach's own files (and a PDF
// it can't copy is named on the book, never lost silently).
const { URL, t, addDays, stu, check, out, start, fillForm } = require('./lib.js');
const pdf = name => ({ name, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%' + name + '\n') });
(async () => {
  const T = await start();
  await T.seed({ coach: 'coach', coaches: ['tom'], players: ['tom'], docs: {
    'data/users/coach/settings': { coachName: 'Raem', lang: 'en' },
    'data/users/coach/st-t': stu('st-t', 'Tom Levi', { invite: { code: 'TOM234', created: t } }),
    'data/users/tom/settings': { coachName: 'Tom Levi', lang: 'en' },
    'data/users/tom/st-k3x9': stu('st-k3x9', 'Tom Levi', { self: true, setup: 'self', rate: 0, worklog: [],
      books: [{ id: 'bk1', title: 'Silman’s Endgame Course', status: 'Reading', pages: 500, page: 40 },
        { id: 'bk2', title: 'Dvoretsky’s Endgame Manual', status: 'Reading', pages: 400, pdf: { path: 'st-k3x9/bk2.pdf', name: 'dvoretsky.pdf', size: 900, at: addDays(t, -5) } }] }) } });
  const p = await T.open('tom', '#/student/st-k3x9/books'); await p.waitForTimeout(3500);
  // attach
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('[data-a=pdfUp][data-id=bk1]')]);
  await fc.setFiles(pdf('silman.pdf')); await p.waitForTimeout(1200);
  check((await p.textContent('#toast')).includes('PDF attached — open it from the book'), 'attached: “PDF attached — open it from the book”');
  let me = await T.student(p, 'tom', 'st-k3x9');
  check(me.books.find(b => b.id === 'bk1').pdf.path === 'st-k3x9/bk1.pdf', 'saved on the book as <their record>/<book>.pdf');
  check((await p.evaluate(() => JSON.parse(localStorage.getItem('fstore:books/st-k3x9/bk1.pdf')))).owner === 'tom', 'the file is the player’s own');
  // open
  const [tab] = await Promise.all([p.context().waitForEvent('page'), p.click('[data-a=pdf][data-id=bk1]')]);
  await tab.waitForTimeout(800); check(tab.url().includes('st-k3x9/bk1.pdf'), 'Open PDF opens it in a new tab'); await tab.close();
  // replace
  const [fc2] = await Promise.all([p.waitForEvent('filechooser'), p.click('[data-a=pdfUp][data-id=bk1]')]);
  await fc2.setFiles(pdf('silman-2nd.pdf')); await p.waitForTimeout(1200);
  me = await T.student(p, 'tom', 'st-k3x9');
  check(me.books.find(b => b.id === 'bk1').pdf.name === 'silman-2nd.pdf' && (await p.evaluate(() => JSON.parse(localStorage.getItem('fstore:books/st-k3x9/bk1.pdf')).name)) === 'silman-2nd.pdf', 'Replace puts the new file in its place');
  // endgames from the book, with types
  await p.goto(URL + '#/student/st-k3x9/work'); await p.waitForTimeout(600);
  await p.click('[data-a=addLog]'); await p.waitForSelector('#modal[open] #f_minutes');
  await fillForm(p, { minutes: '40', what: 'Endgames' }, false);
  await p.click('#modal[open] [data-multi-sum=eg]'); await p.check('#modal[open] [data-checks=eg] input[value=rook]'); await p.check('#modal[open] [data-checks=eg] input[value=pawn]');
  await fillForm(p, { src: 'Book' }, false); await fillForm(p, { bookId: 'bk1', pageFrom: '41', page: '60' });
  me = await T.student(p, 'tom', 'st-k3x9');
  const w = me.worklog.find(x => x.what === 'Endgames');
  check(w && +w.minutes === 40 && w.bookId === 'bk1' && ['rook', 'pawn'].every(k => (w.eg || []).includes(k)), 'endgame practice from the book, with rook and pawn endgames ticked');
  check(+me.books.find(b => b.id === 'bk1').page === 60, 'the book moves on to page 60');
  let v = await T.text(p);
  check(v.includes('Endgames by type') && /Rook\s*50% · 20 min/.test(v) && /Pawn\s*50% · 20 min/.test(v), 'Endgames by type: rook and pawn, 20 minutes each (a session counts evenly for each type)');
  // remove
  await p.goto(URL + '#/student/st-k3x9/books'); await p.waitForTimeout(600);
  await p.click('[data-a=pdfDel][data-id=bk1]'); await p.waitForTimeout(300);
  if (await p.$('#modal[open] button[type=submit]')) await p.click('#modal[open] button[type=submit]'); await p.waitForTimeout(800);
  me = await T.student(p, 'tom', 'st-k3x9');
  check(!me.books.find(b => b.id === 'bk1').pdf && !(await p.evaluate(() => localStorage.getItem('fstore:books/st-k3x9/bk1.pdf'))), 'Remove takes the PDF off the book and deletes the file');
  // attached again, to move with him
  const [fc3] = await Promise.all([p.waitForEvent('filechooser'), p.click('[data-a=pdfUp][data-id=bk1]')]); await fc3.setFiles(pdf('silman.pdf')); await p.waitForTimeout(1000);
  // move to the coach: the coach's app copies the PDF; the second book's file is missing
  await p.goto(URL + '#/home'); await p.waitForTimeout(800);
  await p.click('[data-a=toCoach]'); await p.waitForSelector('#modal[open] #f_code'); await fillForm(p, { code: 'TOM234' }); await p.waitForTimeout(3000);
  const c = await T.open('coach', '#/student/st-t/books'); await c.waitForTimeout(5000);
  const s = await T.eventually(async () => { const x = await T.student(c, 'coach', 'st-t'); const b = (x.books || []).find(y => y.id === 'bk1'); return b && b.pdf && x; }, 10000);
  check(!!s && s.books.find(b => b.id === 'bk1').pdf.path === 'st-t/bk1.pdf', 'the coach’s app copies the PDF into the coach’s files, as <coach’s student>/<book>.pdf');
  check((await c.evaluate(() => JSON.parse(localStorage.getItem('fstore:books/st-t/bk1.pdf') || '{}').owner)) === 'coach', 'and the copy is the coach’s');
  const b2 = s && s.books.find(b => b.id === 'bk2');
  check(b2 && !b2.pdf && b2.pdfLost === 'dvoretsky.pdf', 'a PDF that can’t be copied is named on the book');
  await c.reload(); await c.waitForTimeout(3000);
  v = await T.text(c);
  check(v.includes('The PDF “dvoretsky.pdf” from their own board couldn’t be brought'), 'and the coach sees which one');
  check(v.includes('Open PDF'), 'the copied one opens from the coach’s Books');
  await c.screenshot({ path: out('player-books'), fullPage: true });
  await T.finish();
})();

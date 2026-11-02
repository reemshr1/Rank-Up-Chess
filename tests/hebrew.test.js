// The whole app in Hebrew: the coach's, a student's, a parent's and a player's pages, and the windows their buttons
// open, read right to left, with no English left on screen apart from what people typed (names, titles, notes),
// chess notation and names of sites and lists (FIDE, Lichess…). Each piece of English found is listed with its page.
const { URL, t, addDays, stu, les, check, out, start } = require('./lib.js');
// what people typed, and words that stay in English in the Hebrew app
const DATA = ['Maya Cohen', 'Yoni Cohen', 'Tom Levi', 'Raem', 'Cohen family', 'Rook endings', 'Pins', 'Good work', 'Italian Game', 'Haifa Open', 'Rapid Cup', 'Silman', '30 puzzles on pins',
  'Maya', 'Yoni', 'Tom', 'Kasparovich', 'Club Cup', 'Diamond Class', 'Haifa club', 'Bit to 054-1234567', 'No lessons on Friday', 'raem@x.co', 'maya@x.co', 'Lucena', 'Endgame Strategy'];
const KEEP = /^(ECO|English|ratings\.fide\.com|chess\.org\.il|Id|Chess-Results|Chess|Results|Structures|pgn|ABC|FIDE|ICF|PGN|PDF|CSV|Lichess|Chess\.com|ChessTempo|ChessBase|ChessKing|Chessable|Bit|PayBox|Paybox|Rank|Up|Google|Gmail|WhatsApp|Chrome|Safari|iPhone|Android|Edge|Supabase|OK|Rapid|Blitz|Elo|Storm|Racer|Streak|Puzzle|Rush|Battle|Sicilian|Najdorf|vs|e\.g|am|pm|min|KB|MB|ID)$/;
const SCAN = () => { const skip = 'textarea,script,style,.moves,.line-box,.cboard,.no-tr,[dir=ltr],bdi,input,select option,.pgn,code';
  const vis = el => { for (let e = el; e; e = e.parentElement) { if (e.hidden) return false; const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden') return false; if (e.tagName === 'DIALOG' && !e.open) return false; } return true; };
  const found = new Set(), w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) { const p = n.parentElement, v = n.nodeValue.trim(); if (!p || !v || !/[A-Za-z]{2,}/.test(v) || p.closest(skip) || !vis(p)) continue; found.add(v); }
  document.querySelectorAll('[placeholder],[title],[aria-label]').forEach(el => { if (el.closest(skip.replace(',input', '')) || !vis(el)) return;
    ['placeholder', 'title', 'aria-label'].forEach(a => { const v = (el.getAttribute(a) || '').trim(); if (/[A-Za-z]{2,}/.test(v)) found.add(a + ': ' + v); }); });
  return [...found]; };
// what's left once data, notation and the words that stay in English are taken out
const leftover = s => { let x = s.replace(/^(placeholder|title|aria-label): /, '');
  DATA.forEach(d => { x = x.split(d).join(' '); });
  x = x.replace(/https?:\/\/\S+|\S+@\S+/g, ' ').replace(/\b([KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](=[QRBN])?[+#]?|O-O(-O)?)\b/g, ' ').replace(/\b\d+(\.\.\.|\.)/g, ' ');
  return x.split(/[^A-Za-z.]+/).map(y => y.replace(/^\.+|\.+$/g, '')).filter(y => y.length >= 2 && !KEEP.test(y)); };
const PAGES = {
  coach: ['#/dashboard', '#/students', '#/student/st-a/overview', '#/student/st-a/sessions', '#/student/st-a/work', '#/student/st-a/fitness', '#/student/st-a/books', '#/student/st-a/tournaments',
    '#/student/st-a/games', '#/student/st-a/studied', '#/student/st-a/repertoire', '#/student/st-a/assignments', '#/student/st-a/payments', '#/schedule', '#/club', '#/assignments', '#/assignment/as-1', '#/payments', '#/settings', '#/search/maya'],
  student: id => ['#/home', '#/student/' + id + '/assignments', '#/student/' + id + '/work', '#/student/' + id + '/fitness', '#/student/' + id + '/books', '#/student/' + id + '/tournaments',
    '#/student/' + id + '/games', '#/student/' + id + '/studied', '#/student/' + id + '/repertoire', '#/progress', '#/schedule', '#/payments', '#/assignment/as-1'] };
// buttons that only open a window (never delete, finish or send anything by themselves)
const SAFE = /^(add|new|log|addLog|addFit|fitGoal|sleep|req|edit|profile|alerts|notes|toCoach|addCoach|addKid|addRt|invite|blAdd|blGive|read|sum|notice|addGame|addS|addTour|addRep|rate|pay|charge|iPaid|move|cant|slot|free|club|checkin)$/;
(async () => {
  const T = await start({ viewport: { width: 1280, height: 900 } });
  await T.seed({ coach: 'coach', coaches: ['tom'], players: ['tom'], docs: {
    'data/users/coach/settings': { coachName: 'Raem', coachNameHe: 'רעם', currency: '₪', defaultRate: 100, weekStart: 0, lang: 'he', showPay: true, payInfo: 'Bit to 054-1234567',
      club: [{ id: 'cl1', name: 'Diamond Class', nameHe: 'כיתת יהלום', kind: 'weekly', weekday: new Date().getDay(), from: '16:00', to: '17:30', place: 'Haifa club', start: addDays(t, -30), end: '' }],
      families: [{ id: 'fam', name: 'Cohen family', studentIds: ['st-a', 'st-b'], portal: { uid: 'u-par', linkedAt: t } }] },
    'data/users/coach/st-a': stu('st-a', 'Maya Cohen', { fullHe: 'מאיה כהן', gender: 'f', portal: { uid: 'u-a', linkedAt: addDays(t, -20) }, pay: true, clubIds: ['cl1'], rating: '1540',
      ratings: [{ date: addDays(t, -40), value: 1500, source: 'FIDE' }, { date: addDays(t, -5), value: 1540, source: 'FIDE' }],
      sessions: [les('l1', addDays(t, 2), '17:00', 'Rook endings'), les('l0', addDays(t, -7), '17:00', 'Pins', { status: 'done', fee: 100, notes: 'Good work' })],
      worklog: [{ id: 'w1', date: addDays(t, -1), what: 'Tactics', site: 'Lichess', exercise: 'Puzzles (rated)', minutes: 30, attempted: 20, correct: 15, by: 'student' }, { id: 'w2', date: addDays(t, -3), what: 'Endgames', minutes: 25, src: 'Book', eg: ['rook'], by: 'student' }],
      repertoire: [{ id: 'r1', color: 'White', name: 'Italian Game', firstMove: '1.e4' }], tournaments: [{ id: 'tr1', name: 'Haifa Open', start: addDays(t, 9), end: addDays(t, 11) }, { id: 'tr0', name: 'Rapid Cup', start: addDays(t, -14), result: '4/6', expected: '3/6', rounds: 6 }],
      payments: [{ id: 'p1', date: addDays(t, -6), amount: 100, method: 'Bit' }], books: [{ id: 'bk1', title: 'Silman', status: 'Reading', pages: 500, page: 100 }],
      fitness: [{ id: 'f1', date: addDays(t, -2), activity: 'Running', minutes: 25 }], fitnessGoal: 2, requests: [{ id: 'rq1', kind: 'lesson', by: 'student', date: addDays(t, 5), time: '16:00', duration: 60, format: 'In person', status: 'pending', at: t }] }),
    'data/users/coach/st-b': stu('st-b', 'Yoni Cohen', { fullHe: 'יוני כהן', gender: 'm' }),
    'data/users/coach/as-1': { id: 'as-1', studentId: 'st-a', title: '30 puzzles on pins', type: 'Tactics', status: 'Assigned', due: addDays(t, 3), assigned: t, games: [] },
    'data/users/coach/gm-1': { id: 'gm-1', studentId: 'st-a', date: addDays(t, -9), opponent: 'Kasparovich', color: 'White', result: '1-0', event: 'Club Cup', pgn: '1. e4 e5 2. Nf3 Nc6 *' },
    'portal/u-a': { code: 'AAA234', linked: true, role: 'student', coach: 'coach', linkedAt: t, lang: 'he' }, 'portal/u-par': { code: 'FAM234', linked: true, role: 'parent', coach: 'coach', linkedAt: t, lang: 'he' },
    'data/users/tom/settings': { coachName: 'Tom Levi', lang: 'he' },
    'data/users/tom/st-me': stu('st-me', 'Tom Levi', { self: true, setup: 'self', rate: 0, worklog: [{ id: 'x1', date: addDays(t, -5), what: 'Tactics', minutes: 30, by: 'student' }], tournaments: [{ id: 'tt', name: 'Haifa Open', start: addDays(t, 3) }],
      books: [{ id: 'bk1', title: 'Silman', status: 'Reading', pages: 500, page: 100 }] }),
    'data/users/tom/as-1': { id: 'as-1', studentId: 'st-me', title: '30 puzzles on pins', type: 'Tactics', status: 'Assigned', due: addDays(t, 3), assigned: t, games: [], by: 'self' } },
    ls: { 'rankup-lang': 'he' } });
  const c0 = await T.open('coach'); await c0.waitForTimeout(4000); // writes the student's and parent's boards
  const misses = new Map(), add = (where, s) => { const l = leftover(s); if (l.length) { const k = s.slice(0, 140); if (!misses.has(k)) misses.set(k, where + ' → ' + l.join(' ')); } };
  let rtl = true, opened = 0;
  for (const [who, pages] of [['coach', PAGES.coach], ['u-a', PAGES.student('st-a')], ['u-par', PAGES.student('st-a')], ['tom', PAGES.student('st-me')]]) {
    const p = who === 'coach' ? c0 : await T.open(who); await p.waitForTimeout(3500);
    for (const h of pages) {
      await p.goto(URL + h); await p.waitForTimeout(500);
      if (!(await p.evaluate(() => document.documentElement.dir === 'rtl' && document.documentElement.lang === 'he'))) rtl = false;
      (await p.evaluate(SCAN)).forEach(s => add(who + ' ' + h, s));
      // the windows the page's buttons open
      const btns = await p.$$eval('#view button[data-a]', bs => bs.filter(b => b.offsetParent && !b.disabled).map(b => [b.dataset.a, b.dataset.id || '']));
      const seen = new Set();
      for (const [a, id] of btns) { if (!SAFE.test(a) || seen.has(a)) continue; seen.add(a);
        const sel = '#view button[data-a="' + a + '"]' + (id ? '[data-id="' + id + '"]' : '');
        await p.click(sel, { timeout: 2000 }).catch(() => {}); await p.waitForTimeout(350);
        if (await p.evaluate(() => document.querySelector('#modal').open)) { opened++; (await p.evaluate(SCAN)).forEach(s => add(who + ' ' + h + ' [' + a + ']', s));
          await p.evaluate(() => document.querySelector('#modal').close()); await p.waitForTimeout(150); }
        if (p.url().split('#')[1] !== h.slice(1)) { await p.goto(URL + h); await p.waitForTimeout(400); } }
    }
    if (who !== 'coach') await p.close();
  }
  check(rtl, 'every page is in Hebrew, right to left');
  check(opened > 30, 'windows opened from the pages’ buttons: ' + opened);
  const list = [...misses.entries()].map(([s, w]) => w + '  «' + s + '»');
  check(!list.length, 'no English left on screen in Hebrew (' + list.length + ' found)' + (list.length ? ':\n   ' + list.join('\n   ') : ''));
  await c0.screenshot({ path: out('hebrew'), fullPage: true });
  await T.finish();
})();

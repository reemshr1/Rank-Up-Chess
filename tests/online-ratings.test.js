// Online ratings in the app (the hourly job writes them; see lichess-fn.test.js): a player with no FIDE or ICF rating
// sees their latest online rating on Home's rating tile; Progress says where the ratings come from and shows each
// online list in the rating history; Add rating offers the online lists; in Hebrew too. A student with a FIDE rating
// keeps it on Home.
const { URL, t, addDays, stu, check, out, start } = require('./lib.js');
const R = (source, value, d) => ({ id: 'r-' + source.replace(/\W/g, '') + d, source, value, date: addDays(t, d) });
(async () => {
  const T = await start({ viewport: { width: 390, height: 844 } });
  await T.seed({ coach: 'coach', coaches: ['tom'], players: ['tom'], docs: {
    'data/users/coach/settings': { coachName: 'Raem', lang: 'en' },
    'data/users/coach/st-a': stu('st-a', 'Maya Cohen', { rating: '1540', ratingType: 'FIDE', ratings: [R('FIDE', 1540, -30), R('Lichess Rapid', 1700, -1)], portal: { uid: 'u-a', linkedAt: t } }),
    'portal/u-a': { code: 'A1', linked: true, role: 'student', coach: 'coach', linkedAt: t },
    'data/users/tom/settings': { coachName: 'Tom', lang: 'en' },
    'data/users/tom/st-me': stu('st-me', 'Tom Levi', { self: true, setup: 'self', rate: 0, usernames: { 'lichess.org': 'tomlevi', 'chess.com': 'tomcc' },
      ratings: [R('Lichess Rapid', 1610, -40), R('Lichess Rapid', 1650, -1), R('Chess.com Blitz', 1410, -2)] }) } });
  const p = await T.open('tom', '#/home'); await p.waitForTimeout(3500);
  const tile = async pg => (await pg.$$eval('#view .stats .stat', xs => xs.map(x => x.textContent.replace(/\s+/g, ' ').trim()))).find(x => /rating|דירוג|Lichess/i.test(x)) || '';
  check(/1650\s*Lichess Rapid rating/.test(await tile(p)), 'no FIDE or ICF rating: Home shows his latest online rating (1650 Lichess Rapid): ' + await tile(p));
  await p.goto(URL + '#/progress'); await p.waitForTimeout(800);
  let v = await T.text(p);
  check(v.includes('Lichess and Chess.com ratings are added every morning from your usernames.'), 'Progress says where they come from');
  const lists = await p.$$eval('.seg[aria-label="Rating list"] button, [data-a=src]', bs => bs.map(b => b.textContent.trim()));
  check(lists.includes('Lichess Rapid') && lists.includes('Chess.com Blitz'), 'the rating history has a list for each: ' + lists.join(', '));
  await p.click('[data-a=addRt]'); await p.waitForSelector('#modal[open] #f_source');
  const opts = await p.$$eval('#modal[open] #f_source option', os => os.map(o => o.value));
  check(['Lichess Rapid', 'Lichess Blitz', 'Lichess Classical', 'Chess.com Rapid', 'Chess.com Blitz'].every(x => opts.includes(x)), 'Add rating offers the online lists');
  await p.keyboard.press('Escape');
  // Hebrew
  await p.evaluate(() => { const k = 'fdb:data/users/tom/settings', x = JSON.parse(localStorage.getItem(k)); x.lang = 'he'; localStorage.setItem(k, JSON.stringify(x)); });
  await p.reload(); await p.waitForTimeout(3000); v = await T.text(p);
  check(v.includes('דירוגי Lichess ו־Chess.com מתעדכנים כל בוקר משמות המשתמש.'), 'in Hebrew: דירוגי Lichess ו־Chess.com מתעדכנים כל בוקר');
  await p.goto(URL + '#/home'); await p.waitForTimeout(800);
  check(/Lichess רפיד/.test(await tile(p)), 'and the tile says Lichess רפיד: ' + await tile(p));
  await p.close();
  // a student with a FIDE rating keeps it on Home
  const c = await T.open('coach'); await c.waitForTimeout(3000);
  const m = await T.open('u-a', '#/home'); await m.waitForTimeout(3500);
  check(/1540\s*FIDE rating/.test(await tile(m)), 'a student with a FIDE rating keeps it on Home (the online one is in the history): ' + await tile(m));
  await m.screenshot({ path: out('online-ratings'), fullPage: true });
  await T.finish();
})();

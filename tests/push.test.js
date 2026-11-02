// Phone alerts: the coach turns them on in Settings and sends a test alert; a lesson the coach moves becomes an alert
// to the student's phone; the student turns alerts on (and off) from the 🔔 window; blocked, not allowed, a browser
// that can't sign up (with the Chrome tip on Android) and a function not set up each say so, and the reason stays on
// screen; on iPhone it asks for the Home Screen app; signing out turns this device's alerts off.
const { URL, t, addDays, stu, les, check, out, start } = require('./lib.js');
// a stand-in for the browser's alerts: o = {dev, perm, ask, ua, failSub}; each device (dev) keeps its permission and subscription
const device = o => `(() => { const o = ${JSON.stringify(o)}, k = 'tdev:' + o.dev + ':', ss = { getItem: n => localStorage.getItem(k + n), setItem: (n, v) => localStorage.setItem(k + n, v), removeItem: n => localStorage.removeItem(k + n) };
  if (o.ua) Object.defineProperty(navigator, 'userAgent', { get: () => o.ua });
  if (!ss.getItem('tperm')) ss.setItem('tperm', o.perm || 'default');
  const sub = () => ss.getItem('tsub') && { endpoint: ss.getItem('tsub'), toJSON: () => ({ endpoint: ss.getItem('tsub'), keys: { p256dh: 'p', auth: 'a' } }), unsubscribe: async () => { ss.removeItem('tsub'); return true; } };
  const pm = { getSubscription: async () => sub(), subscribe: async opt => { if (o.failSub) { const e = new Error('Registration failed - push service error'); e.name = 'AbortError'; throw e; }
    if (!(opt.applicationServerKey instanceof Uint8Array)) throw new Error('no key'); ss.setItem('tsub', 'https://push.example/' + Math.random().toString(36).slice(2)); return sub(); } };
  const reg = { pushManager: pm };
  Object.defineProperty(navigator, 'serviceWorker', { get: () => ({ register: async () => reg, ready: Promise.resolve(reg), getRegistration: async () => reg }) });
  window.PushManager = function(){};
  window.Notification = function(){}; Object.defineProperty(Notification, 'permission', { get: () => ss.getItem('tperm') });
  Notification.requestPermission = async () => { if (ss.getItem('tperm') === 'default') ss.setItem('tperm', o.ask || 'granted'); return ss.getItem('tperm'); };
})();`;
const calls = (p, action) => p.evaluate(a => window.__fn.filter(f => f.name === 'push' && (!a || f.body.action === a)).map(f => f.body), action);
const box = p => p.textContent('#pushBox');
(async () => {
  const T = await start();
  await T.seed({ coach: 'coach', docs: {
    'data/users/coach/settings': { coachName: 'Raem', currency: '₪', lang: 'en', weekStart: 0 },
    'data/users/coach/st-a': stu('st-a', 'Maya Cohen', { portal: { uid: 'u-a', linkedAt: t }, sessions: [les('l1', addDays(t, 3), '18:00', 'Rook endings')] }),
    'portal/u-a': { code: 'A1', linked: true, role: 'student', coach: 'coach', linkedAt: t },
    // her board as the coach's app last wrote it: the lesson was at 17:00
    'portal/u-a/view/student': { sessions: [les('l1', addDays(t, 3), '17:00', 'Rook endings')], notices: [], requests: [], offers: [] } },
    ls: { 'ffn:push': { key: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U', sent: 1 } } });
  // the coach: Settings → Phone alerts
  const c = await T.open('coach', '#/settings', URL, device({ dev: 'coach' }));
  await c.waitForTimeout(3500);
  check((await box(c)).includes('Phone alerts') && (await box(c)).includes('Turn them on here to test them'), 'Settings has the Phone alerts box, off');
  await c.click('[data-push=on]'); await c.waitForTimeout(800);
  check((await c.textContent('#toast')).includes('Phone alerts are on') && (await box(c)).includes('On for this device'), 'turned on: “On for this device”');
  const subs = await calls(c, 'subscribe');
  check((await calls(c, 'key')).length === 1 && subs.length === 1 && /^https:\/\/push\.example\//.test(subs[0].sub.endpoint), 'it asked the function for its key, then saved this device’s subscription');
  await c.click('[data-push=test]'); await c.waitForTimeout(600);
  const test = (await calls(c, 'send')).find(m => m.messages[0].tag === 'test');
  check(test && test.messages[0].to === 'coach' && /Test alert/.test(test.messages[0].body) && (await c.textContent('#toast')).includes('Test alert sent'), 'Send a test alert: one alert to the coach’s own account, “Test alert sent”');
  // the coach's app wrote Maya's board on start: her lesson moved from 17:00 to 18:00 → an alert to her
  const moved = await T.eventually(async () => (await calls(c, 'send')).map(x => x.messages).flat().find(m => m.to === 'u-a'));
  check(moved && /Lesson moved to .*18:00 \(was .*17:00\)/.test(moved.body) && moved.title === 'Raem' && moved.url === './#/schedule', 'the moved lesson becomes an alert to Maya’s phone, titled with the coach’s name: ' + (moved && moved.body));
  // a notification from the coach is an alert too
  await c.evaluate(() => { window.__fn.length = 0; });
  await c.goto(URL + '#/dashboard'); await c.waitForTimeout(600); await c.click('#dNote'); await c.waitForTimeout(400);
  if (await c.$('#ntNew')) { await c.click('#ntNew'); await c.waitForTimeout(300); }
  await c.waitForSelector('#modal[open] #nt'); await c.fill('#nt', 'No lessons on Friday');
  await c.check('[data-sid="st-a"][data-who="student"]'); await c.click('#modal[open] button[type=submit]'); await c.waitForTimeout(800);
  const nt = await T.eventually(async () => (await calls(c, 'send')).map(x => x.messages).flat().find(m => m.to === 'u-a' && /No lessons on Friday/.test(m.body)));
  check(!!nt, 'a notification to students goes to Maya’s phone as an alert');
  // the student, from the 🔔 window
  const m = await T.open('u-a', '#/home', URL, device({ dev: 'maya' }));
  await m.waitForTimeout(3500);
  await m.click('[data-a=notes]'); await m.waitForSelector('#modal[open] #pushBox:not([hidden])');
  check((await box(m)).includes('new notifications, lesson changes and practice reminders'), 'the 🔔 window offers alerts, with the student’s wording');
  await m.click('[data-push=on]'); await m.waitForTimeout(800);
  check((await box(m)).includes('On for this device') && (await calls(m, 'subscribe')).length === 1, 'Maya turns them on');
  await m.reload(); await m.waitForTimeout(3000); await m.click('[data-a=notes]'); await m.waitForSelector('#modal[open] #pushBox:not([hidden])');
  check((await box(m)).includes('On for this device'), 'still on after the app reopens');
  await m.click('[data-push=off]'); await m.waitForTimeout(600);
  const un = await calls(m, 'unsubscribe');
  check(un.length === 1 && un[0].endpoint && (await box(m)).includes('Turn on') && (await m.textContent('#toast')).includes('Phone alerts are off'), 'and off: the subscription is removed from the function too');
  // blocked in the browser's settings
  const b = await T.open('u-a', '#/home', URL, device({ dev: 'blocked', perm: 'denied' })); await b.waitForTimeout(3000);
  await b.click('[data-a=notes]'); await b.waitForSelector('#modal[open] #pushBox:not([hidden])');
  check((await box(b)).includes('Alerts are blocked for Rank Up in this browser') && !(await b.$('[data-push=on]')), 'blocked: it says how to allow them, with no button');
  await b.close();
  // not allowed (the question dismissed)
  const n = await T.open('u-a', '#/home', URL, device({ dev: 'dismissed', ask: 'default' })); await n.waitForTimeout(3000);
  await n.click('[data-a=notes]'); await n.waitForSelector('#modal[open] #pushBox:not([hidden])');
  await n.click('[data-push=on]'); await n.waitForTimeout(800);
  check((await box(n)).includes('Alerts weren’t allowed. Tap “Try again” and choose Allow.') && (await n.textContent('[data-push=on]')).includes('Try again'), 'not allowed: the reason stays, and the button says Try again');
  check(!(await box(n)).includes('alerts work best in Chrome'), 'no Chrome tip outside Android');
  await n.close();
  // Edge on Android can't sign up: the reason, the Chrome tip and the technical line
  const edge = 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36 EdgA/124.0.0.0';
  const e = await T.open('u-a', '#/home', URL, device({ dev: 'edge', ua: edge, failSub: true })); await e.waitForTimeout(3000);
  await e.click('[data-a=notes]'); await e.waitForSelector('#modal[open] #pushBox:not([hidden])');
  await e.click('[data-push=on]'); await e.waitForTimeout(800);
  let v = await box(e);
  check(v.includes('This browser couldn’t sign up for alerts.') && v.includes('On Android, alerts work best in Chrome') && /Edge · Android · step: subscribe · AbortError: Registration failed/.test(v), 'Edge on Android: the reason, the Chrome tip, and “Edge · Android · step: subscribe · AbortError…”');
  await e.click('#alClose, #ntClose'); await e.waitForTimeout(300); await e.click('[data-a=notes]'); await e.waitForSelector('#modal[open] #pushBox:not([hidden])');
  check((await box(e)).includes('This browser couldn’t sign up'), 'the reason is still there when the window opens again');
  await e.close();
  // iPhone in Safari, not the Home Screen app
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
  const i = await T.open('u-a', '#/home', URL, device({ dev: 'iphone', ua: iphone })); await i.waitForTimeout(3000);
  await i.click('[data-a=notes]'); await i.waitForSelector('#modal[open] #pushBox:not([hidden])');
  check((await box(i)).includes('Add to Home Screen'), 'iPhone: alerts only from the Home Screen app');
  await i.close();
  // the function isn't set up: the coach is told it's Supabase
  await c.evaluate(() => localStorage.removeItem('ffn:push'));
  const c2 = await T.open('coach', '#/settings', URL, device({ dev: 'coach2' })); await c2.waitForTimeout(3000);
  await c2.click('[data-push=on]'); await c2.waitForTimeout(800);
  check((await box(c2)).includes('Phone alerts aren’t set up in Supabase yet') && /step: key/.test(await box(c2)), 'no function: “Phone alerts aren’t set up in Supabase yet”, at the key step: ' + (await box(c2)));
  await c2.close();
  await c.evaluate(k => localStorage.setItem('ffn:push', k), JSON.stringify({ key: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U', sent: 1 }));
  // signing out turns this device's alerts off
  await c.goto(URL + '#/settings'); await c.waitForTimeout(1500);
  check((await box(c)).includes('On for this device'), 'the coach’s alerts are still on');
  check(!!(await c.evaluate(() => localStorage.getItem('tdev:coach:tsub'))), 'this device has a subscription');
  await c.click('#view [data-signout]'); await c.waitForSelector('#modal[open] button[type=submit]'); await c.click('#modal[open] button[type=submit]');
  await c.waitForTimeout(1500);
  const off = await c.evaluate(() => localStorage.getItem('tdev:coach:tsub')).catch(() => 'x');
  check(off === null, 'signing out removes this device’s subscription ' + JSON.stringify(off));
  await m.screenshot({ path: out('push'), fullPage: true });
  await T.finish();
})();

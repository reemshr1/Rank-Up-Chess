// Rank Up — adds Lichess puzzle practice to students' and players' practice logs every hour, even when nobody opens
// the app, and each morning their Lichess and Chess.com ratings (from the usernames in Useful links). Called by the
// database's scheduled job (supabase/lichess-sync.sql) with a secret only the database and this function can read.
// The app does the same for puzzles when it's open; both make the same entries (same ids), so nothing is added twice.
// Ratings (Lichess Rapid, Blitz, Classical; Chess.com Rapid, Blitz) are written into the record itself, one entry per
// list a month, as the app's addRating does; at 06:xx Israel time, or at once for a username with no rating yet.
// Also each morning: when they play best (online games of the last 3 months, by hour), as totals only (onlineStats).
//
// For every active record with a Lichess username, on a coach's board or a player's board:
//  - linked to an account (a coach's student, a child with their own sign-in): the entries go to that account's
//    outbox (portal/<link>/inbox), as if their own app had sent them. The coach's app takes them in; the student sees
//    them at once.
//  - not linked (a player on their own board, or a student without the app): added straight to the record.
// Rules, as in the app (liEntries / liMerge in index.html): the last 7 days (Israel time); a day already logged by
// hand stays as it is; an entry someone deleted (liGone on the record) is never added back; an entry is brought up
// to date only while nobody has edited it.
//
// Set up: Supabase → Edge Functions → new function "lichess", paste this file, Deploy, switch Verify JWT off
// (the call carries the secret instead); then run supabase/lichess-sync.sql once in the SQL Editor.

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const URL_ = Deno.env.get("SUPABASE_URL")!, KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LICHESS = Deno.env.get("LICHESS_URL") || "https://lichess.org"; // another address only for tests
const PAUSE = +(Deno.env.get("LICHESS_PAUSE_MS") || 1000); // between requests, to be gentle with Lichess
const H = { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" };
const rest = (path: string, init: RequestInit = {}) => fetch(URL_ + "/rest/v1/" + path, { ...init, headers: { ...H, ...(init.headers || {}) } });
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const TZ = "Asia/Jerusalem";
const dayOf = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
const addDays = (d: string, n: number) => new Date(Date.parse(d + "T12:00:00Z") + n * 86400000).toISOString().slice(0, 10);

// ---- the same as liEntries and liMerge in the app ----
const LI_KINDS: Record<string, string> = { puzzles: "Puzzles (rated)", storm: "Puzzle Storm", racer: "Puzzle Racer", streak: "Puzzle Streak" };
export function liEntries(day: string, a: any) {
  const out: any[] = [], base = { what: "Tactics", site: "Lichess", date: day, by: "student", auto: "lichess", note: "", count: "", eg: [] };
  const p = a.puzzles && a.puzzles.score;
  if (p) { const n = (+p.win || 0) + (+p.loss || 0) + (+p.draw || 0); if (n > 0) out.push({ ...base, id: "li-" + day + "-puzzles", exercise: LI_KINDS.puzzles,
    attempted: n, correct: +p.win || 0, prating: p.rp && p.rp.after ? +p.rp.after : "", minutes: Math.max(5, n), scores: [], score: "" }); }
  ([["storm", 3], ["racer", 2], ["streak", 5]] as [string, number][]).forEach(([k, per]) => { const r = a[k]; if (!r || !(+r.runs > 0)) return;
    out.push({ ...base, id: "li-" + day + "-" + k, exercise: LI_KINDS[k], attempted: "", correct: "", prating: "",
      scores: [+r.score || 0], score: +r.score || 0, runs: +r.runs, minutes: per * (+r.runs), note: r.runs > 1 ? r.runs + " runs" : "" }); });
  out.forEach(w => { w.autoMin = w.minutes; w.autoN = w.attempted !== "" ? w.attempted : w.runs; });
  return out;
}
// What to add or bring up to date in a log, from a Lichess feed: [entries], each a whole entry to save.
export function liChanges(worklog: any[], gone: string[], feed: any, today: string) {
  const from = addDays(today, -6), skip = new Set(gone), out: any[] = [], log = worklog.slice();
  (Array.isArray(feed) ? feed : []).forEach((a: any) => {
    const st = a && a.interval && a.interval.start; if (!st) return;
    const day = dayOf(+st + 12 * 3600000); if (day < from || day > today) return;
    liEntries(day, a).forEach(w => {
      if (skip.has(w.id)) return;
      const have = log.find(x => x && x.id === w.id);
      if (!have) {
        if (log.some(x => x && x.date === day && x.what === "Tactics" && x.site === "Lichess" && x.exercise === w.exercise && !x.auto)) return; // logged by hand
        out.push(w); log.push(w); return; }
      const untouched = +have.minutes === +have.autoMin && String(have.attempted !== "" ? have.attempted : have.runs) === String(have.autoN);
      if (untouched && (+w.autoN !== +have.autoN || +w.score !== +have.score || String(w.prating) !== String(have.prating))) out.push({ ...have, ...w });
    });
  });
  return out;
}
// ---- end of the app's rules ----

async function sha256hex(t: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
}
// One Lichess user's recent activity (null if Lichess couldn't be read); waits and tries once more if Lichess is busy.
async function activity(user: string): Promise<any[] | null> {
  for (let i = 0; i < 2; i++) {
    const r = await fetch(LICHESS + "/api/user/" + encodeURIComponent(user) + "/activity", { headers: { Accept: "application/json", "User-Agent": "RankUp (chess coaching app; hourly puzzle sync)" } }).catch(() => null);
    if (r && r.status === 429) { await wait(+(Deno.env.get("LICHESS_BUSY_MS") || 60000)); continue; }
    if (!r || !r.ok) return null;
    return await r.json().catch(() => null);
  }
  return null;
}
const docsOf = async (col: string) => { const r = await rest("docs?select=id,data,updated_at&col=eq." + encodeURIComponent(col)); return r.ok ? await r.json() as any[] : []; };

// ---- online ratings: Lichess and Chess.com, from their public data (both allow it), once a day ----
const CHESSCOM = Deno.env.get("CHESSCOM_URL") || "https://api.chess.com"; // another address only for tests
const UA = { Accept: "application/json", "User-Agent": "RankUp (chess coaching app; https://reemshr1.github.io/Rank-Up-Chess/)" };
const hourOf = (now: Date) => +new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" }).format(now);
// A site's public data (null if it couldn't be read); waits and tries once more if the site is busy.
async function getJSON(url: string): Promise<any> {
  for (let i = 0; i < 2; i++) {
    const r = await fetch(url, { headers: UA }).catch(() => null);
    if (r && r.status === 429) { await wait(+(Deno.env.get("LICHESS_BUSY_MS") || 60000)); continue; }
    if (!r || !r.ok) return null;
    return await r.json().catch(() => null);
  }
  return null;
}
const LI_LISTS: [string, string][] = [["rapid", "Lichess Rapid"], ["blitz", "Lichess Blitz"], ["classical", "Lichess Classical"]];
const CC_LISTS: [string, string][] = [["chess_rapid", "Chess.com Rapid"], ["chess_blitz", "Chess.com Blitz"]];
// The ratings a site's data gives, as {list: rating}: only lists played (no provisional Lichess rating, no 0 games).
export function onlineRatings(li: any, cc: any) {
  const out: Record<string, number> = {};
  if (li && li.perfs) LI_LISTS.forEach(([k, name]) => { const p = li.perfs[k]; if (p && +p.games > 0 && !p.prov && +p.rating > 0) out[name] = Math.round(+p.rating); });
  if (cc) CC_LISTS.forEach(([k, name]) => { const p = cc[k]; const r = p && p.last && +p.last.rating; if (r > 0) out[name] = Math.round(r); });
  return out;
}
// The record's ratings with these added, as the app's addRating does (one entry per list a month); null if nothing changes.
export function withRatings(ratings: any[], got: Record<string, number>, today: string) {
  const L = (ratings || []).slice(); let n = 0;
  Object.entries(got).forEach(([source, value]) => {
    const i = L.findIndex(r => r && r.source === source && String(r.date || "").slice(0, 7) === today.slice(0, 7));
    if (i >= 0) { if (+L[i].value !== value) { L[i] = { ...L[i], value, date: today }; n++; } }
    else { L.push({ id: "rt-" + crypto.randomUUID().slice(0, 12), date: today, value, source }); n++; }
  });
  return n ? { list: L, n } : null;
}

// ---- when they play best: online games of the last 3 months, by hour of the day (Israel time). Only totals are kept,
// never the games: {days, n, hours: {all|rapid|blitz|bullet: {"9": [games, points]}}} on the record as onlineStats.
const STATS_DAYS = 90, KINDS = ["bullet", "blitz", "rapid"];
const hourIL = (ms: number) => +new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" }).format(new Date(ms));
// Lichess: one game a line; the start (createdAt), the speed, and who won. Aborted or unfinished games don't count.
async function liGames(user: string, since: number): Promise<any[] | null> {
  const r = await fetch(LICHESS + "/api/games/user/" + encodeURIComponent(user) + "?since=" + since + "&max=300&moves=false&perfType=bullet,blitz,rapid,classical",
    { headers: { ...UA, Accept: "application/x-ndjson" } }).catch(() => null);
  if (!r || !r.ok) return null;
  const me = user.toLowerCase(), out: any[] = [];
  (await r.text()).split("\n").forEach(line => { let g: any; try { g = JSON.parse(line); } catch (_) { return; }
    if (!g || g.variant !== "standard" || ["created", "started", "aborted", "noStart", "unknownFinish"].includes(g.status)) return;
    const side = ((g.players?.white?.user?.id || g.players?.white?.user?.name || "") + "").toLowerCase() === me ? "white" : ((g.players?.black?.user?.id || g.players?.black?.user?.name || "") + "").toLowerCase() === me ? "black" : "";
    if (!side || !g.createdAt) return;
    out.push({ t: +g.createdAt, kind: g.speed === "classical" ? "rapid" : g.speed, pts: !g.winner ? 0.5 : g.winner === side ? 1 : 0 }); });
  return out;
}
// Chess.com: the monthly archives of the last 3 months; the start from the PGN (UTCDate, UTCTime), else the end.
const CC_DRAW = ["agreed", "repetition", "stalemate", "insufficient", "50move", "timevsinsufficient"];
async function ccGames(user: string, since: number): Promise<any[] | null> {
  const a = await getJSON(CHESSCOM + "/pub/player/" + encodeURIComponent(user.toLowerCase()) + "/games/archives"); if (!a || !Array.isArray(a.archives)) return null;
  const from = new Date(since).toISOString().slice(0, 7).replace("-", "/"), me = user.toLowerCase(), out: any[] = [];
  for (const url of a.archives.filter((u: string) => typeof u === "string" && u.slice(-7) >= from).slice(-4)) {
    const m = await getJSON(url.replace(/^https:\/\/api\.chess\.com/, CHESSCOM)); if (!m || !Array.isArray(m.games)) continue;
    m.games.forEach((g: any) => {
      if (!g || g.rules !== "chess" || !KINDS.includes(g.time_class)) return;
      const side = (g.white?.username || "").toLowerCase() === me ? g.white : (g.black?.username || "").toLowerCase() === me ? g.black : null; if (!side) return;
      const d = /\[UTCDate "(\d{4})\.(\d\d)\.(\d\d)"\]/.exec(g.pgn || ""), tm = /\[UTCTime "(\d\d):(\d\d):(\d\d)"\]/.exec(g.pgn || "");
      const t = d && tm ? Date.UTC(+d[1], +d[2] - 1, +d[3], +tm[1], +tm[2], +tm[3]) : (+g.end_time || 0) * 1000;
      if (!t || t < since) return;
      out.push({ t, kind: g.time_class, pts: side.result === "win" ? 1 : CC_DRAW.includes(side.result) ? 0.5 : 0 }); });
  }
  return out;
}
// The totals by hour (and by kind) for these games (with none: n 0, so it isn't asked again until the next morning).
export function timeStats(games: any[]) {
  if (!games.length) return { days: STATS_DAYS, n: 0, hours: {} };
  const hours: any = { all: {} }; KINDS.forEach(k => { hours[k] = {}; });
  games.forEach(g => { const h = String(hourIL(g.t)); [hours.all, hours[g.kind]].forEach(b => { if (!b) return; const c = b[h] || (b[h] = [0, 0]); c[0]++; c[1] += g.pts; }); });
  KINDS.forEach(k => { if (!Object.keys(hours[k]).length) delete hours[k]; });
  return { days: STATS_DAYS, n: games.length, hours };
}

async function run(now: Date) {
  const today = dayOf(now.getTime()), morning = hourOf(now) === 6;
  const cr = await rest("coaches?select=user_id,kind&kind=in.(coach,player)");
  const boards: any[] = cr.ok ? await cr.json() : [];
  const feeds = new Map<string, any[] | null>(), sites = new Map<string, any>(); let users = 0, added = 0, records = 0, rated = 0, stats = 0; const errors: string[] = [];
  const once = async (map: Map<string, any>, key: string, get: () => Promise<any>) => { if (!map.has(key)) { if (feeds.size + sites.size) await wait(PAUSE); map.set(key, await get()); } return map.get(key); };
  for (const { user_id: owner } of boards) {
    const col = "data/users/" + owner, docs = await docsOf(col);
    for (const d of docs.filter(x => /^st-/.test(x.id))) {
      const s = d.data || {}, un = s.usernames || {};
      const user = String(un["lichess.org"] || "").trim(), ccUser = String(un["chess.com"] || "").trim();
      if ((!user && !ccUser) || s.active === false) continue;
      const link = s.portal && s.portal.uid ? String(s.portal.uid) : "";
      let wl: any[] | null = null, puzzles = 0;
      // 1. Lichess puzzles
      if (user) {
        records++;
        const key = user.toLowerCase(); if (!feeds.has(key)) users++;
        const feed = await once(feeds, key, () => activity(user));
        if (!feed) { if (errors.length < 5) errors.push("Couldn't read Lichess for " + user); }
        else {
          // the whole log: the main document and its yearly log documents
          const logDocs = docs.filter(x => /^lg-/.test(x.id) && x.data && x.data.sid === s.id);
          let log = (s.worklog || []).concat(...logDocs.map(x => x.data.worklog || []));
          if (link) {
            // a linked account: to its outbox; what's waiting there counts too, so nothing is sent twice
            const lr = await rest("docs?select=data&col=eq.portal&id=eq." + encodeURIComponent(link));
            const me = lr.ok ? ((await lr.json())[0] || {}).data || {} : null;
            if (me && me.coach === owner && me.share !== false) { // still this board's link, and shared with this coach
              const inbox = await docsOf("portal/" + link + "/inbox");
              const waiting = inbox.map(x => x.data).filter(o => o && o.type === "worklog.upsert" && o.item && o.item.id);
              const deleted = new Set(inbox.map(x => x.data).filter(o => o && o.type === "worklog.delete").map(o => o.id));
              log = log.filter((x: any) => !deleted.has(x.id)).map((x: any) => { const o = waiting.filter(o => o.item.id === x.id).pop(); return o ? { ...x, ...o.item } : x; })
                .concat(waiting.map(o => o.item).filter(it => !log.some((x: any) => x.id === it.id)));
              for (const w of liChanges(log, [...(s.liGone || []), ...deleted], feed, today)) {
                const id = "op-" + w.id + "-" + w.autoN + "-" + (w.score === "" ? "" : w.score); // the same change twice is one document
                const r = await rest("docs?on_conflict=col,id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" },
                  body: JSON.stringify({ col: "portal/" + link + "/inbox", id, data: { type: "worklog.upsert", item: w, at: now.toISOString(), auto: "lichess" }, updated_at: now.toISOString() }) });
                if (r.ok) added++; else if (errors.length < 5) errors.push("Couldn't send to " + link + " (" + r.status + ")");
              }
            }
          } else {
            // not linked: straight into the record (below)
            const changes = liChanges(log, s.liGone || [], feed, today);
            if (changes.length) { wl = (s.worklog || []).slice(); changes.forEach(w => { const i = wl!.findIndex((x: any) => x && x.id === w.id); if (i >= 0) wl![i] = w; else wl!.push(w); }); puzzles = changes.length; }
          }
        }
      }
      // 2. online ratings: each morning, or at once for a username with no rating from that site yet
      const has = (lists: [string, string][]) => (s.ratings || []).some((r: any) => r && lists.some(([, n]) => n === r.source));
      let liData = null, ccData = null;
      if (user && (morning || !has(LI_LISTS))) liData = await once(sites, "li:" + user.toLowerCase(), () => getJSON(LICHESS + "/api/user/" + encodeURIComponent(user)));
      if (ccUser && (morning || !has(CC_LISTS))) { ccData = await once(sites, "cc:" + ccUser.toLowerCase(), () => getJSON(CHESSCOM + "/pub/player/" + encodeURIComponent(ccUser.toLowerCase()) + "/stats"));
        if (!ccData && errors.length < 5) errors.push("Couldn't read Chess.com for " + ccUser); }
      const rt = withRatings(s.ratings, onlineRatings(liData, ccData), today);
      // 3. when they play best: each morning, or at once when there are no figures yet
      let st: any = undefined;
      if (morning || !s.onlineStats) {
        const since = now.getTime() - STATS_DAYS * 86400000;
        const lg = user ? await once(sites, "lg:" + user.toLowerCase(), () => liGames(user, since)) : [];
        const cg = ccUser ? await once(sites, "cg:" + ccUser.toLowerCase(), () => ccGames(ccUser, since)) : [];
        if (lg !== null && cg !== null) { const v = timeStats([...(lg || []), ...(cg || [])]); if (JSON.stringify(v) !== JSON.stringify(s.onlineStats || null)) st = v; }
      }
      // 4. one write: puzzles (an unlinked record), ratings and the figures, only if nobody saved the record meanwhile (else the next hour tries again)
      if (!wl && !rt && st === undefined) continue;
      const prev = Date.parse(d.updated_at || ""), at = new Date(isNaN(prev) ? now.getTime() : Math.max(now.getTime(), prev + 1)).toISOString();
      const r = await rest("docs?col=eq." + encodeURIComponent(col) + "&id=eq." + encodeURIComponent(d.id) + "&updated_at=eq." + encodeURIComponent(d.updated_at),
        { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ data: { ...s, ...(wl ? { worklog: wl } : {}), ...(rt ? { ratings: rt.list } : {}), ...(st !== undefined ? { onlineStats: st } : {}) }, updated_at: at }) });
      const rows = r.ok ? await r.json() : [];
      if (rows.length) { added += puzzles; rated += rt ? rt.n : 0; if (st !== undefined) stats++; } else if (errors.length < 5) errors.push("Changed meanwhile, next hour: " + d.id);
    }
  }
  return { records, users, added, ratings: rated, stats, errors };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const sr = await rest("lichess_job?select=secret");
    const rows = sr.ok ? await sr.json() : [];
    if (!rows.length) return json({ error: "Run supabase/lichess-sync.sql first" }, 500);
    if (typeof body.secret !== "string" || body.secret !== await sha256hex(rows[0].secret)) return json({ error: "Not allowed" }, 403);
    return json(await run(typeof body.now === "string" ? new Date(body.now) : new Date()));
  } catch (e) {
    return json({ error: String(e && (e as Error).message || e) }, 500);
  }
});

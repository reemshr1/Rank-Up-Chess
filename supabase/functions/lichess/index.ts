// Rank Up — adds Lichess puzzle practice to students' and players' practice logs every hour, even when nobody opens
// the app. Called by the database's scheduled job (supabase/lichess-sync.sql) with a secret only the database and
// this function can read. The app does the same when it's open; both make the same entries (same ids), so nothing
// is ever added twice.
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

async function run(now: Date) {
  const today = dayOf(now.getTime());
  const cr = await rest("coaches?select=user_id,kind&kind=in.(coach,player)");
  const boards: any[] = cr.ok ? await cr.json() : [];
  const feeds = new Map<string, any[] | null>(); let users = 0, added = 0, records = 0; const errors: string[] = [];
  for (const { user_id: owner } of boards) {
    const col = "data/users/" + owner, docs = await docsOf(col);
    for (const d of docs.filter(x => /^st-/.test(x.id))) {
      const s = d.data || {}, user = String((s.usernames || {})["lichess.org"] || "").trim();
      if (!user || s.active === false) continue;
      records++;
      const key = user.toLowerCase();
      if (!feeds.has(key)) { if (feeds.size) await wait(PAUSE); users++; feeds.set(key, await activity(user)); }
      const feed = feeds.get(key); if (!feed) { if (errors.length < 5) errors.push("Couldn't read Lichess for " + user); continue; }
      const link = s.portal && s.portal.uid ? String(s.portal.uid) : "";
      // the whole log: the main document and its yearly log documents
      const logDocs = docs.filter(x => /^lg-/.test(x.id) && x.data && x.data.sid === s.id);
      let log = (s.worklog || []).concat(...logDocs.map(x => x.data.worklog || []));
      if (link) {
        // a linked account: what's waiting in its outbox counts too, so nothing is sent twice
        const lr = await rest("docs?select=data&col=eq.portal&id=eq." + encodeURIComponent(link));
        const me = lr.ok ? ((await lr.json())[0] || {}).data || {} : null;
        if (!me || me.coach !== owner || me.share === false) continue; // not this board's link any more, or not shared with this coach
        const inbox = await docsOf("portal/" + link + "/inbox");
        const waiting = inbox.map(x => x.data).filter(o => o && o.type === "worklog.upsert" && o.item && o.item.id);
        const deleted = new Set(inbox.map(x => x.data).filter(o => o && o.type === "worklog.delete").map(o => o.id));
        log = log.filter((x: any) => !deleted.has(x.id)).map((x: any) => { const o = waiting.filter(o => o.item.id === x.id).pop(); return o ? { ...x, ...o.item } : x; })
          .concat(waiting.map(o => o.item).filter(it => !log.some((x: any) => x.id === it.id)));
        const changes = liChanges(log, [...(s.liGone || []), ...deleted], feed, today);
        for (const w of changes) {
          const id = "op-" + w.id + "-" + w.autoN + "-" + (w.score === "" ? "" : w.score); // the same change twice is one document
          const r = await rest("docs?on_conflict=col,id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" },
            body: JSON.stringify({ col: "portal/" + link + "/inbox", id, data: { type: "worklog.upsert", item: w, at: now.toISOString(), auto: "lichess" }, updated_at: now.toISOString() }) });
          if (r.ok) added++; else if (errors.length < 5) errors.push("Couldn't send to " + link + " (" + r.status + ")");
        }
      } else {
        // not linked: straight into the record, only if nobody saved it meanwhile (else the next hour tries again)
        const changes = liChanges(log, s.liGone || [], feed, today); if (!changes.length) continue;
        const wl = (s.worklog || []).slice();
        changes.forEach(w => { const i = wl.findIndex((x: any) => x && x.id === w.id); if (i >= 0) wl[i] = w; else wl.push(w); });
        const prev = Date.parse(d.updated_at || ""), at = new Date(isNaN(prev) ? now.getTime() : Math.max(now.getTime(), prev + 1)).toISOString();
        const r = await rest("docs?col=eq." + encodeURIComponent(col) + "&id=eq." + encodeURIComponent(d.id) + "&updated_at=eq." + encodeURIComponent(d.updated_at),
          { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ data: { ...s, worklog: wl }, updated_at: at }) });
        const rows = r.ok ? await r.json() : [];
        if (rows.length) added += changes.length; else if (errors.length < 5) errors.push("Changed meanwhile, next hour: " + d.id);
      }
    }
  }
  return { records, users, added, errors };
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

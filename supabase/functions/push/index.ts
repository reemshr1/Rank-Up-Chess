// Rank Up — phone alerts (Supabase Edge Function "push").
// Sends web push notifications to the phones and computers where a student, parent or the coach turned alerts on.
// The function makes its own signing keys the first time it runs and keeps them in public.push_keys;
// each device's push address is kept in public.push_subs. Both tables are closed to the app (no access rules),
// so only this function, with the service key Supabase gives it, can read them.
//
// Requests (POST, signed-in users only):
//   {action:"key"}                      → {key}  the public key a browser needs to turn alerts on
//   {action:"subscribe", sub}           → {ok}   remember this device for the signed-in account
//   {action:"unsubscribe", endpoint}    → {ok}   forget this device
//   {action:"send", messages:[{to, title, body, tag?, url?}]}   coaches only, to their own students and parents (or themselves)
//                                       → {sent, failed, devices, errors}  `to` is an account id, or one of its links
//                                         (<account id>.<key>, a student with more than one coach); errors: the first few
//   {action:"players", secret}          → {players, sent}  every hour, from the database's scheduled job (supabase/player-alerts.sql):
//                                         players without a coach get their own reminders, since no coach's app sends them.
//                                         `secret` is the SHA-256 of the private signing key, which only the database and this
//                                         function can read.
import webpush from "npm:web-push@3.6.7";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const URL_ = Deno.env.get("SUPABASE_URL")!, KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" };
const rest = (path: string, init: RequestInit = {}) => fetch(URL_ + "/rest/v1/" + path, { ...init, headers: { ...H, ...(init.headers || {}) } });
const short = (v: unknown, n: number) => String(v ?? "").slice(0, n);

// The account behind the request's sign-in token.
async function caller(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  if (!/^Bearer .+/.test(auth)) return null;
  const r = await fetch(URL_ + "/auth/v1/user", { headers: { apikey: KEY, Authorization: auth } });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id ? String(u.id) : null;
}
async function isCoach(uid: string) {
  const r = await rest("coaches?select=user_id&user_id=eq." + encodeURIComponent(uid));
  return r.ok && (await r.json()).length > 0;
}
// The accounts a coach may alert: their own devices, and their own students and parents.
async function mine(coach: string, ids: string[]) {
  if (!ids.length) return new Set<string>();
  const r = await rest("docs?select=id&col=eq.portal&data->>coach=eq." + encodeURIComponent(coach) + "&id=in.(" + ids.map(x => '"' + x + '"').join(",") + ")");
  const rows: any[] = r.ok ? await r.json() : [];
  return new Set<string>([coach, ...rows.map(x => String(x.id))]);
}
// The signing keys: made once, then reused, so devices that turned alerts on keep working.
async function keys() {
  const r = await rest("push_keys?select=public_key,private_key");
  if (!r.ok) throw new Error("push_keys table missing — run supabase/schema.sql again (" + r.status + ")");
  const rows = await r.json();
  if (rows.length) return { pub: rows[0].public_key, priv: rows[0].private_key };
  const k = webpush.generateVAPIDKeys();
  const w = await rest("push_keys", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates" }, body: JSON.stringify({ one: true, public_key: k.publicKey, private_key: k.privateKey }) });
  if (!w.ok) throw new Error("couldn't save the keys (" + w.status + ")");
  return keys(); // read back, in case another request made them first
}

// ---- player alerts: what to send one player, worked out from their board (no database or network here) ----
// p: {uid, lang, me (their student record, joined with its log documents), tasks, childOps (changes the child sent, not
// taken in yet), marks (what was already sent)}; now: a Date. Answers {messages, marks}.
function playerAlerts(p: any, now: Date) {
  const fmt = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const hour = +new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", hour: "2-digit", hourCycle: "h23" }).format(now);
  const today = fmt(now), tomorrow = fmt(new Date(now.getTime() + 86400000));
  const days = (a: string, b: string) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
  const s: any = p.me || {}, he = p.lang === "he", marks: any = JSON.parse(JSON.stringify(p.marks || {})), out: any[] = [];
  const parent = s.setup === "parent", child = parent && s.portal && s.portal.uid ? String(s.portal.uid) : "";
  const first = (he && String(s.fullHe || "").trim().split(/\s+/)[0]) || String(s.name || "").trim().split(/\s+/)[0] || (he ? "הילד/ה" : "your child");
  const to = (p2: string) => /^[\u0590-\u05FF]/.test(first) ? p2 + first : p2 + "־" + first;
  const title = he ? "עולים בדרגה" : "Rank Up";
  // to the player (or the child on a parent's board) in their words, and to the parent about the child
  const send = (tag: string, mine: string, aboutChild: string, url: string) => {
    if (!parent) out.push({ to: p.uid, title, body: mine, tag, url });
    else { out.push({ to: p.uid, title, body: aboutChild, tag, url }); if (child) out.push({ to: child, title, body: mine, tag, url }); }
  };
  // practice: after 2 days without, at 17:00, then every 2 days
  if (hour === 17) {
    const dates = (s.worklog || []).filter((w: any) => +w.minutes > 0).map((w: any) => w.date)
      .concat((p.childOps || []).filter((o: any) => o && o.type === "worklog.upsert" && o.item && +o.item.minutes > 0).map((o: any) => o.item.date));
    const last = dates.filter(Boolean).sort().pop() || s.createdAt || "";
    const gap = last ? days(last, today) : 0;
    if (last && gap >= 2 && (!marks.nudge || marks.nudge < last || days(marks.nudge, today) >= 2)) {
      send("checkin", he ? "לא נרשם תרגול כבר " + gap + " ימים. אימון קצר היום יחזיר אותך למסלול." : "No practice logged for " + gap + " days. A short session today gets you back on track.",
        he ? to("ל") + " אין תרגול כבר " + gap + " ימים." : first + " hasn't practiced for " + gap + " days.", "./#/home");
      marks.nudge = today;
    }
  }
  // the evening before: a tournament, and tasks due
  if (hour === 19) {
    marks.tour = marks.tour || {}; marks.task = marks.task || {};
    (s.tournaments || []).filter((t: any) => t && t.start === tomorrow && !marks.tour[t.id]).forEach((t: any) => {
      const n = String(t.name || "").slice(0, 60);
      send("tour", he ? "„" + n + "” מתחילה מחר. כדאי לישון טוב הלילה ולהתחמם עם כמה תרגילים בבוקר." : "“" + n + "” starts tomorrow. Sleep well tonight, and warm up with a few puzzles in the morning.",
        he ? "התחרות „" + n + "” של " + first + " מתחילה מחר. כדאי ללכת לישון מוקדם." : first + "’s tournament “" + n + "” starts tomorrow. An early night helps.", "./#/home");
      marks.tour[t.id] = today;
    });
    (p.tasks || []).filter((a: any) => a && a.status === "Assigned" && a.due === tomorrow && !marks.task[a.id]).forEach((a: any) => {
      const n = String(a.title || "").slice(0, 80);
      send("task", he ? "למחר: „" + n + "”." : "Due tomorrow: “" + n + "”.", he ? "למחר, של " + first + ": „" + n + "”." : "Due tomorrow for " + first + ": “" + n + "”.", "./#/home");
      marks.task[a.id] = today;
    });
    // forget what's long past
    Object.keys(marks.tour).forEach((k: string) => { if (days(marks.tour[k], today) > 30) delete marks.tour[k]; });
    Object.keys(marks.task).forEach((k: string) => { if (days(marks.task[k], today) > 30) delete marks.task[k]; });
  }
  return { messages: out, marks };
}
// ---- end of player alerts ----

async function sha256hex(t: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return [...new Uint8Array(b)].map((x: number) => x.toString(16).padStart(2, "0")).join("");
}
// Every player's reminders for this hour: read their boards, work out what to send, send it, remember it.
async function playersRun(now: Date) {
  const k = await keys();
  webpush.setVapidDetails("https://reemshr1.github.io", k.pub, k.priv);
  const pr = await rest("coaches?select=user_id&kind=eq.player");
  const players: any[] = pr.ok ? await pr.json() : [];
  let sent = 0;
  for (const { user_id: uid } of players) {
    const dr = await rest("docs?select=id,data&col=eq." + encodeURIComponent("data/users/" + uid));
    const docs: any[] = dr.ok ? await dr.json() : [];
    const sts = docs.filter((d: any) => /^st-/.test(d.id)).map((d: any) => d.data).filter((x: any) => x && x.self && x.active !== false);
    const first = sts[0] || (docs.find((d: any) => /^st-/.test(d.id)) || {}).data;
    if (!first) continue;
    // a parent's board can hold several children: each gets their own reminders (and their own marks)
    const kids = first.setup === "parent" ? sts.filter((x: any) => x.setup === "parent") : [first];
    const settings = (docs.find((d: any) => d.id === "settings") || {}).data || {}, marksDoc = (docs.find((d: any) => d.id === "alerts") || {}).data || {};
    const perKid = kids.length > 1 || !!marksDoc.kids, out: any = perKid ? { kids: {} } : {};
    const messages: any[] = [];
    for (const st of kids) {
      const me = { ...st, worklog: (st.worklog || []).concat(...docs.filter((d: any) => /^lg-/.test(d.id) && d.data && d.data.sid === st.id).map((d: any) => d.data.worklog || [])) };
      const tasks = docs.filter((d: any) => /^as-/.test(d.id)).map((d: any) => d.data).filter((a: any) => a && a.studentId === st.id);
      let childOps: any[] = [];
      if (st.setup === "parent" && st.portal && st.portal.uid) { const ir = await rest("docs?select=data&col=eq." + encodeURIComponent("portal/" + st.portal.uid + "/inbox")); childOps = ir.ok ? (await ir.json()).map((x: any) => x.data) : []; }
      const was = marksDoc.kids ? marksDoc.kids[st.id] || {} : marksDoc; // with one child, the marks were the whole doc
      const r = playerAlerts({ uid, lang: settings.lang, me, tasks, childOps, marks: was }, now);
      messages.push(...r.messages);
      if (perKid) out.kids[st.id] = r.marks; else Object.assign(out, r.marks);
    }
    if (!messages.length) continue;
    const ids = [...new Set(messages.map((m: any) => m.to))];
    const sr = await rest("push_subs?select=endpoint,user_id,sub&user_id=in.(" + ids.join(",") + ")");
    const subs: any[] = sr.ok ? await sr.json() : [];
    for (const m of messages) {
      const payload = JSON.stringify({ title: short(m.title, 80), body: short(m.body, 400), tag: short(m.tag, 80), url: short(m.url, 200) });
      for (const s of subs.filter((x: any) => x.user_id === m.to)) {
        try { await webpush.sendNotification(s.sub, payload, { TTL: 43200 }); sent++; }
        catch (e: any) { if (e && (e.statusCode === 404 || e.statusCode === 410)) await rest("push_subs?endpoint=eq." + encodeURIComponent(s.endpoint), { method: "DELETE" }); }
      }
    }
    // remembered even when no device has alerts on, so turning them on later doesn't bring old reminders
    await rest("docs?on_conflict=col,id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ col: "data/users/" + uid, id: "alerts", data: out, updated_at: new Date().toISOString() }) });
  }
  return { players: players.length, sent };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const body0 = await req.clone().json().catch(() => ({}));
    if (body0 && body0.action === "players") { // the hourly job: no sign-in, but the secret only the database has
      const k = await keys().catch(() => null);
      if (!k || typeof body0.secret !== "string" || body0.secret !== await sha256hex(k.priv)) return json({ error: "Not allowed" }, 403);
      return json(await playersRun(typeof body0.now === "string" ? new Date(body0.now) : new Date())); // `now`: for checking it at a given hour
    }
    const me = await caller(req);
    if (!me) return json({ error: "Sign in to the app first" }, 401);
    const body = await req.json().catch(() => ({}));
    const action = body && body.action;

    if (action === "key") return json({ key: (await keys()).pub });

    if (action === "subscribe") {
      const sub = body.sub;
      if (!sub || typeof sub.endpoint !== "string" || !/^https:\/\//.test(sub.endpoint) || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) return json({ error: "Not a push subscription" }, 400);
      const row = { endpoint: sub.endpoint, user_id: me, sub: { endpoint: sub.endpoint, keys: { p256dh: String(sub.keys.p256dh), auth: String(sub.keys.auth) } } };
      const r = await rest("push_subs?on_conflict=endpoint", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify(row) });
      if (!r.ok) return json({ error: "Couldn't save this device (" + r.status + ")" }, 500);
      return json({ ok: true });
    }

    if (action === "unsubscribe") {
      if (typeof body.endpoint === "string") await rest("push_subs?endpoint=eq." + encodeURIComponent(body.endpoint) + "&user_id=eq." + me, { method: "DELETE" });
      return json({ ok: true });
    }

    if (action === "send") {
      if (!(await isCoach(me))) return json({ error: "Only the coach can send alerts" }, 403);
      const list = Array.isArray(body.messages) ? body.messages.slice(0, 300) : [];
      const k = await keys();
      const subject = /^https:\/\//.test(req.headers.get("Origin") || "") ? req.headers.get("Origin")! : "https://reemshr1.github.io";
      webpush.setVapidDetails(subject, k.pub, k.priv);
      // every device of every account in the list, fetched at once
      const asked: string[] = [...new Set<string>(list.map((m: any) => String(m && m.to || "")).filter((x: string) => /^[0-9a-f-]{36}([.][A-Za-z0-9_-]{1,40})?$/i.test(x)))];
      const allowed = await mine(me, asked), acct = (x: string) => x.split(".")[0];
      const ids = [...new Set(asked.filter(x => allowed.has(x)).map(acct))]; // the accounts behind the links this coach has
      if (!ids.length) return json({ sent: 0, failed: 0, devices: 0 });
      const r = await rest("push_subs?select=endpoint,user_id,sub&user_id=in.(" + ids.join(",") + ")");
      const subs: any[] = r.ok ? await r.json() : [];
      let sent = 0, failed = 0; const errors: string[] = [];
      await Promise.all(list.map(async (m: any) => {
        const payload = JSON.stringify({ title: short(m.title, 80) || "Rank Up", body: short(m.body, 400), tag: short(m.tag, 80), url: short(m.url, 200) });
        if (!allowed.has(String(m.to))) return;
        await Promise.all(subs.filter(s => s.user_id === acct(String(m.to))).map(async s => {
          try { await webpush.sendNotification(s.sub, payload, { TTL: 86400 }); sent++; }
          catch (e: any) {
            failed++; if (errors.length < 3) errors.push(String(e && (e.statusCode ? e.statusCode + " " + (e.body || "") : e.message || e)).slice(0, 200));
            // the device turned alerts off or the address expired: forget it
            if (e && (e.statusCode === 404 || e.statusCode === 410)) await rest("push_subs?endpoint=eq." + encodeURIComponent(s.endpoint), { method: "DELETE" });
          }
        }));
      }));
      return json({ sent, failed, devices: subs.length, errors });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e && (e as Error).message || e) }, 500);
  }
});

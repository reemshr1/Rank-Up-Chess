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
//   {action:"send", messages:[{to, title, body, tag?, url?}]}   coach only
//                                       → {sent, failed, devices, errors}  `to` is an account id; errors: the first few, for checking
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
  const r = await rest("coach?select=user_id&user_id=eq." + encodeURIComponent(uid));
  return r.ok && (await r.json()).length > 0;
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
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
      const ids = [...new Set(list.map((m: any) => String(m && m.to || "")).filter((x: string) => /^[0-9a-f-]{36}$/i.test(x)))];
      if (!ids.length) return json({ sent: 0, failed: 0, devices: 0 });
      const r = await rest("push_subs?select=endpoint,user_id,sub&user_id=in.(" + ids.join(",") + ")");
      const subs: any[] = r.ok ? await r.json() : [];
      let sent = 0, failed = 0; const errors: string[] = [];
      await Promise.all(list.map(async (m: any) => {
        const payload = JSON.stringify({ title: short(m.title, 80) || "Rank Up", body: short(m.body, 400), tag: short(m.tag, 80), url: short(m.url, 200) });
        await Promise.all(subs.filter(s => s.user_id === String(m.to)).map(async s => {
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

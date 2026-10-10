// Rank Up service worker: lets phones install the app. Pages always come from the network,
// so an update is live as soon as it's published; the saved copy is only used when offline.
// It also shows phone alerts (push notifications) and opens the app when one is tapped.
const CACHE = "rankup-v1";
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(["./", "vendor/supabase.js", "icons/icon-192.png"]))); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin) return; // Supabase calls go straight to the network
  e.respondWith(fetch(r).then(res => { if (res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(r, c)); } return res; })
    .catch(() => caches.match(r).then(m => m || caches.match("./"))));
});
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Rank Up", {
    body: d.body || "", tag: d.tag || undefined, renotify: !!d.tag, icon: "icons/icon-192.png", badge: "icons/icon-192.png",
    data: { url: d.url || "./" }, dir: /[֐-׿]/.test((d.title || "") + (d.body || "")) ? "rtl" : "auto"
  }));
});
// Tapping an alert brings an open Rank Up window forward (at the right page), or opens one.
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(ws => {
    const w = ws.find(x => x.url.startsWith(self.registration.scope));
    if (w) return w.focus().then(x => x && x.navigate ? x.navigate(url) : x).catch(() => self.clients.openWindow(url));
    return self.clients.openWindow(url);
  }));
});

// A stand-in for Supabase, for the browser tests: everything is kept in localStorage (shared by every page of the
// test's browser), so one page can be the coach and another the student. FAKE_SUPA(uid) is a script to add with
// page.addInitScript; uid signs that page in (null: signed out). It doesn't check the database's access rules —
// those are tested against Postgres itself.
//   localStorage: fdb:<col>/<id> = a document · fcoaches = [uids] · fplayers = [uids who are players] · fadmin = uid
//   fusers = {email: {id, password}}
const FAKE_SUPA = uid => `(() => {
  window.__supaFake = true;
  let UID = (sessionStorage.getItem('fout') ? null : ${JSON.stringify(uid)}) || sessionStorage.getItem('fsess') || null;
  const keep = () => { if (UID) sessionStorage.setItem('fsess', UID); else sessionStorage.removeItem('fsess'); };
  keep();
  const L = k => JSON.parse(localStorage.getItem(k) || '[]');
  const key = (col, id) => 'fdb:' + col + '/' + id;
  const rows = col => Object.keys(localStorage).filter(k => k.startsWith('fdb:' + col + '/') && !k.slice(5 + col.length).includes('/'))
    .map(k => ({ id: k.slice(5 + col.length), data: JSON.parse(localStorage.getItem(k)) }));
  // realtime: every write tells the watchers in this page and, through the storage event, in the others
  const subs = new Set();
  const tell = (event, col, id) => subs.forEach(s => s(event, col, id));
  window.addEventListener('storage', e => { if (!e.key || !e.key.startsWith('fdb:')) return; const p = e.key.slice(4), i = p.lastIndexOf('/');
    tell(e.newValue == null ? 'DELETE' : e.oldValue == null ? 'INSERT' : 'UPDATE', p.slice(0, i), p.slice(i + 1)); });
  // the portal link: a code typed by a student finds the coach who has it (students' and families' invites)
  const codeOwner = c => { if (!c) return null;
    for (const k of Object.keys(localStorage)) { const m = /^fdb:data\\/users\\/([^/]+)\\/(.+)$/.exec(k); if (!m) continue; const v = JSON.parse(localStorage.getItem(k));
      if (v && v.invite && v.invite.code === c) return m[1];
      if (m[2] === 'settings' && (v.families || []).some(f => f.invite && f.invite.code === c)) return m[1]; }
    return null; };
  const portalTrigger = (id, data) => { const prev = JSON.parse(localStorage.getItem(key('portal', id)) || '{}'), c = String(data.code || '').toUpperCase().trim();
    let who = prev.coach && (UID === prev.coach || c === (prev.code || '') || !c) ? prev.coach : codeOwner(c);
    if (!who) { if (c && data.linked !== true) data = Object.assign({}, data, { error: c, errorKind: 'wrong' }); who = prev.coach; }
    data = Object.assign({}, data); delete data.coach; if (who) data.coach = who; return data; };
  function query(table) {
    const f = {}; let op = 'select', payload = null, single = false, range = null;
    const q = {
      select() { return q; }, eq(k, v) { f[k] = v; return q; }, range(a, b) { range = [a, b]; return q; }, order() { return q; },
      maybeSingle() { single = true; return q; }, single() { single = true; return q; },
      upsert(p) { op = 'upsert'; payload = p; return q; }, insert(p) { op = 'insert'; payload = p; return q; },
      update(p) { op = 'update'; payload = p; return q; }, delete() { op = 'delete'; return q; },
      then(res, rej) { return Promise.resolve().then(run).then(res, rej); } };
    function run() {
      if (table === 'coaches') { const me = f.user_id && L('fcoaches').includes(f.user_id) ? { user_id: f.user_id, is_admin: localStorage.getItem('fadmin') === f.user_id, kind: L('fplayers').includes(f.user_id) ? 'player' : 'coach' } : null;
        return { data: single ? me : (me ? [me] : []), error: null }; }
      if (table === 'backups') return { data: single ? null : [], error: null };
      if (table !== 'docs') return { data: single ? null : [], error: null };
      if (op === 'upsert' || op === 'insert') { const { col, id } = payload, data = col === 'portal' ? portalTrigger(id, payload.data) : payload.data;
        const had = localStorage.getItem(key(col, id)) != null; localStorage.setItem(key(col, id), JSON.stringify(data)); tell(had ? 'UPDATE' : 'INSERT', col, id); return { data: null, error: null }; }
      if (op === 'delete') { if (localStorage.getItem(key(f.col, f.id)) != null) { localStorage.removeItem(key(f.col, f.id)); tell('DELETE', f.col, f.id); } return { data: null, error: null }; }
      let out = rows(f.col); if (f.id != null) out = out.filter(r => r.id === f.id);
      if (range) out = out.slice(range[0], range[1] + 1);
      return { data: single ? (out[0] || null) : out, error: null }; }
    return q; }
  const users = () => JSON.parse(localStorage.getItem('fusers') || '{}');
  const sess = () => UID ? { user: { id: UID, email: (Object.entries(users()).find(([e, u]) => u.id === UID) || [UID + '@test'])[0] }, access_token: 'tok' } : null;
  const client = {
    from: query,
    rpc: async (name) => ({ data: null, error: { message: 'not in the test stand-in: ' + name } }),
    functions: { invoke: async () => ({ data: null, error: { message: 'no functions in tests' } }) },
    storage: { from: () => ({ upload: async () => ({ error: null }), remove: async () => ({ error: null }), createSignedUrl: async () => ({ data: { signedUrl: 'about:blank' }, error: null }) }) },
    channel() { const hs = []; const ch = { on(kind, flt, h) { hs.push([flt, h]); return ch; },
      subscribe(cb) { ch.fn = (event, col, id) => hs.forEach(([flt, h]) => { if (flt.event !== event) return; if (flt.filter && flt.filter !== 'col=eq.' + col) return;
        h(event === 'DELETE' ? { old: { col, id } } : { new: { col, id } }); }); subs.add(ch.fn); if (cb) setTimeout(() => cb('SUBSCRIBED'), 0); return ch; } }; return ch; },
    removeChannel(ch) { subs.delete(ch.fn); },
    auth: {
      async getSession() { return { data: { session: sess() }, error: null }; },
      onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; },
      async signInWithPassword({ email, password }) { const u = users()[email]; if (!u || u.password !== password) return { data: {}, error: { code: 'invalid_credentials', message: 'Invalid login credentials' } };
        UID = u.id; sessionStorage.removeItem('fout'); keep(); return { data: { user: sess().user, session: sess() }, error: null }; },
      async signUp({ email, password }) { const us = users(); if (us[email]) return { data: {}, error: { code: 'user_already_exists', message: 'User already registered' } };
        const id = 'u-' + email.split('@')[0]; us[email] = { id, password }; localStorage.setItem('fusers', JSON.stringify(us)); UID = id; keep(); return { data: { user: sess().user, session: sess() }, error: null }; },
      async signOut() { sessionStorage.setItem('fout', '1'); UID = null; keep(); return { error: null }; },
      async resetPasswordForEmail() { return { data: {}, error: null }; }, async updateUser() { return { data: { user: sess().user }, error: null }; },
      async refreshSession() { return { data: { session: sess() }, error: null }; } } };
  window.supabase = { createClient: () => client };
})();`;
module.exports = { FAKE_SUPA };

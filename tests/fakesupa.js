// A stand-in for Supabase, for the browser tests. Everything is kept in localStorage, which every page of a test's
// browser shares, so one page can be the coach and another the student or parent. FAKE_SUPA(uid) is a script for
// page.addInitScript: uid signs that page in (null: signed out; after "Sign out" the page stays signed out).
//
// It follows the database's access rules (supabase/schema.sql) for the docs table: a coach reads and writes their
// own records, their students' links and those links' pages and messages; a student or parent their own links,
// pages (read only) and messages. A write the rules refuse fails as in Supabase and is listed in window.__denied.
//
// localStorage:
//   fdb:<col>/<id>     a document                        fcoach      the first coach (the admin)
//   fcoaches           the other coaches' ids            fplayers    accounts that are players (also in fcoaches)
//   fmoved             players who moved to a coach      fusers      {email: {id, password}}
//   fccodes            coach / player codes {code: {code, note, kind, made_at, used_by, used_email, used_at}}
//   fleads             details left on the website       fbackups    the admin's nightly copies {day: data}
//   fbackups:<uid>     another account's nightly copies  fstore:books/<path>  a book file {owner, size}
//   ffn:<name>         what the server function <name> answers (JSON); every call is kept in window.__fn
const FAKE_SUPA = uid => `(() => {
  window.__supaFake = true; window.__denied = []; window.__fn = [];
  let UID = (sessionStorage.getItem('fout') ? null : ${JSON.stringify(uid)}) || sessionStorage.getItem('fsess') || null;
  const keep = () => { if (UID) sessionStorage.setItem('fsess', UID); else sessionStorage.removeItem('fsess'); };
  keep();
  const J = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const coachId = () => localStorage.getItem('fcoach');
  const others = () => J('fcoaches', []);
  const moved = () => J('fmoved', []);
  const players = () => J('fplayers', []);
  const inCoaches = id => !!id && (id === coachId() || others().includes(id));
  const isAdmin = (id = UID) => !!id && id === coachId();
  const isCoach = (id = UID) => inCoaches(id) && !moved().includes(id); // as public.is_coach()
  const kindOf = id => moved().includes(id) ? 'moved' : players().includes(id) ? 'player' : 'coach';
  const key = (col, id) => 'fdb:' + col + '/' + id;
  const get = (col, id) => J(key(col, id), undefined);
  const myLink = id => !!UID && new RegExp('^' + UID.replace(/[.]/g, '\\\\.') + '([.][A-Za-z0-9_-]{1,40})?$').test(id);
  const myLinkCol = (col, sub) => !!UID && new RegExp('^portal/' + UID.replace(/[.]/g, '\\\\.') + '([.][A-Za-z0-9_-]{1,40})?/(' + sub + ')$').test(col);
  const myPortal = col => { const id = col.split('/')[1], p = get('portal', id); return !!(p && p.coach === UID && isCoach()); };
  // the rules for one row: can the signed-in account read it / write it (before and after, as using / with check)
  const coachRow = (col, data) => isCoach() && (
    col === 'data/users/' + UID || col.startsWith('data/users/' + UID + '/') ||
    (col === 'portal' && data && data.coach === UID) ||
    (/^portal\\/[^/]+\\/(view|inbox)$/.test(col) && myPortal(col)));
  const canRead = (col, id, data) => !!UID && (coachRow(col, data) || (col === 'portal' && myLink(id)) || myLinkCol(col, 'view|inbox'));
  const canWrite = (op, col, id, before, after) => {
    if (!UID) return false;
    const coach = (before === undefined || coachRow(col, before)) && (after === undefined || coachRow(col, after));
    if (coach) return true;
    const own = (col === 'portal' && myLink(id)) || myLinkCol(col, 'inbox');
    if (op === 'delete') return myLinkCol(col, 'inbox') || (col === 'portal' && myLink(id) && id !== UID);
    return own; };
  const deny = what => { window.__denied.push(what); return { data: null, error: { code: '42501', message: 'new row violates row-level security policy' } }; };
  // realtime: each write tells the watchers in this page, and the storage event tells the other pages
  const subs = new Set();
  const tell = (event, col, id) => subs.forEach(s => { try { s(event, col, id); } catch (e) {} });
  window.addEventListener('storage', e => { if (!e.key || !e.key.startsWith('fdb:')) return; const p = e.key.slice(4), i = p.lastIndexOf('/');
    tell(e.newValue == null ? 'DELETE' : e.oldValue == null ? 'INSERT' : 'UPDATE', p.slice(0, i), p.slice(i + 1)); });
  // as public.code_owner and the portal_coach trigger: a typed code finds its coach; a wrong one keeps the coach they have
  const codeOwner = c => { if (!c) return null; let used = null;
    for (const k of Object.keys(localStorage)) { const m = /^fdb:data\\/users\\/([^/]+)\\/(.+)$/.exec(k); if (!m) continue; const v = J(k, null); if (!v) continue;
      if (v.invite && v.invite.code === c) return m[1];
      if (m[2] === 'settings' && (v.families || []).some(f => f.invite && f.invite.code === c)) return m[1];
      if (m[2] === 'settings' && (v.usedCodes || []).some(u => u.code === c)) used = m[1]; }
    return used; };
  const portalTrigger = (id, data) => { const prev = get('portal', id) || {}, c = String(data.code || '').toUpperCase().trim();
    const oldCoach = prev.coach; let who;
    if (oldCoach && (UID === oldCoach || c === String(prev.code || '') || !c)) who = oldCoach;
    else { who = codeOwner(c); if (!who) { if (c && data.linked !== true) data = Object.assign({}, data, { error: c, errorKind: 'wrong' }); who = oldCoach; } }
    data = Object.assign({}, data); delete data.coach; if (who) data.coach = who; return data; };
  // as public.claim_waiting_links: a student who typed the code before the coach's app saved it is picked up then
  const claimWaiting = (col, data) => { const who = col.slice(11); if (!col.startsWith('data/users/') || who.includes('/')) return;
    const codes = [data && data.invite && data.invite.code].concat(((data && data.families) || []).map(f => f.invite && f.invite.code)).filter(Boolean);
    if (!codes.length) return;
    Object.keys(localStorage).filter(k => k.startsWith('fdb:portal/') && k.split('/').length === 2).forEach(k => { const v = J(k, {});
      if (!v.coach && v.linked !== true && codes.includes(String(v.code || '').toUpperCase().trim())) { delete v.error; delete v.errorKind; v.coach = who; put(k, v); tell('UPDATE', 'portal', k.slice(11)); } }); };
  const rowsOf = col => Object.keys(localStorage).filter(k => k.startsWith('fdb:' + col + '/') && !k.slice(5 + col.length).includes('/'))
    .map(k => ({ id: k.slice(5 + col.length), data: J(k, null) }));
  const users = () => J('fusers', {});
  const emailOf = id => (Object.entries(users()).find(([e, u]) => u.id === id) || [id + '@test'])[0];
  function query(table) {
    const f = {}; let op = 'select', payload = null, single = false, range = null, desc = false, orderBy = null;
    const q = {
      select() { return q; }, eq(k, v) { f[k] = v; return q; }, in(k, v) { f[k] = v; return q; }, range(a, b) { range = [a, b]; return q; },
      order(k, o) { orderBy = k; desc = !!(o && o.ascending === false); return q; }, limit() { return q; },
      maybeSingle() { single = true; return q; }, single() { single = true; return q; },
      upsert(p) { op = 'upsert'; payload = p; return q; }, insert(p) { op = 'insert'; payload = p; return q; },
      update(p) { op = 'update'; payload = p; return q; }, delete() { op = 'delete'; return q; },
      then(res, rej) { return new Promise(r => setTimeout(r, 2)).then(run).then(res, rej); } };
    const one = list => ({ data: single ? (list[0] || null) : list, error: null });
    function run() {
      if (table === 'coaches') { const id = f.user_id; return one(id && inCoaches(id) && (id === UID || isAdmin()) ? [{ user_id: id, is_admin: isAdmin(id), kind: kindOf(id) }] : []); }
      if (table === 'coach_codes') { const all = J('fccodes', {});
        if (op === 'select') return one(isAdmin() ? Object.values(all).sort((a, b) => a.made_at < b.made_at ? 1 : -1) : []);
        if (op === 'insert') { if (!isAdmin() || payload.used_by || all[payload.code]) return deny('insert coach_codes');
          all[payload.code] = { code: payload.code, note: payload.note || '', kind: payload.kind === 'player' ? 'player' : 'coach', made_at: new Date().toISOString(), used_by: null, used_email: null, used_at: null }; put('fccodes', all); return one([]); }
        if (op === 'delete') { const x = all[f.code]; if (isAdmin() && x && !x.used_by && !x.used_at) { delete all[f.code]; put('fccodes', all); } return one([]); }
        return one([]); }
      if (table === 'leads') { const all = J('fleads', []);
        if (op === 'insert') { all.push(Object.assign({ id: Date.now(), created_at: new Date().toISOString(), status: 'new' }, payload)); put('fleads', all); return one([]); }
        if (!isAdmin()) return one([]);
        if (op === 'select') return one(all.slice().sort((a, b) => a.created_at < b.created_at ? 1 : -1));
        if (op === 'update') { const x = all.find(y => String(y.id) === String(f.id)); if (x) Object.assign(x, payload); put('fleads', all); return one([]); }
        if (op === 'delete') { put('fleads', all.filter(y => String(y.id) !== String(f.id))); return one([]); }
        return one([]); }
      if (table === 'backups') { if (localStorage.getItem('fbackups') == null) return { data: null, error: { code: '42P01', message: 'relation "public.backups" does not exist' } };
        const o = isAdmin() ? J('fbackups', {}) : J('fbackups:' + UID, {});
        return one(Object.keys(o).filter(d => f.day == null || d === f.day).sort().reverse().map(d => ({ day: d, data: o[d] }))); }
      if (table !== 'docs') return one([]);
      if (op === 'upsert' || op === 'insert') { const { col, id } = payload, before = get(col, id);
        const data = col === 'portal' ? portalTrigger(id, payload.data) : payload.data;
        if (!canWrite(before === undefined ? 'insert' : 'update', col, id, before, data)) return deny('write ' + col + '/' + id);
        put(key(col, id), data); tell(before === undefined ? 'INSERT' : 'UPDATE', col, id); claimWaiting(col, data); return one([]); }
      if (op === 'delete') { const before = get(f.col, f.id); if (before === undefined) return one([]);
        if (!canWrite('delete', f.col, f.id, before, undefined) || !canRead(f.col, f.id, before)) return one([]); // a delete the rules don't allow touches no row
        localStorage.removeItem(key(f.col, f.id)); tell('DELETE', f.col, f.id); return one([]); }
      let out = rowsOf(f.col).filter(r => f.id == null || r.id === f.id).filter(r => canRead(f.col, r.id, r.data));
      if (range) out = out.slice(range[0], range[1] + 1);
      return one(out); }
    return q; }
  // the database functions the app calls (supabase/schema.sql)
  const rpcs = {
    become_coach({ code }) { if (!UID) return false; if (isCoach()) return true;
      if (!coachId() && !others().length) { localStorage.setItem('fcoach', UID); return true; }
      const all = J('fccodes', {}), c = String(code || '').replace(/\\s/g, '').toUpperCase(), x = all[c];
      if (!x || x.used_by || x.used_at) return false;
      Object.assign(x, { used_by: UID, used_email: emailOf(UID), used_at: new Date().toISOString() }); put('fccodes', all);
      put('fmoved', moved().filter(y => y !== UID)); put('fplayers', players().filter(y => y !== UID));
      if (x.kind === 'player') put('fplayers', players().concat([UID]));
      if (!inCoaches(UID)) put('fcoaches', others().concat([UID])); return true; },
    leave_player() { const v = get('portal', UID); if (!UID || !v || !v.coach || kindOf(UID) !== 'player' || isAdmin()) return false;
      put('fmoved', moved().concat([UID])); return true; },
    close_player() { if (!UID || kindOf(UID) !== 'player' || !inCoaches(UID) || isAdmin()) return false;
      const me = UID, kids = rowsOf('portal').filter(r => r.data && r.data.coach === me).map(r => r.id);
      Object.keys(localStorage).filter(k => k.startsWith('fdb:data/users/' + me + '/') || kids.some(g => k.startsWith('fdb:portal/' + g + '/')) || k === 'fdb:portal/' + me || k.startsWith('fdb:portal/' + me + '/')
        || (k.startsWith('fstore:books/') && J(k, {}).owner === me)).forEach(k => localStorage.removeItem(k));
      kids.forEach(g => put('fdb:portal/' + g, { linked: false, unlinked: true, coach: me }));
      put('fcoaches', others().filter(y => y !== me)); put('fplayers', players().filter(y => y !== me)); localStorage.removeItem('fbackups:' + me);
      const us = users(); Object.keys(us).forEach(e => { if (us[e].id === me) delete us[e]; }); put('fusers', us);
      window.__closed = me; return true; },
    coach_list() { if (!isAdmin()) return [];
      return [coachId()].concat(others()).filter(Boolean).map(id => ({ user_id: id, email: emailOf(id), name: (get('data/users/' + id, 'settings') || {}).coachName || '',
        joined: '2026-10-01T10:00:00Z', is_admin: isAdmin(id), kind: kindOf(id), students: Object.keys(localStorage).filter(k => k.startsWith('fdb:data/users/' + id + '/st-')).length })); },
    remove_coach({ target, wipe }) { const t = target; if (!isAdmin() || !t || t === UID || !others().includes(t)) return false;
      window.__removed = (window.__removed || []).concat([{ target: t, wipe: !!wipe }]);
      if (moved().includes(t)) { put('fcoaches', others().filter(x => x !== t));
        Object.keys(localStorage).filter(k => k.startsWith('fdb:data/users/' + t + '/') || (k.startsWith('fstore:books/') && J(k, {}).owner === t)).forEach(k => localStorage.removeItem(k)); return true; }
      put('fcoaches', others().filter(x => x !== t)); put('fplayers', players().filter(x => x !== t));
      if (wipe) { const gone = rowsOf('portal').filter(r => r.data && r.data.coach === t).map(r => r.id);
        Object.keys(localStorage).filter(k => k.startsWith('fdb:data/users/' + t + '/') || gone.some(g => k === 'fdb:portal/' + g || k.startsWith('fdb:portal/' + g + '/')) || (k.startsWith('fstore:books/') && J(k, {}).owner === t)).forEach(k => localStorage.removeItem(k));
        const us = users(); Object.keys(us).forEach(e => { if (us[e].id === t) delete us[e]; }); put('fusers', us);
        const cc = J('fccodes', {}); Object.values(cc).forEach(x => { if (x.used_by === t) x.used_by = null; }); put('fccodes', cc); } // on delete set null, as in the database
      return true; } };
  const sess = () => UID ? { user: { id: UID, email: emailOf(UID) }, access_token: 'tok-' + UID } : null;
  let authCb = null;
  window.__killSession = () => { UID = null; sessionStorage.setItem('fout', '1'); keep(); if (authCb) authCb('SIGNED_OUT', null); }; // the session is gone, as after it expires
  const files = {
    async upload(path, file) { if (!isCoach()) return { data: null, error: { message: 'new row violates row-level security policy' } };
      put('fstore:books/' + path, { owner: UID, size: (file && file.size) || 0, name: (file && file.name) || '' }); return { data: { path }, error: null }; },
    async remove(paths) { (paths || []).forEach(p => { const v = J('fstore:books/' + p, null); if (v && v.owner === UID) localStorage.removeItem('fstore:books/' + p); }); return { data: [], error: null }; },
    async copy(from, to) { const v = J('fstore:books/' + from, null); if (!v) return { data: null, error: { message: 'Object not found' } };
      put('fstore:books/' + to, Object.assign({}, v, { owner: UID })); return { data: { path: to }, error: null }; },
    async createSignedUrl(path) { return localStorage.getItem('fstore:books/' + path) == null ? { data: null, error: { message: 'Object not found' } } : { data: { signedUrl: 'about:blank#' + path }, error: null }; } };
  const client = {
    from: query,
    async rpc(name, args) { await new Promise(r => setTimeout(r, 5)); return rpcs[name] ? { data: rpcs[name](args || {}), error: null } : { data: null, error: { message: 'unknown function ' + name } }; },
    functions: { async invoke(name, opts) { window.__fn.push({ name, body: opts && opts.body }); const a = localStorage.getItem('ffn:' + name);
      return a == null ? { data: null, error: Object.assign(new Error('Edge Function returned a non-2xx status code'), { name: 'FunctionsHttpError' }) } // as supabase-js says for a function that isn't deployed (404)
         : { data: JSON.parse(a), error: null }; } },
    storage: { from: () => files },
    channel() { const hs = []; const ch = { on(kind, flt, h) { hs.push([flt, h]); return ch; },
      subscribe(cb) { ch.fn = (event, col, id) => hs.forEach(([flt, h]) => { if (flt.event !== event) return; if (flt.filter && flt.filter !== 'col=eq.' + col) return;
        h(event === 'DELETE' ? { old: { col, id } } : { new: { col, id } }); }); subs.add(ch.fn); if (cb) setTimeout(() => cb('SUBSCRIBED'), 0); return ch; } }; return ch; },
    removeChannel(ch) { subs.delete(ch.fn); },
    auth: {
      async getSession() { return { data: { session: sess() }, error: null }; },
      onAuthStateChange(cb) { authCb = cb; return { data: { subscription: { unsubscribe() {} } } }; },
      async signInWithPassword({ email, password }) { const u = users()[email]; if (!u || u.password !== password) return { data: {}, error: { code: 'invalid_credentials', message: 'Invalid login credentials' } };
        UID = u.id; sessionStorage.removeItem('fout'); keep(); return { data: { user: sess().user, session: sess() }, error: null }; },
      async signUp({ email, password }) { const us = users(); if (us[email]) return { data: {}, error: { code: 'user_already_exists', message: 'User already registered' } };
        if (String(password).length < 8) return { data: {}, error: { code: 'weak_password', message: 'Password should be at least 8 characters.' } };
        const id = 'u-' + email.split('@')[0]; us[email] = { id, password }; put('fusers', us); UID = id; sessionStorage.removeItem('fout'); keep(); return { data: { user: sess().user, session: sess() }, error: null }; },
      async signOut(o) { window.__signOutScope = (o && o.scope) || 'global'; sessionStorage.setItem('fscope', window.__signOutScope); sessionStorage.setItem('fout', '1'); UID = null; keep(); return { error: null }; },
      async resetPasswordForEmail() { window.__resetSent = (window.__resetSent || 0) + 1; return { data: {}, error: null }; },
      async updateUser() { return { data: { user: sess() && sess().user }, error: null }; },
      async refreshSession() { return { data: { session: sess() }, error: null }; } } };
  window.supabase = { createClient: () => client };
})();`;
module.exports = { FAKE_SUPA };

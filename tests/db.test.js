// The database's own rules (supabase/schema.sql) in a real Postgres, with a stand-in for Supabase's auth, storage,
// pg_cron and pg_net (tests/sql/supabase-stub.sql). Each check runs as one signed-in account (or nobody).
//  - schema.sql runs on a brand-new project, runs again safely, and moves a database from before several coaches.
//  - Codes: the first account is the admin; a coach or player code works once (any case, spaces ignored).
//  - Records: a coach's are theirs alone; links get their coach from the code typed (never from the app); a wrong
//    code never takes a coach away; a code typed before the coach saved it is picked up; boards and messages; a second
//    coach's link; book files; leaving and closing a player account; the admin removing a coach; nightly copies;
//    the website form; phone-alert tables nobody can read; the hourly player reminders.
// Start the database first: tests/sql/start-pg.sh (port 5499).
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { check, done } = require('./lib.js');
const PG = ['-h', process.env.RANKPG_HOST || '/tmp', '-p', process.env.RANKPG_PORT || '5499', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atq', '-F', '|'];
const SQL = f => fs.readFileSync(path.resolve(__dirname, '..', f), 'utf8').replace(/^create extension if not exists (pg_cron|pg_net)[^;]*;/gm, '-- (a stand-in for $1 is in the test database)');
const run = (sql, db) => { try { return { out: execFileSync('psql', PG.concat(['-d', db]), { input: sql, stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim() }; }
  catch (e) { return { err: String(e.stderr || e.message) }; } };
let DB = 'rankup_test';
const sql = s => run(s, DB);
// as an account: Supabase's "authenticated" role with auth.uid() = uid; null = nobody signed in ("anon")
const as = (uid, s) => run("begin;\nset local \"request.jwt.claim.sub\" = '" + (uid || '') + "';\nset local role " + (uid ? 'authenticated' : 'anon') + ";\n" + s + "\ncommit;", DB);
const val = (uid, s) => { const r = as(uid, s); return r.err ? 'ERROR ' + r.err.split('\n')[0] : r.out; };
const refused = r => !!r.err && /row-level security|permission denied/.test(r.err);
const n = (uid, s) => +val(uid, 'select count(*) from (' + s + ') x;');
const id = c => c.repeat(8) + '-' + c.repeat(4) + '-' + c.repeat(4) + '-' + c.repeat(4) + '-' + c.repeat(12);
const ADMIN = id('a'), COACH2 = id('b'), PLAYER = id('c'), STU = id('d'), PAR = id('e'), STU2 = id('f'), STRANGER = id('1'), KID = id('2'), LATE = id('3');
const doc = (col, i, data) => "insert into public.docs (col, id, data) values ('" + col + "', '" + i + "', '" + JSON.stringify(data).replace(/'/g, "''") + "'::jsonb) on conflict (col, id) do update set data = excluded.data;";
const fresh = name => { run('drop database if exists ' + name + ';', 'postgres'); run('create database ' + name + ';', 'postgres'); DB = name;
  const s = run(fs.readFileSync(path.join(__dirname, 'sql/supabase-stub.sql'), 'utf8'), name); if (s.err && !/wal_level/.test(s.err)) throw new Error('stub: ' + s.err); };
(() => {
  // ---- schema.sql on a new project, twice ----
  fresh('rankup_test');
  let r = sql(SQL('supabase/schema.sql'));
  check(!r.err, 'schema.sql runs on a brand-new project' + (r.err ? ': ' + r.err.split('\n').find(l => /ERROR/.test(l)) : ''));
  r = sql(SQL('supabase/schema.sql'));
  check(!r.err, 'and runs again safely' + (r.err ? ': ' + r.err.split('\n').find(l => /ERROR/.test(l)) : ''));
  check(+sql("select count(*) from pg_policies where schemaname in ('public', 'storage');").out >= 20 && sql("select string_agg(jobname, ',' order by jobname) from cron.job;").out === 'rank-up-nightly-backup', 'its access rules and the nightly backup job are in place');
  ['two-coaches', 'coach-code-once', 'player-accounts', 'connect-coach', 'admin-page', 'close-player', 'player-books'].forEach(f => { const x = sql(SQL('supabase/' + f + '.sql')); if (x.err) check(false, f + '.sql runs on top: ' + x.err.split('\n').find(l => /ERROR/.test(l))); });
  r = sql(SQL('supabase/schema.sql')); check(!r.err, 'the one-time files run on top, and schema.sql once more after them');
  sql(['ADMIN', 'COACH2', 'PLAYER', 'STU', 'PAR', 'STU2', 'STRANGER', 'KID', 'LATE'].map(k => "insert into auth.users (id, email) values ('" + eval(k) + "', '" + k.toLowerCase() + "@x.co');").join('\n'));
  // ---- codes ----
  check(val(ADMIN, 'select public.become_coach(null);') === 't' && sql("select is_admin from public.coaches where user_id = '" + ADMIN + "';").out === 't', 'the first account opens a board without a code, as the admin');
  check(val(STRANGER, "select public.become_coach('');") === 'f', 'after that, no code: no board');
  check(refused(as(COACH2, "insert into public.coach_codes (code) values ('SELF123');")) && n(COACH2, 'select * from public.coach_codes') === 0, 'only the admin makes and sees codes');
  as(ADMIN, "insert into public.coach_codes (code, note) values ('COACH234', 'Ben'); insert into public.coach_codes (code, kind) values ('PLAY2345', 'player'); insert into public.coach_codes (code) values ('SPARE234');");
  check(n(ADMIN, 'select * from public.coach_codes') === 3, 'the admin makes a coach code and a player code');
  check(val(STRANGER, "select public.become_coach('NOPE234');") === 'f', 'a wrong code: no board');
  check(val(COACH2, "select public.become_coach(' coach 234 ');") === 't' && sql("select kind || ' ' || used_email from public.coach_codes where code = 'COACH234';").out === 'coach coach2@x.co', 'a coach code, in any case and with spaces: a coach’s board; the code says who used it');
  check(val(STRANGER, "select public.become_coach('COACH234');") === 'f', 'a code works once');
  check(val(PLAYER, "select public.become_coach('play2345');") === 't' && sql("select kind from public.coaches where user_id = '" + PLAYER + "';").out === 'player', 'a player code: a player’s board');
  check(val(ADMIN, "with x as (delete from public.coach_codes where code = 'COACH234' returning 1) select count(*) from x;") === '0' && val(ADMIN, "with x as (delete from public.coach_codes where code = 'SPARE234' returning 1) select count(*) from x;") === '1', 'the admin can remove an unused code, not a used one');
  // ---- records ----
  as(ADMIN, doc('data/users/' + ADMIN, 'settings', { coachName: 'Raem', families: [{ id: 'fam', name: 'Cohen', studentIds: ['st-a'], invite: { code: 'FAM777' } }] }) + doc('data/users/' + ADMIN, 'st-a', { id: 'st-a', name: 'Maya', invite: { code: 'MAYA88' } }));
  as(COACH2, doc('data/users/' + COACH2, 'settings', { coachName: 'Ben' }) + doc('data/users/' + COACH2, 'st-y', { id: 'st-y', name: 'Yoni', invite: { code: 'YONI99' } }) + doc('data/users/' + COACH2, 'st-m2', { id: 'st-m2', name: 'Maya', invite: { code: 'BEN234' } }));
  check(n(ADMIN, "select * from public.docs where col = 'data/users/" + ADMIN + "'") === 2, 'a coach keeps their own records');
  check(n(COACH2, "select * from public.docs where col = 'data/users/" + ADMIN + "'") === 0 && refused(as(COACH2, doc('data/users/' + ADMIN, 'st-x', { id: 'st-x' }))), 'another coach can’t read or write them');
  check(n(STU, "select * from public.docs where col like 'data/users/%'") === 0 && n(null, 'select * from public.docs') === 0, 'nor a student, nor anyone signed out');
  // ---- links ----
  as(STU, doc('portal', STU, { code: 'maya88', coach: COACH2, linked: false }));
  check(sql("select data->>'coach' from public.docs where col = 'portal' and id = '" + STU + "';").out === ADMIN, 'a student’s link gets its coach from the code they typed, not from the app');
  as(PAR, doc('portal', PAR, { code: 'FAM777' }));
  check(sql("select data->>'coach' from public.docs where col = 'portal' and id = '" + PAR + "';").out === ADMIN, 'a family code: the parent’s link is the same coach’s');
  as(STU2, doc('portal', STU2, { code: 'WRONG1' }));
  check(sql("select coalesce(data->>'coach', '-') || ' ' || (data->>'errorKind') from public.docs where col = 'portal' and id = '" + STU2 + "';").out === '- wrong', 'a wrong code: no coach, marked wrong');
  as(STU2, doc('portal', STU2, { code: 'YONI99' })); as(STU2, doc('portal', STU2, { code: 'NOPE77' }));
  check(sql("select data->>'coach' from public.docs where col = 'portal' and id = '" + STU2 + "';").out === COACH2, 'a wrong code typed later never takes away the coach they have');
  as(LATE, doc('portal', LATE, { code: 'LATE55' }));
  as(ADMIN, doc('data/users/' + ADMIN, 'st-l', { id: 'st-l', name: 'Late', invite: { code: 'LATE55' } }));
  check(sql("select data->>'coach' from public.docs where col = 'portal' and id = '" + LATE + "';").out === ADMIN, 'a code typed before the coach’s app saved it is picked up when it’s saved');
  check(n(ADMIN, "select * from public.docs where col = 'portal'") === 3 && n(COACH2, "select * from public.docs where col = 'portal'") === 1, 'each coach sees their own students’ and parents’ links only');
  check(n(STU, "select * from public.docs where col = 'portal'") === 1 && n(STU, "select * from public.docs where col = 'portal' and id = '" + PAR + "'") === 0, 'a student sees their own link, no one else’s');
  // ---- boards and messages ----
  as(ADMIN, doc('portal/' + STU + '/view', 'student', { id: 'st-a', name: 'Maya' }) + doc('portal/' + PAR + '/view', 'ch-st-a', { id: 'st-a' }));
  check(n(STU, "select * from public.docs where col = 'portal/" + STU + "/view'") === 1, 'the coach writes the student’s board; the student reads it');
  check(refused(as(STU, doc('portal/' + STU + '/view', 'student', { id: 'st-a', name: 'Hacked' }))) || val(STU, "with x as (update public.docs set data = '{}' where col = 'portal/" + STU + "/view' returning 1) select count(*) from x;") === '0', 'the student can’t change their board');
  check(n(STU2, "select * from public.docs where col = 'portal/" + STU + "/view'") === 0 && n(COACH2, "select * from public.docs where col = 'portal/" + STU + "/view'") === 0, 'another student, or another coach, can’t read it');
  r = as(STU, doc('portal/' + STU + '/inbox', 'op-1', { type: 'worklog.upsert', item: { minutes: 30 } }));
  check(!r.err && n(ADMIN, "select * from public.docs where col = 'portal/" + STU + "/inbox'") === 1, 'the student sends a message (inbox); their coach reads it');
  check(refused(as(STU2, doc('portal/' + STU + '/inbox', 'op-x', { type: 'x' }))) && n(COACH2, "select * from public.docs where col = 'portal/" + STU + "/inbox'") === 0, 'no one else can write into it or read it');
  check(val(ADMIN, "with x as (delete from public.docs where col = 'portal/" + STU + "/inbox' returning 1) select count(*) from x;") === '1', 'the coach takes the message in and deletes it');
  check(refused(as(STU, doc('portal/' + STU2, 'x', {}))) && refused(as(STU, doc('portal', STU2, { code: 'MAYA88' }))), 'a student can’t write another account’s link');
  // a second coach's link
  as(STU, doc('portal', STU + '.2', { code: 'BEN234' }));
  check(sql("select data->>'coach' from public.docs where col = 'portal' and id = '" + STU + ".2';").out === COACH2 && n(STU, "select * from public.docs where col = 'portal'") === 2, 'a second coach’s link (<account>.2) gets that coach, and the student reads both');
  as(COACH2, doc('portal/' + STU + '.2/view', 'student', { id: 'st-m2' }));
  check(n(ADMIN, "select * from public.docs where col = 'portal/" + STU + ".2/view'") === 0 && n(STU, "select * from public.docs where col like 'portal/" + STU + "%/view'") === 2, 'the first coach can’t read the second coach’s board for her; she reads both');
  check(val(STU, "with x as (delete from public.docs where col = 'portal' and id = '" + STU + "' returning 1) select count(*) from x;") === '0', 'she can’t remove her first link (her coach closes it)');
  check(val(STU, "with x as (delete from public.docs where col = 'portal' and id = '" + STU + ".2' returning 1) select count(*) from x;") === '1', 'but can remove a link she added');
  // ---- book files ----
  check(!as(ADMIN, "insert into storage.objects (bucket_id, name, owner_id) values ('books', 'st-a/bk1.pdf', '" + ADMIN + "');").err, 'a coach uploads a book PDF');
  check(refused(as(STU, "insert into storage.objects (bucket_id, name, owner_id) values ('books', 'st-a/bk9.pdf', '" + STU + "');")), 'a student can’t');
  check(n(STU, "select * from storage.objects where name = 'st-a/bk1.pdf'") === 1 && n(PAR, "select * from storage.objects where name = 'st-a/bk1.pdf'") === 1, 'the student, and the parent (through the child’s board), can open it');
  check(n(STU2, "select * from storage.objects where name = 'st-a/bk1.pdf'") === 0 && n(COACH2, "select * from storage.objects where name = 'st-a/bk1.pdf'") === 0, 'another student or coach can’t');
  check(val(COACH2, "with x as (delete from storage.objects where name = 'st-a/bk1.pdf' returning 1) select count(*) from x;") === '0', 'nor delete it');
  // ---- a player ----
  as(PLAYER, doc('data/users/' + PLAYER, 'st-me', { id: 'st-me', name: 'Tom', self: true, setup: 'parent', portal: { uid: KID }, invite: { code: 'KID123' } }) + "insert into storage.objects (bucket_id, name, owner_id) values ('books', 'st-me/bk1.pdf', '" + PLAYER + "');");
  as(KID, doc('portal', KID, { code: 'KID123' }));
  check(sql("select data->>'coach' from public.docs where col = 'portal' and id = '" + KID + "';").out === PLAYER, 'a player’s child links to the parent’s board with its code');
  as(PLAYER, doc('portal/' + KID + '/view', 'student', { id: 'st-me' }));
  check(n(KID, "select * from storage.objects where name = 'st-me/bk1.pdf'") === 1, 'and opens the board’s book PDFs');
  check(val(PLAYER, 'select public.leave_player();') === 'f', 'leaving the player board without a coach’s link: refused');
  check(val(ADMIN, 'select public.close_player();') === 'f' && val(STU, 'select public.close_player();') === 'f', 'close_player: not for a coach or a student');
  // a second player who moves to a coach
  const MOVER = id('4'); sql("insert into auth.users (id, email) values ('" + MOVER + "', 'mover@x.co');");
  as(ADMIN, "insert into public.coach_codes (code, kind) values ('PLAY9999', 'player');"); val(MOVER, "select public.become_coach('PLAY9999');");
  as(MOVER, doc('data/users/' + MOVER, 'st-me', { id: 'st-me', name: 'Dan', self: true }) + "insert into storage.objects (bucket_id, name, owner_id) values ('books', 'mv/bk1.pdf', '" + MOVER + "');");
  as(ADMIN, doc('data/users/' + ADMIN, 'st-d', { id: 'st-d', name: 'Dan', invite: { code: 'DAN777' } }));
  check(n(ADMIN, "select * from storage.objects where owner_id = '" + MOVER + "'") === 0, 'a coach can’t open a player’s PDFs before the player moves to them');
  as(MOVER, doc('portal', MOVER, { code: 'DAN777' }));
  check(val(MOVER, 'select public.leave_player();') === 't' && sql("select kind from public.coaches where user_id = '" + MOVER + "';").out === 'moved', 'with the coach’s code, leave_player: the account is “moved”');
  check(refused(as(MOVER, doc('data/users/' + MOVER, 'st-me', { id: 'st-me', name: 'changed' }))) && n(MOVER, "select * from public.docs where col = 'data/users/" + MOVER + "'") === 0, 'the old board is a hidden copy: no longer readable or writable by them');
  check(n(ADMIN, "select * from storage.objects where owner_id = '" + MOVER + "'") === 1 && n(COACH2, "select * from storage.objects where owner_id = '" + MOVER + "'") === 0, 'their new coach can copy their PDFs; another coach can’t');
  check(val(MOVER, "select public.become_coach('PLAY9999');") === 'f', 'the used player code doesn’t open the board again');
  // the admin's list, and removing
  r = as(ADMIN, "select string_agg(kind, ',' order by kind) from public.coach_list();");
  check(r.out === 'coach,coach,moved,player', 'coach_list: every board with its kind ' + r.out);
  check(n(COACH2, 'select * from public.coach_list()') === 0, 'only for the admin');
  check(val(COACH2, "select public.remove_coach('" + PLAYER + "', true);") === 'f' && val(ADMIN, "select public.remove_coach('" + ADMIN + "', true);") === 'f', 'remove_coach: only the admin, never themselves');
  check(val(ADMIN, "select public.remove_coach('" + MOVER + "', true);") === 't' && sql("select count(*) from public.docs where col like 'data/users/" + MOVER + "%';").out === '0' && sql("select count(*) from auth.users where id = '" + MOVER + "';").out === '1'
    && sql("select data->>'coach' from public.docs where col = 'portal' and id = '" + MOVER + "';").out === ADMIN && sql("select count(*) from storage.objects where owner_id = '" + MOVER + "';").out === '0', 'a moved player: Delete the copy removes the old board and PDFs, the account and its link to the coach stay');
  // nightly copies
  sql('select public.nightly_backup();');
  check(n(ADMIN, 'select * from public.backups') === 1 && n(COACH2, 'select * from public.backups') === 1 && n(STU, 'select * from public.backups') === 0, 'nightly copies: each coach reads their own only');
  check(refused(as(ADMIN, 'select public.nightly_backup();')) && refused(as(ADMIN, "insert into public.backups (coach, day, data) values ('" + ADMIN + "', '2020-01-01', '{}');")), 'nobody can make or change a copy from the app');
  // closing a player account
  check(val(PLAYER, 'select public.close_player();') === 't', 'close_player: the player closes their account');
  check(sql("select count(*) from public.docs where col like 'data/users/" + PLAYER + "%' or col like 'portal/" + KID + "/%';").out === '0' && sql("select count(*) from storage.objects where owner_id = '" + PLAYER + "';").out === '0', 'their board, the child’s board and their PDFs are gone');
  check(sql("select (data->>'unlinked') || ' ' || (data->>'linked') from public.docs where col = 'portal' and id = '" + KID + "';").out === 'true false', 'the child’s sign-in is told access was closed');
  check(sql("select (select count(*) from auth.users where id = '" + PLAYER + "') + (select count(*) from public.coaches where user_id = '" + PLAYER + "');").out === '0', 'the account is gone');
  // removing a coach, keeping or wiping
  check(val(ADMIN, "select public.remove_coach('" + COACH2 + "', false);") === 't' && sql("select count(*) from public.docs where col like 'data/users/" + COACH2 + "%';").out === '3' && !(+sql("select count(*) from public.coaches where user_id = '" + COACH2 + "';").out), 'removing a coach (keep): their access goes, their records stay');
  check(n(COACH2, "select * from public.docs where col like 'data/users/" + COACH2 + "%'") === 0, 'and they can no longer read them');
  check(val(ADMIN, "select public.remove_coach('" + COACH2 + "', true);") === 'f', '(a removed coach isn’t a coach any more, so wipe needs them back first)');
  as(ADMIN, "insert into public.coach_codes (code) values ('BACK2345');"); val(COACH2, "select public.become_coach('BACK2345');");
  check(n(COACH2, "select * from public.docs where col like 'data/users/" + COACH2 + "%'") === 3, 'a new coach code brings them back, with their records');
  check(val(ADMIN, "select public.remove_coach('" + COACH2 + "', true);") === 't' && sql("select count(*) from public.docs where col like 'data/users/" + COACH2 + "%' or (col = 'portal' and data->>'coach' = '" + COACH2 + "') or col like 'portal/" + STU2 + "/%';").out === '0' && sql("select count(*) from auth.users where id = '" + COACH2 + "';").out === '0', 'removing a coach (wipe): records, their students’ links and boards, and the account go');
  // the website form
  check(!as(null, "insert into public.leads (name, phone, email) values ('Dana', '0541234567', 'dana@x.co');").err, 'anyone can leave their details on the website');
  check(refused(as(null, "insert into public.leads (name, phone, email, status) values ('Dana', '0541234567', 'dana@x.co', 'code');")), 'but can’t set its status, notes or code');
  check(n(ADMIN, 'select * from public.leads') === 1 && n(STU, 'select * from public.leads') === 0 && n(null, 'select * from public.leads') === 0, 'only the admin reads the list');
  check(val(ADMIN, "with x as (update public.leads set status = 'contacted', admin_note = 'called' returning 1) select count(*) from x;") === '1' && val(STU, "with x as (update public.leads set status = 'no' returning 1) select count(*) from x;") === '0', 'only the admin updates it');
  // phone alerts
  sql("insert into public.push_keys (public_key, private_key) values ('pub', 'priv-key-123'); insert into public.push_subs (endpoint, user_id, sub) values ('https://push/1', '" + STU + "', '{}');");
  check(n(STU, 'select * from public.push_subs') === 0 && n(ADMIN, 'select * from public.push_keys') === 0 && refused(as(STU, "insert into public.push_subs (endpoint, user_id, sub) values ('https://push/2', '" + STU + "', '{}');")), 'the phone-alert tables: the app can’t read or write them (only the function)');
  check(refused(as(ADMIN, "select public.code_owner('MAYA88');")), 'code_owner (which coach a code belongs to) can’t be called from the app');
  r = sql(SQL('supabase/player-alerts.sql'));
  check(!r.err && sql("select count(*) from cron.job where jobname = 'rank-up-player-alerts' and schedule = '5 * * * *';").out === '1', 'player-alerts.sql: the hourly job at :05');
  sql('select public.player_alerts();');
  const call = JSON.parse(sql("select body from net.calls order by id desc limit 1;").out || '{}');
  check(call.action === 'players' && call.secret === crypto.createHash('sha256').update('priv-key-123').digest('hex'), 'it calls the push function with the secret made from its signing key');
  check(refused(as(ADMIN, 'select public.player_alerts();')), 'and no account can call it');
  // the hourly Lichess sync
  r = sql(SQL('supabase/lichess-sync.sql')); const r2 = sql(SQL('supabase/lichess-sync.sql'));
  check(!r.err && !r2.err && sql("select count(*) from cron.job where jobname = 'rank-up-lichess' and schedule = '35 * * * *';").out === '1', 'lichess-sync.sql runs (twice, safely): the hourly job at :35' + (r.err || r2.err ? ': ' + (r.err || r2.err).split('\n').find(l => /ERROR/.test(l)) : ''));
  const lsecret = sql('select secret from public.lichess_job;').out;
  check(/^[0-9a-f]{64}$/.test(lsecret) && sql('select count(*) from public.lichess_job;').out === '1', 'it makes one secret, and keeps it when run again');
  check((refused(as(ADMIN, 'select * from public.lichess_job;')) || n(ADMIN, 'select * from public.lichess_job') === 0) && (refused(as(null, 'select * from public.lichess_job;')) || n(null, 'select * from public.lichess_job') === 0), 'no account can read the secret');
  sql('select public.lichess_sync();');
  const lcall = sql("select url || ' ' || body::text from net.calls order by id desc limit 1;").out;
  check(/\/functions\/v1\/lichess /.test(lcall) && JSON.parse(lcall.replace(/^\S+ /, '')).secret === crypto.createHash('sha256').update(lsecret).digest('hex'), 'it calls the lichess function with the secret’s hash');
  check(refused(as(ADMIN, 'select public.lichess_sync();')), 'and no account can call it');
  // ---- a database from before several coaches ----
  fresh('rankup_old');
  const OLD = id('9');
  sql("insert into auth.users (id, email) values ('" + OLD + "', 'old@x.co'); create table public.coach (user_id uuid primary key, created_at timestamptz default now()); insert into public.coach (user_id) values ('" + OLD + "');" +
    "create table public.docs (col text not null, id text not null, data jsonb not null default '{}', updated_at timestamptz not null default now(), primary key (col, id));" +
    "insert into public.docs values ('portal', 'u1', '{\"code\":\"X1\",\"linked\":true}'); create table public.backups (day date primary key, data jsonb not null, created_at timestamptz not null default now()); insert into public.backups (day, data) values (current_date - 1, '{}');");
  r = sql(SQL('supabase/schema.sql'));
  check(!r.err, 'schema.sql moves a database from before several coaches' + (r.err ? ': ' + r.err.split('\n').find(l => /ERROR/.test(l)) : ''));
  check(sql("select is_admin from public.coaches where user_id = '" + OLD + "';").out === 't' && sql("select data->>'coach' from public.docs where col = 'portal' and id = 'u1';").out === OLD && sql("select count(*) from public.backups where coach = '" + OLD + "';").out === '2', 'that coach becomes the admin; their students’ links and backups stay theirs');
  if (!process.env.KEEPDB) { run('drop database if exists rankup_old;', 'postgres'); run('drop database if exists rankup_test;', 'postgres'); }
  done();
})();

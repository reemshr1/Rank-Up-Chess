-- Rank Up — database setup for Supabase.
-- Paste all of this into Supabase → SQL Editor → New query, and click Run.
-- Safe to run again: it only creates what is missing and refreshes the access rules.
-- Run on a database from before there were several coaches, it moves it over: that coach becomes the first coach
-- (and the admin), and their students, parents and backups stay theirs.

-- Coaches. Each coach has their own board; no coach can see another coach's records, students or backups.
-- A new coach joins with a coach code made by the app's admin (Settings → Coaches); everyone else who signs in
-- is a student or parent and connects with the invite code their coach gave them.
create table if not exists public.coaches (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.coaches enable row level security;
drop policy if exists "a coach sees their own row" on public.coaches;
create policy "a coach sees their own row" on public.coaches
  for select to authenticated using (user_id = auth.uid());

-- Before there were several coaches there was one, in public.coach: they become the first coach and the admin.
do $$ begin
  if to_regclass('public.coach') is not null and (select relkind from pg_class where oid = 'public.coach'::regclass) = 'r' then
    insert into public.coaches (user_id, is_admin, created_at) select user_id, true, created_at from public.coach
      on conflict (user_id) do update set is_admin = true;
    alter table public.coach rename to coach_before_multi;
    -- and every student's and parent's link is theirs
    if to_regclass('public.docs') is not null then
      update public.docs set data = data || jsonb_build_object('coach', (select user_id::text from public.coach_before_multi))
       where col = 'portal' and not (data ? 'coach');
    end if;
  end if;
end $$;
-- Kept under the old name for an app or phone-alert function that hasn't been updated yet: it shows the admin only,
-- so they keep working exactly as before.
create or replace view public.coach as select user_id from public.coaches where is_admin;
grant select on public.coach to authenticated;

create or replace function public.is_coach() returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (select 1 from public.coaches where user_id = auth.uid()) $$;
create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (select 1 from public.coaches where user_id = auth.uid() and is_admin) $$;

-- Coach codes: the admin makes one per new coach. A code works once.
create table if not exists public.coach_codes (
  code text primary key check (code ~ '^[A-Z0-9]{6,12}$'),
  note text not null default '',
  made_at timestamptz not null default now(),
  used_by uuid references auth.users(id) on delete set null,
  used_email text,
  used_at timestamptz
);
alter table public.coach_codes enable row level security;
drop policy if exists "the admin sees the coach codes" on public.coach_codes;
create policy "the admin sees the coach codes" on public.coach_codes
  for select to authenticated using (public.is_admin());
drop policy if exists "the admin makes coach codes" on public.coach_codes;
create policy "the admin makes coach codes" on public.coach_codes
  for insert to authenticated with check (public.is_admin() and used_by is null);
drop policy if exists "the admin removes unused coach codes" on public.coach_codes;
create policy "the admin removes unused coach codes" on public.coach_codes
  for delete to authenticated using (public.is_admin() and used_by is null);

-- Signing up as a coach with a code: true if this account is now a coach.
create or replace function public.become_coach(code text) returns boolean
  language plpgsql security definer set search_path = public
  as $$
declare me uuid := auth.uid(); c text := upper(regexp_replace(coalesce(code, ''), '\s', '', 'g'));
begin
  if me is null then return false; end if;
  if exists (select 1 from public.coaches where user_id = me) then return true; end if;
  -- a brand-new install: the first coach needs no code and becomes the admin
  if not exists (select 1 from public.coaches) then
    insert into public.coaches (user_id, is_admin) values (me, true) on conflict do nothing;
    return true;
  end if;
  update public.coach_codes set used_by = me, used_at = now(),
         used_email = (select email from auth.users where id = me)
   where coach_codes.code = c and used_by is null and used_at is null; -- a code works once, even if that account is deleted later
  if not found then return false; end if;
  insert into public.coaches (user_id) values (me) on conflict do nothing;
  return true;
end $$;
revoke execute on function public.become_coach(text) from public, anon;
grant execute on function public.become_coach(text) to authenticated;

-- The coaches who joined, for the admin's list in Settings → Coaches: email, name, when they joined, how many students.
create or replace function public.coach_list() returns table (user_id uuid, email text, name text, joined timestamptz, is_admin boolean, students integer)
  language sql stable security definer set search_path = public
  as $$
  select k.user_id, u.email::text, coalesce(s.data->>'coachName', ''), k.created_at, k.is_admin,
         (select count(*)::int from public.docs d where d.col = 'data/users/' || k.user_id::text and d.id like 'st-%')
    from public.coaches k join auth.users u on u.id = k.user_id
    left join public.docs s on s.col = 'data/users/' || k.user_id::text and s.id = 'settings'
   where public.is_admin()
   order by k.created_at
  $$;
revoke execute on function public.coach_list() from public, anon;
grant execute on function public.coach_list() to authenticated;

-- The admin removes a coach (never themselves or another admin). Without wipe only the coach access goes: their
-- records stay, and a new coach code brings them back. With wipe their account and everything of theirs is deleted:
-- their records, their students' and parents' links and pages, and their backups.
create or replace function public.remove_coach(target uuid, wipe boolean) returns boolean
  language plpgsql security definer set search_path = public
  as $$
declare who text := target::text;
begin
  if not public.is_admin() or target is null or target = auth.uid() then return false; end if;
  if not exists (select 1 from public.coaches where user_id = target and not is_admin) then return false; end if;
  delete from public.coaches where user_id = target;
  if wipe then
    delete from public.docs where col like 'portal/%'
       and split_part(col, '/', 2) in (select id from public.docs where col = 'portal' and data->>'coach' = who);
    delete from public.docs where col = 'portal' and data->>'coach' = who;
    delete from public.docs where col = 'data/users/' || who or col like 'data/users/' || who || '/%';
    begin -- their book PDFs; a project that only allows deleting files through the Storage API keeps them, unreachable
      delete from storage.objects where bucket_id = 'books' and owner_id = who;
    exception when others then null; end;
    delete from auth.users where id = target; -- with it go their backups, phone alerts and coach code use
  end if;
  return true;
end $$;
revoke execute on function public.remove_coach(uuid, boolean) from public, anon;
grant execute on function public.remove_coach(uuid, boolean) to authenticated;

-- Every record is one JSON document in a collection, the same shape the app already uses:
--   data/users/<coach id>/...      the coach's records (students, settings, assignments, games)
--   portal/<user id>               a student's or parent's link to their coach (their invite code; "coach" says whose)
--   portal/<user id>/view/...      what the coach shares with that student or parent
--   portal/<user id>/inbox/...     changes the student or parent sends to the coach
create table if not exists public.docs (
  col text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (col, id)
);
alter table public.docs enable row level security;
alter table public.docs replica identity full;

-- Which coach a student's or parent's account belongs to: set here from the invite code they typed, never by the app.
-- The code is looked up in every coach's records: a student's invite, a family's invite, or a code already used
-- (so that coach's app can say "already used"). A code nobody has is answered "not recognised" right here.
create index if not exists docs_invite_code on public.docs ((data->'invite'->>'code')) where col like 'data/users/%';
create or replace function public.code_owner(c text) returns text
  language sql stable security definer set search_path = public
  as $$
  select substr(col, 12) from (
    select col, 1 as pri from public.docs where col like 'data/users/%' and data->'invite'->>'code' = c
    union all select col, 1 from public.docs where col like 'data/users/%' and id = 'settings'
      and data->'families' @> jsonb_build_array(jsonb_build_object('invite', jsonb_build_object('code', c)))
    union all select col, 2 from public.docs where col like 'data/users/%' and id = 'settings'
      and data->'usedCodes' @> jsonb_build_array(jsonb_build_object('code', c))
  ) m where position('/' in substr(col, 12)) = 0 and c <> '' order by pri limit 1
  $$;
revoke execute on function public.code_owner(text) from public, anon, authenticated;

create or replace function public.portal_coach() returns trigger
  language plpgsql security definer set search_path = public
  as $$
declare prev jsonb; old_coach text; old_code text;
        c text := upper(trim(coalesce(new.data->>'code', ''))); who text;
begin
  if new.col <> 'portal' then return new; end if;
  -- a save from the app is an insert that becomes an update when the link is already there: use what is there
  if tg_op = 'UPDATE' then prev := old.data;
  else select d.data into prev from public.docs d where d.col = new.col and d.id = new.id; end if;
  old_coach := prev->>'coach'; old_code := coalesce(prev->>'code', '');
  if old_coach is not null and (auth.uid()::text = old_coach or c = old_code or c = '') then
    who := old_coach; -- the coach's own app writing, or nothing new typed: stays with the same coach
  else
    who := public.code_owner(c);
  end if;
  new.data := new.data - 'coach';
  if who is not null then new.data := new.data || jsonb_build_object('coach', who);
  elsif c <> '' and coalesce(new.data->>'linked', '') <> 'true' then
    new.data := new.data || jsonb_build_object('error', c, 'errorKind', 'wrong');
  end if;
  return new;
end $$;
drop trigger if exists portal_coach on public.docs;
create trigger portal_coach before insert or update on public.docs
  for each row execute function public.portal_coach();

-- A student who typed the code a moment before the coach's app saved the invite is picked up when it is saved.
create or replace function public.claim_waiting_links() returns trigger
  language plpgsql security definer set search_path = public
  as $$
declare who text := substr(new.col, 12); codes text[];
begin
  if new.col not like 'data/users/%' or position('/' in who) > 0 then return new; end if;
  codes := array_remove(array[new.data->'invite'->>'code'], null)
        || coalesce((select array_agg(f->'invite'->>'code') from jsonb_array_elements(case when jsonb_typeof(new.data->'families') = 'array' then new.data->'families' else '[]'::jsonb end) f
                     where f->'invite'->>'code' is not null), '{}');
  if cardinality(codes) = 0 then return new; end if;
  update public.docs set data = (data - 'error' - 'errorKind') || jsonb_build_object('coach', who)
   where col = 'portal' and not (data ? 'coach') and coalesce(data->>'linked', '') <> 'true'
     and upper(trim(coalesce(data->>'code', ''))) = any (codes);
  return new;
end $$;
drop trigger if exists claim_waiting_links on public.docs;
create trigger claim_waiting_links after insert or update on public.docs
  for each row when (new.col like 'data/users/%') execute function public.claim_waiting_links();

-- The portal account a collection belongs to (portal/<id>/view, portal/<id>/inbox) is one of the signed-in coach's.
create or replace function public.my_portal(c text) returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (select 1 from public.docs d where d.col = 'portal' and d.id = split_part(c, '/', 2)
                         and d.data->>'coach' = auth.uid()::text and public.is_coach()) $$;

drop policy if exists "the coach can do everything" on public.docs;
drop policy if exists "a coach keeps their own records" on public.docs;
create policy "a coach keeps their own records" on public.docs
  for all to authenticated
  using (public.is_coach() and (col = 'data/users/' || auth.uid()::text or col like 'data/users/' || auth.uid()::text || '/%'))
  with check (public.is_coach() and (col = 'data/users/' || auth.uid()::text or col like 'data/users/' || auth.uid()::text || '/%'));
drop policy if exists "a coach sees and answers their students' links" on public.docs;
create policy "a coach sees and answers their students' links" on public.docs
  for all to authenticated
  using (col = 'portal' and data->>'coach' = auth.uid()::text and public.is_coach())
  with check (col = 'portal' and data->>'coach' = auth.uid()::text and public.is_coach());
drop policy if exists "a coach writes their students' pages and reads their messages" on public.docs;
create policy "a coach writes their students' pages and reads their messages" on public.docs
  for all to authenticated
  using (col like 'portal/%' and (col like '%/view' or col like '%/inbox') and public.my_portal(col))
  with check (col like 'portal/%' and (col like '%/view' or col like '%/inbox') and public.my_portal(col));

drop policy if exists "students and parents read their own pages" on public.docs;
create policy "students and parents read their own pages" on public.docs
  for select to authenticated using (
    (col = 'portal' and id = auth.uid()::text)
    or col = 'portal/' || auth.uid()::text || '/view'
    or col = 'portal/' || auth.uid()::text || '/inbox');

drop policy if exists "students and parents add their link and messages" on public.docs;
create policy "students and parents add their link and messages" on public.docs
  for insert to authenticated with check (
    (col = 'portal' and id = auth.uid()::text)
    or col = 'portal/' || auth.uid()::text || '/inbox');

drop policy if exists "students and parents update their link and messages" on public.docs;
create policy "students and parents update their link and messages" on public.docs
  for update to authenticated
  using ((col = 'portal' and id = auth.uid()::text) or col = 'portal/' || auth.uid()::text || '/inbox')
  with check ((col = 'portal' and id = auth.uid()::text) or col = 'portal/' || auth.uid()::text || '/inbox');

drop policy if exists "students and parents remove their messages" on public.docs;
create policy "students and parents remove their messages" on public.docs
  for delete to authenticated using (col = 'portal/' || auth.uid()::text || '/inbox');

-- Live updates, so changes appear on other devices without reloading.
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-- Phone alerts (the "push" Edge Function). The function keeps its signing keys and each device's
-- push address here. No access rules on purpose: the app can't read these tables, only the function can.
create table if not exists public.push_keys (
  one boolean primary key default true check (one),
  public_key text not null,
  private_key text not null
);
alter table public.push_keys enable row level security;
create table if not exists public.push_subs (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  sub jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.push_subs enable row level security;

-- Nightly backups. Every night at 00:00 UTC (02:00 or 03:00 in Israel) a copy of each coach's records is
-- saved here, and copies older than 30 days are removed. A coach sees their own in Settings → Backup and can
-- download any of them. Nobody else can read them, and nobody can change them from the app.
create table if not exists public.backups (
  coach uuid not null references auth.users(id) on delete cascade,
  day date not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  primary key (coach, day)
);
-- backups from before there were several coaches belong to the first coach
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'backups' and column_name = 'coach') then
    alter table public.backups add column coach uuid references auth.users(id) on delete cascade;
    update public.backups set coach = (select user_id from public.coaches where is_admin order by created_at limit 1);
    delete from public.backups where coach is null;
    alter table public.backups alter column coach set not null;
    alter table public.backups drop constraint if exists backups_pkey;
    alter table public.backups add primary key (coach, day);
  end if;
end $$;
alter table public.backups enable row level security;
drop policy if exists "the coach can read the backups" on public.backups;
drop policy if exists "a coach reads their own backups" on public.backups;
create policy "a coach reads their own backups" on public.backups
  for select to authenticated using (coach = auth.uid());

create or replace function public.nightly_backup() returns void
  language plpgsql security definer set search_path = public
  as $$
declare d date := (now() at time zone 'Asia/Jerusalem')::date;
begin
  insert into public.backups (coach, day, data)
    select k.user_id, d, jsonb_build_object('app', 'rank-up', 'kind', 'nightly', 'exportedAt', now(),
                                 'docs', coalesce((select jsonb_object_agg(id, data) from public.docs
                                                   where col = 'data/users/' || k.user_id::text and id not like 'lock-%'), '{}'::jsonb))
    from public.coaches k
  on conflict (coach, day) do update set data = excluded.data, created_at = now();
  delete from public.backups where day < d - 30;
end $$;
revoke execute on function public.nightly_backup() from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('rank-up-nightly-backup', '0 0 * * *', 'select public.nightly_backup()');
select public.nightly_backup(); -- the first copy, right away

-- Book PDFs. The coach uploads a book's PDF into the private "books" storage folder, as <student id>/<book id>.pdf.
-- A coach can add, replace and remove their own; a student (or their parent) can only open the files of their own books.
-- Files are opened through a link that works for an hour. Up to 50 MB each, PDF only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('books', 'books', false, 52428800, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Each coach manages only the files they uploaded.
drop policy if exists "rank-up: the coach manages book files" on storage.objects;
drop policy if exists "rank-up: a coach adds book files" on storage.objects;
create policy "rank-up: a coach adds book files" on storage.objects
  for insert to authenticated with check (bucket_id = 'books' and public.is_coach());
drop policy if exists "rank-up: a coach manages their own book files" on storage.objects;
create policy "rank-up: a coach manages their own book files" on storage.objects
  for all to authenticated
  using (bucket_id = 'books' and public.is_coach() and owner_id = auth.uid()::text)
  with check (bucket_id = 'books' and public.is_coach() and owner_id = auth.uid()::text);

drop policy if exists "rank-up: students and parents open their book files" on storage.objects;
create policy "rank-up: students and parents open their book files" on storage.objects
  for select to authenticated
  using (bucket_id = 'books' and exists (
    select 1 from public.docs d
    where d.col = 'portal/' || auth.uid()::text || '/view'
      and ((d.id = 'student' and d.data->>'id' = (storage.foldername(name))[1])
        or d.id = 'ch-' || (storage.foldername(name))[1])));

-- Coaches who left their details on the website (welcome/). Anyone can send the form; only the admin can read
-- the list (Settings → Coaches) and remove rows. Nothing else can be read or changed from outside.
create table if not exists public.leads (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  phone text not null check (char_length(phone) between 9 and 30),
  email text not null check (char_length(email) <= 120 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  city text not null default '' check (char_length(city) <= 60),
  students text not null default '' check (students in ('', '1-5', '6-15', '16-30', '30+')),
  kind text not null default '' check (kind in ('', 'private', 'club', 'both')),
  note text not null default '' check (char_length(note) <= 500),
  lang text not null default 'he' check (lang in ('he', 'en'))
);
alter table public.leads enable row level security;
grant insert on public.leads to anon, authenticated;
drop policy if exists "anyone can leave their details" on public.leads;
create policy "anyone can leave their details" on public.leads
  for insert to anon, authenticated with check (true);
drop policy if exists "the admin reads the details left" on public.leads;
create policy "the admin reads the details left" on public.leads
  for select to authenticated using (public.is_admin());
drop policy if exists "the admin removes details left" on public.leads;
create policy "the admin removes details left" on public.leads
  for delete to authenticated using (public.is_admin());

-- Rank Up — database setup for Supabase.
-- Paste all of this into Supabase → SQL Editor → New query, and click Run.
-- Safe to run again: it only creates what is missing and refreshes the access rules.

-- The coach: one account, claimed by the first sign-in on a fresh install.
create table if not exists public.coach (
  one boolean primary key default true check (one),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.coach enable row level security;
drop policy if exists "anyone signed in can see who the coach is" on public.coach;
create policy "anyone signed in can see who the coach is" on public.coach
  for select to authenticated using (true);
drop policy if exists "the first account can become the coach" on public.coach;
create policy "the first account can become the coach" on public.coach
  for insert to authenticated with check (user_id = auth.uid());

create or replace function public.is_coach() returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (select 1 from public.coach where user_id = auth.uid()) $$;

-- Every record is one JSON document in a collection, the same shape the app already uses:
--   data/users/<coach id>/...      the coach's records (students, settings, assignments, games)
--   portal/<user id>               a student's or parent's link to the coach (their invite code)
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

drop policy if exists "the coach can do everything" on public.docs;
create policy "the coach can do everything" on public.docs
  for all to authenticated using (public.is_coach()) with check (public.is_coach());

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

-- Nightly backups. Every night at 00:00 UTC (02:00 or 03:00 in Israel) a copy of all the coach's records is
-- saved here, and copies older than 30 days are removed. The coach sees them in Settings → Backup and can
-- download any of them. Only the coach can read them; nobody can change them from the app.
create table if not exists public.backups (
  day date primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.backups enable row level security;
drop policy if exists "the coach can read the backups" on public.backups;
create policy "the coach can read the backups" on public.backups
  for select to authenticated using (public.is_coach());

create or replace function public.nightly_backup() returns void
  language plpgsql security definer set search_path = public
  as $$
declare c text; d date := (now() at time zone 'Asia/Jerusalem')::date;
begin
  select 'data/users/' || user_id::text into c from public.coach;
  if c is null then return; end if;
  insert into public.backups (day, data)
    select d, jsonb_build_object('app', 'rank-up', 'kind', 'nightly', 'exportedAt', now(),
                                 'docs', coalesce(jsonb_object_agg(id, data), '{}'::jsonb))
    from public.docs where col = c and id not like 'lock-%'
  on conflict (day) do update set data = excluded.data, created_at = now();
  delete from public.backups where day < d - 30;
end $$;
revoke execute on function public.nightly_backup() from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('rank-up-nightly-backup', '0 0 * * *', 'select public.nightly_backup()');
select public.nightly_backup(); -- the first copy, right away

-- Book PDFs. The coach uploads a book's PDF into the private "books" storage folder, as <student id>/<book id>.pdf.
-- The coach can add, replace and remove them; a student (or their parent) can only open the files of their own books.
-- Files are opened through a link that works for an hour. Up to 50 MB each, PDF only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('books', 'books', false, 52428800, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "rank-up: the coach manages book files" on storage.objects;
create policy "rank-up: the coach manages book files" on storage.objects
  for all to authenticated
  using (bucket_id = 'books' and public.is_coach())
  with check (bucket_id = 'books' and public.is_coach());

drop policy if exists "rank-up: students and parents open their book files" on storage.objects;
create policy "rank-up: students and parents open their book files" on storage.objects
  for select to authenticated
  using (bucket_id = 'books' and exists (
    select 1 from public.docs d
    where d.col = 'portal/' || auth.uid()::text || '/view'
      and ((d.id = 'student' and d.data->>'id' = (storage.foldername(name))[1])
        or d.id = 'ch-' || (storage.foldername(name))[1])));

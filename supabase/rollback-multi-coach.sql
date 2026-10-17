-- Rank Up — undo the move to several coaches (only if something went wrong right after running schema.sql).
-- Paste into Supabase → SQL Editor and Run. Afterwards the app from before several coaches works again:
-- the first coach (the admin) is the only coach, with all their records, students and backups.
-- Other coaches' records stay in the database but nobody but the first coach can open them.

-- the single coach again
drop view if exists public.coach;
do $$ begin
  if to_regclass('public.coach_before_multi') is not null then
    alter table public.coach_before_multi rename to coach;
  else
    create table public.coach (
      one boolean primary key default true check (one),
      user_id uuid not null unique references auth.users(id) on delete cascade,
      created_at timestamptz not null default now());
    insert into public.coach (user_id) select user_id from public.coaches where is_admin order by created_at limit 1;
  end if;
end $$;
alter table public.coach enable row level security;
drop policy if exists "anyone signed in can see who the coach is" on public.coach;
create policy "anyone signed in can see who the coach is" on public.coach for select to authenticated using (true);
drop policy if exists "the first account can become the coach" on public.coach;
create policy "the first account can become the coach" on public.coach for insert to authenticated with check (user_id = auth.uid());
create or replace function public.is_coach() returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (select 1 from public.coach where user_id = auth.uid()) $$;

-- the records' access rules as before
drop trigger if exists portal_coach on public.docs;
drop trigger if exists claim_waiting_links on public.docs;
drop policy if exists "a coach keeps their own records" on public.docs;
drop policy if exists "a coach sees and answers their students' links" on public.docs;
drop policy if exists "a coach writes their students' pages and reads their messages" on public.docs;
drop policy if exists "the coach can do everything" on public.docs;
create policy "the coach can do everything" on public.docs
  for all to authenticated using (public.is_coach()) with check (public.is_coach());

-- backups: the first coach's, by day
drop policy if exists "a coach reads their own backups" on public.backups;
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'backups' and column_name = 'coach') then
    delete from public.backups where coach <> (select user_id from public.coach);
    alter table public.backups drop constraint if exists backups_pkey;
    alter table public.backups drop column coach;
    alter table public.backups add primary key (day);
  end if;
end $$;
drop policy if exists "the coach can read the backups" on public.backups;
create policy "the coach can read the backups" on public.backups for select to authenticated using (public.is_coach());
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

-- book files: the coach manages all of them
drop policy if exists "rank-up: a coach adds book files" on storage.objects;
drop policy if exists "rank-up: a coach manages their own book files" on storage.objects;
drop policy if exists "rank-up: the coach manages book files" on storage.objects;
create policy "rank-up: the coach manages book files" on storage.objects
  for all to authenticated
  using (bucket_id = 'books' and public.is_coach())
  with check (bucket_id = 'books' and public.is_coach());

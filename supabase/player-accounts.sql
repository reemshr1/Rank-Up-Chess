-- Run this once in Supabase → SQL Editor to turn on player accounts (player codes from the admin page).
-- (The same lines are in schema.sql.)
-- Players: someone who follows their own chess without a coach. A player's account is like a coach's with one
-- student, themselves (so their records, backups and later moving to a coach work the same); "kind" tells them apart,
-- and a code says which kind of account it opens.
alter table public.coaches add column if not exists kind text not null default 'coach' check (kind in ('coach', 'player'));
alter table public.coach_codes add column if not exists kind text not null default 'coach' check (kind in ('coach', 'player'));

-- Signing up with a code: true if this account is now a coach (or a player, for a player code).
create or replace function public.become_coach(code text) returns boolean
  language plpgsql security definer set search_path = public
  as $$
declare me uuid := auth.uid(); c text := upper(regexp_replace(coalesce(code, ''), '\s', '', 'g')); k text;
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
   where coach_codes.code = c and used_by is null and used_at is null -- a code works once, even if that account is deleted later
   returning coach_codes.kind into k;
  if not found then return false; end if;
  insert into public.coaches (user_id, kind) values (me, coalesce(k, 'coach')) on conflict do nothing;
  return true;
end $$;
revoke execute on function public.become_coach(text) from public, anon;
grant execute on function public.become_coach(text) to authenticated;

drop function if exists public.coach_list();
create or replace function public.coach_list() returns table (user_id uuid, email text, name text, joined timestamptz, is_admin boolean, students integer, kind text)
  language sql stable security definer set search_path = public
  as $$
  select k.user_id, u.email::text, coalesce(s.data->>'coachName', ''), k.created_at, k.is_admin,
         (select count(*)::int from public.docs d where d.col = 'data/users/' || k.user_id::text and d.id like 'st-%'), k.kind
    from public.coaches k join auth.users u on u.id = k.user_id
    left join public.docs s on s.col = 'data/users/' || k.user_id::text and s.id = 'settings'
   where public.is_admin()
   order by k.created_at
  $$;
revoke execute on function public.coach_list() from public, anon;
grant execute on function public.coach_list() to authenticated;

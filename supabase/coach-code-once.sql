-- Run this once in Supabase → SQL Editor: a coach code can't be used again after the account that used it is deleted.
-- (The same function is in schema.sql.)
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

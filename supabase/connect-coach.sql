-- Run this once in Supabase → SQL Editor to turn on "Connect to a coach" for players.
-- (The same lines are in schema.sql.)
-- A player who moved to a coach: their account is now that coach's student (or a parent in a family), and their old
-- player records stay as a hidden copy (the admin can delete it). Such an account is no longer a coach for anything.
alter table public.coaches drop constraint if exists coaches_kind_check;
alter table public.coaches add constraint coaches_kind_check check (kind in ('coach', 'player', 'moved'));
create or replace function public.is_coach() returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (select 1 from public.coaches where user_id = auth.uid() and kind <> 'moved') $$;

-- "Connect to a coach": once their link has a coach, a player's account stops being a player's board.
create or replace function public.leave_player() returns boolean
  language plpgsql security definer set search_path = public
  as $$
begin
  if auth.uid() is null then return false; end if;
  if not exists (select 1 from public.docs where col = 'portal' and id = auth.uid()::text and data ? 'coach') then return false; end if;
  update public.coaches set kind = 'moved' where user_id = auth.uid() and kind = 'player' and not is_admin;
  return found;
end $$;
revoke execute on function public.leave_player() from public, anon;
grant execute on function public.leave_player() to authenticated;

-- Signing up with a code: true if this account is now a coach (or a player, for a player code).
create or replace function public.become_coach(code text) returns boolean
  language plpgsql security definer set search_path = public
  as $$
declare me uuid := auth.uid(); c text := upper(regexp_replace(coalesce(code, ''), '\s', '', 'g')); k text;
begin
  if me is null then return false; end if;
  if exists (select 1 from public.coaches where user_id = me and kind <> 'moved') then return true; end if;
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
  insert into public.coaches (user_id, kind) values (me, coalesce(k, 'coach'))
    on conflict (user_id) do update set kind = excluded.kind; -- a player who moved to a coach can open a board again
  return true;
end $$;
revoke execute on function public.become_coach(text) from public, anon;
grant execute on function public.become_coach(text) to authenticated;

-- The admin's Remove on a player who moved to a coach deletes only the hidden copy of their old board.
create or replace function public.remove_coach(target uuid, wipe boolean) returns boolean
  language plpgsql security definer set search_path = public
  as $$
declare who text := target::text;
begin
  if not public.is_admin() or target is null or target = auth.uid() then return false; end if;
  if not exists (select 1 from public.coaches where user_id = target and not is_admin) then return false; end if;
  -- a player who moved to a coach: only the hidden copy of their old board goes; their account is now a student's
  if exists (select 1 from public.coaches where user_id = target and kind = 'moved') then
    delete from public.coaches where user_id = target;
    delete from public.docs where col = 'data/users/' || who or col like 'data/users/' || who || '/%';
    return true;
  end if;
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

-- Which coach a link belongs to: a wrong code never takes away the coach someone already has.
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
    if who is null then
      if c <> '' and coalesce(new.data->>'linked', '') <> 'true' then
        new.data := new.data || jsonb_build_object('error', c, 'errorKind', 'wrong');
      end if;
      who := old_coach; -- a wrong code never takes away the coach they have
    end if;
  end if;
  new.data := new.data - 'coach';
  if who is not null then new.data := new.data || jsonb_build_object('coach', who); end if;
  return new;
end $$;

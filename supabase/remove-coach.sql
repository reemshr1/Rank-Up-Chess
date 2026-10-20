-- Run this once in Supabase → SQL Editor to turn on "Remove coach" in Settings → Coaches.
-- (The same functions are in schema.sql, for a new install.)
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

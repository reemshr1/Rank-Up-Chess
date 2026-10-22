-- Run this once in Supabase → SQL Editor for players' book PDFs. (The same lines are in schema.sql.)
-- A player (who has their own board, like a coach's) attaches PDFs to their own books. When they move to a coach,
-- that coach's app copies those PDFs into the coach's own files: a coach may open the files of an account linked
-- to them as a student or parent (only players ever upload, so these are a moving player's own PDFs).
create or replace function public.my_students_file(owner text) returns boolean
  language sql stable security definer set search_path = public
  as $$ select public.is_coach() and exists (select 1 from public.docs d where d.col = 'portal' and d.id = owner
                                                and d.data->>'coach' = auth.uid()::text) $$;
revoke execute on function public.my_students_file(text) from public, anon;
grant execute on function public.my_students_file(text) to authenticated;
drop policy if exists "rank-up: a coach copies the PDFs of a player who moved to them" on storage.objects;
create policy "rank-up: a coach copies the PDFs of a player who moved to them" on storage.objects
  for select to authenticated
  using (bucket_id = 'books' and owner_id is not null and public.my_students_file(owner_id));

-- The admin's "Delete the copy" on a player who moved to a coach also deletes the PDFs of their old books.
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
    begin -- and the PDFs of their old books (their coach has their own copies)
      delete from storage.objects where bucket_id = 'books' and owner_id = who;
    exception when others then null; end;
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

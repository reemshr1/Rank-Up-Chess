-- Run this once in Supabase → SQL Editor, so players can close their own account (Progress → Your data → Close my account).
-- (It is also in schema.sql.)
-- A player closes their own account: their board (every child on a parent's board), book PDFs, nightly copies and
-- phone alerts go for good, and so does the account. The children's own sign-ins are told their access ended, and
-- what those apps showed them goes too. Only a player's account (not a coach's, nor a student's) can close itself.
create or replace function public.close_player() returns boolean
  language plpgsql security definer set search_path = public
  as $$
declare me uuid := auth.uid(); who text := auth.uid()::text;
begin
  if me is null then return false; end if;
  if not exists (select 1 from public.coaches where user_id = me and kind = 'player' and not is_admin) then return false; end if;
  delete from public.docs where col like 'portal/%'
     and split_part(col, '/', 2) in (select id from public.docs where col = 'portal' and data->>'coach' = who);
  update public.docs set data = jsonb_build_object('linked', false, 'unlinked', true) where col = 'portal' and data->>'coach' = who;
  delete from public.docs where col = 'data/users/' || who or col like 'data/users/' || who || '/%';
  delete from public.docs where (col = 'portal' and id = who) or col like 'portal/' || who || '/%';
  begin -- their book PDFs; a project that only allows deleting files through the Storage API keeps them, unreachable
    delete from storage.objects where bucket_id = 'books' and owner_id = who;
  exception when others then null; end;
  delete from public.coaches where user_id = me;
  delete from auth.users where id = me; -- with it go their nightly copies, phone alerts and player code use
  return true;
end $$;
revoke execute on function public.close_player() from public, anon;
grant execute on function public.close_player() to authenticated;

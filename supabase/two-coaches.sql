-- Run this once in Supabase → SQL Editor for students with more than one coach. (The same lines are in schema.sql.)
-- A student or parent can work with more than one coach: each coach is one link, portal/<user id> for the first and
-- portal/<user id>.<key> for each more. Every link has its own coach, pages and messages; the account's own app reads
-- all of its links. These say whether a link (or one of its collections) is the signed-in account's own.
create or replace function public.my_link_id(i text) returns boolean
  language sql stable set search_path = public
  as $$ select auth.uid() is not null and i ~ ('^' || auth.uid()::text || '([.][A-Za-z0-9_-]{1,40})?$') $$;
create or replace function public.my_link_col(c text, sub text) returns boolean
  language sql stable set search_path = public
  as $$ select auth.uid() is not null and c ~ ('^portal/' || auth.uid()::text || '([.][A-Za-z0-9_-]{1,40})?/' || sub || '$') $$;

drop policy if exists "students and parents read their own pages" on public.docs;
create policy "students and parents read their own pages" on public.docs
  for select to authenticated using (
    (col = 'portal' and public.my_link_id(id))
    or public.my_link_col(col, '(view|inbox)'));

drop policy if exists "students and parents add their link and messages" on public.docs;
create policy "students and parents add their link and messages" on public.docs
  for insert to authenticated with check (
    (col = 'portal' and public.my_link_id(id))
    or public.my_link_col(col, 'inbox'));

drop policy if exists "students and parents update their link and messages" on public.docs;
create policy "students and parents update their link and messages" on public.docs
  for update to authenticated
  using ((col = 'portal' and public.my_link_id(id)) or public.my_link_col(col, 'inbox'))
  with check ((col = 'portal' and public.my_link_id(id)) or public.my_link_col(col, 'inbox'));

-- Messages, and a link to another coach they added (never the first one, which their coach closes).
drop policy if exists "students and parents remove their messages" on public.docs;
create policy "students and parents remove their messages" on public.docs
  for delete to authenticated using (
    public.my_link_col(col, 'inbox')
    or (col = 'portal' and public.my_link_id(id) and id <> auth.uid()::text));

-- Book PDFs: a student (or parent) opens the files of any of their coaches' books.
drop policy if exists "rank-up: students and parents open their book files" on storage.objects;
create policy "rank-up: students and parents open their book files" on storage.objects
  for select to authenticated
  using (bucket_id = 'books' and exists (
    select 1 from public.docs d
    where public.my_link_col(d.col, 'view')
      and ((d.id = 'student' and d.data->>'id' = (storage.foldername(name))[1])
        or d.id = 'ch-' || (storage.foldername(name))[1])));

-- A coach copies the PDFs of a player who moved to them, through any of that account's links.
create or replace function public.my_students_file(owner text) returns boolean
  language sql stable security definer set search_path = public
  as $$ select public.is_coach() and exists (select 1 from public.docs d where d.col = 'portal' and split_part(d.id, '.', 1) = owner
                                                and d.data->>'coach' = auth.uid()::text) $$;
revoke execute on function public.my_students_file(text) from public, anon;
grant execute on function public.my_students_file(text) to authenticated;

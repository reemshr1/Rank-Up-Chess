-- Run this once in Supabase → SQL Editor to turn on the admin page's request tracking (admin/).
-- (The same lines are in schema.sql.)
-- The admin page (admin/) keeps track of each request: who it's from (a coach, a player, or a player's parent),
-- where it stands, the admin's own notes, and the code sent. Only the admin can change these; the form can't set them.
alter table public.leads add column if not exists who text not null default 'coach' check (who in ('coach', 'player', 'parent'));
alter table public.leads add column if not exists status text not null default 'new' check (status in ('new', 'contacted', 'code', 'joined', 'no'));
alter table public.leads add column if not exists admin_note text not null default '' check (char_length(admin_note) <= 1000);
alter table public.leads add column if not exists code text;
alter table public.leads add column if not exists updated_at timestamptz;
drop policy if exists "anyone can leave their details" on public.leads;
create policy "anyone can leave their details" on public.leads
  for insert to anon, authenticated with check (status = 'new' and admin_note = '' and code is null and updated_at is null);
drop policy if exists "the admin updates the details left" on public.leads;
create policy "the admin updates the details left" on public.leads
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
grant update on public.leads to authenticated;

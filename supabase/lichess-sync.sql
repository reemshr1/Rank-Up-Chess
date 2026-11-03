-- Run this once in Supabase → SQL Editor to add Lichess puzzles to practice logs every hour, even when nobody
-- opens the app (after making the "lichess" Edge Function: see supabase/functions/lichess/index.ts).
-- Every hour, at :35, the database calls the function with a secret that only the database and the function can
-- read, so nobody else can trigger it. Running this file again keeps one job and the same secret.
-- (Not in schema.sql: the address below is this project's own.)
create extension if not exists pg_net with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- The secret. No access rules on purpose: the app can't read it, only the database and the function can.
create table if not exists public.lichess_job (
  one boolean primary key default true check (one),
  secret text not null default encode(extensions.gen_random_bytes(32), 'hex')
);
alter table public.lichess_job enable row level security;
revoke all on public.lichess_job from anon, authenticated;
insert into public.lichess_job (one) values (true) on conflict do nothing;

create or replace function public.lichess_sync() returns void
  language plpgsql security definer set search_path = public
  as $$
declare k text;
begin
  select secret into k from public.lichess_job limit 1;
  if k is null then return; end if;
  perform net.http_post(
    url := 'https://gzcwvnynkcepvqkzwvkb.supabase.co/functions/v1/lichess',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('action', 'sync', 'secret', encode(extensions.digest(k, 'sha256'), 'hex')),
    timeout_milliseconds := 120000);
end $$;
revoke execute on function public.lichess_sync() from public, anon, authenticated;

select cron.schedule('rank-up-lichess', '35 * * * *', 'select public.lichess_sync()'); -- at :35 every hour (running it again keeps one job)

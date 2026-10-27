-- Run this once in Supabase → SQL Editor to send players without a coach their phone reminders.
-- Every hour the database calls the "push" function, which sends players their practice reminder (17:00) and the
-- evening-before reminders for a tournament or a task due (19:00, Israel time). Coaches' students get theirs from
-- the coach's app, as before. The call carries a secret made from the function's own signing key, which only the
-- database and the function can read, so nobody else can trigger it.
-- (Not in schema.sql: the address below is this project's own.)
create extension if not exists pg_net with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create or replace function public.player_alerts() returns void
  language plpgsql security definer set search_path = public
  as $$
declare k text;
begin
  select private_key into k from public.push_keys limit 1;
  if k is null then return; end if; -- nobody has turned phone alerts on yet
  perform net.http_post(
    url := 'https://gzcwvnynkcepvqkzwvkb.supabase.co/functions/v1/push',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('action', 'players', 'secret', encode(extensions.digest(k, 'sha256'), 'hex')),
    timeout_milliseconds := 60000);
end $$;
revoke execute on function public.player_alerts() from public, anon, authenticated;

select cron.schedule('rank-up-player-alerts', '5 * * * *', 'select public.player_alerts()'); -- at :05 every hour (running it again keeps one job)

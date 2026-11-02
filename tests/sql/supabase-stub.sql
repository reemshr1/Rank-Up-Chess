-- What a Supabase project has before schema.sql runs, as far as Rank Up's SQL uses it, for tests/db.test.js:
-- the roles, auth.users and auth.uid() (the signed-in account, set per test), Storage's buckets and objects,
-- the realtime publication, and stand-ins for pg_cron and pg_net (which record what they're asked to do).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
grant usage on schema public to anon, authenticated, service_role;
-- as on Supabase: the API roles may use every table, function and sequence in public; the access rules decide the rest
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;
create table if not exists auth.users (id uuid primary key, email text, created_at timestamptz not null default now());
create or replace function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;

create schema if not exists storage;
grant usage on schema storage to anon, authenticated, service_role;
create table if not exists storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text not null, owner_id text, created_at timestamptz default now(), unique (bucket_id, name));
alter table storage.objects enable row level security;
grant all on storage.objects to authenticated, service_role;
grant select on storage.buckets to authenticated;
create or replace function storage.foldername(name text) returns text[] language sql immutable
  as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;

do $$ begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then create publication supabase_realtime; end if;
end $$;

-- pg_cron and pg_net, as far as they're used: what's scheduled, and what would be sent
create schema if not exists cron;
create table if not exists cron.job (jobname text primary key, schedule text, command text);
create or replace function cron.schedule(job_name text, schedule text, command text) returns bigint language sql
  as $$ insert into cron.job values (job_name, schedule, command) on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command; select 1::bigint $$;
create schema if not exists net;
create table if not exists net.calls (id serial primary key, url text, headers jsonb, body jsonb, at timestamptz default now());
create or replace function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 2000) returns bigint language sql
  as $$ insert into net.calls (url, headers, body) values (url, headers, body) returning id::bigint $$;

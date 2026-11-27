-- 0001 — Extensions and shared helpers.
create extension if not exists postgis with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists citext with schema extensions;
create extension if not exists pgcrypto with schema extensions;
-- pg_cron is enabled from the Supabase dashboard (Database > Extensions); jobs are added in later migrations.

-- Private schema for helpers that must never be exposed through PostgREST.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to postgres, service_role;

-- Immutable wrapper so unaccent() can be used in generated columns and indexes.
create or replace function private.immutable_unaccent(text) returns text
language sql immutable parallel safe strict as $$
  select extensions.unaccent('extensions.unaccent', $1)
$$;

-- updated_at maintenance.
create or replace function private.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Current day in Paris time: every quota rule uses it.
create or replace function private.paris_today() returns date
language sql stable as $$
  select (now() at time zone 'Europe/Paris')::date
$$;

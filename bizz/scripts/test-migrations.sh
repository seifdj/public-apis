#!/usr/bin/env bash
# Runs every migration against a throwaway local Postgres (with PostGIS) that
# mimics the Supabase roles and `auth` schema, then executes smoke tests.
# Usage: npm run db:test   (needs a local `postgres` superuser via `sudo -u postgres psql` or PG* env vars)
set -euo pipefail
cd "$(dirname "$0")/.."
DB="bizz_migration_test"
PSQL=${PSQL:-"sudo -u postgres psql -v ON_ERROR_STOP=1 -q"}

$PSQL -c "drop database if exists $DB" >/dev/null
$PSQL -c "create database $DB" >/dev/null
P="$PSQL -d $DB"

# --- Supabase stub -----------------------------------------------------------
$P <<'SQL'
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then create role supabase_auth_admin nologin; end if;
end $$;
create schema if not exists extensions;
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key,
  phone text,
  phone_confirmed_at timestamptz,
  raw_user_meta_data jsonb default '{}'
);
create or replace function auth.uid() returns uuid language sql stable as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'sub')::uuid
$$;
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;
grant usage on schema extensions to public;
grant usage on schema auth to public;
alter default privileges in schema extensions grant execute on functions to public;
SQL

# --- Migrations, in order ----------------------------------------------------
for f in supabase/migrations/*.sql; do
  echo "→ $f"
  $P -f "$f" >/dev/null
done
$P -c "grant usage on schema extensions to authenticated, anon; grant execute on all functions in schema extensions to authenticated, anon;" >/dev/null

# --- Smoke tests -------------------------------------------------------------
$P <<'SQL'
\set ON_ERROR_STOP on
-- 1. A new auth user gets a profile.
insert into auth.users (id, phone, phone_confirmed_at) values ('00000000-0000-0000-0000-000000000001', '+33600000001', now());
insert into auth.users (id, phone) values ('00000000-0000-0000-0000-000000000002', '+33600000002');
do $$ begin
  assert (select count(*) from public.profiles) = 2, 'profiles not auto-created';
  assert (select phone_verified from public.profiles where id = '00000000-0000-0000-0000-000000000001'), 'phone_verified should be true';
  assert not (select phone_verified from public.profiles where id = '00000000-0000-0000-0000-000000000002'), 'phone_verified should be false';
end $$;

-- 2. Phone confirmation later flips the flag.
update auth.users set phone_confirmed_at = now() where id = '00000000-0000-0000-0000-000000000002';
do $$ begin
  assert (select phone_verified from public.profiles where id = '00000000-0000-0000-0000-000000000002'), 'phone_verified not synced';
end $$;

-- 3. Claims hook.
update public.profiles set is_moderator = true, moderation_scope = 'department', moderation_zone = '69' where id = '00000000-0000-0000-0000-000000000001';
do $$ declare out jsonb; begin
  out := public.auth_hook_add_claims('{"user_id":"00000000-0000-0000-0000-000000000001","claims":{"sub":"00000000-0000-0000-0000-000000000001","app_metadata":{}}}');
  assert out->'claims'->'app_metadata'->>'is_moderator' = 'true', 'hook: is_moderator missing';
  assert out->'claims'->'app_metadata'->>'mod_zone' = '69', 'hook: mod_zone missing';
end $$;

-- 4. RLS as an authenticated user: sees own profile only, cannot self-promote.
insert into public.cities (id, insee_code, name, slug, department, postal_codes, population, location)
values (69123, '69123', 'Lyon', 'lyon', '69', '{69001,69002}', 516000, extensions.ST_SetSRID(extensions.ST_MakePoint(4.8357, 45.7640), 4326)::extensions.geography),
       (75056, '75056', 'Paris', 'paris', '75', '{75001}', 2100000, extensions.ST_SetSRID(extensions.ST_MakePoint(2.3522, 48.8566), 4326)::extensions.geography);
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{"role":"client","is_moderator":false,"is_admin":false}}', false);
do $$ begin
  assert (select count(*) from public.profiles) = 1, 'RLS: user should see exactly one profile';
  assert (select count(*) from public.public_profiles) = 2, 'public_profiles should list everyone';
  assert (select count(*) from public.cities) = 2, 'cities readable';
  assert (select count(*) from public.categories) >= 10, 'categories readable';
  assert (select count(*) from public.app_settings where key like 'pricing.%') = 5, 'pricing settings readable';
  assert (select count(*) from public.banned_keywords) = 0, 'banned keywords must be hidden from clients';
end $$;
update public.profiles set display_name = 'Seif' where id = auth.uid();
do $$ begin
  begin
    update public.profiles set is_admin = true where id = auth.uid();
    raise exception 'self-promotion should fail';
  exception when others then
    if sqlerrm not like '%PROTECTED_COLUMN%' then raise; end if;
  end;
end $$;
do $$ begin
  begin
    perform public.set_active_mode('seller');
    raise exception 'client must not switch to seller mode';
  exception when others then
    if sqlerrm not like '%NOT_A_SELLER%' then raise; end if;
  end;
end $$;
do $$ begin
  assert (select count(*) from public.search_cities('lyo')) = 1, 'search_cities(lyo)';
  assert (select name from public.search_cities('75001') limit 1) = 'Paris', 'search_cities by postal code';
end $$;
-- blocks
insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), '00000000-0000-0000-0000-000000000001');
do $$ begin
  assert private.is_blocked_between('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'), 'is_blocked_between';
end $$;

-- 5. Moderator claims see all profiles; zone helper.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"role":"client","is_moderator":true,"is_admin":false,"mod_scope":"department","mod_zone":"69"}}', false);
do $$ begin
  assert (select count(*) from public.profiles) = 2, 'moderator sees all profiles';
  assert private.mod_covers('69', 69123), 'mod covers own department';
  assert not private.mod_covers('75', 75056), 'mod must not cover other department';
  assert (select count(*) from public.banned_keywords) > 0, 'moderator reads banned keywords';
end $$;
reset role;
select 'all smoke tests passed' as result;
SQL

$PSQL -c "drop database $DB" >/dev/null
echo "OK: migrations + smoke tests passed"

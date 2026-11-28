#!/usr/bin/env bash
# Runs every migration against a throwaway local Postgres (with PostGIS) that
# mimics a hosted Supabase project (roles, `auth` schema, default grants), then
# executes smoke tests on privileges and RLS.
# Usage: npm run db:test   (needs a local `postgres` superuser reachable with `sudo -u postgres psql`)
set -euo pipefail
cd "$(dirname "$0")/.."
DB="bizz_migration_test"
PSQL=${PSQL:-"sudo -u postgres psql -v ON_ERROR_STOP=1 -q"}

$PSQL -c "drop database if exists $DB" >/dev/null 2>&1
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
grant usage on schema public to anon, authenticated, service_role;
-- Same defaults as a hosted Supabase project: everything created in `public` is granted to the API roles.
alter default privileges for role postgres in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on functions to anon, authenticated, service_role;
grant select, insert, update on auth.users to supabase_auth_admin;
-- Minimal Storage stub (bucket registry + objects with RLS).
create schema if not exists storage;
create table storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text not null, owner uuid);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $f$
  select (string_to_array(name, '/'))[1 : array_length(string_to_array(name, '/'), 1) - 1]
$f$;
grant usage on schema storage to authenticated, anon;
grant select, insert, update, delete on storage.objects to authenticated;
SQL

# --- Migrations, in order ----------------------------------------------------
for f in supabase/migrations/*.sql; do
  echo "→ $f"
  $P -f "$f" >/dev/null
done

# --- Smoke tests -------------------------------------------------------------
$P <<'SQL' >/dev/null
\set ON_ERROR_STOP on
create function public.test_expect_error(stmt text, pattern text) returns void language plpgsql as $f$
begin
  begin
    execute stmt;
  exception when others then
    if sqlerrm not ilike '%' || pattern || '%' then
      raise exception 'expected error like "%" for [%], got: %', pattern, stmt, sqlerrm;
    end if;
    return;
  end;
  raise exception 'expected an error like "%" for [%], but it succeeded', pattern, stmt;
end $f$;
grant execute on function public.test_expect_error(text, text) to anon, authenticated;

-- 0. Privilege audit: anon has nothing; authenticated can only run an allowlist of functions.
do $$ declare leaked text; begin
  select string_agg(table_name || ':' || privilege_type, ', ') into leaked
    from information_schema.role_table_grants where table_schema in ('public', 'private') and grantee in ('anon', 'PUBLIC');
  assert leaked is null, 'anon/PUBLIC table grants: ' || leaked;
  select string_agg(table_name || '.' || column_name, ', ') into leaked
    from information_schema.column_privileges where table_schema in ('public', 'private') and grantee in ('anon', 'PUBLIC');
  assert leaked is null, 'anon/PUBLIC column grants: ' || leaked;
  select string_agg(n.nspname || '.' || p.proname, ', ') into leaked
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private') and p.proname <> 'test_expect_error' and has_function_privilege('anon', p.oid, 'EXECUTE');
  assert leaked is null, 'functions executable by anon: ' || leaked;
  select string_agg(n.nspname || '.' || p.proname, ', ' order by 1) into leaked
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private') and has_function_privilege('authenticated', p.oid, 'EXECUTE')
     and (n.nspname || '.' || p.proname) not in (
       'public.test_expect_error',
       'public.set_active_mode', 'public.search_cities', 'public.get_my_profile',
       'public.is_username_available', 'public.complete_profile', 'public.open_shop',
       'public.request_account_deletion', 'public.cancel_account_deletion',
       'private.is_admin', 'private.is_moderator', 'private.mod_covers', 'private.is_blocked_between',
       'private.paris_today', 'private.immutable_unaccent');
  assert leaked is null, 'unexpected functions executable by authenticated: ' || leaked;
  select string_agg(n.nspname || '.' || p.proname, ', ') into leaked
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private') and p.proname <> 'test_expect_error'
     and (p.proconfig is null or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'));
  assert leaked is null, 'functions without pinned search_path: ' || leaked;
  select string_agg(c.relname, ', ') into leaked
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('public', 'private') and c.relkind = 'r' and not c.relrowsecurity;
  assert leaked is null, 'tables without RLS: ' || leaked;
end $$;

-- 1. Signup as the auth server does it (non-superuser): the trigger creates the profile.
set role supabase_auth_admin;
insert into auth.users (id, phone, phone_confirmed_at) values ('00000000-0000-0000-0000-000000000001', '+33600000001', now());
insert into auth.users (id, phone) values ('00000000-0000-0000-0000-000000000002', '+33600000002');
reset role;
do $$ begin
  assert (select count(*) from public.profiles) = 2, 'profiles not auto-created';
  assert (select phone_verified from public.profiles where id = '00000000-0000-0000-0000-000000000001'), 'phone_verified should be true';
  assert not (select phone_verified from public.profiles where id = '00000000-0000-0000-0000-000000000002'), 'phone_verified should be false';
end $$;

-- 2. Phone confirmation later flips the flag.
set role supabase_auth_admin;
update auth.users set phone_confirmed_at = now() where id = '00000000-0000-0000-0000-000000000002';
reset role;
do $$ begin
  assert (select phone_verified from public.profiles where id = '00000000-0000-0000-0000-000000000002'), 'phone_verified not synced';
end $$;

-- 3. Claims hook, called as the auth server.
update public.profiles set is_moderator = true, moderation_scope = 'department', moderation_zone = '69' where id = '00000000-0000-0000-0000-000000000001';
set role supabase_auth_admin;
do $$ declare out jsonb; begin
  out := public.auth_hook_add_claims('{"user_id":"00000000-0000-0000-0000-000000000001","claims":{"sub":"00000000-0000-0000-0000-000000000001","app_metadata":{}}}');
  assert out->'claims'->'app_metadata'->>'is_moderator' = 'true', 'hook: is_moderator missing';
  assert out->'claims'->'app_metadata'->>'mod_zone' = '69', 'hook: mod_zone missing';
  assert out->'claims'->'app_metadata'->>'phone_verified' = 'true', 'hook: phone_verified missing';
end $$;
reset role;

insert into public.cities (id, insee_code, name, slug, department, postal_codes, population, location)
values (69123, '69123', 'Lyon', 'lyon', '69', '{69001,69002}', 516000, extensions.ST_SetSRID(extensions.ST_MakePoint(4.8357, 45.7640), 4326)::extensions.geography),
       (75056, '75056', 'Paris', 'paris', '75', '{75001}', 2100000, extensions.ST_SetSRID(extensions.ST_MakePoint(2.3522, 48.8566), 4326)::extensions.geography);

-- 4. anon (publishable key, no session): nothing at all.
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select public.test_expect_error($q$select 1 from public.public_profiles$q$, 'permission denied');
select public.test_expect_error($q$select id from public.profiles$q$, 'permission denied');
select public.test_expect_error($q$select 1 from public.cities$q$, 'permission denied');
select public.test_expect_error($q$select 1 from public.app_settings$q$, 'permission denied');
select public.test_expect_error($q$update public.public_profiles set display_name = 'x'$q$, 'permission denied');
select public.test_expect_error($q$delete from public.public_profiles$q$, 'permission denied');
select public.test_expect_error($q$select public.set_active_mode('client')$q$, 'permission denied');
select public.test_expect_error($q$select * from public.get_my_profile()$q$, 'permission denied');
select public.test_expect_error($q$select * from public.search_cities('lyon')$q$, 'permission denied');
reset role;

-- 5. Signed-in client.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{"role":"client","is_moderator":false,"is_admin":false}}', false);
do $$ begin
  assert (select count(*) from public.public_profiles) = 2, 'public_profiles should list everyone';
  assert (select count(*) from (select id, username, display_name from public.profiles) t) = 2, 'public columns of all profiles readable';
  assert (select phone_verified from public.get_my_profile()), 'get_my_profile returns own private columns';
  assert (select count(*) from public.get_my_profile()) = 1, 'get_my_profile returns exactly one row';
  assert (select count(*) from public.cities) = 2, 'cities readable';
  assert (select count(*) from public.categories) >= 10, 'categories readable';
  assert (select count(*) from public.app_settings where key like 'pricing.%') = 5, 'pricing settings readable';
  assert (select count(*) from public.app_settings where key like 'moderation.%') = 0, 'moderation settings hidden';
  assert (select count(*) from public.banned_keywords) = 0, 'banned keywords must be hidden from clients';
end $$;
-- private columns of others are unreachable
select public.test_expect_error($q$select * from public.profiles$q$, 'permission denied');
select public.test_expect_error($q$select is_admin, suspended_until from public.profiles$q$, 'permission denied');
select public.test_expect_error($q$select location from public.profiles$q$, 'permission denied');
-- own edits: allowed columns only
update public.profiles set display_name = 'Seif' where id = auth.uid();
select public.test_expect_error($q$update public.profiles set is_admin = true where id = auth.uid()$q$, 'permission denied');
select public.test_expect_error($q$update public.profiles set role = 'seller' where id = auth.uid()$q$, 'permission denied');
select public.test_expect_error($q$update public.profiles set phone_verified = true where id = auth.uid()$q$, 'permission denied');
select public.test_expect_error($q$update public.public_profiles set display_name = 'x'$q$, 'permission denied');
select public.test_expect_error($q$delete from public.profiles$q$, 'permission denied');
select public.test_expect_error($q$insert into public.profiles (id, username, display_name) values (gen_random_uuid(), 'hack_user', 'x')$q$, 'permission denied');
-- someone else's row: RLS filters it out, 0 row updated
update public.profiles set display_name = 'Pwned' where id = '00000000-0000-0000-0000-000000000001';
-- reference data is read-only for non-admins
select public.test_expect_error($q$insert into public.categories (slug, label, icon) values ('x', 'x', 'x')$q$, 'row-level security');
select public.test_expect_error($q$insert into public.app_settings (key, value) values ('quota.hack', '1')$q$, 'row-level security');
update public.app_settings set value = '99' where key = 'quota.free_daily';
select public.test_expect_error($q$select public.set_active_mode('seller')$q$, 'NOT_A_SELLER');
do $$ begin
  assert (select count(*) from public.search_cities('lyo')) = 1, 'search_cities(lyo)';
  assert (select name from public.search_cities('75001') limit 1) = 'Paris', 'search_cities by postal code';
end $$;
insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), '00000000-0000-0000-0000-000000000001');
select public.test_expect_error($q$insert into public.blocks (blocker_id, blocked_id) values ('00000000-0000-0000-0000-000000000001', auth.uid())$q$, 'row-level security');
do $$ begin
  assert private.is_blocked_between('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'), 'is_blocked_between';
end $$;
reset role;
do $$ begin
  assert (select display_name from public.profiles where id = '00000000-0000-0000-0000-000000000001') <> 'Pwned', 'RLS must block updates of other profiles';
  assert (select display_name from public.profiles where id = '00000000-0000-0000-0000-000000000002') = 'Seif', 'own display_name updated';
  assert (select value from public.app_settings where key = 'quota.free_daily') = '1'::jsonb, 'client must not change settings';
end $$;

-- 6. Defense in depth: even with a stray column grant, the trigger refuses protected columns.
grant update (is_admin) on public.profiles to authenticated;
set role authenticated;
select public.test_expect_error($q$update public.profiles set is_admin = true where id = auth.uid()$q$, 'PROTECTED_COLUMN');
reset role;
revoke update (is_admin) on public.profiles from authenticated;

-- 7. Server-side paths may change protected columns; a seller can then switch mode.
update public.profiles set role = 'seller' where id = '00000000-0000-0000-0000-000000000002';
insert into public.shops (owner_id, slug, name, city_id, location)
values ('00000000-0000-0000-0000-000000000002', 'legacy_shop', 'Legacy shop', 69123, (select location from public.cities where id = 69123));
set role authenticated;
select public.set_active_mode('seller');
do $$ begin
  assert (select active_mode from public.get_my_profile()) = 'seller', 'seller mode not applied';
end $$;
select public.set_active_mode('client');
reset role;

-- 8. Moderator of department 69.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"role":"client","is_moderator":true,"is_admin":false,"mod_scope":"department","mod_zone":"69"}}', false);
do $$ begin
  assert private.mod_covers('69', 69123), 'mod covers own department';
  assert not private.mod_covers('75', 75056), 'mod must not cover other department';
  assert (select count(*) from public.banned_keywords) > 0, 'moderator reads banned keywords';
end $$;
select public.test_expect_error($q$insert into public.banned_keywords (term, severity) values ('x', 'block')$q$, 'row-level security');
reset role;

-- 9. Admin edits settings and categories through the API.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"is_moderator":true,"is_admin":true,"mod_scope":"all"}}', false);
update public.app_settings set value = '2' where key = 'quota.free_daily';
insert into public.categories (slug, label, icon, sort_order) values ('test-cat', 'Test', 'package', 50);
insert into public.banned_keywords (term, severity) values ('test-term', 'flag');
do $$ begin
  assert (select count(*) from public.app_settings where key like 'moderation.%') = 1, 'admin reads every setting';
  assert private.mod_covers('75', 75056), 'admin covers every zone';
end $$;
reset role;
do $$ begin
  assert (select value from public.app_settings where key = 'quota.free_daily') = '2'::jsonb, 'admin setting update';
end $$;

-- 10. Step 2: sign-up completion, shop opening, account deletion.
set role supabase_auth_admin;
insert into auth.users (id, phone, phone_confirmed_at) values ('00000000-0000-0000-0000-000000000003', '+33600000003', now());
insert into auth.users (id, phone, phone_confirmed_at) values ('00000000-0000-0000-0000-000000000004', '+33600000004', now());
reset role;
update public.app_settings set value = '1' where key = 'quota.founder_limit';
delete from public.shops where slug = 'legacy_shop';
update public.profiles set role = 'client', active_mode = 'client' where id = '00000000-0000-0000-0000-000000000002';

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated","app_metadata":{}}', false);
do $$ begin
  assert public.is_username_available('sweetcakes'), 'free username';
  assert public.is_username_available('  SweetCakes '), 'username is normalized';
  assert not public.is_username_available('ab'), 'too short';
  assert not public.is_username_available('sweet cakes'), 'spaces refused';
  assert not public.is_username_available('admin'), 'reserved';
  assert not public.is_username_available('user_abc'), 'provisional prefix reserved';
end $$;
select public.test_expect_error($q$select public.open_shop('Sweet Cakes')$q$, 'PROFILE_INCOMPLETE');
select public.test_expect_error($q$select public.complete_profile('ad', 'Sarah', 69123)$q$, 'INVALID_USERNAME');
select public.test_expect_error($q$select public.complete_profile('sweetcakes', '', 69123)$q$, 'INVALID_DISPLAY_NAME');
select public.test_expect_error($q$select public.complete_profile('sweetcakes', 'Sarah', 1)$q$, 'INVALID_CITY');
select public.complete_profile(' SweetCakes', ' Sarah ', 69123);
do $$ declare p public.profiles; begin
  select * into p from public.get_my_profile();
  assert p.username = 'sweetcakes' and p.display_name = 'Sarah' and p.city_id = 69123, 'profile completed';
  assert p.terms_accepted_at is not null, 'terms accepted';
  assert p.role = 'client', 'still a client';
  assert public.is_username_available('sweetcakes'), 'own username stays available to its owner';
end $$;
select public.test_expect_error($q$select public.open_shop('S')$q$, 'INVALID_SHOP_NAME');
select public.open_shop('Sweet Cakes Lyon', 'Layer cakes sur commande', null, '@sweetcakes', null, ' sweet.cakes ', '06 12 34 56 78');
select public.test_expect_error($q$select public.open_shop('Encore')$q$, 'SHOP_EXISTS');
do $$ declare p public.profiles; s public.shops; begin
  select * into p from public.get_my_profile();
  assert p.role = 'seller' and p.active_mode = 'seller', 'account became a seller';
  select * into s from public.shops where owner_id = auth.uid();
  assert s.slug = 'sweetcakes' and s.city_id = 69123, 'shop slug and city';
  assert s.instagram = 'sweetcakes' and s.tiktok = 'sweet.cakes' and s.whatsapp = '0612345678', 'handles cleaned';
  assert s.is_founder and s.founder_rank = 1, 'first shop is founder #1';
  assert extensions.ST_Distance(s.location, (select location from public.cities where id = 69123)) = 0, 'shop location = city location';
end $$;
update public.shops set bio = 'Nouvelle bio', city_id = 75056 where owner_id = auth.uid();
select public.test_expect_error($q$update public.shops set status = 'hidden' where owner_id = auth.uid()$q$, 'permission denied');
select public.test_expect_error($q$update public.shops set is_founder = false where owner_id = auth.uid()$q$, 'permission denied');
select public.test_expect_error($q$insert into public.shops (owner_id, slug, name, city_id, location) select auth.uid(), 'x', 'xx', 69123, location from public.cities limit 1$q$, 'permission denied');
do $$ begin
  assert (select extensions.ST_Distance(location, (select location from public.cities where id = 75056)) from public.shops where owner_id = auth.uid()) = 0, 'location follows city change';
end $$;
select public.set_active_mode('client');
select public.set_active_mode('seller');

-- second user: username clash, sees the shop, cannot edit it, founder badge exhausted
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated","app_metadata":{}}', false);
do $$ begin
  assert not public.is_username_available('SweetCakes'), 'taken username (case-insensitive)';
  assert (select count(*) from public.shops) = 1, 'active shop visible to others';
end $$;
select public.test_expect_error($q$select public.complete_profile('sweetcakes', 'Karim', 75056)$q$, 'USERNAME_TAKEN');
select public.complete_profile('drip_vintage', 'Karim', 75056);
update public.shops set name = 'Pwned';
select public.open_shop('Drip Vintage');
do $$ begin
  assert (select not is_founder and founder_rank is null from public.shops where owner_id = auth.uid()), 'founder limit reached';
  assert (select name from public.shops where slug = 'sweetcakes') = 'Sweet Cakes Lyon', 'cannot edit another shop';
end $$;
-- storage: own folder only
insert into storage.objects (bucket_id, name, owner) values ('avatars', '00000000-0000-0000-0000-000000000004/avatar.jpg', auth.uid());
select public.test_expect_error($q$insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0000-000000000003/avatar.jpg')$q$, 'row-level security');

-- account deletion hides profile and shop, and is reversible
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated","app_metadata":{}}', false);
select public.request_account_deletion();
do $$ begin
  assert (select deleted_at is not null and active_mode = 'client' from public.get_my_profile()), 'deletion requested';
end $$;
select public.test_expect_error($q$select public.set_active_mode('seller')$q$, 'NOT_A_SELLER');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated","app_metadata":{}}', false);
do $$ begin
  assert (select count(*) from public.shops where slug = 'sweetcakes') = 0, 'deleted shop hidden';
  assert (select count(*) from public.public_profiles where username = 'sweetcakes') = 0, 'deleted profile hidden';
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated","app_metadata":{}}', false);
select public.cancel_account_deletion();
do $$ begin
  assert (select deleted_at is null from public.get_my_profile()), 'deletion cancelled';
  assert (select count(*) from public.shops where owner_id = auth.uid() and deleted_at is null) = 1, 'shop restored';
end $$;
reset role;
SQL

$PSQL -c "drop database $DB" >/dev/null
echo "OK: migrations + smoke tests passed"

#!/usr/bin/env bash
# Runs every migration against a throwaway local Postgres (with PostGIS) that
# mimics a hosted Supabase project (roles, `auth` schema, default grants), then
# executes smoke tests on privileges and RLS.
# Usage: npm run db:test   (needs a local `postgres` superuser reachable with `sudo -u postgres psql`)
set -euo pipefail
cd "$(dirname "$0")/.."
DB="bizz_migration_test"
PSQL=${PSQL:-"sudo -u postgres psql -v ON_ERROR_STOP=1 -q"}

if ! $PSQL -c "select 1" >/dev/null 2>&1; then
  echo "Postgres local injoignable. Lance-le (ex. : sudo service postgresql start) puis relance." >&2
  exit 1
fi
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
       'public.get_post_allowance', 'public.create_post', 'public.update_post', 'public.delete_post',
       'public.block_user', 'public.unblock_user', 'public.my_blocked_users', 'public.report_target',
       'public.record_views', 'public.feed', 'public.drops_today',
       'public.search_posts', 'public.find_shops', 'private.search_origin',
       'private.is_admin', 'private.is_moderator', 'private.mod_covers', 'private.is_blocked_between',
       'private.paris_today', 'private.immutable_unaccent', 'private.post_search_vector');
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
select public.block_user('00000000-0000-0000-0000-000000000001');
select public.test_expect_error($q$insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), '00000000-0000-0000-0000-000000000003')$q$, 'permission denied');
select public.test_expect_error($q$select public.block_user(auth.uid())$q$, 'CANNOT_BLOCK_SELF');
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

-- 11. Step 3: publishing, quota, credits, banned keywords, statuses, visibility.
-- user 3 = seller "sweetcakes" (phone verified), user 4 = seller "drip_vintage", user 2 = client.
create function public.test_post_payload(p_title text, p_paths text[], p_extra jsonb default '{}') returns jsonb language sql as $f$
  select jsonb_build_object('type', 'creation', 'title', p_title, 'description', 'Sur commande, retrait sur place.',
           'hashtags', jsonb_build_array('#Layer Cake', 'ANNIV', 'anniv'), 'price_mode', 'fixed', 'price_cents', 3500,
           'category_id', (select id from public.categories where slug = 'food'), 'city_id', 69123,
           'media', (select jsonb_agg(jsonb_build_object('kind', 'image', 'storage_path', x, 'width', 1200, 'height', 1500)) from unnest(p_paths) x)) || p_extra
$f$;
grant execute on function public.test_post_payload(text, text[], jsonb) to authenticated;
create table public.test_ids (k text primary key, v uuid);
grant all on public.test_ids to authenticated;
insert into storage.buckets (id, name, public) values ('post-media', 'post-media', true) on conflict do nothing;
update public.app_settings set value = '1' where key = 'quota.free_daily';

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated","app_metadata":{}}', false);
insert into storage.objects (bucket_id, name, owner) values
  ('post-media', '00000000-0000-0000-0000-000000000003/a.jpg', auth.uid()),
  ('post-media', '00000000-0000-0000-0000-000000000003/b.jpg', auth.uid()),
  ('post-media', '00000000-0000-0000-0000-000000000003/c.jpg', auth.uid());
select public.test_expect_error($q$insert into storage.objects (bucket_id, name) values ('post-media', '00000000-0000-0000-0000-000000000004/x.jpg')$q$, 'row-level security');
do $$ declare a record; begin
  select * into a from public.get_post_allowance();
  assert a.free_daily = 1 and a.used_today = 0 and a.credits = 0 and a.can_post, 'fresh allowance';
  assert a.next_reset > now() and a.next_reset <= now() + interval '25 hours', 'next reset is the coming Paris midnight';
end $$;

-- invalid content never consumes quota
select public.test_expect_error($q$select public.create_post(public.test_post_payload('Ab', array['00000000-0000-0000-0000-000000000003/a.jpg']))$q$, 'INVALID_TITLE');
select public.test_expect_error($q$select public.create_post(public.test_post_payload('Layer cake', array['00000000-0000-0000-0000-000000000003/a.jpg'], '{"price_cents": null}'))$q$, 'INVALID_PRICE');
select public.test_expect_error($q$select public.create_post(public.test_post_payload('Layer cake', array['00000000-0000-0000-0000-000000000003/a.jpg'], '{"category_id": 9999}'))$q$, 'INVALID_CATEGORY');
select public.test_expect_error($q$select public.create_post(public.test_post_payload('Layer cake', array['00000000-0000-0000-0000-000000000003/missing.jpg']))$q$, 'INVALID_MEDIA');
select public.test_expect_error($q$select public.create_post(public.test_post_payload('Layer cake', array['00000000-0000-0000-0000-000000000004/x.jpg']))$q$, 'INVALID_MEDIA');
select public.test_expect_error($q$select public.create_post(public.test_post_payload('Layer cake', array[]::text[]) || '{"media": []}')$q$, 'INVALID_MEDIA');
select public.test_expect_error($q$select public.create_post(public.test_post_payload('Puffs goût fraise', array['00000000-0000-0000-0000-000000000003/a.jpg']))$q$, 'FORBIDDEN_CONTENT');
select public.test_expect_error($q$select public.create_post(public.test_post_payload('Vente d ARMES de collection', array['00000000-0000-0000-0000-000000000003/a.jpg']))$q$, 'FORBIDDEN_CONTENT');
select public.test_expect_error($q$select public.create_post(public.test_post_payload('Bonbons', array['00000000-0000-0000-0000-000000000003/a.jpg'], '{"description": "avec des médicaments"}'))$q$, 'FORBIDDEN_CONTENT');
do $$ begin
  assert (select used_today from public.get_post_allowance()) = 0, 'rejected posts must not consume quota';
end $$;

-- first post of the day: free. Whole words only: "parmesan" and "charme" contain "arme" but pass.
insert into public.test_ids select 'p1', public.create_post(public.test_post_payload('Plateau parmesan plein de charme',
  array['00000000-0000-0000-0000-000000000003/a.jpg', '00000000-0000-0000-0000-000000000003/b.jpg', '00000000-0000-0000-0000-000000000003/c.jpg']));
do $$ declare p public.posts; a record; begin
  select * into p from public.posts where id = (select v from public.test_ids where k = 'p1');
  assert p.status = 'available' and p.visibility = 'visible' and p.price_cents = 3500, 'post created';
  assert p.hashtags = array['layercake', 'anniv'], 'hashtags sanitized and deduplicated: ' || p.hashtags::text;
  assert p.expires_at between now() + interval '59 days' and now() + interval '61 days', 'expires in 60 days';
  assert extensions.ST_Distance(p.location, (select location from public.cities where id = 69123)) = 0, 'post location = city';
  assert p.search_vector @@ to_tsquery('french', 'parmesan'), 'search vector filled';
  assert (select count(*) from public.post_media where post_id = p.id) = 3, 'three photos';
  assert (select array_agg(position order by position) from public.post_media where post_id = p.id) = array[0, 1, 2]::smallint[], 'photo order kept';
  assert (select posts_count from public.shops where owner_id = auth.uid()) = 1, 'shop posts_count';
  select * into a from public.get_post_allowance();
  assert a.used_today = 1 and not a.can_post, 'free post consumed';
end $$;

-- second post the same day: refused
select public.test_expect_error($q$select public.create_post(public.test_post_payload('Number cake 20 parts', array['00000000-0000-0000-0000-000000000003/a.jpg']))$q$, 'QUOTA_EXCEEDED');

-- editing and changing the status never consume quota
select public.update_post((select v from public.test_ids where k = 'p1'),
  public.test_post_payload('Layer cake perso 8 parts', array['00000000-0000-0000-0000-000000000003/b.jpg'], '{"price_mode": "on_quote", "price_cents": null, "city_id": 75056}'));
update public.posts set status = 'reserved' where id = (select v from public.test_ids where k = 'p1');
do $$ declare p public.posts; begin
  select * into p from public.posts where id = (select v from public.test_ids where k = 'p1');
  assert p.title = 'Layer cake perso 8 parts' and p.price_mode = 'on_quote' and p.price_cents is null, 'post edited';
  assert p.city_id = 75056 and extensions.ST_Distance(p.location, (select location from public.cities where id = 75056)) = 0, 'city and location edited';
  assert p.status = 'reserved', 'status changed by the seller';
  assert (select count(*) from public.post_media where post_id = p.id) = 1, 'media replaced';
  assert (select used_today from public.get_post_allowance()) = 1, 'editing is free';
end $$;
select public.test_expect_error($q$select public.update_post((select v from public.test_ids where k = 'p1'), public.test_post_payload('Puff pas chère', array['00000000-0000-0000-0000-000000000003/b.jpg']))$q$, 'FORBIDDEN_CONTENT');
select public.test_expect_error($q$update public.posts set status = 'expired' where id = (select v from public.test_ids where k = 'p1')$q$, 'INVALID_STATUS');
select public.test_expect_error($q$update public.posts set title = 'x' where author_id = auth.uid()$q$, 'permission denied');
select public.test_expect_error($q$update public.posts set visibility = 'visible', bumped_at = now() where author_id = auth.uid()$q$, 'permission denied');
select public.test_expect_error($q$insert into public.posts (shop_id, author_id, type, title, category_id, city_id, location, expires_at) select s.id, auth.uid(), 'object', 'direct insert', 1, 69123, s.location, now() from public.shops s where s.owner_id = auth.uid()$q$, 'permission denied');
select public.test_expect_error($q$update public.daily_post_usage set count = 0$q$, 'permission denied');
select public.test_expect_error($q$insert into public.post_credits (user_id, source, amount, remaining, expires_at) values (auth.uid(), 'admin', 99, 99, now() + interval '1 day')$q$, 'permission denied');
reset role;

-- credits: the one closest to expiry goes first; expired credits are ignored
insert into public.post_credits (user_id, source, amount, remaining, expires_at, note) values
  ('00000000-0000-0000-0000-000000000003', 'admin', 5, 5, now() - interval '1 day', 'expired'),
  ('00000000-0000-0000-0000-000000000003', 'admin', 2, 2, now() + interval '20 days', 'late'),
  ('00000000-0000-0000-0000-000000000003', 'admin', 1, 1, now() + interval '3 days', 'soon');
set role authenticated;
do $$ declare a record; begin
  select * into a from public.get_post_allowance();
  assert a.credits = 3 and a.can_post, 'three usable credits (expired ones ignored)';
end $$;
insert into public.test_ids select 'p2', public.create_post(public.test_post_payload('Number cake 20 parts', array['00000000-0000-0000-0000-000000000003/a.jpg']));
reset role;
do $$ begin
  assert (select remaining from public.post_credits where note = 'soon') = 0, 'credit closest to expiry used first';
  assert (select remaining from public.post_credits where note = 'late') = 2, 'later credit untouched';
  assert (select remaining from public.post_credits where note = 'expired') = 5, 'expired credit untouched';
  assert (select count from public.daily_post_usage where user_id = '00000000-0000-0000-0000-000000000003') = 1, 'daily counter unchanged when a credit is used';
end $$;

-- "flag" keywords publish but queue a moderation job
set role authenticated;
insert into public.test_ids select 'p3', public.create_post(public.test_post_payload('Sac réplique de créateur', array['00000000-0000-0000-0000-000000000003/c.jpg']));
reset role;
do $$ begin
  assert (select count(*) from private.job_queue where kind = 'keyword_flag' and payload->>'term' = 'réplique') = 1, 'flag keyword queued for moderation';
  assert private.grant_post_credits('00000000-0000-0000-0000-000000000003', 3, 'admin', 'test') is not null, 'grant_post_credits';
  assert (select expires_at from public.post_credits where note = 'test') between now() + interval '29 days' and now() + interval '31 days', 'credits valid 30 days';
end $$;

-- a new Paris day resets the free publication
update public.daily_post_usage set day = day - 1 where user_id = '00000000-0000-0000-0000-000000000003';
set role authenticated;
do $$ declare a record; begin
  select * into a from public.get_post_allowance();
  assert a.used_today = 0 and a.can_post, 'counter back to zero on a new day';
end $$;

-- visibility for another signed-in user (user 2, client)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{}}', false);
do $$ begin
  assert (select count(*) from public.posts) = 3, 'client sees the 3 visible posts (reserved included)';
  assert (select count(*) from public.post_media) = 3, 'and their photos';
  assert (select count(*) from public.daily_post_usage) = 0 and (select count(*) from public.post_credits) = 0, 'quota rows of others are private';
end $$;
update public.posts set status = 'sold';
select public.test_expect_error($q$select public.update_post((select v from public.test_ids where k = 'p1'), public.test_post_payload('Hack', array['00000000-0000-0000-0000-000000000003/a.jpg']))$q$, 'POST_NOT_FOUND');
select public.test_expect_error($q$select public.delete_post((select v from public.test_ids where k = 'p1'))$q$, 'POST_NOT_FOUND');
select public.test_expect_error($q$select public.create_post(public.test_post_payload('Annonce client', array['00000000-0000-0000-0000-000000000003/a.jpg']))$q$, 'NO_SHOP');
select public.block_user('00000000-0000-0000-0000-000000000003');
do $$ begin
  assert (select count(*) from public.posts) = 0, 'posts of a blocked seller disappear';
end $$;
delete from public.blocks where blocker_id = auth.uid();
reset role;
do $$ begin
  assert (select count(*) from public.posts where status = 'sold') = 0, 'a client cannot change the status of someone else''s post';
end $$;

-- hidden by moderation / expired / deleted / suspended shop: gone for others, still there for the author
update public.posts set visibility = 'hidden_by_moderation' where id = (select v from public.test_ids where k = 'p2');
update public.posts set expires_at = now() - interval '1 minute' where id = (select v from public.test_ids where k = 'p3');
set role authenticated;
do $$ begin
  assert (select count(*) from public.posts) = 1, 'hidden and expired posts are invisible to others';
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated","app_metadata":{}}', false);
do $$ begin
  assert (select count(*) from public.posts) = 3, 'the author still sees all their posts';
  assert (select posts_count from public.shops where owner_id = auth.uid()) = 2, 'posts_count ignores hidden posts';
end $$;
select public.test_expect_error($q$update public.posts set status = 'reserved' where id = (select v from public.test_ids where k = 'p3')$q$, 'POST_EXPIRED');
select public.delete_post((select v from public.test_ids where k = 'p1'));
do $$ begin
  assert (select count(*) from public.posts) = 2, 'deleted post gone for the author too';
  assert (select posts_count from public.shops where owner_id = auth.uid()) = 1, 'posts_count after delete';
end $$;
reset role;
update public.shops set status = 'suspended' where slug = 'sweetcakes';
update public.posts set expires_at = now() + interval '10 days', visibility = 'visible' where author_id = '00000000-0000-0000-0000-000000000003' and deleted_at is null;
set role authenticated;
select public.test_expect_error($q$select public.create_post(public.test_post_payload('Encore un gâteau', array['00000000-0000-0000-0000-000000000003/a.jpg']))$q$, 'SHOP_SUSPENDED');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{}}', false);
do $$ begin
  assert (select count(*) from public.posts) = 0, 'posts of a suspended shop are hidden';
end $$;
reset role;
update public.shops set status = 'active' where slug = 'sweetcakes';

-- phone not verified: cannot publish
update public.profiles set phone_verified = false where id = '00000000-0000-0000-0000-000000000004';
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated","app_metadata":{}}', false);
insert into storage.objects (bucket_id, name, owner) values ('post-media', '00000000-0000-0000-0000-000000000004/a.jpg', auth.uid());
select public.test_expect_error($q$select public.create_post(public.test_post_payload('Veste vintage', array['00000000-0000-0000-0000-000000000004/a.jpg']))$q$, 'PHONE_NOT_VERIFIED');
reset role;

-- 12. Step 4: follows, likes, saves, feed, drops, views, reports, blocking.
-- user 2 = client (Lyon), user 3 = seller sweetcakes (posts p2, p3 in Lyon... p2 was moved? no: p2, p3 are in Lyon), user 4 = seller drip_vintage (Paris).
delete from public.blocks;
update public.profiles set city_id = 69123, terms_accepted_at = now() where id = '00000000-0000-0000-0000-000000000002';
update public.posts set status = 'available', visibility = 'visible', expires_at = now() + interval '30 days', bumped_at = now() - interval '2 hours'
 where author_id = '00000000-0000-0000-0000-000000000003' and deleted_at is null;
insert into public.posts (id, shop_id, author_id, type, title, category_id, city_id, location, price_cents, expires_at, bumped_at, published_at)
select md5('t4-' || g)::uuid, s.id, s.owner_id, 'object', 'Veste vintage ' || g, (select id from public.categories where slug = 'fashion'), 75056, s.location, 4500,
       now() + interval '30 days', now() - make_interval(hours => g), now() - make_interval(hours => g)
  from public.shops s, generate_series(1, 4) g where s.slug = 'drip_vintage';
update public.posts set status = 'sold' where id = md5('t4-4')::uuid;
insert into public.test_ids select 'shop3', id from public.shops where slug = 'sweetcakes';
insert into public.test_ids select 'shop4', id from public.shops where slug = 'drip_vintage';
create table public.test_ts (k text primary key, v timestamptz);
grant all on public.test_ts to authenticated;
insert into public.test_ts select 'p2_updated', updated_at from public.posts where id = (select v from public.test_ids where k = 'p2');

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{}}', false);
-- follow
insert into public.follows (follower_id, shop_id) values (auth.uid(), (select v from public.test_ids where k = 'shop3'));
select public.test_expect_error($q$insert into public.follows (follower_id, shop_id) values (auth.uid(), (select v from public.test_ids where k = 'shop3'))$q$, 'duplicate key');
select public.test_expect_error($q$insert into public.follows (follower_id, shop_id) values ('00000000-0000-0000-0000-000000000004', (select v from public.test_ids where k = 'shop3'))$q$, 'row-level security');
-- like / save
insert into public.likes (user_id, post_id) values (auth.uid(), (select v from public.test_ids where k = 'p2'));
insert into public.saves (user_id, post_id) values (auth.uid(), (select v from public.test_ids where k = 'p2'));
insert into public.likes (user_id, post_id) values (auth.uid(), md5('t4-1')::uuid);
select public.test_expect_error($q$insert into public.likes (user_id, post_id) values (auth.uid(), gen_random_uuid())$q$, 'row-level security');
select public.test_expect_error($q$update public.likes set created_at = now()$q$, 'permission denied');
select public.test_expect_error($q$update public.posts set likes_count = 999 where id = (select v from public.test_ids where k = 'p2')$q$, 'permission denied');
do $$ declare r record; n int; first_ids uuid[]; second_ids uuid[]; begin
  assert (select followers_count from public.shops where slug = 'sweetcakes') = 1, 'followers_count +1';
  select * into r from public.posts where id = (select v from public.test_ids where k = 'p2');
  assert r.likes_count = 1 and r.saves_count = 1, 'likes_count and saves_count +1';
  assert r.updated_at = (select v from public.test_ts where k = 'p2_updated'), 'a like must not touch updated_at';

  -- for_you: every available post of others, with my flags
  select count(*) into n from public.feed('for_you', 30);
  assert n = 5, 'for_you returns the 5 available posts of other sellers, got ' || n;
  select * into r from public.feed('for_you', 30) f where f.id = (select v from public.test_ids where k = 'p2');
  assert r.liked and r.saved and r.following, 'flags liked / saved / following';
  assert r.shop_slug = 'sweetcakes' and r.city_name = 'Lyon' and jsonb_array_length(r.media) = 1, 'shop, city and media embedded';
  assert r.distance_km = 0, 'distance from my city (Lyon)';
  select * into r from public.feed('for_you', 30) f where f.id = md5('t4-1')::uuid;
  assert not r.saved and r.liked and not r.following and r.distance_km > 350, 'Paris post flags and distance';
  assert (select count(*) from public.feed('for_you', 30) f where f.status <> 'available') = 0, 'sold posts stay out of the feed';
  -- nearby and followed posts rank above farther, unfollowed ones of the same age
  assert (select f.shop_slug from public.feed('for_you', 1) f) = 'sweetcakes', 'for_you favours followed + nearby';

  -- keyset pagination: two pages, no overlap, nothing lost
  select array_agg(f.id) into first_ids from public.feed('for_you', 3) f;
  select array_agg(f2.id) into second_ids
    from public.feed('for_you', 3, (select min(f.rank_ts) from public.feed('for_you', 3) f),
                     (select f.id from public.feed('for_you', 3) f order by f.rank_ts, f.id limit 1)) f2;
  assert array_length(first_ids, 1) = 3 and array_length(second_ids, 1) = 2 and not (first_ids && second_ids), 'pagination: 3 + 2 distinct posts';

  -- following / nearby
  assert (select count(*) from public.feed('following', 30)) = 2 and (select count(distinct f.shop_slug) from public.feed('following', 30) f) = 1, 'following = the followed shop only';
  assert (select count(*) from public.feed('nearby', 30)) = 2, 'nearby = around my city';
  assert (select count(*) from public.feed('nearby', 30, null, null, 48.8566, 2.3522, 10)) = 3, 'nearby with an explicit position (Paris)';
  assert (select count(*) from public.feed('nearby', 30, null, null, 43.2965, 5.3698, 10)) = 0, 'nothing around Marseille';

  -- drops
  select * into r from public.drops_today();
  assert r.slug = 'sweetcakes' and r.posts_today = 2, 'drops: the followed shop that published today';
end $$;
-- views
select public.record_views(array[(select v from public.test_ids where k = 'p2'), md5('t4-1')::uuid, gen_random_uuid()]);
select public.record_views(array[(select v from public.test_ids where k = 'p2')]);
select public.test_expect_error($q$select count(*) from public.post_views$q$, 'permission denied');
-- reports
insert into public.test_ids select 'r1', public.report_target('post', (select v from public.test_ids where k = 'p2'), 'scam', '  Prix trop beau pour être vrai  ');
do $$ begin
  assert public.report_target('post', (select v from public.test_ids where k = 'p2'), 'spam') = (select v from public.test_ids where k = 'r1'), 'reporting twice returns the same report';
  assert (select count(*) from public.reports) = 1, 'no duplicate report';
  assert (select department = '69' and city_id = 69123 and details = 'Prix trop beau pour être vrai' and status = 'open' from public.reports), 'report routed to the shop zone';
  assert public.report_target('shop', (select v from public.test_ids where k = 'shop4'), 'counterfeit') is not null, 'shop report';
end $$;
select public.test_expect_error($q$select public.report_target('post', gen_random_uuid(), 'spam')$q$, 'TARGET_NOT_FOUND');
select public.test_expect_error($q$select public.report_target('message', gen_random_uuid(), 'spam')$q$, 'UNSUPPORTED_TARGET');
select public.test_expect_error($q$insert into public.reports (reporter_id, target_type, shop_id, reason, department, city_id) values (auth.uid(), 'shop', (select v from public.test_ids where k = 'shop4'), 'spam', '75', 75056)$q$, 'permission denied');
reset role;
do $$ begin
  assert (select count(*) from public.post_views) = 2, 'two distinct views recorded (unknown id and repeat ignored)';
end $$;

-- the seller: cannot follow, like-count or report their own things; own posts are not in their feed
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated","app_metadata":{}}', false);
select public.test_expect_error($q$insert into public.follows (follower_id, shop_id) values (auth.uid(), (select v from public.test_ids where k = 'shop3'))$q$, 'row-level security');
select public.test_expect_error($q$select public.report_target('post', (select v from public.test_ids where k = 'p2'), 'spam')$q$, 'CANNOT_REPORT_OWN');
select public.record_views(array[(select v from public.test_ids where k = 'p2')]);
do $$ begin
  assert (select count(*) from public.feed('for_you', 30) f where f.shop_slug = 'sweetcakes') = 0, 'own posts are not in my feed';
  assert (select count(*) from public.follows) = 0 and (select count(*) from public.likes) = 0 and (select count(*) from public.reports) = 0, 'follows, likes and reports of others are private';
end $$;
reset role;
do $$ begin
  assert (select count(*) from public.post_views) = 2, 'own views are not counted';
end $$;

-- auto-hide after N distinct reporters
update public.app_settings set value = '2' where key = 'moderation.auto_hide_threshold';
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated","app_metadata":{}}', false);
select public.report_target('post', (select v from public.test_ids where k = 'p2'), 'forbidden_item');
reset role;
do $$ begin
  assert (select visibility from public.posts where id = (select v from public.test_ids where k = 'p2')) = 'hidden_by_moderation', 'post hidden after 2 distinct reports';
  assert (select count(*) from private.job_queue where kind = 'post_auto_hidden') = 1, 'auto-hide queued for the moderation team';
end $$;
update public.posts set visibility = 'visible' where id = (select v from public.test_ids where k = 'p2');

-- blocking: follow removed, posts and shop gone, both ways
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{}}', false);
select public.block_user('00000000-0000-0000-0000-000000000003');
do $$ declare r record; begin
  assert (select count(*) from public.follows) = 0, 'block removes the follow';
  assert (select count(*) from public.feed('for_you', 30) f where f.shop_slug = 'sweetcakes') = 0, 'blocked seller leaves the feed';
  assert (select count(*) from public.shops where slug = 'sweetcakes') = 0, 'blocked shop is hidden';
  assert (select count(*) from public.drops_today()) = 0, 'no drop from a blocked shop';
  select * into r from public.my_blocked_users();
  assert r.username = 'sweetcakes' and r.shop_name = 'Sweet Cakes Lyon', 'blocked list';
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated","app_metadata":{}}', false);
do $$ begin
  assert (select followers_count from public.shops where slug = 'sweetcakes') = 0, 'followers_count back to 0';
  assert (select count(*) from public.my_blocked_users()) = 0, 'the blocked person does not see who blocked them';
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{}}', false);
select public.unblock_user('00000000-0000-0000-0000-000000000003');
delete from public.likes where user_id = auth.uid() and post_id = (select v from public.test_ids where k = 'p2');
do $$ begin
  assert (select count(*) from public.shops where slug = 'sweetcakes') = 1, 'unblock restores the shop';
  assert (select likes_count from public.posts where id = (select v from public.test_ids where k = 'p2')) = 0, 'unlike decrements';
end $$;
reset role;

-- 13. Step 5: search, filters, directory, alerts.
-- Posts: sweetcakes (Lyon) "Number cake 20 parts" 35 € creation/food (p2) and "Sac réplique de créateur" (p3);
--        drip_vintage (Paris) "Veste vintage 1..3" 45 € object/fashion (the 4th is sold).
update public.posts set title = 'Sac cabas de créateur', price_cents = 6500, type = 'object' where id = (select v from public.test_ids where k = 'p3');
update public.posts set price_cents = 2000 where id = md5('t4-2')::uuid;
update public.shops set city_id = 69123 where slug = 'sweetcakes';
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{}}', false);
do $$ declare r record; n int; begin
  -- text
  assert (select count(*) from public.search_posts('number cake')) = 1, 'full-text match';
  assert (select count(*) from public.search_posts('numbr cak')) = 1, 'typo tolerance';
  assert (select count(*) from public.search_posts('createur')) = 1 and (select count(*) from public.search_posts('CRÉATEUR')) = 1, 'accents and case ignored';
  assert (select count(*) from public.search_posts('vestes')) = 3, 'French stemming (plural) + only available posts';
  assert (select count(*) from public.search_posts('drip')) = 3, 'shop name match';
  assert (select count(*) from public.search_posts('licorne')) = 0, 'no match';
  assert (select count(*) from public.search_posts(null)) = 5 and (select count(*) from public.search_posts('   ')) = 5, 'empty query = browse everything available';
  select * into r from public.search_posts('number cake');
  assert r.shop_slug = 'sweetcakes' and r.city_name = 'Lyon' and jsonb_array_length(r.media) = 1 and r.distance_km = 0, 'same row shape as the feed';
  -- filters
  assert (select count(*) from public.search_posts(null, (select id from public.categories where slug = 'fashion'))) = 3, 'category filter';
  assert (select count(*) from public.search_posts(null, null, 'creation')) = 1, 'type filter';
  assert (select count(*) from public.search_posts(null, null, null, null, null, null, null, null, 3000)) = 1, 'price max';
  assert (select count(*) from public.search_posts(null, null, null, null, null, null, null, 4000, 5000)) = 2, 'price range';
  assert (select count(*) from public.search_posts(null, null, null, null, null, null, 30)) = 2, 'radius around my city (Lyon)';
  assert (select count(*) from public.search_posts(null, null, null, 75056, null, null, 10)) = 3, 'radius around a chosen city (Paris)';
  assert (select count(*) from public.search_posts(null, null, null, null, 48.8566, 2.3522, 10)) = 3, 'radius around a GPS position';
  assert (select count(*) from public.search_posts('vintage', null, null, null, null, null, 30)) = 0, 'text + radius combine';
  assert (select count(*) from public.search_posts(null, null, null, null, null, null, null, null, null, 4)) = 0, 'minimum rating (no review yet)';
  -- sort + pagination
  assert (select price_cents from public.search_posts(null, null, null, null, null, null, null, null, null, null, 'price_asc', 1)) = 2000, 'cheapest first';
  assert (select price_cents from public.search_posts(null, null, null, null, null, null, null, null, null, null, 'price_desc', 1)) = 6500, 'most expensive first';
  assert (select city_name from public.search_posts(null, null, null, null, null, null, null, null, null, null, 'distance', 1)) = 'Lyon', 'closest first';
  assert (select count(*) from public.search_posts(null, null, null, null, null, null, null, null, null, null, 'recent', 2, 4)) = 1, 'offset pagination';
  assert (select array_agg(city_name) from public.search_posts(null, null, null, null, null, null, null, null, null, null, 'relevance', 5)) = array['Lyon', 'Lyon', 'Paris', 'Paris', 'Paris'], 'browsing: local posts first (0014)';
  assert (select array_agg(city_name) from public.search_posts(null, null, null, 75056, null, null, null, null, null, null, 'relevance', 5)) = array['Paris', 'Paris', 'Paris', 'Lyon', 'Lyon'], 'browsing around another city';

  -- directory
  select count(*) into n from public.find_shops();
  assert n = 1, 'shops within 30 km of my city, got ' || n;
  select * into r from public.find_shops();
  assert r.slug = 'sweetcakes' and r.distance_km = 0 and r.posts_count = 2 and not r.following, 'directory row';
  assert (select count(*) from public.find_shops(null, 75056)) = 1, 'shops around Paris';
  assert (select count(*) from public.find_shops(null, null, null, null, null)) = 2, 'no radius = everywhere';
  assert (select slug from public.find_shops('drip')) = 'drip_vintage', 'shop by name, wherever it is';
  assert (select slug from public.find_shops('sweet cake')) = 'sweetcakes', 'shop by fuzzy name';
  assert (select count(*) from public.find_shops(null, null, null, null, null, (select id from public.categories where slug = 'fashion'))) = 1, 'shops selling in a category';
end $$;
-- a blocked seller disappears from search and from the directory
select public.block_user('00000000-0000-0000-0000-000000000004');
do $$ begin
  assert (select count(*) from public.search_posts('vintage')) = 0 and (select count(*) from public.find_shops('drip')) = 0, 'blocked seller hidden from search';
end $$;
select public.unblock_user('00000000-0000-0000-0000-000000000004');

-- alerts
insert into public.search_alerts (user_id, query, city_id, radius_km, price_max_cents) values (auth.uid(), 'layer cake', 69123, 30, 5000);
insert into public.search_alerts (user_id, category_id) values (auth.uid(), (select id from public.categories where slug = 'food'));
update public.search_alerts set is_active = false where query = 'layer cake';
select public.test_expect_error($q$insert into public.search_alerts (user_id, query) values ('00000000-0000-0000-0000-000000000003', 'x')$q$, 'row-level security');
select public.test_expect_error($q$insert into public.search_alerts (user_id, city_id) values (auth.uid(), 69123)$q$, 'search_alerts_has_criterion');
select public.test_expect_error($q$update public.search_alerts set query = 'hack'$q$, 'permission denied');
do $$ begin
  for i in 1..18 loop insert into public.search_alerts (user_id, query) values (auth.uid(), 'alerte ' || i); end loop;
end $$;
select public.test_expect_error($q$insert into public.search_alerts (user_id, query) values (auth.uid(), 'une de trop')$q$, 'TOO_MANY_ALERTS');
delete from public.search_alerts where query like 'alerte %';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated","app_metadata":{}}', false);
do $$ begin
  assert (select count(*) from public.search_alerts) = 0, 'alerts of others are private';
  assert (select count(*) from public.search_posts('number cake')) = 1, 'the author also finds their own post in search';
  assert (select count(*) from public.find_shops('sweet')) = 0, 'my own shop is not in the directory';
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{}}', false);
do $$ begin
  assert (select count(*) from public.feed('nearby', 30)) = 2, 'feed nearby: my city by default';
  assert (select count(*) from public.feed('nearby', 30, null, null, null, null, 10, 75056)) = 3, 'feed nearby: around a chosen city';
  assert (select count(*) from public.feed('nearby', 30, null, null, 48.8566, 2.3522, 10, 69123)) = 3, 'feed nearby: GPS wins over the chosen city';
end $$;
reset role;
SQL

$PSQL -c "drop database $DB" >/dev/null
echo "OK: migrations + smoke tests passed"

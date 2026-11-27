-- 0006 — Hardening after the first Supabase advisor run.
--
-- Supabase grants ALL on every new table, sequence and function of `public` to `anon` and
-- `authenticated` by default, leaving RLS as the only gate. From now on:
--   * `anon` has no privilege at all (the app always has a session);
--   * `authenticated` gets explicit, minimal grants, column-level on `profiles`;
--   * every function is revoked from PUBLIC/anon and granted one by one.
-- Convention: each later migration ends with the same "revoke execute ... from public, anon" footer.

-- ---------------------------------------------------------------------------
-- 1. Default privileges: stop auto-granting to the API roles.
-- ---------------------------------------------------------------------------
alter default privileges for role postgres in schema public revoke all on tables    from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Reset what migrations 0003-0005 inherited, then grant explicitly.
-- ---------------------------------------------------------------------------
drop view if exists public.public_profiles;

revoke all on all tables    in schema public  from anon, authenticated;
revoke all on all sequences in schema public  from anon, authenticated;
revoke all on all functions in schema public  from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
revoke usage on schema private from anon;

-- Reference data (writes are gated by admin-only policies below).
grant select                         on public.cities, public.categories, public.app_settings, public.banned_keywords to authenticated;
grant insert, update, delete         on public.cities, public.categories, public.banned_keywords to authenticated;
grant insert, update                 on public.app_settings to authenticated;
grant usage on sequence public.categories_id_seq, public.banned_keywords_id_seq to authenticated;

grant select, insert, update, delete on public.device_tokens to authenticated;
grant select, insert, delete         on public.blocks to authenticated;

-- Profiles: other users only ever see the public columns; the owner edits a few of them.
-- Private columns (flags, location, suspension...) are read through get_my_profile().
-- `deleted_at` is needed by the public_profiles view filter (security invoker).
grant select (id, username, display_name, avatar_url, role, city_id, created_at, deleted_at) on public.profiles to authenticated;
grant update (username, display_name, avatar_url, city_id, location, terms_accepted_at) on public.profiles to authenticated;

-- Functions.
grant execute on function public.set_active_mode(public.active_mode) to authenticated;
grant execute on function public.search_cities(text, int)            to authenticated;
grant execute on function public.auth_hook_add_claims(jsonb)         to supabase_auth_admin;
grant execute on function private.is_admin(), private.is_moderator(), private.mod_covers(text, integer),
                          private.is_blocked_between(uuid, uuid), private.paris_today(), private.immutable_unaccent(text)
  to authenticated, service_role;
grant execute on function private.setting(text) to service_role; -- only used inside security definer functions

-- ---------------------------------------------------------------------------
-- 3. Pin search_path on every function.
-- ---------------------------------------------------------------------------
alter function public.search_cities(text, int)         set search_path = '';
alter function private.immutable_unaccent(text)        set search_path = '';
alter function private.set_updated_at()                set search_path = '';
alter function private.paris_today()                   set search_path = '';
alter function private.is_admin()                      set search_path = '';
alter function private.is_moderator()                  set search_path = '';
alter function private.mod_covers(text, integer)       set search_path = '';
alter function private.is_blocked_between(uuid, uuid)  set search_path = '';
alter function private.setting(text)                   set search_path = '';
alter function private.handle_new_user()               set search_path = '';
alter function private.handle_user_phone_confirmed()   set search_path = '';
alter function public.auth_hook_add_claims(jsonb)      set search_path = '';
alter function public.set_active_mode(public.active_mode) set search_path = '';

-- ---------------------------------------------------------------------------
-- 4. Column protection keyed on the SQL role, not on JWT claims: direct API writes run as
--    `authenticated`; security definer functions and service_role do not, so they may
--    change protected columns (open_shop, moderation, webhooks...).
-- ---------------------------------------------------------------------------
create or replace function private.protect_profile_columns() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.active_mode is distinct from old.active_mode
     or new.is_moderator is distinct from old.is_moderator
     or new.is_admin is distinct from old.is_admin
     or new.moderation_scope is distinct from old.moderation_scope
     or new.moderation_zone is distinct from old.moderation_zone
     or new.phone_verified is distinct from old.phone_verified
     or new.suspended_until is distinct from old.suspended_until
     or new.referral_code is distinct from old.referral_code
     or new.referred_by is distinct from old.referred_by
     or new.deleted_at is distinct from old.deleted_at then
    raise exception 'PROTECTED_COLUMN' using hint = 'Use the dedicated server function';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Profiles access.
-- ---------------------------------------------------------------------------
-- Public columns of everyone, through the caller's own rights (no security definer view).
create view public.public_profiles with (security_invoker = true) as
  select id, username, display_name, avatar_url, role, city_id, created_at
  from public.profiles
  where deleted_at is null;
grant select on public.public_profiles to authenticated;

-- Full row of the signed-in user.
create or replace function public.get_my_profile() returns setof public.profiles
language sql stable security definer set search_path = '' as $$
  select p.* from public.profiles p where p.id = (select auth.uid())
$$;
revoke all on function public.get_my_profile() from public, anon;
grant execute on function public.get_my_profile() to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Policies: one per action, auth calls wrapped in (select ...) so they run once per query.
-- ---------------------------------------------------------------------------
drop policy if exists cities_read            on public.cities;
drop policy if exists cities_admin           on public.cities;
drop policy if exists categories_read        on public.categories;
drop policy if exists categories_admin       on public.categories;
drop policy if exists settings_read          on public.app_settings;
drop policy if exists settings_admin_write   on public.app_settings;
drop policy if exists settings_admin_update  on public.app_settings;
drop policy if exists keywords_mod_read      on public.banned_keywords;
drop policy if exists keywords_admin         on public.banned_keywords;
drop policy if exists profiles_read_own      on public.profiles;
drop policy if exists profiles_update_own    on public.profiles;
drop policy if exists profiles_admin_update  on public.profiles;
drop policy if exists device_tokens_own      on public.device_tokens;
drop policy if exists blocks_read_own        on public.blocks;
drop policy if exists blocks_insert_own      on public.blocks;
drop policy if exists blocks_delete_own      on public.blocks;

create policy cities_select on public.cities for select to authenticated using (true);
create policy cities_insert on public.cities for insert to authenticated with check ((select private.is_admin()));
create policy cities_update on public.cities for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy cities_delete on public.cities for delete to authenticated using ((select private.is_admin()));

create policy categories_select on public.categories for select to authenticated using (true);
create policy categories_insert on public.categories for insert to authenticated with check ((select private.is_admin()));
create policy categories_update on public.categories for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy categories_delete on public.categories for delete to authenticated using ((select private.is_admin()));

create policy settings_select on public.app_settings for select to authenticated
  using ((select private.is_admin()) or key like 'pricing.%' or key like 'features.%' or key like 'quota.%');
create policy settings_insert on public.app_settings for insert to authenticated with check ((select private.is_admin()));
create policy settings_update on public.app_settings for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy keywords_select on public.banned_keywords for select to authenticated using ((select private.is_moderator()));
create policy keywords_insert on public.banned_keywords for insert to authenticated with check ((select private.is_admin()));
create policy keywords_update on public.banned_keywords for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy keywords_delete on public.banned_keywords for delete to authenticated using ((select private.is_admin()));

-- Rows of everyone are visible, but only the granted public columns can be selected.
create policy profiles_select on public.profiles for select to authenticated
  using (deleted_at is null or id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy device_tokens_select on public.device_tokens for select to authenticated using (user_id = (select auth.uid()));
create policy device_tokens_insert on public.device_tokens for insert to authenticated with check (user_id = (select auth.uid()));
create policy device_tokens_update on public.device_tokens for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy device_tokens_delete on public.device_tokens for delete to authenticated using (user_id = (select auth.uid()));

create policy blocks_select on public.blocks for select to authenticated using (blocker_id = (select auth.uid()));
create policy blocks_insert on public.blocks for insert to authenticated with check (blocker_id = (select auth.uid()));
create policy blocks_delete on public.blocks for delete to authenticated using (blocker_id = (select auth.uid()));

-- Internal queue: no API role may touch it.
alter table private.job_queue enable row level security;

-- ---------------------------------------------------------------------------
-- 7. Covering indexes for foreign keys.
-- ---------------------------------------------------------------------------
create index if not exists profiles_referred_by       on public.profiles (referred_by) where referred_by is not null;
create index if not exists app_settings_updated_by    on public.app_settings (updated_by) where updated_by is not null;
create index if not exists banned_keywords_created_by on public.banned_keywords (created_by) where created_by is not null;

-- ---------------------------------------------------------------------------
-- Footer (repeat at the end of every migration that creates functions).
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public  from public, anon;
revoke execute on all functions in schema private from public, anon;

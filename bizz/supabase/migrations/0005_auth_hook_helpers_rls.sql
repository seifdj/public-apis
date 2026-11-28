-- 0005 — JWT claims hook, RLS helpers, policies for the tables created so far.

-- ---------------------------------------------------------------------------
-- Custom Access Token Hook: copies role flags into app_metadata.
-- Enable it in Dashboard > Authentication > Hooks (or supabase/config.toml locally).
-- ---------------------------------------------------------------------------
create or replace function public.auth_hook_add_claims(event jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  p record;
  claims jsonb;
begin
  select role, is_moderator, is_admin, moderation_scope, moderation_zone, phone_verified
    into p from public.profiles where id = (event->>'user_id')::uuid;
  claims := coalesce(event->'claims', '{}'::jsonb);
  if claims->'app_metadata' is null then
    claims := jsonb_set(claims, '{app_metadata}', '{}'::jsonb);
  end if;
  claims := jsonb_set(claims, '{app_metadata,role}',         to_jsonb(coalesce(p.role::text, 'client')));
  claims := jsonb_set(claims, '{app_metadata,is_moderator}', to_jsonb(coalesce(p.is_moderator, false)));
  claims := jsonb_set(claims, '{app_metadata,is_admin}',     to_jsonb(coalesce(p.is_admin, false)));
  claims := jsonb_set(claims, '{app_metadata,mod_scope}',    to_jsonb(coalesce(p.moderation_scope::text, '')));
  claims := jsonb_set(claims, '{app_metadata,mod_zone}',     to_jsonb(coalesce(p.moderation_zone, '')));
  claims := jsonb_set(claims, '{app_metadata,phone_verified}', to_jsonb(coalesce(p.phone_verified, false)));
  return jsonb_set(event, '{claims}', claims);
end $$;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.auth_hook_add_claims to supabase_auth_admin;
revoke execute on function public.auth_hook_add_claims from authenticated, anon, public;
grant select on table public.profiles to supabase_auth_admin;

-- ---------------------------------------------------------------------------
-- Helpers used by every policy.
-- ---------------------------------------------------------------------------
create or replace function private.is_admin() returns boolean
language sql stable as $$
  select coalesce((auth.jwt()->'app_metadata'->>'is_admin')::boolean, false)
$$;

create or replace function private.is_moderator() returns boolean
language sql stable as $$
  select private.is_admin() or coalesce((auth.jwt()->'app_metadata'->>'is_moderator')::boolean, false)
$$;

-- Does the current moderator cover this department / city?
create or replace function private.mod_covers(dept text, city integer) returns boolean
language sql stable as $$
  select private.is_admin()
      or (private.is_moderator() and (
            (auth.jwt()->'app_metadata'->>'mod_scope') = 'all'
         or ((auth.jwt()->'app_metadata'->>'mod_scope') = 'department' and (auth.jwt()->'app_metadata'->>'mod_zone') = dept)
         or ((auth.jwt()->'app_metadata'->>'mod_scope') = 'city'       and (auth.jwt()->'app_metadata'->>'mod_zone') = city::text)))
$$;

create or replace function private.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a))
$$;

create or replace function private.setting(k text) returns jsonb
language sql stable security definer set search_path = public as $$
  select value from public.app_settings where key = k
$$;

grant execute on function private.is_admin, private.is_moderator, private.mod_covers, private.is_blocked_between, private.setting, private.paris_today to authenticated, service_role;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Public, read-only view of profiles (what other users may see).
-- ---------------------------------------------------------------------------
create view public.public_profiles with (security_invoker = false) as
  select id, username, display_name, avatar_url, role, city_id, created_at
  from public.profiles
  where deleted_at is null;
grant select on public.public_profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Column protection: a user cannot promote themselves.
-- ---------------------------------------------------------------------------
create or replace function private.protect_profile_columns() returns trigger
language plpgsql as $$
begin
  if current_setting('request.jwt.claims', true) is null or private.is_admin() then
    return new; -- service role / migrations / admin
  end if;
  if new.role is distinct from old.role
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
create trigger profiles_protect_columns before update on public.profiles
  for each row execute function private.protect_profile_columns();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
-- Switch navigation mode (seller accounts only).
create or replace function public.set_active_mode(p_mode public.active_mode) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set active_mode = p_mode
   where id = auth.uid() and (p_mode = 'client' or role = 'seller');
  if not found then raise exception 'NOT_A_SELLER'; end if;
end $$;
grant execute on function public.set_active_mode to authenticated;

-- City picker (accent-insensitive, typo-tolerant).
create or replace function public.search_cities(q text, max_results int default 10)
returns setof public.cities
language sql stable as $$
  select c.* from public.cities c
  where c.slug ilike '%' || private.immutable_unaccent(lower(q)) || '%'
     or c.postal_codes @> array[q]
  order by (c.slug ilike private.immutable_unaccent(lower(q)) || '%') desc, c.population desc nulls last
  limit least(max_results, 50)
$$;
grant execute on function public.search_cities to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.cities          enable row level security;
alter table public.categories      enable row level security;
alter table public.app_settings    enable row level security;
alter table public.banned_keywords enable row level security;
alter table public.profiles        enable row level security;
alter table public.device_tokens   enable row level security;
alter table public.blocks          enable row level security;

-- Reference data: readable by every signed-in user, writable by admins.
create policy cities_read on public.cities for select to authenticated using (true);
create policy cities_admin on public.cities for all to authenticated using (private.is_admin()) with check (private.is_admin());

create policy categories_read on public.categories for select to authenticated using (true);
create policy categories_admin on public.categories for all to authenticated using (private.is_admin()) with check (private.is_admin());

create policy settings_read on public.app_settings for select to authenticated
  using (private.is_admin() or key like 'pricing.%' or key like 'features.%' or key like 'quota.%');
create policy settings_admin_write on public.app_settings for insert to authenticated with check (private.is_admin());
create policy settings_admin_update on public.app_settings for update to authenticated using (private.is_admin()) with check (private.is_admin());

create policy keywords_mod_read on public.banned_keywords for select to authenticated using (private.is_moderator());
create policy keywords_admin on public.banned_keywords for all to authenticated using (private.is_admin()) with check (private.is_admin());

-- Profiles: own row in full; moderators/admins see everyone. Others use public_profiles.
create policy profiles_read_own on public.profiles for select to authenticated
  using (id = auth.uid() or private.is_moderator());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_update on public.profiles for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy device_tokens_own on public.device_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy blocks_read_own on public.blocks for select to authenticated using (blocker_id = auth.uid());
create policy blocks_insert_own on public.blocks for insert to authenticated with check (blocker_id = auth.uid());
create policy blocks_delete_own on public.blocks for delete to authenticated using (blocker_id = auth.uid());

-- Default privileges: PostgREST roles need table grants on top of RLS.
grant select on public.cities, public.categories, public.app_settings, public.banned_keywords, public.profiles, public.device_tokens, public.blocks to authenticated;
grant insert, update, delete on public.cities, public.categories, public.banned_keywords to authenticated; -- gated by RLS (admin)
grant insert, update on public.app_settings to authenticated;                                            -- gated by RLS (admin)
grant update on public.profiles to authenticated;
grant insert, update, delete on public.device_tokens, public.blocks to authenticated;

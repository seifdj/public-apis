-- 0003 — Reference cities, profiles, device tokens, blocks.

create table public.cities (
  id            integer primary key,
  insee_code    text unique not null,
  name          text not null,
  slug          text not null,
  department    text not null,
  region        text,
  postal_codes  text[] not null default '{}',
  population    integer,
  location      extensions.geography(Point, 4326) not null
);
create index cities_slug_trgm on public.cities using gin (slug extensions.gin_trgm_ops);
create index cities_department on public.cities (department);
create index cities_location on public.cities using gist (location);
comment on table public.cities is 'French communes (INSEE). Loaded by scripts/load-cities.ts.';

create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  username          extensions.citext unique not null,
  display_name      text not null,
  avatar_url        text,
  phone_verified    boolean not null default false,
  role              public.user_role not null default 'client',
  active_mode       public.active_mode not null default 'client',
  is_moderator      boolean not null default false,
  is_admin          boolean not null default false,
  moderation_scope  public.moderation_scope,
  moderation_zone   text,
  city_id           integer references public.cities(id),
  location          extensions.geography(Point, 4326),
  referral_code     text unique not null default upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 8)),
  referred_by       uuid references public.profiles(id),
  terms_accepted_at timestamptz,
  suspended_until   timestamptz,
  deleted_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint profiles_username_format check (username::text ~ '^[a-z0-9_]{3,24}$'),
  constraint profiles_display_name_len check (char_length(display_name) between 1 and 40),
  constraint profiles_moderator_scope check (is_moderator = false or moderation_scope is not null),
  constraint profiles_moderator_zone check (moderation_scope is distinct from 'all' or moderation_zone is null),
  constraint profiles_seller_mode check (active_mode = 'client' or role = 'seller')
);
create index profiles_city on public.profiles (city_id);
create index profiles_moderators on public.profiles (moderation_scope, moderation_zone) where is_moderator;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function private.set_updated_at();

-- Auto-create a profile for each new auth user. Username is provisional until profile setup.
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_username text := 'user_' || substr(md5(new.id::text), 1, 10);
  v_name text := coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), 'Nouveau membre');
begin
  insert into public.profiles (id, username, display_name, phone_verified)
  values (new.id, v_username, v_name, new.phone_confirmed_at is not null);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- Keep phone_verified in sync when the phone gets confirmed later.
create or replace function private.handle_user_phone_confirmed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.phone_confirmed_at is not null and (old.phone_confirmed_at is null) then
    update public.profiles set phone_verified = true where id = new.id;
  end if;
  return new;
end $$;
create trigger on_auth_user_phone_confirmed after update of phone_confirmed_at on auth.users
  for each row execute function private.handle_user_phone_confirmed();

create table public.device_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  expo_token    text not null unique,
  platform      text not null check (platform in ('ios', 'android')),
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
create index device_tokens_user on public.device_tokens (user_id);

create table public.blocks (
  blocker_id  uuid not null references public.profiles(id) on delete cascade,
  blocked_id  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);
create index blocks_blocked on public.blocks (blocked_id);

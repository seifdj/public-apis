-- 0007 — Step 2: profile completion, shops ("Je propose"), account deletion request.

-- ---------------------------------------------------------------------------
-- Shops
-- ---------------------------------------------------------------------------
create table public.shops (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid unique not null references public.profiles(id) on delete cascade,
  slug            extensions.citext unique not null,     -- = username when the shop is opened
  name            text not null,
  bio             text,
  avatar_url      text,
  cover_url       text,
  city_id         integer not null references public.cities(id),
  location        extensions.geography(Point, 4326) not null,
  instagram       text,
  snapchat        text,
  tiktok          text,
  whatsapp        text,
  status          public.shop_status not null default 'active',
  is_founder      boolean not null default false,
  founder_rank    integer unique,
  followers_count integer not null default 0,
  posts_count     integer not null default 0,
  rating_avg      numeric(3,2),
  rating_count    integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  constraint shops_name_len    check (char_length(name) between 2 and 40),
  constraint shops_bio_len     check (bio is null or char_length(bio) <= 300),
  constraint shops_handles_len check (coalesce(char_length(instagram), 0) <= 30 and coalesce(char_length(snapchat), 0) <= 30
                                      and coalesce(char_length(tiktok), 0) <= 30 and coalesce(char_length(whatsapp), 0) <= 20)
);
create index shops_location on public.shops using gist (location);
create index shops_city on public.shops (city_id) where status = 'active' and deleted_at is null;
create trigger shops_set_updated_at before update on public.shops for each row execute function private.set_updated_at();

-- The shop position always follows its city.
create or replace function private.shops_sync_city_location() returns trigger
language plpgsql set search_path = '' as $$
begin
  select c.location into new.location from public.cities c where c.id = new.city_id;
  if new.location is null then raise exception 'INVALID_CITY'; end if;
  return new;
end $$;
create trigger shops_sync_city_location before insert or update of city_id on public.shops
  for each row execute function private.shops_sync_city_location();

alter table public.shops enable row level security;
grant select on public.shops to authenticated;
grant update (name, bio, avatar_url, cover_url, city_id, instagram, snapchat, tiktok, whatsapp) on public.shops to authenticated;

create policy shops_select on public.shops for select to authenticated
  using ((status = 'active' and deleted_at is null) or owner_id = (select auth.uid()) or (select private.is_moderator()));
create policy shops_update on public.shops for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Usernames
-- ---------------------------------------------------------------------------
create or replace function private.normalize_username(p text) returns text
language sql immutable set search_path = '' as $$
  select lower(btrim(coalesce(p, '')))
$$;

create or replace function private.username_is_reserved(p text) returns boolean
language sql immutable set search_path = '' as $$
  select p = any (array['admin', 'administrateur', 'bizz', 'bizzplus', 'bizz_plus', 'support', 'moderation', 'moderateur',
                        'modo', 'contact', 'help', 'aide', 'official', 'officiel', 'root', 'system', 'null', 'undefined',
                        'anonymous', 'equipe', 'team', 'staff', 'securite', 'security'])
      or p like 'user\_%'
$$;

-- Live check used by the profile form. Format, reserved words, then uniqueness.
create or replace function public.is_username_available(p_username text) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.normalize_username(p_username) ~ '^[a-z0-9_]{3,24}$'
     and not private.username_is_reserved(private.normalize_username(p_username))
     and not exists (
       select 1 from public.profiles p
        where p.username operator(extensions.=) private.normalize_username(p_username)::extensions.citext
          and p.id <> (select auth.uid()))
$$;

-- ---------------------------------------------------------------------------
-- Profile completion (end of sign-up): username, name, city, terms.
-- ---------------------------------------------------------------------------
create or replace function public.complete_profile(
  p_username text, p_display_name text, p_city_id integer, p_avatar_url text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_username text := private.normalize_username(p_username);
  v_name text := btrim(coalesce(p_display_name, ''));
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if v_username !~ '^[a-z0-9_]{3,24}$' or private.username_is_reserved(v_username) then raise exception 'INVALID_USERNAME'; end if;
  if char_length(v_name) not between 1 and 40 then raise exception 'INVALID_DISPLAY_NAME'; end if;
  if not exists (select 1 from public.cities c where c.id = p_city_id) then raise exception 'INVALID_CITY'; end if;

  begin
    update public.profiles
       set username = v_username::extensions.citext,
           display_name = v_name,
           city_id = p_city_id,
           avatar_url = coalesce(p_avatar_url, avatar_url),
           terms_accepted_at = coalesce(terms_accepted_at, now())
     where id = v_uid and deleted_at is null;
    if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  exception when unique_violation then
    raise exception 'USERNAME_TAKEN';
  end;
end $$;

-- ---------------------------------------------------------------------------
-- "Ouvre ta boutique": creates the shop and turns the account into a seller.
-- ---------------------------------------------------------------------------
create or replace function private.clean_handle(p text) returns text
language sql immutable set search_path = '' as $$
  select nullif(regexp_replace(btrim(coalesce(p, '')), '^@+', ''), '')
$$;

create or replace function public.open_shop(
  p_name text,
  p_bio text default null,
  p_city_id integer default null,
  p_instagram text default null,
  p_snapchat text default null,
  p_tiktok text default null,
  p_whatsapp text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_city integer;
  v_name text := btrim(coalesce(p_name, ''));
  v_bio text := nullif(btrim(coalesce(p_bio, '')), '');
  v_whatsapp text := nullif(regexp_replace(coalesce(p_whatsapp, ''), '[^0-9+]', '', 'g'), '');
  v_rank integer;
  v_shop_id uuid;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into v_profile from public.profiles where id = v_uid;
  if not found or v_profile.deleted_at is not null then raise exception 'PROFILE_NOT_FOUND'; end if;
  if v_profile.terms_accepted_at is null then raise exception 'PROFILE_INCOMPLETE'; end if;
  if v_profile.suspended_until is not null and v_profile.suspended_until > now() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if exists (select 1 from public.shops s where s.owner_id = v_uid) then raise exception 'SHOP_EXISTS'; end if;
  if char_length(v_name) not between 2 and 40 then raise exception 'INVALID_SHOP_NAME'; end if;
  if v_bio is not null and char_length(v_bio) > 300 then raise exception 'INVALID_SHOP_BIO'; end if;

  v_city := coalesce(p_city_id, v_profile.city_id);
  if v_city is null or not exists (select 1 from public.cities c where c.id = v_city) then raise exception 'INVALID_CITY'; end if;

  -- Founder badge for the first N shops; serialized so two sign-ups cannot take the same rank.
  perform pg_advisory_xact_lock(hashtext('bizz.founder_rank'));
  select coalesce(max(s.founder_rank), 0) + 1 into v_rank from public.shops s;
  if v_rank > (private.setting('quota.founder_limit'))::int then v_rank := null; end if;

  insert into public.shops (owner_id, slug, name, bio, city_id, location, instagram, snapchat, tiktok, whatsapp, is_founder, founder_rank, avatar_url)
  values (v_uid, v_profile.username, v_name, v_bio, v_city,
          (select c.location from public.cities c where c.id = v_city),
          left(private.clean_handle(p_instagram), 30), left(private.clean_handle(p_snapchat), 30),
          left(private.clean_handle(p_tiktok), 30), left(v_whatsapp, 20),
          v_rank is not null, v_rank, v_profile.avatar_url)
  returning id into v_shop_id;

  update public.profiles set role = 'seller', active_mode = 'seller' where id = v_uid;
  return v_shop_id;
end $$;

-- ---------------------------------------------------------------------------
-- Account deletion (in-app, required by both stores). The account and its shop disappear
-- at once; the permanent erasure job arrives with step 14. Until then it can be undone.
-- ---------------------------------------------------------------------------
create or replace function public.request_account_deletion() returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  update public.profiles set deleted_at = now(), active_mode = 'client' where id = v_uid and deleted_at is null;
  update public.shops set deleted_at = now() where owner_id = v_uid and deleted_at is null;
  delete from public.device_tokens where user_id = v_uid;
end $$;

create or replace function public.cancel_account_deletion() returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  update public.profiles set deleted_at = null where id = v_uid;
  update public.shops set deleted_at = null where owner_id = v_uid;
end $$;

-- A seller's active_mode can never point to a deleted or missing shop.
create or replace function public.set_active_mode(p_mode public.active_mode) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles p set active_mode = p_mode
   where p.id = auth.uid()
     and (p_mode = 'client' or (p.role = 'seller' and exists (select 1 from public.shops s where s.owner_id = p.id and s.deleted_at is null)));
  if not found then raise exception 'NOT_A_SELLER'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Grants + footer
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public  from public, anon;
revoke execute on all functions in schema private from public, anon;
grant execute on function public.is_username_available(text)                              to authenticated;
grant execute on function public.complete_profile(text, text, integer, text)              to authenticated;
grant execute on function public.open_shop(text, text, integer, text, text, text, text)   to authenticated;
grant execute on function public.request_account_deletion()                               to authenticated;
grant execute on function public.cancel_account_deletion()                                to authenticated;
grant execute on function public.set_active_mode(public.active_mode)                      to authenticated;

-- 0009 — Step 3: posts, media, daily quota and credits. Every publication goes through
-- create_post(), which checks and consumes the quota in the same transaction as the insert.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create or replace function private.post_search_vector(p_title text, p_hashtags text[], p_description text) returns tsvector
language sql immutable parallel safe set search_path = '' as $$
  select setweight(to_tsvector('french'::regconfig, private.immutable_unaccent(coalesce(p_title, ''))), 'A')
      || setweight(to_tsvector('french'::regconfig, private.immutable_unaccent(coalesce(array_to_string(p_hashtags, ' '), ''))), 'B')
      || setweight(to_tsvector('french'::regconfig, private.immutable_unaccent(coalesce(p_description, ''))), 'C')
$$;

create table public.posts (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references public.shops(id) on delete cascade,
  author_id       uuid not null references public.profiles(id) on delete cascade,
  type            public.post_type not null,
  title           text not null,
  description     text,
  hashtags        text[] not null default '{}',
  price_mode      public.price_mode not null default 'fixed',
  price_cents     integer,
  currency        char(3) not null default 'EUR',
  category_id     smallint not null references public.categories(id),
  city_id         integer not null references public.cities(id),
  location        extensions.geography(Point, 4326) not null,
  status          public.post_status not null default 'available',
  visibility      public.visibility not null default 'visible',
  published_at    timestamptz not null default now(),
  bumped_at       timestamptz not null default now(),
  expires_at      timestamptz not null,
  likes_count     integer not null default 0,
  saves_count     integer not null default 0,
  views_count     integer not null default 0,
  conversations_count integer not null default 0,
  search_vector   tsvector generated always as (private.post_search_vector(title, hashtags, description)) stored,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  constraint posts_title_len       check (char_length(title) between 3 and 80),
  constraint posts_description_len check (description is null or char_length(description) <= 1000),
  constraint posts_price           check ((price_mode = 'on_quote' and price_cents is null) or (price_mode = 'fixed' and price_cents between 0 and 100000000)),
  constraint posts_hashtags_max    check (cardinality(hashtags) <= 10)
);
create index posts_feed            on public.posts (bumped_at desc) where deleted_at is null and visibility = 'visible' and status = 'available';
create index posts_shop            on public.posts (shop_id, published_at desc) where deleted_at is null;
create index posts_author          on public.posts (author_id, published_at desc) where deleted_at is null;
create index posts_category_recent on public.posts (category_id, bumped_at desc) where deleted_at is null and visibility = 'visible' and status = 'available';
create index posts_city            on public.posts (city_id, bumped_at desc) where deleted_at is null;
create index posts_location        on public.posts using gist (location);
create index posts_search          on public.posts using gin (search_vector);
create index posts_title_trgm      on public.posts using gin (title extensions.gin_trgm_ops);
create index posts_expires         on public.posts (expires_at) where status <> 'expired';

create table public.post_media (
  id              uuid primary key default gen_random_uuid(),
  post_id         uuid not null references public.posts(id) on delete cascade,
  kind            public.media_kind not null,
  position        smallint not null default 0,
  storage_path    text,
  width           integer,
  height          integer,
  blurhash        text,
  mux_upload_id   text,
  mux_asset_id    text,
  mux_playback_id text,
  video_state     public.video_state,
  duration_s      numeric(6,2),
  created_at      timestamptz not null default now(),
  unique (post_id, position),
  constraint post_media_source check ((kind = 'image' and storage_path is not null) or (kind = 'video' and mux_upload_id is not null))
);

create table public.daily_post_usage (
  user_id  uuid not null references public.profiles(id) on delete cascade,
  day      date not null,                 -- Paris day
  count    integer not null default 0 check (count >= 0),
  primary key (user_id, day)
);

create table public.post_credits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  source      public.credit_source not null,
  amount      integer not null check (amount > 0),
  remaining   integer not null check (remaining >= 0),
  expires_at  timestamptz not null,
  purchase_id uuid,                       -- -> purchases.id (step 9)
  note        text,
  created_at  timestamptz not null default now(),
  constraint post_credits_remaining check (remaining <= amount)
);
create index post_credits_user on public.post_credits (user_id, expires_at) where remaining > 0;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create trigger posts_set_updated_at before update on public.posts for each row execute function private.set_updated_at();
create trigger posts_sync_city_location before insert or update of city_id on public.posts
  for each row execute function private.shops_sync_city_location();

-- Sellers change the status themselves (Dispo / Réservé / Vendu). An expired post cannot be
-- revived that way: publishing it again costs a publication.
create or replace function private.posts_guard_status() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') or new.status is not distinct from old.status then
    return new;
  end if;
  if old.status = 'expired' or old.expires_at <= now() then raise exception 'POST_EXPIRED'; end if;
  if new.status = 'expired' then raise exception 'INVALID_STATUS'; end if;
  return new;
end $$;
create trigger posts_guard_status before update of status on public.posts
  for each row execute function private.posts_guard_status();

-- shops.posts_count = visible, non-deleted posts.
create or replace function private.posts_refresh_shop_count() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_shop uuid := coalesce(new.shop_id, old.shop_id);
begin
  update public.shops s
     set posts_count = (select count(*) from public.posts p where p.shop_id = v_shop and p.deleted_at is null and p.visibility = 'visible')
   where s.id = v_shop;
  return null;
end $$;
create trigger posts_refresh_shop_count after insert or delete or update of deleted_at, visibility on public.posts
  for each row execute function private.posts_refresh_shop_count();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.posts            enable row level security;
alter table public.post_media       enable row level security;
alter table public.daily_post_usage enable row level security;
alter table public.post_credits     enable row level security;

grant select on public.posts, public.post_media, public.daily_post_usage, public.post_credits to authenticated;
grant update (status) on public.posts to authenticated;   -- everything else goes through update_post()

create policy posts_select on public.posts for select to authenticated using (
  deleted_at is null and (
    author_id = (select auth.uid())
    or (select private.is_moderator())
    or (visibility = 'visible' and status <> 'expired' and expires_at > now()
        and exists (select 1 from public.shops s where s.id = posts.shop_id and s.status = 'active' and s.deleted_at is null)
        and not private.is_blocked_between((select auth.uid()), author_id))
  )
);
create policy posts_update on public.posts for update to authenticated
  using (author_id = (select auth.uid()) and deleted_at is null) with check (author_id = (select auth.uid()));

-- A media row is visible exactly when its post is.
create policy post_media_select on public.post_media for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_media.post_id));

create policy daily_post_usage_select on public.daily_post_usage for select to authenticated using (user_id = (select auth.uid()));
create policy post_credits_select     on public.post_credits     for select to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
-- '#Layer Cake', 'ANNIV' -> {layercake, anniv}; max 10 tags of 30 chars, duplicates removed.
create or replace function private.sanitize_hashtags(p text[]) returns text[]
language sql immutable set search_path = '' as $$
  with cleaned as (
    select left(regexp_replace(private.immutable_unaccent(lower(x)), '[^a-z0-9_]', '', 'g'), 30) as t, ord
    from unnest(coalesce(p, '{}'::text[])) with ordinality as u(x, ord)
  ), dedup as (
    select t, min(ord) as ord from cleaned where t <> '' group by t
  )
  select coalesce(array_agg(t order by ord), '{}'::text[]) from (select t, ord from dedup order by ord limit 10) z
$$;

-- First banned keyword found as a whole word (optional plural), accents and case ignored.
-- Whole words only: "arme" must not block "parmesan" or "charme".
create or replace function private.find_banned_keyword(p_text text, p_severity text) returns text
language sql stable security definer set search_path = '' as $$
  select k.term from public.banned_keywords k
   where k.severity = p_severity
     and private.immutable_unaccent(lower(coalesce(p_text, '')))
         ~ ('\m' || regexp_replace(private.immutable_unaccent(lower(k.term)), '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g') || 's?\M')
   order by k.id
   limit 1
$$;

-- Validates the editable fields of a post. Raises a coded exception on the first problem.
create or replace function private.check_post_fields(p jsonb) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  v_title text := btrim(coalesce(p->>'title', ''));
  v_description text := btrim(coalesce(p->>'description', ''));
  v_bad text;
begin
  if char_length(v_title) not between 3 and 80 then raise exception 'INVALID_TITLE'; end if;
  if char_length(v_description) > 1000 then raise exception 'INVALID_DESCRIPTION'; end if;
  if coalesce(p->>'type', '') not in ('object', 'service', 'creation', 'rental') then raise exception 'INVALID_TYPE'; end if;
  if coalesce(p->>'price_mode', 'fixed') not in ('fixed', 'on_quote') then raise exception 'INVALID_PRICE'; end if;
  if coalesce(p->>'price_mode', 'fixed') = 'fixed' then
    if coalesce(p->>'price_cents', '') !~ '^[0-9]{1,9}$' or (p->>'price_cents')::bigint > 100000000 then raise exception 'INVALID_PRICE'; end if;
  end if;
  if coalesce(p->>'category_id', '') !~ '^[0-9]{1,4}$'
     or not exists (select 1 from public.categories c where c.id = (p->>'category_id')::smallint and c.is_active) then
    raise exception 'INVALID_CATEGORY';
  end if;
  if coalesce(p->>'city_id', '') !~ '^[0-9]{1,9}$'
     or not exists (select 1 from public.cities c where c.id = (p->>'city_id')::integer) then
    raise exception 'INVALID_CITY';
  end if;
  if jsonb_typeof(coalesce(p->'hashtags', '[]'::jsonb)) <> 'array' then raise exception 'INVALID_HASHTAGS'; end if;

  v_bad := private.find_banned_keyword(v_title || ' ' || v_description || ' ' ||
             coalesce((select string_agg(x, ' ') from jsonb_array_elements_text(coalesce(p->'hashtags', '[]'::jsonb)) x), ''), 'block');
  if v_bad is not null then raise exception 'FORBIDDEN_CONTENT' using detail = v_bad; end if;
end $$;

-- Replaces the media of a post. Images must already be uploaded in the author's own folder.
create or replace function private.set_post_media(p_post_id uuid, p_uid uuid, p_media jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_images int; v_videos int; v_total int;
begin
  if p_media is null or jsonb_typeof(p_media) <> 'array' then raise exception 'INVALID_MEDIA'; end if;
  select count(*), count(*) filter (where m->>'kind' = 'image'), count(*) filter (where m->>'kind' = 'video')
    into v_total, v_images, v_videos from jsonb_array_elements(p_media) m;
  if v_videos > 0 and not coalesce((private.setting('features.video'))::boolean, false) then raise exception 'VIDEO_DISABLED'; end if;
  if v_total <> v_images + v_videos or not ((v_images between 1 and 10 and v_videos = 0) or (v_videos = 1 and v_images = 0)) then
    raise exception 'INVALID_MEDIA';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_media) m
     where m->>'kind' = 'image'
       and (coalesce(m->>'storage_path', '') not like p_uid::text || '/%'
            or m->>'storage_path' like '%..%'
            or not exists (select 1 from storage.objects o where o.bucket_id = 'post-media' and o.name = m->>'storage_path'))
  ) then
    raise exception 'INVALID_MEDIA' using detail = 'file missing or outside the author folder';
  end if;

  delete from public.post_media where post_id = p_post_id;
  insert into public.post_media (post_id, kind, position, storage_path, width, height, blurhash, mux_upload_id, video_state)
  select p_post_id, (m->>'kind')::public.media_kind, (ord - 1)::smallint, m->>'storage_path',
         nullif(m->>'width', '')::integer, nullif(m->>'height', '')::integer, m->>'blurhash',
         m->>'mux_upload_id', case when m->>'kind' = 'video' then 'uploading'::public.video_state end
    from jsonb_array_elements(p_media) with ordinality as t(m, ord);
end $$;

-- ---------------------------------------------------------------------------
-- Quota
-- ---------------------------------------------------------------------------
-- Consumes one publication: the free daily one first, then the credit closest to expiry.
-- The row lock makes two simultaneous publications queue up instead of both passing.
create or replace function private.consume_post_quota(p_uid uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_day date := private.paris_today();
  v_limit int := coalesce((private.setting('quota.free_daily'))::int, 1);
  v_used int;
  v_credit uuid;
begin
  insert into public.daily_post_usage (user_id, day, count) values (p_uid, v_day, 0)
    on conflict (user_id, day) do nothing;
  select d.count into v_used from public.daily_post_usage d where d.user_id = p_uid and d.day = v_day for update;

  if v_used < v_limit then
    update public.daily_post_usage set count = count + 1 where user_id = p_uid and day = v_day;
    return 'free';
  end if;

  select c.id into v_credit from public.post_credits c
   where c.user_id = p_uid and c.remaining > 0 and c.expires_at > now()
   order by c.expires_at asc, c.created_at asc
   limit 1 for update;
  if v_credit is null then raise exception 'QUOTA_EXCEEDED'; end if;
  update public.post_credits set remaining = remaining - 1 where id = v_credit;
  return 'credit';
end $$;

-- State of the quota for the "Publier" screen.
create or replace function public.get_post_allowance()
returns table (free_daily integer, used_today integer, credits integer, can_post boolean, next_reset timestamptz, has_bizzplus boolean)
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  free_daily := coalesce((private.setting('quota.free_daily'))::int, 1);
  select coalesce(max(d.count), 0) into used_today from public.daily_post_usage d where d.user_id = v_uid and d.day = private.paris_today();
  select coalesce(sum(c.remaining), 0)::int into credits from public.post_credits c where c.user_id = v_uid and c.remaining > 0 and c.expires_at > now();
  can_post := used_today < free_daily or credits > 0;
  next_reset := ((private.paris_today() + 1)::timestamp at time zone 'Europe/Paris');
  has_bizzplus := false;   -- step 9
  return next;
end $$;

-- Credits granted outside a purchase (support, tests, referral). Purchases arrive with step 9.
create or replace function private.grant_post_credits(p_user uuid, p_amount integer, p_source public.credit_source, p_note text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  insert into public.post_credits (user_id, source, amount, remaining, expires_at, note)
  values (p_user, p_source, p_amount, p_amount,
          now() + make_interval(days => coalesce((private.setting('quota.credit_validity_days'))::int, 30)), p_note)
  returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Publishing
-- ---------------------------------------------------------------------------
create or replace function public.create_post(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_shop public.shops%rowtype;
  v_post_id uuid;
  v_flag text;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;

  -- 1. Account prerequisites
  select * into v_profile from public.profiles where id = v_uid and deleted_at is null;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  if v_profile.suspended_until is not null and v_profile.suspended_until > now() then raise exception 'ACCOUNT_SUSPENDED'; end if;
  select * into v_shop from public.shops where owner_id = v_uid and deleted_at is null;
  if not found then raise exception 'NO_SHOP'; end if;
  if v_shop.status <> 'active' then raise exception 'SHOP_SUSPENDED'; end if;
  if not v_profile.phone_verified then raise exception 'PHONE_NOT_VERIFIED'; end if;

  -- 2. Content
  perform private.check_post_fields(p);

  -- 3. Quota: locks, consumes, or raises QUOTA_EXCEEDED. Rolled back with the rest on any later error.
  perform private.consume_post_quota(v_uid);

  -- 4. Insert (location is filled from the city by trigger)
  insert into public.posts (shop_id, author_id, type, title, description, hashtags, price_mode, price_cents, category_id, city_id, location, expires_at)
  values (v_shop.id, v_uid, (p->>'type')::public.post_type, btrim(p->>'title'), nullif(btrim(coalesce(p->>'description', '')), ''),
          private.sanitize_hashtags(array(select jsonb_array_elements_text(coalesce(p->'hashtags', '[]'::jsonb)))),
          coalesce(p->>'price_mode', 'fixed')::public.price_mode,
          case when coalesce(p->>'price_mode', 'fixed') = 'fixed' then (p->>'price_cents')::integer end,
          (p->>'category_id')::smallint, (p->>'city_id')::integer, v_shop.location,
          now() + make_interval(days => coalesce((private.setting('quota.post_expiry_days'))::int, 60)))
  returning id into v_post_id;

  perform private.set_post_media(v_post_id, v_uid, p->'media');

  -- 5. "flag" keywords publish the post but queue it for the moderation team (step 10).
  v_flag := private.find_banned_keyword(coalesce(p->>'title', '') || ' ' || coalesce(p->>'description', ''), 'flag');
  if v_flag is not null then
    insert into private.job_queue (kind, payload) values ('keyword_flag', jsonb_build_object('post_id', v_post_id, 'term', v_flag));
  end if;

  return v_post_id;
end $$;

-- Editing never consumes quota. Same payload as create_post; `media` is optional (kept when absent).
create or replace function public.update_post(p_post_id uuid, p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not exists (select 1 from public.posts where id = p_post_id and author_id = v_uid and deleted_at is null) then raise exception 'POST_NOT_FOUND'; end if;
  perform private.check_post_fields(p);

  update public.posts
     set type = (p->>'type')::public.post_type,
         title = btrim(p->>'title'),
         description = nullif(btrim(coalesce(p->>'description', '')), ''),
         hashtags = private.sanitize_hashtags(array(select jsonb_array_elements_text(coalesce(p->'hashtags', '[]'::jsonb)))),
         price_mode = coalesce(p->>'price_mode', 'fixed')::public.price_mode,
         price_cents = case when coalesce(p->>'price_mode', 'fixed') = 'fixed' then (p->>'price_cents')::integer end,
         category_id = (p->>'category_id')::smallint,
         city_id = (p->>'city_id')::integer
   where id = p_post_id;

  if p ? 'media' then perform private.set_post_media(p_post_id, v_uid, p->'media'); end if;
end $$;

create or replace function public.delete_post(p_post_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.posts set deleted_at = now() where id = p_post_id and author_id = auth.uid() and deleted_at is null;
  if not found then raise exception 'POST_NOT_FOUND'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Grants + footer
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public  from public, anon;
revoke execute on all functions in schema private from public, anon;
grant execute on function public.get_post_allowance()          to authenticated;
grant execute on function public.create_post(jsonb)            to authenticated;
grant execute on function public.update_post(uuid, jsonb)      to authenticated;
grant execute on function public.delete_post(uuid)             to authenticated;
grant execute on function private.grant_post_credits(uuid, integer, public.credit_source, text) to service_role;
-- The generated column posts.search_vector is recomputed on every update, with the caller's rights.
grant execute on function private.post_search_vector(text, text[], text) to authenticated, service_role;

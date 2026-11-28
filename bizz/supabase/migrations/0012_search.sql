-- 0012 — Step 5: search with filters, sellers directory, search alerts.
-- Both search functions run with the caller's rights: the posts and shops policies apply.

create index if not exists shops_name_trgm on public.shops using gin (name extensions.gin_trgm_ops);

-- Where "near me" is measured from: explicit position (GPS), else a chosen city, else my profile city.
create or replace function private.search_origin(p_lat double precision, p_lng double precision, p_city_id integer)
returns extensions.geography
language sql stable set search_path = '' as $$
  select coalesce(
    case when p_lat is not null and p_lng is not null
         then extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)::extensions.geography end,
    (select c.location from public.cities c where c.id = p_city_id),
    (select c.location from public.profiles pr join public.cities c on c.id = pr.city_id where pr.id = (select auth.uid()))
  )
$$;

-- ---------------------------------------------------------------------------
-- Posts search. Same row shape as feed(), so the app reuses its types and cards.
--   text   : French full-text (accents ignored) OR fuzzy match on title + hashtags (typos) OR shop name
--   filters: category, type, price range, minimum shop rating, radius around the origin
--   sort   : relevance (default with a query), recent, price_asc, price_desc, distance
-- ---------------------------------------------------------------------------
create or replace function public.search_posts(
  p_query text default null,
  p_category_id smallint default null,
  p_type public.post_type default null,
  p_city_id integer default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_km integer default null,
  p_price_min integer default null,
  p_price_max integer default null,
  p_min_rating numeric default null,
  p_sort text default 'relevance',
  p_limit integer default 24,
  p_offset integer default 0
) returns table (
  id uuid, shop_id uuid, author_id uuid, type public.post_type, title text, description text, hashtags text[],
  price_mode public.price_mode, price_cents integer, status public.post_status, category_id smallint,
  city_id integer, city_name text, department text, published_at timestamptz, likes_count integer, saves_count integer,
  media jsonb, shop_slug text, shop_name text, shop_avatar_url text, shop_is_founder boolean,
  liked boolean, saved boolean, following boolean, distance_km numeric, rank_ts timestamptz
)
language sql stable set search_path = '' as $$
  with params as (
    select (select auth.uid()) as uid,
           private.search_origin(p_lat, p_lng, p_city_id) as origin,
           private.immutable_unaccent(lower(nullif(btrim(coalesce(p_query, '')), ''))) as q
  ),
  matched as (
    select p.id, p.shop_id, p.author_id, p.type, p.title, p.description, p.hashtags, p.price_mode, p.price_cents, p.status,
           p.category_id, p.city_id, p.published_at, p.bumped_at, p.likes_count, p.saves_count,
           extensions.ST_Distance(p.location, params.origin) as dist_m,
           params.uid as uid,
           case when params.q is null then 0::real
                else ts_rank(p.search_vector, websearch_to_tsquery('french'::regconfig, params.q)) * 2
                     + extensions.word_similarity(params.q, private.immutable_unaccent(lower(p.title || ' ' || array_to_string(p.hashtags, ' '))))
           end as relevance
      from public.posts p
      join public.shops s on s.id = p.shop_id
      cross join params
     where p.deleted_at is null and p.visibility = 'visible' and p.status = 'available' and p.expires_at > now()
       and (params.q is null
            or p.search_vector @@ websearch_to_tsquery('french'::regconfig, params.q)
            or extensions.word_similarity(params.q, private.immutable_unaccent(lower(p.title || ' ' || array_to_string(p.hashtags, ' ')))) >= 0.45
            or private.immutable_unaccent(lower(s.name)) like '%' || params.q || '%')
       and (p_category_id is null or p.category_id = p_category_id)
       and (p_type is null or p.type = p_type)
       and (p_price_min is null or p.price_cents >= p_price_min)
       and (p_price_max is null or p.price_cents <= p_price_max)
       and (p_min_rating is null or s.rating_avg >= p_min_rating)
       and (p_radius_km is null or (params.origin is not null
            and extensions.ST_DWithin(p.location, params.origin, least(greatest(p_radius_km, 1), 500) * 1000)))
  )
  select m.id, m.shop_id, m.author_id, m.type, m.title, m.description, m.hashtags, m.price_mode, m.price_cents, m.status, m.category_id,
         m.city_id, ci.name, ci.department, m.published_at, m.likes_count, m.saves_count,
         coalesce((select jsonb_agg(jsonb_build_object('storage_path', pm.storage_path, 'width', pm.width, 'height', pm.height) order by pm.position)
                     from public.post_media pm where pm.post_id = m.id and pm.kind = 'image'), '[]'::jsonb),
         s.slug::text, s.name, s.avatar_url, s.is_founder,
         exists (select 1 from public.likes l where l.user_id = m.uid and l.post_id = m.id),
         exists (select 1 from public.saves sv where sv.user_id = m.uid and sv.post_id = m.id),
         exists (select 1 from public.follows f where f.follower_id = m.uid and f.shop_id = m.shop_id),
         round((m.dist_m / 1000.0)::numeric, 1),
         m.bumped_at
    from matched m
    join public.shops s on s.id = m.shop_id
    join public.cities ci on ci.id = m.city_id
   order by
     case when p_sort = 'price_asc' then m.price_cents end asc nulls last,
     case when p_sort = 'price_desc' then m.price_cents end desc nulls last,
     case when p_sort = 'distance' then m.dist_m end asc nulls last,
     case when p_sort = 'recent' then m.bumped_at end desc nulls last,
     m.relevance desc, m.bumped_at desc, m.id
   limit least(greatest(coalesce(p_limit, 24), 1), 48)
  offset greatest(coalesce(p_offset, 0), 0)
$$;

-- ---------------------------------------------------------------------------
-- Sellers directory: "Vendeurs près de toi", or shops matching a name.
-- ---------------------------------------------------------------------------
create or replace function public.find_shops(
  p_query text default null,
  p_city_id integer default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_km integer default 30,
  p_category_id smallint default null,
  p_limit integer default 20
) returns table (
  id uuid, slug text, name text, avatar_url text, bio text, is_founder boolean, owner_id uuid,
  city_name text, department text, distance_km numeric, posts_count integer, followers_count integer,
  rating_avg numeric, rating_count integer, following boolean
)
language sql stable set search_path = '' as $$
  with params as (
    select (select auth.uid()) as uid,
           private.search_origin(p_lat, p_lng, p_city_id) as origin,
           private.immutable_unaccent(lower(nullif(btrim(coalesce(p_query, '')), ''))) as q
  )
  select s.id, s.slug::text, s.name, s.avatar_url, s.bio, s.is_founder, s.owner_id,
         c.name, c.department,
         round((extensions.ST_Distance(s.location, params.origin) / 1000.0)::numeric, 1),
         s.posts_count, s.followers_count, s.rating_avg, s.rating_count,
         exists (select 1 from public.follows f where f.follower_id = params.uid and f.shop_id = s.id)
    from public.shops s
    join public.cities c on c.id = s.city_id
    cross join params
   where s.status = 'active' and s.deleted_at is null and s.owner_id <> params.uid
     and case when params.q is not null
              then private.immutable_unaccent(lower(s.name)) like '%' || params.q || '%'
                   or s.slug::text like '%' || replace(params.q, ' ', '_') || '%'
                   or extensions.word_similarity(params.q, private.immutable_unaccent(lower(s.name))) >= 0.5
              else s.posts_count > 0
                   and (p_radius_km is null or params.origin is null
                        or extensions.ST_DWithin(s.location, params.origin, least(greatest(p_radius_km, 1), 500) * 1000))
         end
     and (p_category_id is null or exists (
            select 1 from public.posts p
             where p.shop_id = s.id and p.category_id = p_category_id and p.deleted_at is null and p.visibility = 'visible' and p.status = 'available'))
   order by
     case when params.q is not null then extensions.word_similarity(params.q, private.immutable_unaccent(lower(s.name))) end desc nulls last,
     extensions.ST_Distance(s.location, params.origin) asc nulls last,
     s.posts_count desc, s.id
   limit least(greatest(coalesce(p_limit, 20), 1), 50)
$$;

-- ---------------------------------------------------------------------------
-- Search alerts (saved searches). Notifications are sent from step 6.
-- ---------------------------------------------------------------------------
create table public.search_alerts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  query            text,
  category_id      smallint references public.categories(id) on delete cascade,
  type             public.post_type,
  city_id          integer references public.cities(id),
  radius_km        smallint,
  price_min_cents  integer,
  price_max_cents  integer,
  is_active        boolean not null default true,
  last_notified_at timestamptz,
  created_at       timestamptz not null default now(),
  constraint search_alerts_has_criterion check (nullif(btrim(coalesce(query, '')), '') is not null or category_id is not null),
  constraint search_alerts_query_len     check (query is null or char_length(query) <= 80),
  constraint search_alerts_radius        check (radius_km is null or radius_km between 1 and 500),
  constraint search_alerts_prices        check ((price_min_cents is null or price_min_cents >= 0) and (price_max_cents is null or price_max_cents >= coalesce(price_min_cents, 0)))
);
create index search_alerts_user on public.search_alerts (user_id, created_at desc);
create index search_alerts_active on public.search_alerts (category_id, city_id) where is_active;
create index search_alerts_city on public.search_alerts (city_id) where city_id is not null;

create or replace function private.search_alerts_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.search_alerts a where a.user_id = new.user_id) >= 20 then
    raise exception 'TOO_MANY_ALERTS';
  end if;
  return new;
end $$;
create trigger search_alerts_limit before insert on public.search_alerts for each row execute function private.search_alerts_limit();

alter table public.search_alerts enable row level security;
grant select, insert, delete on public.search_alerts to authenticated;
grant update (is_active) on public.search_alerts to authenticated;
create policy search_alerts_select on public.search_alerts for select to authenticated using (user_id = (select auth.uid()));
create policy search_alerts_insert on public.search_alerts for insert to authenticated with check (user_id = (select auth.uid()));
create policy search_alerts_update on public.search_alerts for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy search_alerts_delete on public.search_alerts for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Grants + footer
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public  from public, anon;
revoke execute on all functions in schema private from public, anon;
grant execute on function private.search_origin(double precision, double precision, integer) to authenticated, service_role;
grant execute on function public.search_posts(text, smallint, public.post_type, integer, double precision, double precision, integer, integer, integer, numeric, text, integer, integer) to authenticated;
grant execute on function public.find_shops(text, integer, double precision, double precision, integer, smallint, integer) to authenticated;

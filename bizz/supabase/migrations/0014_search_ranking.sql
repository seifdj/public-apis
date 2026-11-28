-- 0014_search_ranking.sql
-- Search ranking: at (almost) equal relevance, posts within 50 km of the origin come first, then the
-- most recent. Without a query every post has relevance 0, so browsing a category shows local posts first.
-- Same signature and grants as 0012 (create or replace keeps the privileges).

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
     round(m.relevance::numeric, 1) desc,
     (m.dist_m is not null and m.dist_m <= 50000) desc,
     m.bumped_at desc, m.id
   limit least(greatest(coalesce(p_limit, 24), 1), 48)
  offset greatest(coalesce(p_offset, 0), 0)
$$;

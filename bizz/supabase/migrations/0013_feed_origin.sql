-- 0013 — The feed measures "near me" from the same origin as search: GPS position, else a chosen
-- city, else the profile city. Adds p_city_id to feed().
drop function public.feed(text, integer, timestamptz, uuid, double precision, double precision, integer);

create or replace function public.feed(
  p_tab text default 'for_you',
  p_limit integer default 10,
  p_cursor_ts timestamptz default null,
  p_cursor_id uuid default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_km integer default 30,
  p_city_id integer default null
) returns table (
  id uuid, shop_id uuid, author_id uuid, type public.post_type, title text, description text, hashtags text[],
  price_mode public.price_mode, price_cents integer, status public.post_status, category_id smallint,
  city_id integer, city_name text, department text, published_at timestamptz, likes_count integer, saves_count integer,
  media jsonb, shop_slug text, shop_name text, shop_avatar_url text, shop_is_founder boolean,
  liked boolean, saved boolean, following boolean, distance_km numeric, rank_ts timestamptz
)
language sql stable set search_path = '' as $$
  with me as (
    select (select auth.uid()) as uid,
           private.search_origin(p_lat, p_lng, p_city_id) as origin
  ),
  interests as (   -- categories of what I follow, liked or saved
    select distinct p2.category_id
      from public.posts p2, me
     where p2.shop_id in (select f.shop_id from public.follows f where f.follower_id = me.uid)
        or p2.id in (select l.post_id from public.likes l where l.user_id = me.uid)
        or p2.id in (select s.post_id from public.saves s where s.user_id = me.uid)
  ),
  cand as (
    select p.id, p.shop_id, p.author_id, p.type, p.title, p.description, p.hashtags, p.price_mode, p.price_cents, p.status,
           p.category_id, p.city_id, p.published_at, p.bumped_at, p.likes_count, p.saves_count,
           extensions.ST_Distance(p.location, me.origin) as dist_m,
           exists (select 1 from public.follows f where f.follower_id = me.uid and f.shop_id = p.shop_id) as following,
           me.uid as uid
      from public.posts p, me
     where p.deleted_at is null and p.visibility = 'visible' and p.status = 'available' and p.expires_at > now()
       and p.author_id <> me.uid
       and (p_tab <> 'following' or exists (select 1 from public.follows f where f.follower_id = me.uid and f.shop_id = p.shop_id))
       and (p_tab <> 'nearby' or (me.origin is not null and extensions.ST_DWithin(p.location, me.origin, least(greatest(p_radius_km, 1), 200) * 1000)))
  ),
  ranked as (
    select c.*,
           c.bumped_at
           + case when p_tab = 'for_you' and c.category_id in (select i.category_id from interests i) then interval '12 hours' else interval '0' end
           + case when p_tab = 'for_you' and c.following then interval '6 hours' else interval '0' end
           + case when p_tab = 'for_you' and c.dist_m is not null
                  then make_interval(secs => 86400 * greatest(0::double precision, 1 - c.dist_m / 50000.0)) else interval '0' end
           as rank_ts
      from cand c
  )
  select r.id, r.shop_id, r.author_id, r.type, r.title, r.description, r.hashtags, r.price_mode, r.price_cents, r.status, r.category_id,
         r.city_id, ci.name, ci.department, r.published_at, r.likes_count, r.saves_count,
         coalesce((select jsonb_agg(jsonb_build_object('storage_path', m.storage_path, 'width', m.width, 'height', m.height) order by m.position)
                     from public.post_media m where m.post_id = r.id and m.kind = 'image'), '[]'::jsonb),
         s.slug::text, s.name, s.avatar_url, s.is_founder,
         exists (select 1 from public.likes l where l.user_id = r.uid and l.post_id = r.id),
         exists (select 1 from public.saves sv where sv.user_id = r.uid and sv.post_id = r.id),
         r.following,
         round((r.dist_m / 1000.0)::numeric, 1),
         r.rank_ts
    from ranked r
    join public.shops s on s.id = r.shop_id
    join public.cities ci on ci.id = r.city_id
   where p_cursor_ts is null or (r.rank_ts, r.id) < (p_cursor_ts, p_cursor_id)
   order by r.rank_ts desc, r.id desc
   limit least(greatest(coalesce(p_limit, 10), 1), 30)
$$;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.feed(text, integer, timestamptz, uuid, double precision, double precision, integer, integer) to authenticated;

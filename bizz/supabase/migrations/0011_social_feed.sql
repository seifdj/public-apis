-- 0011 — Step 4: follows, likes, saves, views, reports, blocking, and the feed.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  shop_id     uuid not null references public.shops(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, shop_id)
);
create index follows_shop on public.follows (shop_id);

create table public.likes (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  post_id    uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index likes_post on public.likes (post_id);

create table public.saves (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  post_id    uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index saves_post on public.saves (post_id);
create index saves_user_recent on public.saves (user_id, created_at desc);

-- One row per viewer, post and hour. Aggregated into daily stats by the step 7 job.
create table public.post_views (
  post_id     uuid not null references public.posts(id) on delete cascade,
  viewer_id   uuid not null references public.profiles(id) on delete cascade,
  viewed_hour timestamptz not null,
  primary key (post_id, viewer_id, viewed_hour)
);
create index post_views_hour on public.post_views (viewed_hour);

create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type public.report_target not null,
  post_id     uuid references public.posts(id) on delete cascade,
  shop_id     uuid not null references public.shops(id) on delete cascade,   -- shop concerned, used to route by zone
  message_id  uuid,                                                          -- FK added with step 6
  review_id   uuid,                                                          -- FK added with step 12
  reason      public.report_reason not null,
  details     text,
  department  text not null,          -- snapshot of the shop zone when reported
  city_id     integer not null,
  status      public.report_status not null default 'open',
  handled_by  uuid references public.profiles(id),
  handled_at  timestamptz,
  action_id   uuid,                   -- -> moderation_actions.id (step 10)
  created_at  timestamptz not null default now(),
  constraint reports_details_len check (details is null or char_length(details) <= 500),
  constraint reports_one_per_target unique nulls not distinct (reporter_id, target_type, post_id, shop_id, message_id, review_id)
);
create index reports_open_zone on public.reports (department, created_at) where status = 'open';
create index reports_post on public.reports (post_id) where post_id is not null;
create index reports_shop on public.reports (shop_id);
create index reports_handled_by on public.reports (handled_by) where handled_by is not null;

-- ---------------------------------------------------------------------------
-- updated_at only moves when the content changes, not when a counter does.
-- ---------------------------------------------------------------------------
drop trigger posts_set_updated_at on public.posts;
create trigger posts_set_updated_at
  before update of type, title, description, hashtags, price_mode, price_cents, category_id, city_id, status, visibility, deleted_at on public.posts
  for each row execute function private.set_updated_at();
drop trigger shops_set_updated_at on public.shops;
create trigger shops_set_updated_at
  before update of name, bio, avatar_url, cover_url, city_id, instagram, snapchat, tiktok, whatsapp, status, deleted_at on public.shops
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Denormalized counters
-- ---------------------------------------------------------------------------
create or replace function private.sync_post_counter() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_delta int := case when tg_op = 'INSERT' then 1 else -1 end;
        v_post uuid := case when tg_op = 'INSERT' then new.post_id else old.post_id end;
begin
  if tg_table_name = 'likes' then
    update public.posts set likes_count = greatest(0, likes_count + v_delta) where id = v_post;
  else
    update public.posts set saves_count = greatest(0, saves_count + v_delta) where id = v_post;
  end if;
  return null;
end $$;
create trigger likes_sync_counter after insert or delete on public.likes for each row execute function private.sync_post_counter();
create trigger saves_sync_counter after insert or delete on public.saves for each row execute function private.sync_post_counter();

create or replace function private.sync_followers_counter() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.shops set followers_count = followers_count + 1 where id = new.shop_id;
  else
    update public.shops set followers_count = greatest(0, followers_count - 1) where id = old.shop_id;
  end if;
  return null;
end $$;
create trigger follows_sync_counter after insert or delete on public.follows for each row execute function private.sync_followers_counter();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.follows    enable row level security;
alter table public.likes      enable row level security;
alter table public.saves      enable row level security;
alter table public.post_views enable row level security;
alter table public.reports    enable row level security;

grant select, insert, delete on public.follows, public.likes, public.saves to authenticated;
grant select on public.reports to authenticated;
revoke insert on public.blocks from authenticated;   -- blocking goes through block_user() (it also removes follows)

-- A user follows shops they can see, never their own.
create policy follows_select on public.follows for select to authenticated using (follower_id = (select auth.uid()));
create policy follows_insert on public.follows for insert to authenticated with check (
  follower_id = (select auth.uid())
  and exists (select 1 from public.shops s where s.id = shop_id and s.owner_id <> (select auth.uid()) and s.status = 'active' and s.deleted_at is null)
);
create policy follows_delete on public.follows for delete to authenticated using (follower_id = (select auth.uid()));

-- Likes and saves: only on posts the user can see (the sub-select runs under the posts policy).
create policy likes_select on public.likes for select to authenticated using (user_id = (select auth.uid()));
create policy likes_insert on public.likes for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.posts p where p.id = post_id));
create policy likes_delete on public.likes for delete to authenticated using (user_id = (select auth.uid()));

create policy saves_select on public.saves for select to authenticated using (user_id = (select auth.uid()));
create policy saves_insert on public.saves for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.posts p where p.id = post_id));
create policy saves_delete on public.saves for delete to authenticated using (user_id = (select auth.uid()));

create policy reports_select on public.reports for select to authenticated using (reporter_id = (select auth.uid()));

-- Shops of someone you blocked (or who blocked you) disappear, like their posts already do.
drop policy shops_select on public.shops;
create policy shops_select on public.shops for select to authenticated using (
  owner_id = (select auth.uid())
  or (select private.is_moderator())
  or (status = 'active' and deleted_at is null and not private.is_blocked_between((select auth.uid()), owner_id))
);

-- ---------------------------------------------------------------------------
-- Blocking
-- ---------------------------------------------------------------------------
create or replace function public.block_user(p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_user_id = v_uid then raise exception 'CANNOT_BLOCK_SELF'; end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then raise exception 'TARGET_NOT_FOUND'; end if;
  insert into public.blocks (blocker_id, blocked_id) values (v_uid, p_user_id) on conflict do nothing;
  -- no follow relation survives a block, in either direction
  delete from public.follows f using public.shops s
   where s.id = f.shop_id
     and ((f.follower_id = v_uid and s.owner_id = p_user_id) or (f.follower_id = p_user_id and s.owner_id = v_uid));
end $$;

create or replace function public.unblock_user(p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.blocks where blocker_id = auth.uid() and blocked_id = p_user_id;
end $$;

-- People I blocked, with what the "Comptes bloqués" screen shows.
create or replace function public.my_blocked_users()
returns table (user_id uuid, username text, display_name text, avatar_url text, shop_name text, blocked_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username::text, p.display_name, p.avatar_url, s.name, b.created_at
    from public.blocks b
    join public.profiles p on p.id = b.blocked_id
    left join public.shops s on s.owner_id = p.id and s.deleted_at is null
   where b.blocker_id = (select auth.uid())
   order by b.created_at desc
$$;

-- ---------------------------------------------------------------------------
-- Reports (every user can report; the moderation queue arrives with step 10)
-- ---------------------------------------------------------------------------
create or replace function public.report_target(
  p_target_type public.report_target, p_target_id uuid, p_reason public.report_reason, p_details text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_post uuid; v_shop uuid; v_owner uuid; v_department text; v_city integer;
  v_id uuid;
  v_threshold int := coalesce((private.setting('moderation.auto_hide_threshold'))::int, 5);
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if (select count(*) from public.reports r where r.reporter_id = v_uid and r.created_at > now() - interval '1 day') >= 20 then
    raise exception 'TOO_MANY_REPORTS';
  end if;

  if p_target_type = 'post' then
    select p.id, p.shop_id, p.author_id, c.department, p.city_id into v_post, v_shop, v_owner, v_department, v_city
      from public.posts p join public.cities c on c.id = p.city_id
     where p.id = p_target_id and p.deleted_at is null;
  elsif p_target_type = 'shop' then
    select s.id, s.owner_id, c.department, s.city_id into v_shop, v_owner, v_department, v_city
      from public.shops s join public.cities c on c.id = s.city_id
     where s.id = p_target_id and s.deleted_at is null;
  else
    raise exception 'UNSUPPORTED_TARGET';   -- messages: step 6, reviews: step 12
  end if;
  if v_shop is null then raise exception 'TARGET_NOT_FOUND'; end if;
  if v_owner = v_uid then raise exception 'CANNOT_REPORT_OWN'; end if;

  insert into public.reports (reporter_id, target_type, post_id, shop_id, reason, details, department, city_id)
  values (v_uid, p_target_type, v_post, v_shop, p_reason, nullif(left(btrim(coalesce(p_details, '')), 500), ''), v_department, v_city)
  on conflict on constraint reports_one_per_target do nothing
  returning id into v_id;
  if v_id is null then   -- already reported by this user: same answer, no duplicate
    select r.id into v_id from public.reports r
     where r.reporter_id = v_uid and r.target_type = p_target_type and r.shop_id = v_shop and r.post_id is not distinct from v_post
     limit 1;
    return v_id;
  end if;

  -- Safety net until a moderator looks at it: a post reported by N different people is hidden.
  if v_post is not null
     and (select count(distinct r.reporter_id) from public.reports r where r.post_id = v_post and r.status = 'open') >= v_threshold then
    update public.posts set visibility = 'hidden_by_moderation' where id = v_post and visibility = 'visible';
    if found then
      insert into private.job_queue (kind, payload) values ('post_auto_hidden', jsonb_build_object('post_id', v_post, 'reports', v_threshold));
    end if;
  end if;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------
create or replace function public.record_views(p_post_ids uuid[]) returns void
language sql security definer set search_path = '' as $$
  insert into public.post_views (post_id, viewer_id, viewed_hour)
  select p.id, (select auth.uid()), date_trunc('hour', now())
    from public.posts p
   where p.id = any (p_post_ids[1:50]) and p.deleted_at is null and p.visibility = 'visible'
     and p.author_id <> (select auth.uid()) and (select auth.uid()) is not null
  on conflict do nothing
$$;

-- ---------------------------------------------------------------------------
-- Feed. Runs with the caller's rights, so the posts policy applies (hidden, expired,
-- blocked and suspended content never comes out).
--   for_you   : everything available, ranked by recency + interest + proximity
--   following : shops I follow, by recency
--   nearby    : within p_radius_km of the given position, or of my city, by recency
-- Keyset pagination on (rank_ts, id).
-- ---------------------------------------------------------------------------
create or replace function public.feed(
  p_tab text default 'for_you',
  p_limit integer default 10,
  p_cursor_ts timestamptz default null,
  p_cursor_id uuid default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_km integer default 30
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
           coalesce(
             case when p_lat is not null and p_lng is not null
                  then extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)::extensions.geography end,
             (select c.location from public.profiles pr join public.cities c on c.id = pr.city_id where pr.id = (select auth.uid()))
           ) as origin
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

-- "Drops du jour": shops I follow that published today (Paris day), most recent first.
create or replace function public.drops_today()
returns table (shop_id uuid, slug text, name text, avatar_url text, posts_today integer, latest_post_id uuid)
language sql stable set search_path = '' as $$
  select s.id, s.slug::text, s.name, s.avatar_url, count(*)::int, (array_agg(p.id order by p.published_at desc))[1]
    from public.follows f
    join public.shops s on s.id = f.shop_id
    join public.posts p on p.shop_id = s.id
   where f.follower_id = (select auth.uid())
     and p.deleted_at is null and p.visibility = 'visible' and p.status <> 'expired' and p.expires_at > now()
     and (p.published_at at time zone 'Europe/Paris')::date = private.paris_today()
   group by s.id
   order by max(p.published_at) desc
   limit 30
$$;

-- ---------------------------------------------------------------------------
-- Grants + footer
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public  from public, anon;
revoke execute on all functions in schema private from public, anon;
grant execute on function public.block_user(uuid), public.unblock_user(uuid), public.my_blocked_users() to authenticated;
grant execute on function public.report_target(public.report_target, uuid, public.report_reason, text) to authenticated;
grant execute on function public.record_views(uuid[]) to authenticated;
grant execute on function public.feed(text, integer, timestamptz, uuid, double precision, double precision, integer) to authenticated;
grant execute on function public.drops_today() to authenticated;

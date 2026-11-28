# 01 — Schéma de base de données

Postgres 15+ sur Supabase. Extensions : `postgis`, `pg_trgm`, `unaccent`, `pg_cron`, `citext`, `pgcrypto`.
Tout ce qui suit sera découpé en migrations dans `supabase/migrations/` (une par étape du plan).

Conventions :
- `id uuid primary key default gen_random_uuid()` partout, sauf les tables de liaison (clé composite).
- `created_at timestamptz not null default now()`, `updated_at` tenu à jour par un trigger.
- Prix en **centimes** (`integer`), devise `EUR` en dur dans une colonne `currency` pour plus tard.
- Position : `geography(Point, 4326)`, index GiST.
- Suppression logique (`deleted_at`) pour `posts`, `shops`, `profiles` ; suppression physique pour les tables de liaison.

## 1. Vue d'ensemble des relations

```
auth.users 1─1 profiles 1─0..1 shops 1─n posts 1─n post_media
                 │                 │          │
                 │                 │          ├─n likes, saves, comments(opt), post_stats_daily
                 │                 │          └─n boosts
                 │                 ├─n follows (follower = profiles)
                 │                 ├─n reviews
                 │                 └─n conversations 1─n messages
                 ├─n reports ─0..1 moderation_actions
                 ├─n blocks
                 ├─n post_credits, daily_post_usage, subscriptions, purchases
                 ├─n referrals, search_alerts, device_tokens, notifications
                 └─n moderation_actions (en tant que modérateur)
categories (arbre à 2 niveaux)   cities (référentiel INSEE)   app_settings (clé/valeur)   banned_keywords
```

## 2. Types énumérés

```sql
create type user_role        as enum ('client', 'seller');
create type active_mode      as enum ('client', 'seller');
create type moderation_scope as enum ('all', 'department', 'city');
create type shop_status      as enum ('active', 'hidden', 'suspended');
create type post_type        as enum ('object', 'service', 'creation', 'rental');
create type price_mode       as enum ('fixed', 'on_quote');
create type post_status      as enum ('available', 'reserved', 'sold', 'expired');  -- statut vendeur
create type visibility       as enum ('visible', 'hidden_by_moderation', 'removed'); -- statut modération
create type media_kind       as enum ('image', 'video');
create type video_state      as enum ('uploading', 'processing', 'ready', 'errored');
create type message_kind     as enum ('text', 'image', 'availability_request', 'system');
create type report_target    as enum ('post', 'shop', 'message', 'review');
create type report_reason    as enum ('forbidden_item', 'counterfeit', 'scam', 'adult', 'harassment', 'spam', 'wrong_category', 'other');
create type report_status    as enum ('open', 'handled');
create type moderation_action_kind as enum ('ignore', 'hide_post', 'unhide_post', 'remove_post', 'suspend_shop', 'unsuspend_shop', 'warn', 'delete_message');
create type appeal_status    as enum ('none', 'appealed', 'upheld', 'overturned');
create type credit_source    as enum ('pack', 'referral', 'founder', 'admin', 'compensation');
create type subscription_status as enum ('active', 'grace_period', 'billing_issue', 'cancelled', 'expired');
create type store            as enum ('app_store', 'play_store');
create type purchase_kind    as enum ('pack', 'subscription', 'boost');
create type boost_kind       as enum ('bump', 'featured_24h');
create type boost_source     as enum ('paid', 'bizzplus_weekly');
create type notification_kind as enum ('message', 'follow', 'like', 'availability_request', 'search_alert', 'moderation', 'referral', 'system');
```

## 3. Tables

### 3.1 Comptes

(`cities` est créée avant `profiles` dans les migrations ; elle est décrite en 3.2 pour la lecture.)

```sql
create table profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  username          citext unique not null check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name      text not null check (char_length(display_name) between 1 and 40),
  avatar_url        text,
  phone_verified    boolean not null default false,
  role              user_role not null default 'client',
  active_mode       active_mode not null default 'client',
  is_moderator      boolean not null default false,
  is_admin          boolean not null default false,
  moderation_scope  moderation_scope,          -- null si pas modérateur
  moderation_zone   text,                      -- code département ('69') ou code INSEE ville ('69123')
  city_id           integer references cities(id),
  location          geography(Point, 4326),    -- dernière position connue, optionnelle
  referral_code     text unique not null default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
  referred_by       uuid references profiles(id),
  terms_accepted_at timestamptz,
  suspended_until   timestamptz,
  deleted_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (is_moderator = false or moderation_scope is not null),
  check (active_mode = 'client' or role = 'seller')
);

create table device_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  expo_token    text not null unique,
  platform      text not null check (platform in ('ios', 'android')),
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create table blocks (
  blocker_id  uuid not null references profiles(id) on delete cascade,
  blocked_id  uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
```

### 3.2 Référentiels

```sql
create table cities (
  id            integer primary key,          -- code INSEE converti ('69123' -> 69123)
  insee_code    text unique not null,
  name          text not null,
  slug          text not null,
  department    text not null,                -- '69', '2A'
  region        text,
  postal_codes  text[] not null,
  population    integer,
  location      geography(Point, 4326) not null
);
create index cities_name_trgm on cities using gin (slug gin_trgm_ops);
create index cities_location on cities using gist (location);

create table categories (
  id          smallserial primary key,
  slug        text unique not null,
  label       text not null,                   -- libellé FR
  parent_id   smallint references categories(id),
  icon        text not null,                   -- nom d'icône Lucide
  sort_order  smallint not null default 0,
  is_active   boolean not null default true
);

create table banned_keywords (
  id        serial primary key,
  term      text unique not null,
  severity  text not null check (severity in ('block', 'flag')),  -- block = refus, flag = publié mais signalé
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table app_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_by  uuid references profiles(id),
  updated_at  timestamptz not null default now()
);
-- Valeurs initiales (seed) :
--  quota.free_daily = 1, quota.bizzplus_daily = 5, quota.credit_validity_days = 30
--  quota.post_expiry_days = 60, quota.founder_limit = 500, quota.referral_bonus = 3
--  pricing.pack_3 = {"credits":3,"display":"0,99 €","rc_product":"bizz_pack_3"}
--  pricing.pack_10, pricing.bizzplus_monthly, pricing.boost_bump, pricing.boost_featured
--  features.comments = false, features.moderation_zones = true, features.video = false
--  moderation.auto_hide_threshold = 5   (masquage automatique à 5 signalements distincts)
```

### 3.3 Boutiques et publications

```sql
create table shops (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid unique not null references profiles(id) on delete cascade,
  slug            citext unique not null,      -- = username au moment de la création
  name            text not null check (char_length(name) between 2 and 40),
  bio             text check (char_length(bio) <= 300),
  avatar_url      text,
  cover_url       text,
  city_id         integer not null references cities(id),
  location        geography(Point, 4326) not null, -- copié de cities, modifiable
  instagram       text, snapchat text, tiktok text, whatsapp text,
  status          shop_status not null default 'active',
  is_founder      boolean not null default false,
  founder_rank    integer unique,
  -- compteurs dénormalisés, tenus par triggers
  followers_count integer not null default 0,
  posts_count     integer not null default 0,
  rating_avg      numeric(3,2),
  rating_count    integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create table posts (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references shops(id) on delete cascade,
  author_id       uuid not null references profiles(id),
  type            post_type not null,
  title           text not null check (char_length(title) between 3 and 80),
  description     text check (char_length(description) <= 1000),
  hashtags        text[] not null default '{}',
  price_mode      price_mode not null default 'fixed',
  price_cents     integer check (price_cents is null or price_cents >= 0),
  currency        char(3) not null default 'EUR',
  category_id     smallint not null references categories(id),
  city_id         integer not null references cities(id),
  location        geography(Point, 4326) not null,
  status          post_status not null default 'available',
  visibility      visibility not null default 'visible',
  published_at    timestamptz not null default now(),
  bumped_at       timestamptz not null default now(),   -- modifié par un boost "remonter"
  expires_at      timestamptz not null,                 -- published_at + quota.post_expiry_days
  likes_count     integer not null default 0,
  saves_count     integer not null default 0,
  views_count     integer not null default 0,
  conversations_count integer not null default 0,
  search_vector   tsvector generated always as (
                    setweight(to_tsvector('french', unaccent(coalesce(title, ''))), 'A') ||
                    setweight(to_tsvector('french', unaccent(array_to_string(hashtags, ' '))), 'B') ||
                    setweight(to_tsvector('french', unaccent(coalesce(description, ''))), 'C')
                  ) stored,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  check (price_mode = 'on_quote' or price_cents is not null)
);

create table post_media (
  id              uuid primary key default gen_random_uuid(),
  post_id         uuid not null references posts(id) on delete cascade,
  kind            media_kind not null,
  position        smallint not null default 0,
  storage_path    text,                -- images : chemin dans le bucket post-media
  width           integer, height integer,
  blurhash        text,
  -- vidéo (Mux)
  mux_upload_id   text, mux_asset_id text, mux_playback_id text,
  video_state     video_state,
  duration_s      numeric(6,2),
  created_at      timestamptz not null default now(),
  unique (post_id, position),
  check ((kind = 'image' and storage_path is not null) or (kind = 'video' and mux_upload_id is not null))
);
-- Règle "1 à 10 photos OU 1 vidéo" vérifiée dans create_post(), pas en contrainte.
```

### 3.4 Interactions

```sql
create table follows (
  follower_id uuid not null references profiles(id) on delete cascade,
  shop_id     uuid not null references shops(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, shop_id)
);
create table likes (
  user_id uuid not null references profiles(id) on delete cascade,
  post_id uuid not null references posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create table saves (
  user_id uuid not null references profiles(id) on delete cascade,
  post_id uuid not null references posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

-- Optionnel, derrière features.comments (voir 00-decisions)
create table comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references posts(id) on delete cascade,
  author_id  uuid not null references profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 300),
  visibility visibility not null default 'visible',
  created_at timestamptz not null default now()
);

create table post_views (          -- brut, purgé par pg_cron après agrégation
  post_id    uuid not null references posts(id) on delete cascade,
  viewer_id  uuid references profiles(id) on delete set null,
  viewed_at  timestamptz not null default now()
);
create table post_stats_daily (
  post_id   uuid not null references posts(id) on delete cascade,
  day       date not null,
  views     integer not null default 0,
  primary key (post_id, day)
);
create table shop_stats_daily (
  shop_id        uuid not null references shops(id) on delete cascade,
  day            date not null,
  views          integer not null default 0,
  messages       integer not null default 0,
  new_followers  integer not null default 0,
  primary key (shop_id, day)
);
```

### 3.5 Messagerie

```sql
create table conversations (
  id                uuid primary key default gen_random_uuid(),
  post_id           uuid references posts(id) on delete set null,
  shop_id           uuid not null references shops(id) on delete cascade,
  client_id         uuid not null references profiles(id) on delete cascade,
  seller_id         uuid not null references profiles(id) on delete cascade, -- = shops.owner_id, dénormalisé pour la RLS
  last_message_at   timestamptz,
  last_message_preview text,
  client_unread     integer not null default 0,
  seller_unread     integer not null default 0,
  is_request_pending boolean not null default false,  -- "demande à traiter" côté vendeur
  created_at        timestamptz not null default now(),
  unique (post_id, client_id),
  check (client_id <> seller_id)
);

create table messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id       uuid not null references profiles(id) on delete cascade,
  kind            message_kind not null default 'text',
  body            text check (char_length(body) <= 2000),
  media_path      text,
  read_at         timestamptz,
  visibility      visibility not null default 'visible',
  created_at      timestamptz not null default now()
);
```

### 3.6 Avis, signalements, modération

```sql
create table reviews (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references shops(id) on delete cascade,
  author_id       uuid not null references profiles(id) on delete cascade,
  conversation_id uuid not null references conversations(id),
  rating          smallint not null check (rating between 1 and 5),
  body            text check (char_length(body) <= 500),
  visibility      visibility not null default 'visible',
  created_at      timestamptz not null default now(),
  unique (shop_id, author_id)
);

create table reports (
  id            uuid primary key default gen_random_uuid(),
  reporter_id   uuid not null references profiles(id) on delete cascade,
  target_type   report_target not null,
  post_id       uuid references posts(id) on delete cascade,
  shop_id       uuid references shops(id) on delete cascade,     -- toujours rempli (boutique concernée), pour le routage par zone
  message_id    uuid references messages(id) on delete cascade,
  review_id     uuid references reviews(id) on delete cascade,
  reason        report_reason not null,
  details       text check (char_length(details) <= 500),
  department    text not null,     -- snapshot de la zone de la boutique au moment du signalement
  city_id       integer not null,
  status        report_status not null default 'open',
  handled_by    uuid references profiles(id),
  handled_at    timestamptz,
  action_id     uuid,              -- -> moderation_actions.id (FK ajoutée après création de la table)
  created_at    timestamptz not null default now(),
  unique nulls not distinct (reporter_id, target_type, post_id, shop_id, message_id, review_id)  -- 1 signalement par cible et par personne (PG15+)
);

create table moderation_actions (
  id            uuid primary key default gen_random_uuid(),
  moderator_id  uuid not null references profiles(id),
  action        moderation_action_kind not null,
  target_type   report_target not null,
  post_id       uuid references posts(id) on delete set null,
  shop_id       uuid not null references shops(id) on delete cascade,
  message_id    uuid references messages(id) on delete set null,
  reason        text not null check (char_length(reason) between 5 and 500),  -- envoyé au prestataire (DSA)
  suspended_until timestamptz,                       -- pour suspend_shop
  reports_closed  integer not null default 0,
  appeal_status   appeal_status not null default 'none',
  appeal_text     text check (char_length(appeal_text) <= 1000),
  appeal_decided_by uuid references profiles(id),
  appeal_decided_at timestamptz,
  created_at    timestamptz not null default now()
);
alter table reports add foreign key (action_id) references moderation_actions(id);
```

### 3.7 Monétisation

```sql
create table daily_post_usage (
  user_id  uuid not null references profiles(id) on delete cascade,
  day      date not null,            -- jour Paris
  count    integer not null default 0,
  primary key (user_id, day)
);

create table post_credits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  source      credit_source not null,
  amount      integer not null check (amount > 0),
  remaining   integer not null check (remaining >= 0),
  expires_at  timestamptz not null,
  purchase_id uuid,                  -- -> purchases.id
  note        text,
  created_at  timestamptz not null default now()
);

create table purchases (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references profiles(id) on delete cascade,
  rc_event_id       text unique not null,   -- idempotence du webhook RevenueCat
  rc_transaction_id text,
  store             store not null,
  product_id        text not null,          -- bizz_pack_3, bizz_plus_monthly, bizz_boost_bump...
  kind              purchase_kind not null,
  price_cents       integer,
  currency          char(3),
  raw_event         jsonb not null,
  created_at        timestamptz not null default now()
);
alter table post_credits add foreign key (purchase_id) references purchases(id);

create table subscriptions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid unique not null references profiles(id) on delete cascade,
  store                store not null,
  product_id           text not null,
  status               subscription_status not null,
  current_period_start timestamptz not null,
  current_period_end   timestamptz not null,
  weekly_bump_used_at  timestamptz,        -- la remontée offerte par semaine
  rc_original_app_user_id text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table boosts (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references posts(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  kind        boost_kind not null,
  source      boost_source not null,
  city_id     integer references cities(id),       -- featured_24h : ville ciblée
  category_id smallint references categories(id),  -- featured_24h : catégorie ciblée
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz not null,                -- bump : = starts_at ; featured : +24 h
  purchase_id uuid references purchases(id),
  created_at  timestamptz not null default now()
);

create table referrals (
  id           uuid primary key default gen_random_uuid(),
  referrer_id  uuid not null references profiles(id) on delete cascade,
  referee_id   uuid unique not null references profiles(id) on delete cascade,
  code_used    text not null,
  rewarded_at  timestamptz,      -- rempli à la première publication du filleul
  created_at   timestamptz not null default now(),
  check (referrer_id <> referee_id)
);
```

### 3.8 Recherche et notifications

```sql
create table search_alerts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  query         text,
  category_id   smallint references categories(id),
  type          post_type,
  city_id       integer references cities(id),
  radius_km     smallint check (radius_km between 1 and 200),
  price_min_cents integer, price_max_cents integer,
  is_active     boolean not null default true,
  last_notified_at timestamptz,
  created_at    timestamptz not null default now()
);

create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  kind       notification_kind not null,
  title      text not null,
  body       text,
  data       jsonb not null default '{}',   -- {post_id, conversation_id, shop_id, action_id...}
  read_at    timestamptz,
  pushed_at  timestamptz,
  created_at timestamptz not null default now()
);
```

## 4. Index

```sql
-- Feed et recherche
create index posts_feed            on posts (visibility, status, bumped_at desc) where deleted_at is null;
create index posts_shop            on posts (shop_id, published_at desc);
create index posts_category_recent on posts (category_id, bumped_at desc) where visibility = 'visible' and status = 'available';
create index posts_city            on posts (city_id, bumped_at desc);
create index posts_location        on posts using gist (location);
create index posts_search          on posts using gin (search_vector);
create index posts_title_trgm      on posts using gin (title gin_trgm_ops);
create index posts_expires         on posts (expires_at) where status <> 'expired';
create index post_media_post       on post_media (post_id, position);
-- Social
create index follows_shop          on follows (shop_id);
create index likes_post            on likes (post_id);
create index saves_user            on saves (user_id, created_at desc);
create index shops_location        on shops using gist (location);
create index shops_city            on shops (city_id) where status = 'active';
-- Messagerie
create index conversations_client  on conversations (client_id, last_message_at desc nulls last);
create index conversations_seller  on conversations (seller_id, last_message_at desc nulls last);
create index conversations_pending on conversations (seller_id) where is_request_pending;
create index messages_conv         on messages (conversation_id, created_at);
-- Modération
create index reports_open_zone     on reports (status, department, created_at) where status = 'open';
create index reports_open_city     on reports (status, city_id) where status = 'open';
create index reports_target_post   on reports (post_id) where post_id is not null;
create index moderation_actions_recent on moderation_actions (created_at desc);
create index moderation_actions_shop   on moderation_actions (shop_id, created_at desc);
-- Monétisation
create index post_credits_user     on post_credits (user_id, expires_at) where remaining > 0;
create index boosts_active         on boosts (kind, ends_at) where kind = 'featured_24h';
create index boosts_post           on boosts (post_id);
-- Divers
create index notifications_user    on notifications (user_id, created_at desc) where read_at is null;
create index post_views_rollup     on post_views (viewed_at);
create index search_alerts_active  on search_alerts (category_id, city_id) where is_active;
```

## 5. Sécurité : claims et helpers

### 5.1 Custom Access Token Hook

```sql
create or replace function auth_hook_add_claims(event jsonb) returns jsonb
language plpgsql stable as $$
declare p record; claims jsonb;
begin
  select role, is_moderator, is_admin, moderation_scope, moderation_zone, phone_verified
    into p from public.profiles where id = (event->>'user_id')::uuid;
  claims := event->'claims';
  claims := jsonb_set(claims, '{app_metadata,role}', to_jsonb(coalesce(p.role::text, 'client')));
  claims := jsonb_set(claims, '{app_metadata,is_moderator}', to_jsonb(coalesce(p.is_moderator, false)));
  claims := jsonb_set(claims, '{app_metadata,is_admin}', to_jsonb(coalesce(p.is_admin, false)));
  claims := jsonb_set(claims, '{app_metadata,mod_scope}', to_jsonb(coalesce(p.moderation_scope::text, '')));
  claims := jsonb_set(claims, '{app_metadata,mod_zone}', to_jsonb(coalesce(p.moderation_zone, '')));
  return jsonb_set(event, '{claims}', claims);
end $$;
```

### 5.2 Helpers (schéma `private`, non exposés via l'API)

```sql
create schema private;
create function private.uid() returns uuid language sql stable as $$ select auth.uid() $$;
create function private.is_admin() returns boolean language sql stable as
  $$ select coalesce((auth.jwt()->'app_metadata'->>'is_admin')::boolean, false) $$;
create function private.is_moderator() returns boolean language sql stable as
  $$ select private.is_admin() or coalesce((auth.jwt()->'app_metadata'->>'is_moderator')::boolean, false) $$;

-- Un modérateur voit-il cette zone ?
create function private.mod_covers(dept text, city integer) returns boolean language sql stable as $$
  select private.is_admin()
      or (private.is_moderator() and (
            (auth.jwt()->'app_metadata'->>'mod_scope') = 'all'
         or ((auth.jwt()->'app_metadata'->>'mod_scope') = 'department' and (auth.jwt()->'app_metadata'->>'mod_zone') = dept)
         or ((auth.jwt()->'app_metadata'->>'mod_scope') = 'city'       and (auth.jwt()->'app_metadata'->>'mod_zone') = city::text)))
$$;

create function private.owns_shop(sid uuid) returns boolean language sql stable security definer as
  $$ select exists (select 1 from shops where id = sid and owner_id = auth.uid()) $$;

create function private.is_blocked_between(a uuid, b uuid) returns boolean language sql stable security definer as
  $$ select exists (select 1 from blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)) $$;

create function private.paris_today() returns date language sql stable as
  $$ select (now() at time zone 'Europe/Paris')::date $$;

create function private.setting(k text) returns jsonb language sql stable security definer as
  $$ select value from app_settings where key = k $$;
```

## 6. Policies RLS par rôle

`alter table ... enable row level security` sur **toutes** les tables.

**Droits (mise à jour après la création du projet, migration `0006`)** : Supabase accorde par défaut tous les droits sur `public` à `anon` et `authenticated`. Ces droits par défaut sont retirés. `anon` n'a aucun droit. `authenticated` reçoit des `grant` explicites par table, par colonne pour `profiles`, et par fonction. Aucune vue `security definer`. Le trigger de protection des colonnes se base sur le rôle SQL courant (`authenticated`), pas sur les claims, pour que les fonctions serveur puissent modifier les colonnes protégées. Aucune policy pour `anon` : l'app exige une session (même pour lire le feed, on crée une session anonyme Supabase si besoin, à décider à l'étape 4).

Légende : **C** = client connecté, **V** = vendeur (propriétaire de la boutique), **M** = modérateur (dans sa zone), **A** = admin, **—** = interdit, **srv** = uniquement via fonction `security definer` ou service role.

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| profiles | colonnes publiques de tous (`grant select` par colonne + vue `public_profiles`) ; ligne complète de soi-même via `get_my_profile()` ; M/A : via fonctions dédiées | srv (trigger auth) | soi-même, colonnes `username`, `display_name`, `avatar_url`, `city_id`, `location`, `terms_accepted_at` uniquement ; le reste via fonctions serveur | srv (`delete_my_account`) |
| device_tokens | soi | soi | soi | soi |
| blocks | soi (blocker) | soi | — | soi |
| cities, categories | tous | A | A | A |
| banned_keywords | M, A | A | A | A |
| app_settings | tous (clés `pricing.*`, `features.*`, `quota.*`) | A | A | — |
| shops | tous si `status='active'` et non supprimée ; V : la sienne quel que soit le statut ; M/A : tout | srv (`open_shop`) | V (hors `status`, `is_founder`, `founder_rank`, compteurs) ; M (status) ; A | V (soft) |
| posts | tous si `visibility='visible'` et boutique active et pas de blocage ; V : les siens ; M (zone) / A : tout | srv (`create_post`) | V (titre, desc, prix, statut, catégorie… **pas** `published_at`, `bumped_at`, `visibility`, compteurs) ; M (`visibility`) | V (soft) |
| post_media | comme posts | srv (`create_post`, `attach_media`) | V (position) | V |
| follows / likes / saves | soi ; `follows` : V voit ses abonnés | soi | — | soi |
| comments | comme posts (si `features.comments`) | C/V (auteur = uid) | auteur (body) ; M (visibility) | auteur, M |
| post_views | — | srv (`record_view`) | — | — |
| post_stats_daily, shop_stats_daily | V : sa boutique ; A | srv | srv | — |
| conversations | client ou seller de la conversation ; M : si signalée | srv (`start_conversation`) | participant (compteurs non lus via fonction) | — |
| messages | participant ; M : si la conversation est signalée | participant, si pas bloqué et vendeur non suspendu | expéditeur (`read_at` par le destinataire via fonction) ; M (visibility) | M |
| reviews | tous si visible ; auteur ; V ; M | srv (`create_review`, vérifie l'échange de messages) | auteur (< 7 jours) ; M (visibility) | auteur, M |
| reports | reporter : les siens ; M : zone ; A | tout utilisateur connecté (reporter = uid) | srv (`moderate`) | — |
| moderation_actions | V : celles qui visent sa boutique ; M : zone ; A | srv (`moderate`) | V : `appeal_*` (contestation) ; A : décision | — |
| daily_post_usage, post_credits | soi ; A | srv | srv | — |
| purchases, subscriptions | soi ; A | srv (webhook) | srv | — |
| boosts | V : les siens ; A ; tous : vue `active_featured` | srv | — | — |
| referrals | referrer / referee ; A | srv (`apply_referral`) | srv | — |
| search_alerts | soi | soi | soi | soi |
| notifications | soi | srv | soi (`read_at`) | soi |

Exemples de policies représentatives :

```sql
-- posts : lecture publique filtrée
create policy posts_read on posts for select using (
  deleted_at is null and (
    author_id = auth.uid()
    or private.mod_covers((select c.department from cities c where c.id = posts.city_id), city_id)
    or (visibility = 'visible'
        and exists (select 1 from shops s where s.id = posts.shop_id and s.status = 'active' and s.deleted_at is null)
        and not private.is_blocked_between(auth.uid(), author_id))
  )
);

-- posts : le vendeur modifie ses champs, jamais les champs protégés (trigger en complément)
create policy posts_update_owner on posts for update
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create trigger posts_protect_columns before update on posts for each row
  execute function private.protect_post_columns();   -- lève une erreur si visibility/bumped_at/published_at/compteurs changent sans être modérateur/service

-- reports : un modérateur ne voit que sa zone
create policy reports_read_mod on reports for select using (
  reporter_id = auth.uid() or private.mod_covers(department, city_id)
);

-- messages : participants uniquement, blocage respecté
create policy messages_insert on messages for insert with check (
  sender_id = auth.uid()
  and exists (select 1 from conversations c
              where c.id = conversation_id
                and auth.uid() in (c.client_id, c.seller_id)
                and not private.is_blocked_between(c.client_id, c.seller_id))
);

-- app_settings : lecture limitée aux clés publiques
create policy settings_read on app_settings for select using (
  private.is_admin() or key like 'pricing.%' or key like 'features.%' or key like 'quota.%'
);
```

Storage (bucket `post-media`, `avatars`, `message-media`) :
- `post-media` et `avatars` : lecture publique, écriture sur le chemin `{uid}/...` uniquement.
- `message-media` : privé, lecture via URL signée générée par `get_message_media_url(message_id)` qui vérifie la participation.

## 7. Fonctions serveur

### 7.1 Quota et publication (le cœur)

```sql
-- Retourne l'état du quota pour l'écran "Publier"
create function get_post_allowance()
returns table (free_daily int, used_today int, bizzplus_daily int, has_bizzplus boolean, credits int, can_post boolean, next_reset timestamptz)
language plpgsql stable security definer as $$
declare
  v_uid uuid := auth.uid();
  v_free int := (private.setting('quota.free_daily'))::int;
  v_plus int := (private.setting('quota.bizzplus_daily'))::int;
  v_has_plus boolean;
begin
  select exists (select 1 from subscriptions s where s.user_id = v_uid and s.status in ('active','grace_period') and s.current_period_end > now())
    into v_has_plus;
  free_daily := v_free;
  bizzplus_daily := case when v_has_plus then v_plus else 0 end;
  has_bizzplus := v_has_plus;
  select coalesce(d.count, 0) into used_today from daily_post_usage d where d.user_id = v_uid and d.day = private.paris_today();
  used_today := coalesce(used_today, 0);
  select coalesce(sum(remaining), 0) into credits from post_credits where user_id = v_uid and remaining > 0 and expires_at > now();
  can_post := used_today < greatest(v_free, bizzplus_daily) or credits > 0;
  next_reset := (private.paris_today() + 1)::timestamp at time zone 'Europe/Paris';
  return next;
end $$;

-- Consomme une unité de quota. Appelée UNIQUEMENT par create_post(), dans la même transaction.
create function private.consume_post_quota(p_uid uuid) returns text  -- 'free' | 'bizzplus' | 'credit'
language plpgsql as $$
declare
  v_day date := private.paris_today();
  v_used int;
  v_limit int := (private.setting('quota.free_daily'))::int;
  v_credit_id uuid;
begin
  if exists (select 1 from subscriptions s where s.user_id = p_uid and s.status in ('active','grace_period') and s.current_period_end > now()) then
    v_limit := greatest(v_limit, (private.setting('quota.bizzplus_daily'))::int);
  end if;

  -- verrou ligne : deux publications simultanées ne passent pas toutes les deux
  insert into daily_post_usage (user_id, day, count) values (p_uid, v_day, 0)
    on conflict (user_id, day) do nothing;
  select count into v_used from daily_post_usage where user_id = p_uid and day = v_day for update;

  if v_used < v_limit then
    update daily_post_usage set count = count + 1 where user_id = p_uid and day = v_day;
    return case when v_limit > (private.setting('quota.free_daily'))::int then 'bizzplus' else 'free' end;
  end if;

  -- sinon, un crédit : le plus proche de l'expiration d'abord
  select id into v_credit_id from post_credits
   where user_id = p_uid and remaining > 0 and expires_at > now()
   order by expires_at asc limit 1 for update skip locked;
  if v_credit_id is null then
    raise exception 'QUOTA_EXCEEDED' using errcode = 'P0001', hint = 'Plus de publication disponible aujourd''hui';
  end if;
  update post_credits set remaining = remaining - 1 where id = v_credit_id;
  return 'credit';
end $$;

-- Création d'une publication : toutes les règles métier au même endroit
create function create_post(p jsonb) returns uuid
language plpgsql security definer as $$
declare
  v_uid uuid := auth.uid();
  v_shop shops%rowtype;
  v_post_id uuid;
  v_media jsonb;
  v_n_images int; v_n_videos int;
  v_bad text;
  v_source text;
  v_city cities%rowtype;
begin
  -- 1. Prérequis compte
  select * into v_shop from shops where owner_id = v_uid and deleted_at is null;
  if not found then raise exception 'NO_SHOP'; end if;
  if v_shop.status = 'suspended' then raise exception 'SHOP_SUSPENDED'; end if;
  if not exists (select 1 from profiles where id = v_uid and phone_verified and (suspended_until is null or suspended_until < now())) then
    raise exception 'PHONE_NOT_VERIFIED';
  end if;

  -- 2. Validation du contenu
  v_media := p->'media';
  select count(*) filter (where m->>'kind' = 'image'), count(*) filter (where m->>'kind' = 'video')
    into v_n_images, v_n_videos from jsonb_array_elements(v_media) m;
  if not ((v_n_images between 1 and 10 and v_n_videos = 0) or (v_n_videos = 1 and v_n_images = 0)) then
    raise exception 'INVALID_MEDIA';
  end if;
  if v_n_videos = 1 and not (private.setting('features.video'))::boolean then raise exception 'VIDEO_DISABLED'; end if;

  select term into v_bad from banned_keywords
   where severity = 'block' and (unaccent(lower(p->>'title' || ' ' || coalesce(p->>'description',''))) like '%' || unaccent(lower(term)) || '%')
   limit 1;
  if v_bad is not null then raise exception 'FORBIDDEN_CONTENT' using detail = v_bad; end if;

  select * into v_city from cities where id = (p->>'city_id')::int;
  if not found then raise exception 'INVALID_CITY'; end if;

  -- 3. Quota (verrouille et consomme ; lève QUOTA_EXCEEDED sinon)
  v_source := private.consume_post_quota(v_uid);

  -- 4. Insertion
  insert into posts (shop_id, author_id, type, title, description, hashtags, price_mode, price_cents,
                     category_id, city_id, location, expires_at)
  values (v_shop.id, v_uid, (p->>'type')::post_type, p->>'title', p->>'description',
          coalesce((select array_agg(x) from jsonb_array_elements_text(p->'hashtags') x), '{}'),
          coalesce((p->>'price_mode')::price_mode, 'fixed'), (p->>'price_cents')::int,
          (p->>'category_id')::smallint, v_city.id, v_city.location,
          now() + make_interval(days => (private.setting('quota.post_expiry_days'))::int))
  returning id into v_post_id;

  insert into post_media (post_id, kind, position, storage_path, width, height, blurhash, mux_upload_id, video_state)
  select v_post_id, (m->>'kind')::media_kind, ord - 1, m->>'storage_path', (m->>'width')::int, (m->>'height')::int,
         m->>'blurhash', m->>'mux_upload_id', case when m->>'kind' = 'video' then 'uploading'::video_state end
  from jsonb_array_elements(v_media) with ordinality as t(m, ord);

  -- 5. Signalement automatique si mot-clé "flag"
  insert into reports (reporter_id, target_type, post_id, shop_id, reason, details, department, city_id)
  select v_uid, 'post', v_post_id, v_shop.id, 'other', 'auto: ' || term, v_city.department, v_city.id
    from banned_keywords where severity = 'flag'
     and unaccent(lower(p->>'title' || ' ' || coalesce(p->>'description',''))) like '%' || unaccent(lower(term)) || '%'
   limit 1;

  -- 6. Parrainage : première publication du filleul
  perform private.reward_referral_if_first_post(v_uid);

  -- 7. Alertes de recherche (asynchrone : simple insertion dans une file traitée par pg_cron)
  insert into private.job_queue (kind, payload) values ('search_alert_match', jsonb_build_object('post_id', v_post_id));

  return v_post_id;
end $$;
```

Points à retenir :
- La vérification et la consommation du quota sont dans **la même transaction** que l'insertion. Si l'insertion échoue, le quota est rendu.
- `for update` sur la ligne du jour empêche deux appels simultanés de passer avec une seule publication gratuite.
- Modifier une publication (`update posts`) ou changer son statut ne passe pas par cette fonction, donc ne consomme rien.
- Le client appelle `supabase.rpc('create_post', { p })`. Les erreurs `QUOTA_EXCEEDED`, `PHONE_NOT_VERIFIED`, `FORBIDDEN_CONTENT` sont traduites en messages FR dans l'app.

### 7.2 Autres fonctions

| Fonction | Rôle | Sécurité |
|---|---|---|
| `open_shop(name, city_id, bio)` | Crée la boutique, passe `role='seller'`, attribue `founder_rank` si < `quota.founder_limit` | definer, uid |
| `set_active_mode(mode)` | Bascule client / prestataire | definer |
| `record_view(post_id)` | Insère dans `post_views` (1 par utilisateur et par post et par heure) | definer |
| `toggle_like(post_id)`, `toggle_save(post_id)`, `toggle_follow(shop_id)` | Idempotents, mettent à jour les compteurs | definer |
| `feed_for_you(cursor, limit, lat, lng)` | Score = récence + proximité + catégories suivies + boost ; retourne les posts et leurs médias | invoker (RLS) |
| `feed_following(cursor, limit)` | Posts des boutiques suivies | invoker |
| `feed_nearby(lat, lng, radius_km, cursor, limit)` | `ST_DWithin` + tri distance puis récence | invoker |
| `drops_today()` | Boutiques suivies ayant publié aujourd'hui (jour Paris) | invoker |
| `search_posts(q, filters, cursor)` | `search_vector @@ websearch_to_tsquery('french', q)` + `similarity` sur le titre, filtres ville/rayon/prix/type/note | invoker |
| `nearby_shops(lat, lng, radius_km)` | Annuaire « Vendeurs près de toi » | invoker |
| `start_conversation(post_id, first_message, kind)` | Crée ou récupère la conversation, insère le message, incrémente `conversations_count`, marque `is_request_pending` | definer |
| `mark_conversation_read(conversation_id)` | Remet le compteur non lu du lecteur à zéro | definer |
| `can_review(shop_id)` / `create_review(shop_id, rating, body)` | Exige une conversation avec ≥ 1 message de chaque côté ; met à jour `rating_avg` | definer |
| `report_target(type, id, reason, details)` | Remplit `shop_id`, `department`, `city_id` ; masque automatiquement à `moderation.auto_hide_threshold` signalements distincts | definer |
| `moderate(report_id, action, reason, duration)` | Vérifie `mod_covers`, applique l'action (visibility / shop.status / suspended_until), écrit `moderation_actions`, ferme tous les signalements ouverts sur la même cible, crée la notification au prestataire | definer |
| `appeal_action(action_id, text)` | Contestation par le prestataire | definer |
| `decide_appeal(action_id, verdict)` | Admin : `upheld` ou `overturned` (ré-applique l'inverse) | definer, admin |
| `admin_set_moderator(user_id, scope, zone)` / `admin_remove_moderator(user_id)` | Équipe de modération | definer, admin |
| `admin_update_setting(key, value)` | Réglages | definer, admin |
| `admin_overview()` | Compteurs globaux (utilisateurs, prestataires actifs, publications du jour, revenus du mois) | definer, admin |
| `apply_rc_event(event)` | Appelée par l'Edge Function `revenuecat-webhook` ; idempotente sur `rc_event_id` ; crée `purchases`, puis `post_credits` (expiration `credit_validity_days`), ou met à jour `subscriptions`, ou crée `boosts` | service role |
| `use_weekly_bump(post_id)` | Bizz+ : 1 remontée par semaine (`weekly_bump_used_at`) | definer |
| `apply_referral(code)` | À l'inscription ; vérifie que le code n'est pas celui du compte lui-même | definer |
| `private.reward_referral_if_first_post(uid)` | Crédite 3 (`quota.referral_bonus`) aux deux parties | interne |
| `delete_my_account()` | Anonymise le profil, supprime médias et tokens, garde `moderation_actions` et `purchases` (obligations légales) | definer |
| `export_my_data()` | Edge Function : JSON zippé envoyé par URL signée | service role |

### 7.3 Tâches planifiées (pg_cron)

| Tâche | Fréquence | Action |
|---|---|---|
| `expire_posts` | toutes les heures | `status='expired'` où `expires_at < now()` |
| `rollup_views` | toutes les 10 min | Agrège `post_views` dans `post_stats_daily` et `shop_stats_daily`, purge les lignes > 24 h |
| `process_job_queue` | toutes les minutes | Alertes de recherche (`search_alert_match`), envoi des pushs en attente via Edge Function `send-push` |
| `expire_featured` | toutes les 10 min | Rien à écrire : la vue `active_featured` filtre sur `ends_at > now()` ; la tâche recalcule seulement un cache si besoin |
| `subscription_grace_check` | quotidien | Passe `grace_period` en `expired` au-delà de 16 jours sans événement RevenueCat |
| `purge_notifications` | quotidien | Supprime les notifications lues > 90 jours |

### 7.4 Triggers

- `profiles` : création automatique à l'insertion dans `auth.users` (username provisoire `user_xxxx`, `phone_verified` depuis `auth.users.phone_confirmed_at`).
- `posts`, `shops`, `messages`, `follows`, `likes`, `saves`, `reviews` : compteurs dénormalisés.
- `posts` : `protect_post_columns` (voir § 6), et `set_updated_at`.
- `messages` after insert : met à jour `conversations.last_message_*`, incrémente le compteur non lu de l'autre participant, crée la `notification`, et `shop_stats_daily.messages`.
- `moderation_actions` after insert : notification au propriétaire de la boutique avec le motif.
- Realtime : publication `supabase_realtime` sur `messages`, `conversations`, `notifications` (la RLS s'applique aux abonnements).

## 7.5 Écarts entre ce document et les migrations (étape 3)

Les migrations font foi. Différences avec le texte ci-dessus :
- `update_post(post_id, payload)` : toute modification du contenu passe par cette fonction, pour repasser le filtre de mots-clés. Seul `status` se modifie directement.
- Mots interdits : recherche par **mot entier** (pluriel accepté), pas par sous-chaîne. « arme » ne bloque pas « parmesan » ni « charme ».
- Les mots de gravité `flag` créent une entrée dans `private.job_queue` (`keyword_flag`), transformée en signalement à l'étape 10.
- `posts.search_vector` est calculé par `private.post_search_vector()`.
- Une publication dont `expires_at` est dépassée est traitée comme expirée par la RLS, sans attendre la tâche planifiée (étape 6).
- `delete_post(post_id)` : suppression logique par l'auteur.
- Les fichiers remplacés ou supprimés restent dans le bucket `post-media` : nettoyage à prévoir avec les tâches planifiées (étape 6).
- Bizz+ (`subscriptions`) n'existe pas encore : `get_post_allowance().has_bizzplus` vaut `false` jusqu'à l'étape 9.

## 7.6 Écarts entre ce document et les migrations (étape 4)

- Likes, favoris et abonnements : insertions et suppressions directes, protégées par la RLS (on ne like que ce qu'on peut voir, on ne suit pas sa propre boutique). Les compteurs sont tenus par des triggers. Pas de fonctions `toggle_*`.
- `feed(onglet, limite, curseur, position, rayon)` remplace `feed_for_you`, `feed_following` et `feed_nearby`. Elle s'exécute avec les droits de l'appelant, donc la RLS des publications s'applique.
- Classement « Pour toi » : date de remontée, plus 12 h si la catégorie m'intéresse, plus 6 h si je suis la boutique, plus jusqu'à 24 h selon la proximité (0 à 50 km). À revoir quand le volume grandira : la fonction parcourt toutes les publications disponibles.
- « Près de moi » utilise la ville du profil. La position GPS arrive à l'étape 5.
- `post_views` : une ligne par personne, publication et heure. L'agrégation en statistiques arrive à l'étape 7.
- `report_target` : un signalement par personne et par cible, 20 par jour au maximum, masquage automatique au seuil `moderation.auto_hide_threshold`. Messages et avis : étapes 6 et 12.
- Blocage par `block_user` / `unblock_user` : supprime les abonnements dans les deux sens, masque publications et boutique dans les deux sens.
- `updated_at` des publications et boutiques ne change plus quand seul un compteur bouge.

## 7.7 Écarts entre ce document et les migrations (étape 5)

- `search_posts(texte, catégorie, type, ville, position, rayon, prix min, prix max, note min, tri, limite, décalage)` : une seule fonction pour la recherche et le parcours par catégorie. Elle renvoie les mêmes colonnes que `feed`, avec les droits de l'appelant (RLS et blocages appliqués).
- Texte : recherche plein texte en français (pluriels, accents, casse), tolérance aux fautes par `word_similarity` (seuil 0,45) sur le titre et les hashtags, et correspondance sur le nom de la boutique.
- Tri « Pertinence » : pertinence arrondie au dixième, puis les publications à moins de 50 km du point de référence, puis les plus récentes. Sans texte, le parcours montre donc d'abord le local. Autres tris : récent, prix croissant ou décroissant, distance.
- Pagination par décalage (24 par page, 48 au maximum). Suffisant à ce volume, à revoir avec le classement du feed.
- Point de référence commun au feed, à la recherche et à l'annuaire, par `private.search_origin` : position GPS si elle est fournie, sinon ville choisie, sinon ville du profil. `feed` gagne le paramètre `p_city_id` (migration 0013).
- La position GPS n'est jamais enregistrée : elle part en paramètre des requêtes et reste dans la mémoire de l'app.
- `find_shops(texte, ville, position, rayon, catégorie, limite)` : annuaire « Vendeurs près de toi » trié par distance, ou boutiques par nom (approximatif) sans limite de rayon.
- `search_alerts` : au moins un mot-clé ou une catégorie, 20 alertes par personne au maximum (`TOO_MANY_ALERTS`), lecture et écriture réservées au propriétaire. L'envoi des notifications arrive à l'étape 6.

## 8. Données de démo (seed)

`supabase/seed.sql` + script `scripts/seed-demo.ts` (images libres de droits via Unsplash, téléchargées une fois dans Storage) :
- 4 comptes de test : client, prestataire, modérateur (zone : département 69), admin. Connexion par numéros de test Supabase (`+33600000001` à `04`), avec un code choisi dans le dashboard et jamais écrit dans le dépôt. Le code `123456` ne sert qu'en local (`supabase/config.toml`). Les comptes modérateur et admin de test sont supprimés avant le lancement.
- 30 boutiques réparties sur Lyon, Paris, Marseille, Lille, Bordeaux, Nantes, Toulouse, Villeurbanne.
- 150 publications sur 20 catégories, prix réalistes, 10 en `reserved`, 10 en `sold`, 5 avec boost `featured_24h`.
- 20 conversations, 40 messages, 15 avis, 8 signalements ouverts, 3 actions de modération.
- `cities` : les ~35 000 communes depuis le fichier officiel (un script de chargement, pas un seed à la main).

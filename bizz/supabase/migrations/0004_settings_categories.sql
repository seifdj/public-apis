-- 0004 — App settings, categories, banned keywords, with reference data.

create table public.app_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_by  uuid references public.profiles(id),
  updated_at  timestamptz not null default now()
);

insert into public.app_settings (key, value, description) values
  ('quota.free_daily',            '1',   'Publications gratuites par jour (heure de Paris)'),
  ('quota.bizzplus_daily',        '5',   'Publications par jour avec Bizz+'),
  ('quota.credit_validity_days',  '30',  'Durée de validité des crédits achetés'),
  ('quota.post_expiry_days',      '60',  'Expiration automatique des publications'),
  ('quota.founder_limit',         '500', 'Nombre de badges Fondateur'),
  ('quota.referral_bonus',        '3',   'Crédits offerts au parrain et au filleul'),
  ('pricing.pack_3',        '{"credits": 3,  "display": "0,99 €", "rc_product": "bizz_pack_3"}',           'Pack 3 publications'),
  ('pricing.pack_10',       '{"credits": 10, "display": "2,49 €", "rc_product": "bizz_pack_10"}',          'Pack 10 publications'),
  ('pricing.bizzplus_monthly', '{"display": "4,99 €/mois", "rc_product": "bizz_plus_monthly", "rc_entitlement": "bizz_plus"}', 'Abonnement Bizz+'),
  ('pricing.boost_bump',    '{"display": "0,49 €", "rc_product": "bizz_boost_bump"}',                      'Remonter une publication'),
  ('pricing.boost_featured','{"display": "1,99 €", "rc_product": "bizz_boost_featured", "hours": 24}',     'À la une 24 h'),
  ('features.comments',         'false', 'Commentaires sous les publications'),
  ('features.moderation_zones', 'true',  'Modérateurs limités à une zone'),
  ('features.video',            'false', 'Publication de vidéos'),
  ('moderation.auto_hide_threshold', '5', 'Masquage automatique à N signalements distincts')
on conflict (key) do nothing;

create table public.categories (
  id          smallserial primary key,
  slug        text unique not null,
  label       text not null,
  parent_id   smallint references public.categories(id),
  icon        text not null,
  sort_order  smallint not null default 0,
  is_active   boolean not null default true
);
create index categories_parent on public.categories (parent_id, sort_order);

-- Top-level categories (icon = Lucide icon name). Sub-categories come with the seed of step 3.
insert into public.categories (slug, label, icon, sort_order) values
  ('food',        'Food et pâtisserie',     'cake',        1),
  ('beauty',      'Beauté et ongles',       'sparkles',    2),
  ('hair',        'Coiffure',               'scissors',    3),
  ('fashion',     'Mode et sneakers',       'shirt',       4),
  ('handmade',    'Créations fait-main',    'palette',     5),
  ('home',        'Maison et déco',         'lamp',        6),
  ('tech',        'High-tech',              'smartphone',  7),
  ('kids',        'Enfants et bébé',        'baby',        8),
  ('services',    'Services et bricolage',  'wrench',      9),
  ('events',      'Événements',             'party-popper', 10),
  ('vehicles',    'Auto et moto',           'car',         11),
  ('rental',      'Locations',              'key-round',   12),
  ('sport',       'Sport et loisirs',       'dumbbell',    13),
  ('other',       'Autre',                  'package',     99)
on conflict (slug) do nothing;

create table public.banned_keywords (
  id         serial primary key,
  term       text unique not null,
  severity   text not null check (severity in ('block', 'flag')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- Forbidden categories (spec §5): weapons, animals, drugs, tobacco/vape, counterfeits, adult content.
insert into public.banned_keywords (term, severity) values
  ('arme', 'block'), ('pistolet', 'block'), ('couteau papillon', 'block'), ('taser', 'block'), ('munition', 'block'),
  ('chiot', 'block'), ('chaton', 'block'), ('animal à vendre', 'block'),
  ('médicament', 'block'), ('ordonnance', 'block'), ('xanax', 'block'), ('tramadol', 'block'), ('cannabis', 'block'), ('cbd', 'flag'),
  ('cigarette', 'block'), ('tabac', 'block'), ('vape', 'block'), ('puff', 'block'), ('e-liquide', 'block'),
  ('contrefaçon', 'block'), ('réplique', 'flag'), ('copie conforme', 'flag'), ('AAA quality', 'flag'),
  ('escort', 'block'), ('sexe', 'block'), ('onlyfans', 'block'), ('nude', 'block')
on conflict (term) do nothing;

-- Generic job queue consumed by pg_cron (search alerts, push notifications...). Internal only.
create table private.job_queue (
  id          bigserial primary key,
  kind        text not null,
  payload     jsonb not null default '{}',
  run_after   timestamptz not null default now(),
  attempts    int not null default 0,
  locked_at   timestamptz,
  done_at     timestamptz,
  last_error  text,
  created_at  timestamptz not null default now()
);
create index job_queue_pending on private.job_queue (run_after) where done_at is null;

-- Loads every French commune into public.cities, straight from the database, using the
-- official API https://geo.api.gouv.fr and the `http` extension (enabled only for the load).
-- Run in the Supabase SQL editor (role postgres). Idempotent: re-running refreshes the rows.
-- Loaded on the Bizz project on 2026-11-27: 34 875 communes, 101 departments.
--
-- If the SQL editor times out, run the DO block three times with
-- `offset 0 limit 35`, `offset 35 limit 35`, `offset 70 limit 60` on the department list.

create extension if not exists http with schema extensions;

do $$
declare
  d record; resp record; failed text := '';
begin
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '20');
  for d in
    select x->>'code' as code
    from jsonb_array_elements((select content::jsonb from extensions.http_get('https://geo.api.gouv.fr/departements?fields=code'))) x
    order by 1
  loop
    select * into resp from extensions.http_get(
      'https://geo.api.gouv.fr/departements/' || d.code || '/communes?fields=code,nom,codeDepartement,codeRegion,codesPostaux,population,centre&format=json');
    if resp.status <> 200 then failed := failed || d.code || ' '; continue; end if;

    insert into public.cities (id, insee_code, name, slug, department, region, postal_codes, population, location)
    select regexp_replace(regexp_replace(c->>'code', '^2A', '201'), '^2B', '202')::int,   -- Corsica: 2A004 -> 201004
           c->>'code',
           c->>'nom',
           trim(both '-' from regexp_replace(lower(extensions.unaccent(c->>'nom')), '[^a-z0-9]+', '-', 'g')),
           c->>'codeDepartement',
           c->>'codeRegion',
           coalesce((select array_agg(p) from jsonb_array_elements_text(c->'codesPostaux') p), '{}'),
           (c->>'population')::int,
           extensions.ST_SetSRID(extensions.ST_MakePoint((c->'centre'->'coordinates'->>0)::float8, (c->'centre'->'coordinates'->>1)::float8), 4326)::extensions.geography
    from jsonb_array_elements(resp.content::jsonb) c
    where c->'centre' is not null and c->>'codeDepartement' is not null
    on conflict (id) do update set
      name = excluded.name, slug = excluded.slug, department = excluded.department, region = excluded.region,
      postal_codes = excluded.postal_codes, population = excluded.population, location = excluded.location;
  end loop;
  if failed <> '' then raise exception 'failed departments: %', failed; end if;
end $$;

drop extension http;

select count(*) as cities, count(distinct department) as departments from public.cities;

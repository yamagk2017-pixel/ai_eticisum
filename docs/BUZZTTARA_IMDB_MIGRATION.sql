-- BUZZTTARA migration notes:
-- 1) Keep buzzttara app data in public schema (tweets, tags, tweet_tags, events).
-- 2) Use imd.groups as canonical group master.
-- 3) Move public.groups.ticketdive_id to imd.external_ids (service='ticketdive').

begin;

-- Recommended uniqueness if not already enforced.
create unique index if not exists ux_external_ids_group_service
  on imd.external_ids (group_id, service);

-- Do not enforce global uniqueness on (service, external_id),
-- because existing services (e.g. spotify) may legitimately contain duplicates.
-- Limit uniqueness to ticketdive only for this migration.
create unique index if not exists ux_external_ids_ticketdive_external_id
  on imd.external_ids (service, external_id)
  where service = 'ticketdive' and external_id is not null;

-- Optional: backup current ticketdive_id data.
create table if not exists public.groups_ticketdive_backup as
select id, name, ticketdive_id, now() as backed_up_at
from public.groups
where ticketdive_id is not null;

-- Build mapping from public.groups -> imd.groups by spotify_id.
-- IMD is the canonical master; public.groups.id is not trusted for identity.
-- Requires public.groups.spotify_id and imd.external_ids(service='spotify').
with unique_spotify as (
  select distinct on (external_id)
    external_id,
    group_id
  from imd.external_ids
  where service = 'spotify' and external_id is not null
    and external_id in (
      select external_id
      from imd.external_ids
      where service = 'spotify' and external_id is not null
      group by external_id
      having count(*) = 1
    )
  order by external_id, group_id
),
spotify_map as (
  select
    pg.id as public_group_id,
    pg.name as public_group_name,
    pg.spotify_id as public_spotify_id,
    pg.ticketdive_id,
    us.group_id as imd_group_id
  from public.groups pg
  left join unique_spotify us
    on us.external_id = pg.spotify_id
  where pg.ticketdive_id is not null
)
insert into imd.external_ids (group_id, service, external_id, url, meta)
select
  sm.imd_group_id as group_id,
  'ticketdive' as service,
  sm.ticketdive_id::text as external_id,
  'https://ticketdive.com/artist/' || sm.ticketdive_id as url,
  jsonb_build_object(
    'migration', 'public.groups.ticketdive_id',
    'match_key', 'spotify_id',
    'public_group_id', sm.public_group_id,
    'public_group_name', sm.public_group_name,
    'public_spotify_id', sm.public_spotify_id
  ) as meta
from spotify_map sm
where sm.imd_group_id is not null
on conflict (group_id, service)
do update set
  external_id = excluded.external_id,
  url = excluded.url,
  meta = excluded.meta;

-- Save unmatched rows for manual resolution.
create table if not exists public.groups_ticketdive_unmatched as
with unique_spotify as (
  select distinct on (external_id)
    external_id,
    group_id
  from imd.external_ids
  where service = 'spotify' and external_id is not null
    and external_id in (
      select external_id
      from imd.external_ids
      where service = 'spotify' and external_id is not null
      group by external_id
      having count(*) = 1
    )
  order by external_id, group_id
),
spotify_map as (
  select
    pg.id as public_group_id,
    pg.name as public_group_name,
    pg.spotify_id as public_spotify_id,
    pg.ticketdive_id,
    us.group_id as imd_group_id
  from public.groups pg
  left join unique_spotify us
    on us.external_id = pg.spotify_id
  where pg.ticketdive_id is not null
)
select
  public_group_id,
  public_group_name,
  public_spotify_id,
  ticketdive_id,
  now() as detected_at
from spotify_map
where imd_group_id is null;

commit;

-- After application cutover is confirmed, you can drop the legacy column:
-- alter table public.groups drop column if exists ticketdive_id;

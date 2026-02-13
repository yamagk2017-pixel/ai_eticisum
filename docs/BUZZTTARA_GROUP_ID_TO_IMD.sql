-- Convert buzzttara foreign keys from legacy public.groups IDs to imd.groups IDs.
-- This enables app code to resolve groups using imd only.
--
-- Preconditions:
-- - public.groups.spotify_id is populated for mapped groups.
-- - imd.external_ids has service='spotify' with external_id=spotify_id.

begin;

-- 0) Switch FK target from public.groups to imd.groups first.
-- Existing constraints still point to public.groups, which blocks updates to IMD IDs.
alter table public.tweets drop constraint if exists tweets_group_id_fkey;
alter table public.events drop constraint if exists events_group_id_fkey;

-- 1) Build deterministic spotify mapping (only unique spotify IDs in IMD).
with unique_spotify as (
  select distinct on (external_id)
    external_id,
    group_id
  from imd.external_ids
  where service = 'spotify'
    and external_id is not null
    and external_id in (
      select external_id
      from imd.external_ids
      where service = 'spotify' and external_id is not null
      group by external_id
      having count(*) = 1
    )
  order by external_id, group_id
),
legacy_to_imd as (
  select
    pg.id as legacy_group_id,
    us.group_id as imd_group_id
  from public.groups pg
  join unique_spotify us
    on us.external_id = pg.spotify_id
)
update public.tweets t
set group_id = m.imd_group_id
from legacy_to_imd m
where t.group_id = m.legacy_group_id
  and t.group_id <> m.imd_group_id;

with unique_spotify as (
  select distinct on (external_id)
    external_id,
    group_id
  from imd.external_ids
  where service = 'spotify'
    and external_id is not null
    and external_id in (
      select external_id
      from imd.external_ids
      where service = 'spotify' and external_id is not null
      group by external_id
      having count(*) = 1
    )
  order by external_id, group_id
),
legacy_to_imd as (
  select
    pg.id as legacy_group_id,
    us.group_id as imd_group_id
  from public.groups pg
  join unique_spotify us
    on us.external_id = pg.spotify_id
)
update public.events e
set group_id = m.imd_group_id
from legacy_to_imd m
where e.group_id = m.legacy_group_id
  and e.group_id <> m.imd_group_id;

-- 2) Recreate FKs against imd.groups.
-- Use NOT VALID first so constraint creation does not fail on pre-existing outliers.
alter table public.tweets
  add constraint tweets_group_id_fkey
  foreign key (group_id)
  references imd.groups(id)
  on delete set null
  not valid;

alter table public.events
  add constraint events_group_id_fkey
  foreign key (group_id)
  references imd.groups(id)
  on delete cascade
  not valid;

commit;

-- Verification queries:
-- tweets that still don't resolve to imd.groups
-- select count(*) from public.tweets t left join imd.groups g on g.id=t.group_id where t.group_id is not null and g.id is null;
--
-- events that still don't resolve to imd.groups
-- select count(*) from public.events e left join imd.groups g on g.id=e.group_id where e.group_id is not null and g.id is null;

-- If both counts are 0, validate constraints:
-- alter table public.tweets validate constraint tweets_group_id_fkey;
-- alter table public.events validate constraint events_group_id_fkey;

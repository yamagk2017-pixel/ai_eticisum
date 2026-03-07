-- NANDATTE ranking RPCs for top10/top20 lists.
-- This migration adds fixed-limit functions so the frontend can switch:
-- - guest: top10
-- - logged in: top20

create or replace function nandatte.get_vote_top10()
returns table (
  group_id uuid,
  vote_count bigint,
  last_vote_at timestamptz
)
language sql
stable
security definer
set search_path = nandatte, public
as $$
  select
    v.group_id,
    count(*)::bigint as vote_count,
    max(v.updated_at) as last_vote_at
  from nandatte.votes v
  where v.group_id is not null
  group by v.group_id
  order by vote_count desc, last_vote_at desc
  limit 10
$$;

create or replace function nandatte.get_vote_top20()
returns table (
  group_id uuid,
  vote_count bigint,
  last_vote_at timestamptz
)
language sql
stable
security definer
set search_path = nandatte, public
as $$
  select
    v.group_id,
    count(*)::bigint as vote_count,
    max(v.updated_at) as last_vote_at
  from nandatte.votes v
  where v.group_id is not null
  group by v.group_id
  order by vote_count desc, last_vote_at desc
  limit 20
$$;

create or replace function nandatte.get_recent_vote_top10()
returns table (
  group_id uuid,
  vote_count bigint,
  last_vote_at timestamptz
)
language sql
stable
security definer
set search_path = nandatte, public
as $$
  select
    v.group_id,
    count(*)::bigint as vote_count,
    max(v.updated_at) as last_vote_at
  from nandatte.votes v
  where v.group_id is not null
  group by v.group_id
  order by last_vote_at desc, vote_count desc
  limit 10
$$;

create or replace function nandatte.get_recent_vote_top20()
returns table (
  group_id uuid,
  vote_count bigint,
  last_vote_at timestamptz
)
language sql
stable
security definer
set search_path = nandatte, public
as $$
  select
    v.group_id,
    count(*)::bigint as vote_count,
    max(v.updated_at) as last_vote_at
  from nandatte.votes v
  where v.group_id is not null
  group by v.group_id
  order by last_vote_at desc, vote_count desc
  limit 20
$$;

grant usage on schema nandatte to anon, authenticated;
grant execute on function nandatte.get_vote_top10() to anon, authenticated;
grant execute on function nandatte.get_vote_top20() to anon, authenticated;
grant execute on function nandatte.get_recent_vote_top10() to anon, authenticated;
grant execute on function nandatte.get_recent_vote_top20() to anon, authenticated;


-- NANDATTE summary RPC for lightweight header stats.
-- Returns unique voter/group counts without scanning all rows in app code.

create or replace function nandatte.get_vote_summary()
returns table (
  voter_count bigint,
  group_count bigint
)
language sql
stable
security definer
set search_path = nandatte, public
as $$
  select
    count(distinct v.user_id)::bigint as voter_count,
    count(distinct v.group_id)::bigint as group_count
  from nandatte.votes v
  where v.user_id is not null or v.group_id is not null
$$;

grant usage on schema nandatte to anon, authenticated;
grant execute on function nandatte.get_vote_summary() to anon, authenticated;

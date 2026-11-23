-- IAM-only resumption of the legacy v1 weekly calculation. Public IHC archives
-- and Spotify playlists remain frozen. No browser role can access this snapshot.
create table imd.iam_weekly_rankings (
  week_end_date date primary key,
  week_start_date date not null,
  algorithm_version text not null check (algorithm_version = 'v1'),
  source_day_count integer not null check (source_day_count = 7),
  source_row_count integer not null,
  top20 jsonb not null check (jsonb_typeof(top20) = 'array' and jsonb_array_length(top20) = 20),
  calculated_at timestamptz not null default now(),
  check (extract(isodow from week_end_date) = 1),
  check (week_start_date = week_end_date - 6)
);
alter table imd.iam_weekly_rankings enable row level security;
revoke all on imd.iam_weekly_rankings from public, anon, authenticated;
grant select, insert, update on imd.iam_weekly_rankings to service_role;
create policy iam_weekly_rankings_service on imd.iam_weekly_rankings
  for all to service_role using (true) with check (true);

create function imd.compute_iam_weekly_ranking(p_week_end_date date, p_persist boolean default false)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_start date := p_week_end_date - 6;
  v_days integer;
  v_rows integer;
  v_top20 jsonb;
  v_calculated_at timestamptz := now();
begin
  if p_week_end_date is null or extract(isodow from p_week_end_date) <> 1 then
    raise exception 'IAM week end must be a Monday';
  end if;

  -- One SQL snapshot for both coverage validation and scoring. v1 sums the
  -- legacy base score, falling back to score on older daily rows. Daily v2
  -- momentum is deliberately excluded, matching ihc_weekly_ranking_job.py.
  with source as materialized (
    select d.snapshot_date, d.group_id, coalesce(d.base_score, d.score, 0) as base_score
    from ihc.daily_rankings d
    where d.snapshot_date between v_start and p_week_end_date
  ), totals as (
    select s.group_id, sum(s.base_score) as total_score
    from source s group by s.group_id
  ), ranked as (
    select t.group_id, t.total_score,
      row_number() over (order by t.total_score desc, t.group_id) as rank
    from totals t
  )
  select (select count(distinct s.snapshot_date) from source s),
    (select count(*) from source),
    (select jsonb_agg(to_jsonb(r) order by r.rank) from ranked r where r.rank <= 20)
  into v_days, v_rows, v_top20;

  if v_days <> 7 or coalesce(jsonb_array_length(v_top20), 0) <> 20 then
    raise exception 'iam_weekly_ranking_not_ready: % through % (% days)', v_start, p_week_end_date, v_days;
  end if;

  if p_persist then
    insert into imd.iam_weekly_rankings
      (week_end_date, week_start_date, algorithm_version, source_day_count, source_row_count, top20, calculated_at)
    values (p_week_end_date, v_start, 'v1', v_days, v_rows, v_top20, v_calculated_at)
    on conflict (week_end_date) do update set
      source_row_count = excluded.source_row_count,
      top20 = excluded.top20,
      calculated_at = excluded.calculated_at;
  end if;

  return jsonb_build_object('weekEndDate', p_week_end_date, 'weekStartDate', v_start,
    'algorithmVersion', 'v1', 'sourceDayCount', v_days, 'sourceRowCount', v_rows,
    'top20', v_top20, 'calculatedAt', v_calculated_at);
end;
$$;
revoke all on function imd.compute_iam_weekly_ranking(date, boolean) from public, anon, authenticated;
grant execute on function imd.compute_iam_weekly_ranking(date, boolean) to service_role;
notify pgrst, 'reload schema';

-- Production-safe verification: every write below is rolled back.
begin;
do $$
declare
  preview jsonb;
  historical jsonb;
  before_count integer;
  after_count integer;
  expected_ids uuid[];
  actual_ids uuid[];
begin
  assert not has_table_privilege('anon', 'imd.iam_weekly_rankings', 'select');
  assert not has_table_privilege('authenticated', 'imd.iam_weekly_rankings', 'select');
  assert not has_function_privilege('anon', 'imd.compute_iam_weekly_ranking(date,boolean)', 'execute');
  assert not has_function_privilege('authenticated', 'imd.compute_iam_weekly_ranking(date,boolean)', 'execute');
  assert has_function_privilege('service_role', 'imd.compute_iam_weekly_ranking(date,boolean)', 'execute');
  assert (select relrowsecurity from pg_class where oid = 'imd.iam_weekly_rankings'::regclass);

  select count(*) into before_count from imd.iam_weekly_rankings;
  preview := imd.compute_iam_weekly_ranking('2026-11-16', false);
  select count(*) into after_count from imd.iam_weekly_rankings;
  assert before_count = after_count, 'preview wrote a snapshot';
  assert preview->>'weekStartDate' = '2026-11-10';
  assert preview->>'sourceDayCount' = '7';
  assert jsonb_array_length(preview->'top20') = 20;

  historical := imd.compute_iam_weekly_ranking('2026-11-09', false);
  select array_agg(w.group_id order by w.rank) into expected_ids
    from ihc.weekly_rankings w where w.week_end_date = '2026-11-09' and w.rank <= 20;
  select array_agg((r->>'group_id')::uuid order by (r->>'rank')::integer) into actual_ids
    from jsonb_array_elements(historical->'top20') r;
  assert array_length(expected_ids, 1) = 20 and expected_ids = actual_ids,
    'legacy published top 20 changed';

  begin
    perform imd.compute_iam_weekly_ranking('1900-01-01', true);
    raise exception 'missing dates were accepted';
  exception when raise_exception then
    if sqlerrm not like 'iam_weekly_ranking_not_ready:%' then raise; end if;
  end;
  assert not exists(select 1 from imd.iam_weekly_rankings where week_end_date = '1900-01-01');
end;
$$;

-- Check actual caller privileges, not just an invocation as table owner.
set local role service_role;
select imd.compute_iam_weekly_ranking('2026-11-16', true)->>'sourceRowCount' as source_rows;
reset role;
do $$
begin
  assert exists(select 1 from imd.iam_weekly_rankings where week_end_date = '2026-11-16'
    and source_day_count = 7 and jsonb_array_length(top20) = 20);
  assert (select max(week_end_date) from ihc.weekly_rankings) = '2026-11-09',
    'public ranking was changed';
end;
$$;
rollback;

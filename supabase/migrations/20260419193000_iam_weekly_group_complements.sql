create table if not exists imd.weekly_group_complements (
  id uuid primary key default gen_random_uuid(),
  week_key date not null,
  group_id uuid not null references imd.groups(id) on delete cascade,
  status text not null check (status in ('completed', 'budget_limited', 'error', 'skipped')),
  summary text,
  bullets jsonb not null default '[]'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  model text,
  estimated_input_tokens int,
  estimated_output_tokens int,
  estimated_cost_usd numeric(12, 6),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (week_key, group_id)
);

create index if not exists ix_iam_weekly_group_complements_week
  on imd.weekly_group_complements (week_key desc, created_at desc);

drop trigger if exists trg_iam_weekly_group_complements_updated_at on imd.weekly_group_complements;
create trigger trg_iam_weekly_group_complements_updated_at
before update on imd.weekly_group_complements
for each row
execute function imd.set_iam_updated_at();

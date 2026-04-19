-- IAM MVP archive tables
-- Store weekly monitoring targets, collected updates, normalized events,
-- and weekly digest candidates under imd schema.

create extension if not exists pgcrypto;

create table if not exists imd.weekly_targets (
  id uuid primary key default gen_random_uuid(),
  week_key date not null,
  group_id uuid not null references imd.groups(id) on delete cascade,
  target_reasons text[] not null default '{}',
  priority smallint not null default 3 check (priority between 1 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (week_key, group_id)
);

create table if not exists imd.raw_updates (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references imd.groups(id) on delete cascade,
  source_type text not null,
  source_url text not null,
  external_item_id text,
  title text,
  body_text text,
  raw_json jsonb,
  published_at timestamptz,
  fetched_at timestamptz not null default now(),
  status text not null default 'success' check (status in ('success', 'skipped', 'failed')),
  error_type text,
  error_message text,
  title_hash text
);

create unique index if not exists ux_iam_raw_updates_external
  on imd.raw_updates (group_id, source_type, source_url, external_item_id)
  where external_item_id is not null;

create unique index if not exists ux_iam_raw_updates_fallback
  on imd.raw_updates (group_id, source_url, published_at, title_hash)
  where external_item_id is null and published_at is not null and title_hash is not null;

create index if not exists ix_iam_raw_updates_group_fetched_at
  on imd.raw_updates (group_id, fetched_at desc);

create table if not exists imd.normalized_events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references imd.groups(id) on delete cascade,
  event_type text not null,
  headline text not null,
  summary text,
  event_date timestamptz,
  event_date_bucket text not null default 'unknown',
  importance_score int check (importance_score between 0 and 100),
  candidate_score int check (candidate_score between 0 and 100),
  confidence numeric(4, 3),
  is_major boolean not null default false,
  is_major_manual_override boolean,
  is_ongoing boolean not null default false,
  is_ongoing_manual_override boolean,
  dedupe_key text not null,
  dedupe_version text not null default 'v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, dedupe_key)
);

create index if not exists ix_iam_normalized_events_date
  on imd.normalized_events (event_date desc nulls last, created_at desc);

create table if not exists imd.event_sources (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references imd.normalized_events(id) on delete cascade,
  raw_update_id uuid not null references imd.raw_updates(id) on delete cascade,
  source_role text not null default 'evidence',
  created_at timestamptz not null default now(),
  unique (event_id, raw_update_id)
);

create table if not exists imd.weekly_digest_candidates (
  id uuid primary key default gen_random_uuid(),
  week_key date not null,
  event_id uuid not null references imd.normalized_events(id) on delete cascade,
  candidate_score int not null default 0 check (candidate_score between 0 and 100),
  rank_hint int,
  editorial_note text,
  status text not null default 'hold' check (status in ('adopt', 'hold', 'drop')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (week_key, event_id)
);

create index if not exists ix_iam_weekly_digest_candidates_week_score
  on imd.weekly_digest_candidates (week_key desc, candidate_score desc);

create table if not exists imd.group_observability_profiles (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null unique references imd.groups(id) on delete cascade,
  coverage_score int check (coverage_score between 0 and 100),
  source_diversity_score int check (source_diversity_score between 0 and 100),
  freshness_score int check (freshness_score between 0 and 100),
  interpretability_score int check (interpretability_score between 0 and 100),
  observability_mode text,
  last_observed_at timestamptz,
  updated_at timestamptz not null default now()
);

create or replace function imd.set_iam_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_iam_weekly_targets_updated_at on imd.weekly_targets;
create trigger trg_iam_weekly_targets_updated_at
before update on imd.weekly_targets
for each row
execute function imd.set_iam_updated_at();

drop trigger if exists trg_iam_normalized_events_updated_at on imd.normalized_events;
create trigger trg_iam_normalized_events_updated_at
before update on imd.normalized_events
for each row
execute function imd.set_iam_updated_at();

drop trigger if exists trg_iam_weekly_digest_candidates_updated_at on imd.weekly_digest_candidates;
create trigger trg_iam_weekly_digest_candidates_updated_at
before update on imd.weekly_digest_candidates
for each row
execute function imd.set_iam_updated_at();


alter table if exists imd.weekly_group_complements
  add column if not exists major_ongoing_topics jsonb not null default '[]'::jsonb;

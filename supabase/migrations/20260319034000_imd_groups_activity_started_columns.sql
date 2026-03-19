-- Add Dokonano career metadata columns to IMD groups.
-- Both columns are nullable for gradual backfill.

alter table if exists imd.groups
  add column if not exists activity_started_month date,
  add column if not exists activity_started_basis text;

comment on column imd.groups.activity_started_month is
  'Group activity start month (MVP stores YYYY-MM as month-start date, nullable).';

comment on column imd.groups.activity_started_basis is
  'Reference basis of activity_started_month (e.g. formation/debut/first_show/relaunch/unknown), nullable.';

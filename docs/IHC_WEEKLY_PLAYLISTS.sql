-- IMAKITE weekly playlist table
-- One row per week_end_date

create table if not exists ihc.weekly_playlists (
  week_end_date date primary key,
  spotify_playlist_id text not null,
  spotify_playlist_url text not null,
  spotify_embed_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_weekly_playlists_created_at
  on ihc.weekly_playlists (created_at desc);

-- Keep updated_at fresh on upsert/update
create or replace function ihc.set_weekly_playlists_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_weekly_playlists_updated_at on ihc.weekly_playlists;
create trigger trg_weekly_playlists_updated_at
before update on ihc.weekly_playlists
for each row
execute function ihc.set_weekly_playlists_updated_at();

-- Access for frontend
grant usage on schema ihc to anon, authenticated;
grant select on table ihc.weekly_playlists to anon, authenticated;

alter table ihc.weekly_playlists enable row level security;

drop policy if exists "Allow anon read weekly_playlists" on ihc.weekly_playlists;
create policy "Allow anon read weekly_playlists"
on ihc.weekly_playlists
for select
to anon
using (true);

drop policy if exists "Allow authenticated read weekly_playlists" on ihc.weekly_playlists;
create policy "Allow authenticated read weekly_playlists"
on ihc.weekly_playlists
for select
to authenticated
using (true);

-- Example upsert for batch job
-- insert into ihc.weekly_playlists (
--   week_end_date,
--   spotify_playlist_id,
--   spotify_playlist_url,
--   spotify_embed_url
-- ) values (
--   '2026-02-09',
--   '37i9dQZF1DXcBWIGoYBM5M',
--   'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
--   'https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M'
-- )
-- on conflict (week_end_date) do update
-- set
--   spotify_playlist_id = excluded.spotify_playlist_id,
--   spotify_playlist_url = excluded.spotify_playlist_url,
--   spotify_embed_url = excluded.spotify_embed_url;

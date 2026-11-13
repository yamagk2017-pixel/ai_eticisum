import type { SupabaseClient } from "@supabase/supabase-js";

const PROJECT = "imakite-idol-japan";
type SavedTrack = {
  track_id: string; group_id?: string; spotify_artist_id?: string;
  group_name: string; track_name: string; release_date?: string;
  total_points?: number; base_points?: number; ihc_score?: number;
  news_points?: number; youtube_points?: number; news_count?: number;
  qualifying_video_count?: number; popularity?: number; wildcard?: boolean;
  activity?: { video_ids?: unknown[] };
};
export type SavedRelease = {
  cutoff: string; committed_at: string; mode: string;
  added_tracks: unknown; target_tracks: unknown; before_tracks: unknown;
};
export type PublicTrack = { group: string; name: string; spotifyUrl: string | null };
export type ReleaseTrack = PublicTrack & {
  position: number; releaseDate: string | null;
  total: number | null; ihc: number | null; rawIhc: number | null;
  news: number | null; youtube: number | null;
  newsCount: number | null; videoCount: number | null; popularity: number | null;
  wildcard: boolean; videos: string[]; replaced: PublicTrack[];
};
export type PublicRelease = {
  date: string; committedAt: string; periodStart: string; periodEnd: string;
  initial: boolean; added: number; retained: number; total: number;
  tracks: ReleaseTrack[]; removed: (PublicTrack & { replacement: PublicTrack | null })[];
};

export function isReleaseDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

function tracks(value: unknown): SavedTrack[] {
  if (!Array.isArray(value) || value.some((t) => !t || typeof t.track_id !== "string" ||
    typeof t.group_name !== "string" || typeof t.track_name !== "string")) {
    throw new Error("Invalid saved release tracks");
  }
  return value;
}
function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function publicTrack(track: SavedTrack): PublicTrack {
  return {
    group: track.group_name, name: track.track_name,
    spotifyUrl: /^[A-Za-z0-9]{22}$/.test(track.track_id) ? `https://open.spotify.com/track/${track.track_id}` : null,
  };
}
function sameGroup(a: SavedTrack, b: SavedTrack) {
  if (a.group_id && b.group_id) return a.group_id === b.group_id;
  if (a.spotify_artist_id && b.spotify_artist_id) return a.spotify_artist_id === b.spotify_artist_id;
  return a.group_name === b.group_name;
}
function shiftDate(date: string, days: number) {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

// Explicit public projection: no object spreads from database records, IDs or raw evidence.
export function toPublicRelease(run: SavedRelease): PublicRelease {
  if (!isReleaseDate(run.cutoff) || !Number.isFinite(Date.parse(run.committed_at))) throw new Error("Invalid release date");
  const added = tracks(run.added_tracks), target = tracks(run.target_tracks), before = tracks(run.before_tracks);
  const addedMap = new Map(added.map((track) => [track.track_id, track]));
  const targetIds = new Set(target.map((track) => track.track_id));
  if (targetIds.size !== target.length || addedMap.size !== added.length || added.some((track) => !targetIds.has(track.track_id))) {
    throw new Error("Inconsistent saved release tracks");
  }
  const removed = before.filter((track) => !targetIds.has(track.track_id));
  return {
    date: run.cutoff, committedAt: new Date(run.committed_at).toISOString(),
    periodStart: shiftDate(run.cutoff, -7), periodEnd: shiftDate(run.cutoff, -1),
    initial: run.mode === "bootstrap", added: added.length,
    retained: target.filter((track) => before.some((old) => old.track_id === track.track_id)).length,
    total: target.length,
    tracks: target.flatMap((track, index) => {
      const saved = addedMap.get(track.track_id);
      if (!saved) return [];
      const videoIds = saved.activity?.video_ids ?? [];
      return [{
        ...publicTrack(saved), position: index + 1,
        releaseDate: saved.release_date && isReleaseDate(saved.release_date) ? saved.release_date : null,
        total: number(saved.total_points), ihc: number(saved.base_points), rawIhc: number(saved.ihc_score),
        news: number(saved.news_points), youtube: number(saved.youtube_points),
        newsCount: number(saved.news_count), videoCount: number(saved.qualifying_video_count),
        popularity: number(saved.popularity), wildcard: saved.wildcard === true,
        videos: [...new Set(videoIds.filter((id): id is string => typeof id === "string" && /^[\w-]{11}$/.test(id)))]
          .map((id) => `https://www.youtube.com/watch?v=${id}`),
        replaced: removed.filter((old) => sameGroup(old, saved)).map(publicTrack),
      }];
    }),
    removed: removed.map((old) => {
      const replacement = target.find((track) => sameGroup(old, track));
      return { ...publicTrack(old), replacement: replacement ? publicTrack(replacement) : null };
    }),
  };
}

function committedQuery<Columns extends string>(client: SupabaseClient, columns: Columns) {
  return client.schema("ihc").from("release_playlist_runs").select(columns)
    .eq("project_slug", PROJECT).eq("status", "committed").not("committed_at", "is", null)
    .order("committed_at", { ascending: false }).order("cutoff", { ascending: false });
}

export async function loadRelease(client: SupabaseClient, date?: string) {
  if (date !== undefined && !isReleaseDate(date)) return null;
  let query = committedQuery(client, "cutoff,committed_at,mode,added_tracks,target_tracks,before_tracks");
  if (date) query = query.eq("cutoff", date);
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw new Error(`Release read failed: ${error.message}`);
  return data ? toPublicRelease(data as unknown as SavedRelease) : null;
}

export async function loadReleaseDates(client: SupabaseClient) {
  const dates = new Set<string>();
  // Page through metadata only so older weeks remain accessible beyond the API row limit.
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await committedQuery(client, "cutoff,committed_at").range(offset, offset + 499);
    if (error) throw new Error(`Release archive read failed: ${error.message}`);
    for (const row of data ?? []) if (isReleaseDate(row.cutoff)) dates.add(row.cutoff);
    if (!data || data.length < 500) break;
  }
  return [...dates];
}

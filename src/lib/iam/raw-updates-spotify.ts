import { createHash } from "crypto";
import { createServerClient } from "@/lib/supabase/server";

type WeeklyTargetRow = {
  group_id: string;
};

type ExternalIdRow = {
  group_id: string;
  external_id: string | null;
  url: string | null;
};

type SpotifyAlbum = {
  id: string;
  name: string;
  album_type: string | null;
  release_date: string | null;
  release_date_precision: string | null;
  external_urls?: { spotify?: string };
  total_tracks?: number;
};

export type CollectRawUpdatesSpotifyResult = {
  weekKey: string | null;
  targetGroups: number;
  spotifySources: number;
  discoveredReleases: number;
  processed: number;
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{ groupId: string; message: string }>;
};

function toTitleHash(title: string | null) {
  if (!title) return null;
  return createHash("sha1").update(title.trim()).digest("hex").slice(0, 12);
}

function parseWeekKeyStartInTokyo(weekKey: string) {
  const ts = Date.parse(`${weekKey}T00:00:00+09:00`);
  if (Number.isNaN(ts)) {
    throw new Error(`Invalid weekKey: ${weekKey}`);
  }
  return ts;
}

function resolveSpotifyArtistId(externalId: string | null, url: string | null) {
  if (externalId) {
    const trimmed = externalId.trim();
    const uriMatch = trimmed.match(/^spotify:artist:([A-Za-z0-9]+)$/);
    if (uriMatch) return uriMatch[1];
    if (/^[A-Za-z0-9]{22}$/.test(trimmed)) return trimmed;
  }

  if (url) {
    try {
      const parsed = new URL(url);
      const match = parsed.pathname.match(/\/artist\/([A-Za-z0-9]+)/);
      if (match) return match[1];
    } catch {
      return null;
    }
  }

  return null;
}

function toReleaseTimestamp(releaseDate: string | null, precision: string | null) {
  if (!releaseDate) return Number.NaN;
  if (precision === "day") {
    return Date.parse(`${releaseDate}T00:00:00+09:00`);
  }
  if (precision === "month") {
    return Date.parse(`${releaseDate}-01T00:00:00+09:00`);
  }
  if (precision === "year") {
    return Date.parse(`${releaseDate}-01-01T00:00:00+09:00`);
  }
  return Date.parse(`${releaseDate}T00:00:00+09:00`);
}

async function getLatestWeekKey() {
  const supabase = createServerClient({ requireServiceRole: true });
  const res = await supabase
    .schema("imd")
    .from("weekly_targets")
    .select("week_key")
    .order("week_key", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (res.error) {
    throw new Error(`Failed to load latest week_key from weekly_targets: ${res.error.message}`);
  }
  return res.data?.week_key ?? null;
}

async function getWeeklyTargetGroupIds(weekKey: string) {
  const supabase = createServerClient({ requireServiceRole: true });
  const res = await supabase.schema("imd").from("weekly_targets").select("group_id").eq("week_key", weekKey);
  if (res.error) {
    throw new Error(`Failed to load weekly targets: ${res.error.message}`);
  }
  return ((res.data ?? []) as WeeklyTargetRow[]).map((row) => row.group_id);
}

async function getSpotifyExternalIds(groupIds: string[]) {
  if (groupIds.length === 0) return [] as ExternalIdRow[];
  const supabase = createServerClient({ requireServiceRole: true });
  const res = await supabase
    .schema("imd")
    .from("external_ids")
    .select("group_id,external_id,url")
    .in("group_id", groupIds)
    .eq("service", "spotify");

  if (res.error) {
    throw new Error(`Failed to load Spotify external_ids: ${res.error.message}`);
  }
  return (res.data ?? []) as ExternalIdRow[];
}

async function fetchSpotifyAccessToken(clientId: string, clientSecret: string) {
  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!tokenRes.ok) {
    throw new Error(`Spotify token error: ${tokenRes.status}`);
  }

  const json = (await tokenRes.json()) as { access_token?: string };
  if (!json.access_token) {
    throw new Error("Spotify token response missing access_token");
  }
  return json.access_token;
}

async function fetchArtistReleases(token: string, artistId: string) {
  const url =
    `https://api.spotify.com/v1/artists/${encodeURIComponent(artistId)}/albums` +
    `?include_groups=album,single&market=JP&limit=50`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Spotify artist releases error: ${res.status}`);
  }
  const json = (await res.json()) as { items?: SpotifyAlbum[] };
  return json.items ?? [];
}

async function saveRawUpdate(row: {
  groupId: string;
  album: SpotifyAlbum;
  fetchedAt: string;
}) {
  const supabase = createServerClient({ requireServiceRole: true });
  const sourceUrl = row.album.external_urls?.spotify ?? `https://open.spotify.com/album/${row.album.id}`;
  const description = [
    row.album.album_type ? `album_type=${row.album.album_type}` : null,
    row.album.total_tracks ? `total_tracks=${row.album.total_tracks}` : null,
    row.album.release_date ? `release_date=${row.album.release_date}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  const existingRes = await supabase
    .schema("imd")
    .from("raw_updates")
    .select("id")
    .eq("group_id", row.groupId)
    .eq("source_type", "spotify_release")
    .eq("external_item_id", row.album.id)
    .maybeSingle();

  if (existingRes.error) {
    throw new Error(`Failed to check spotify raw_updates existing row: ${existingRes.error.message}`);
  }

  const payload = {
    group_id: row.groupId,
    source_type: "spotify_release",
    source_url: sourceUrl,
    external_item_id: row.album.id,
    title: row.album.name ?? null,
    body_text: description || null,
    raw_json: {
      source: "spotify",
      album_id: row.album.id,
      album_type: row.album.album_type,
      release_date: row.album.release_date,
      release_date_precision: row.album.release_date_precision,
      total_tracks: row.album.total_tracks ?? null,
    },
    published_at: row.album.release_date ? `${row.album.release_date}T00:00:00+09:00` : null,
    fetched_at: row.fetchedAt,
    status: "success",
    title_hash: toTitleHash(row.album.name ?? null),
    error_type: null,
    error_message: null,
  };

  if (existingRes.data?.id) {
    const updateRes = await supabase
      .schema("imd")
      .from("raw_updates")
      .update(payload)
      .eq("id", existingRes.data.id)
      .select("id")
      .single();
    if (updateRes.error) {
      throw new Error(`Failed to update spotify raw_updates: ${updateRes.error.message}`);
    }
    return;
  }

  const insertRes = await supabase.schema("imd").from("raw_updates").insert(payload).select("id").single();
  if (insertRes.error) {
    throw new Error(`Failed to insert spotify raw_updates: ${insertRes.error.message}`);
  }
}

export async function collectRawUpdatesFromSpotify(): Promise<CollectRawUpdatesSpotifyResult> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET");
  }

  const weekKey = await getLatestWeekKey();
  if (!weekKey) {
    return {
      weekKey: null,
      targetGroups: 0,
      spotifySources: 0,
      discoveredReleases: 0,
      processed: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };
  }

  const weekStartTs = parseWeekKeyStartInTokyo(weekKey);
  const weekEndTs = weekStartTs + 7 * 24 * 60 * 60 * 1000;
  const groupIds = await getWeeklyTargetGroupIds(weekKey);
  const extRows = await getSpotifyExternalIds(groupIds);
  const uniqueByGroup = new Map<string, ExternalIdRow>();
  for (const row of extRows) {
    if (!uniqueByGroup.has(row.group_id)) uniqueByGroup.set(row.group_id, row);
  }
  const spotifyRows = [...uniqueByGroup.values()];
  const token = await fetchSpotifyAccessToken(clientId, clientSecret);

  const result: CollectRawUpdatesSpotifyResult = {
    weekKey,
    targetGroups: groupIds.length,
    spotifySources: spotifyRows.length,
    discoveredReleases: 0,
    processed: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  for (const row of spotifyRows) {
    const artistId = resolveSpotifyArtistId(row.external_id, row.url);
    if (!artistId) {
      result.skipped += 1;
      continue;
    }
    try {
      const releases = await fetchArtistReleases(token, artistId);
      const weeklyReleases = releases.filter((album) => {
        const ts = toReleaseTimestamp(album.release_date, album.release_date_precision);
        return Number.isFinite(ts) && ts >= weekStartTs && ts < weekEndTs;
      });
      result.discoveredReleases += weeklyReleases.length;
      if (weeklyReleases.length === 0) {
        result.skipped += 1;
        continue;
      }

      for (const album of weeklyReleases) {
        result.processed += 1;
        await saveRawUpdate({
          groupId: row.group_id,
          album,
          fetchedAt: new Date().toISOString(),
        });
        result.success += 1;
      }
    } catch (error) {
      result.failed += 1;
      result.errors.push({
        groupId: row.group_id,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return result;
}


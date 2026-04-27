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

type YoutubeVideoItem = {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    description?: string;
    publishedAt?: string;
  };
};

type YoutubePlaylistItem = {
  contentDetails?: { videoId?: string };
  snippet?: {
    title?: string;
    description?: string;
    publishedAt?: string;
  };
};

type YoutubeVideoDetailsItem = {
  id?: string;
  snippet?: {
    title?: string;
    description?: string;
    publishedAt?: string;
    liveBroadcastContent?: string;
  };
  contentDetails?: {
    duration?: string;
  };
  liveStreamingDetails?: {
    scheduledStartTime?: string;
    actualStartTime?: string;
    actualEndTime?: string;
  };
};

type YoutubeSnippetBase = {
  title?: string;
  description?: string;
  publishedAt?: string;
};

type YoutubeActivity = {
  videoId: string;
  title: string | null;
  description: string | null;
  publishedAt: string | null;
  sourceUrl: string;
  rawJson: Record<string, unknown>;
};

export type CollectRawUpdatesYoutubeResult = {
  weekKey: string | null;
  targetGroups: number;
  youtubeSources: number;
  discoveredVideos: number;
  processed: number;
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{ groupId: string; message: string }>;
};

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

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

function parseIsoDurationSeconds(duration: string | null | undefined) {
  if (!duration) return null;
  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;
  const h = Number(match[1] ?? "0");
  const m = Number(match[2] ?? "0");
  const s = Number(match[3] ?? "0");
  return h * 3600 + m * 60 + s;
}

function extractChannelIdFromUrl(url: string | null) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const channelMatch = parsed.pathname.match(/\/channel\/([A-Za-z0-9_-]+)/);
    if (channelMatch) return channelMatch[1];
  } catch {
    return null;
  }
  return null;
}

function extractHandleFromUrl(url: string | null) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const handleMatch = parsed.pathname.match(/\/@([A-Za-z0-9._-]+)/);
    return handleMatch?.[1] ?? null;
  } catch {
    return null;
  }
}

function extractUserFromUrl(url: string | null) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const userMatch = parsed.pathname.match(/\/user\/([A-Za-z0-9._-]+)/);
    return userMatch?.[1] ?? null;
  } catch {
    return null;
  }
}

function extractCustomFromUrl(url: string | null) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const customMatch = parsed.pathname.match(/\/c\/([A-Za-z0-9._-]+)/);
    return customMatch?.[1] ?? null;
  } catch {
    return null;
  }
}

async function fetchJson<T>(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`YouTube API error: ${res.status}`);
  }
  return (await res.json()) as T;
}

async function resolveChannelId(apiKey: string, externalId: string | null, url: string | null) {
  if (externalId && externalId.startsWith("UC")) return externalId;

  const channelIdFromUrl = extractChannelIdFromUrl(url);
  if (channelIdFromUrl) return channelIdFromUrl;

  const handle = extractHandleFromUrl(url);
  if (handle) {
    const data = await fetchJson<{ items?: Array<{ id?: string }> }>(
      `${YOUTUBE_API_BASE}/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${apiKey}`
    );
    const id = data.items?.[0]?.id ?? null;
    if (id && id.startsWith("UC")) return id;
  }

  const user = extractUserFromUrl(url);
  if (user) {
    const data = await fetchJson<{ items?: Array<{ id?: string }> }>(
      `${YOUTUBE_API_BASE}/channels?part=id&forUsername=${encodeURIComponent(user)}&key=${apiKey}`
    );
    const id = data.items?.[0]?.id ?? null;
    if (id && id.startsWith("UC")) return id;
  }

  const custom = extractCustomFromUrl(url);
  if (custom) {
    const data = await fetchJson<{ items?: Array<{ id?: { channelId?: string } }> }>(
      `${YOUTUBE_API_BASE}/search?part=id&type=channel&maxResults=1&q=${encodeURIComponent(custom)}&key=${apiKey}`
    );
    const id = data.items?.[0]?.id?.channelId ?? null;
    if (id && id.startsWith("UC")) return id;
  }

  return null;
}

async function fetchChannelUploadsPlaylistId(apiKey: string, channelId: string) {
  const data = await fetchJson<{
    items?: Array<{ contentDetails?: { relatedPlaylists?: { uploads?: string } } }>;
  }>(`${YOUTUBE_API_BASE}/channels?part=contentDetails&id=${encodeURIComponent(channelId)}&key=${apiKey}`);

  return data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? null;
}

async function fetchVideoDetailsMap(apiKey: string, videoIds: string[]) {
  if (videoIds.length === 0) return new Map<string, YoutubeVideoDetailsItem>();
  const chunks: string[][] = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    chunks.push(videoIds.slice(i, i + 50));
  }

  const map = new Map<string, YoutubeVideoDetailsItem>();
  for (const chunk of chunks) {
    const data = await fetchJson<{ items?: YoutubeVideoDetailsItem[] }>(
      `${YOUTUBE_API_BASE}/videos?part=snippet,contentDetails,liveStreamingDetails&id=${encodeURIComponent(
        chunk.join(",")
      )}&key=${apiKey}`
    );
    for (const item of data.items ?? []) {
      if (item.id) map.set(item.id, item);
    }
  }
  return map;
}

async function fetchChannelActivities(apiKey: string, channelId: string, weekStartTs: number) {
  const candidates = new Map<string, YoutubeSnippetBase | undefined>();

  const uploadsPlaylistId = await fetchChannelUploadsPlaylistId(apiKey, channelId);
  if (uploadsPlaylistId) {
    const playlistData = await fetchJson<{ items?: YoutubePlaylistItem[] }>(
      `${YOUTUBE_API_BASE}/playlistItems?part=contentDetails,snippet&playlistId=${encodeURIComponent(
        uploadsPlaylistId
      )}&maxResults=20&key=${apiKey}`
    );
    for (const item of playlistData.items ?? []) {
      const id = item.contentDetails?.videoId;
      if (!id) continue;
      candidates.set(id, item.snippet);
    }
  }

  for (const eventType of ["upcoming", "live", "completed"] as const) {
    const searchData = await fetchJson<{ items?: YoutubeVideoItem[] }>(
      `${YOUTUBE_API_BASE}/search?part=snippet&channelId=${encodeURIComponent(
        channelId
      )}&type=video&eventType=${eventType}&order=date&maxResults=10&key=${apiKey}`
    );
    for (const item of searchData.items ?? []) {
      const id = item.id?.videoId;
      if (!id) continue;
      candidates.set(id, item.snippet);
    }
  }

  const recentData = await fetchJson<{ items?: YoutubeVideoItem[] }>(
    `${YOUTUBE_API_BASE}/search?part=snippet&channelId=${encodeURIComponent(
      channelId
    )}&type=video&order=date&maxResults=10&key=${apiKey}`
  );
  for (const item of recentData.items ?? []) {
    const id = item.id?.videoId;
    if (!id) continue;
    candidates.set(id, item.snippet);
  }

  const videoIds = [...candidates.keys()];
  const detailsMap = await fetchVideoDetailsMap(apiKey, videoIds);

  const activities: YoutubeActivity[] = [];
  for (const videoId of videoIds) {
    const detail = detailsMap.get(videoId);
    const snippet = (detail?.snippet as YoutubeSnippetBase | undefined) ?? candidates.get(videoId);
    const publishedAt = snippet?.publishedAt ?? null;
    const liveBroadcastContent = detail?.snippet?.liveBroadcastContent ?? "none";
    const scheduledStartTime = detail?.liveStreamingDetails?.scheduledStartTime ?? null;
    const durationSeconds = parseIsoDurationSeconds(detail?.contentDetails?.duration);
    const isShort = durationSeconds !== null && durationSeconds <= 70 && liveBroadcastContent === "none";

    const publishedTs = publishedAt ? Date.parse(publishedAt) : Number.NaN;
    const scheduledTs = scheduledStartTime ? Date.parse(scheduledStartTime) : Number.NaN;
    const includeByPublished = Number.isFinite(publishedTs) && publishedTs >= weekStartTs;
    const includeBySchedule =
      liveBroadcastContent === "upcoming" && Number.isFinite(scheduledTs) && scheduledTs >= weekStartTs;

    if (!includeByPublished && !includeBySchedule) continue;

    activities.push({
      videoId,
      title: snippet?.title ?? null,
      description: snippet?.description ?? null,
      publishedAt,
      sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
      rawJson: {
        source: "youtube",
        video_id: videoId,
        channel_id: channelId,
        live_broadcast_content: liveBroadcastContent,
        duration_seconds: durationSeconds,
        is_short: isShort,
        scheduled_start_time: scheduledStartTime,
      },
    });
  }

  return activities;
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

async function getYoutubeExternalIds(groupIds: string[]) {
  if (groupIds.length === 0) return [] as ExternalIdRow[];
  const supabase = createServerClient({ requireServiceRole: true });
  const res = await supabase
    .schema("imd")
    .from("external_ids")
    .select("group_id,external_id,url")
    .in("group_id", groupIds)
    .in("service", ["youtube_channel", "youtube"]);

  if (res.error) {
    throw new Error(`Failed to load YouTube external_ids: ${res.error.message}`);
  }
  return (res.data ?? []) as ExternalIdRow[];
}

async function saveRawUpdate(row: {
  groupId: string;
  sourceUrl: string;
  videoId: string;
  title: string | null;
  description: string | null;
  publishedAt: string | null;
  rawJson?: Record<string, unknown>;
}) {
  const supabase = createServerClient({ requireServiceRole: true });
  const existingRes = await supabase
    .schema("imd")
    .from("raw_updates")
    .select("id")
    .eq("group_id", row.groupId)
    .eq("source_type", "youtube")
    .eq("external_item_id", row.videoId)
    .maybeSingle();

  if (existingRes.error) {
    throw new Error(`Failed to check raw_updates existing row: ${existingRes.error.message}`);
  }

  const payload = {
    group_id: row.groupId,
    source_type: "youtube",
    source_url: row.sourceUrl,
    external_item_id: row.videoId,
    title: row.title,
    body_text: row.description,
    raw_json: {
      source: "youtube",
      video_id: row.videoId,
      ...(row.rawJson ?? {}),
    },
    published_at: row.publishedAt,
    fetched_at: new Date().toISOString(),
    status: "success",
    title_hash: toTitleHash(row.title),
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
      throw new Error(`Failed to update raw_updates: ${updateRes.error.message}`);
    }
    return;
  }

  const insertRes = await supabase.schema("imd").from("raw_updates").insert(payload).select("id").single();
  if (insertRes.error) {
    throw new Error(`Failed to insert raw_updates: ${insertRes.error.message}`);
  }
}

export async function collectRawUpdatesFromYoutube(weekKeyInput?: string): Promise<CollectRawUpdatesYoutubeResult> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error("Missing YOUTUBE_API_KEY");
  }

  const weekKey = weekKeyInput ?? (await getLatestWeekKey());
  if (!weekKey) {
    return {
      weekKey: null,
      targetGroups: 0,
      youtubeSources: 0,
      discoveredVideos: 0,
      processed: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };
  }
  const weekStartTs = parseWeekKeyStartInTokyo(weekKey);

  const groupIds = await getWeeklyTargetGroupIds(weekKey);
  const extRows = await getYoutubeExternalIds(groupIds);
  const uniqueByGroup = new Map<string, ExternalIdRow>();
  for (const row of extRows) {
    if (!uniqueByGroup.has(row.group_id)) {
      uniqueByGroup.set(row.group_id, row);
    }
  }

  const youtubeRows = [...uniqueByGroup.values()];
  const result: CollectRawUpdatesYoutubeResult = {
    weekKey,
    targetGroups: groupIds.length,
    youtubeSources: youtubeRows.length,
    discoveredVideos: 0,
    processed: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  for (const row of youtubeRows) {
    const channelId = await resolveChannelId(apiKey, row.external_id, row.url);
    if (!channelId) {
      result.skipped += 1;
      continue;
    }

    try {
      const videos = await fetchChannelActivities(apiKey, channelId, weekStartTs);
      result.discoveredVideos += videos.length;
      if (videos.length === 0) {
        result.skipped += 1;
        continue;
      }

      for (const video of videos) {
        result.processed += 1;
        await saveRawUpdate({
          groupId: row.group_id,
          sourceUrl: video.sourceUrl,
          videoId: video.videoId,
          title: video.title,
          description: video.description,
          publishedAt: video.publishedAt,
          rawJson: video.rawJson,
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

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

export type CollectRawUpdatesYoutubeResult = {
  weekKey: string | null;
  targetGroups: number;
  youtubeSources: number;
  processed: number;
  success: number;
  failed: number;
  skipped: number;
};

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

function toTitleHash(title: string | null) {
  if (!title) return null;
  return createHash("sha1").update(title.trim()).digest("hex").slice(0, 12);
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

async function fetchLatestYoutubeVideo(apiKey: string, channelId: string) {
  const data = await fetchJson<{ items?: YoutubeVideoItem[] }>(
    `${YOUTUBE_API_BASE}/search?part=snippet&channelId=${encodeURIComponent(
      channelId
    )}&type=video&order=date&maxResults=1&key=${apiKey}`
  );
  const item = data.items?.[0];
  const videoId = item?.id?.videoId ?? null;
  if (!videoId) {
    return null;
  }

  return {
    videoId,
    title: item?.snippet?.title ?? null,
    description: item?.snippet?.description ?? null,
    publishedAt: item?.snippet?.publishedAt ?? null,
    sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
  };
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

async function upsertRawUpdate(row: {
  groupId: string;
  sourceUrl: string;
  videoId: string;
  title: string | null;
  description: string | null;
  publishedAt: string | null;
}) {
  const supabase = createServerClient({ requireServiceRole: true });
  const res = await supabase
    .schema("imd")
    .from("raw_updates")
    .upsert(
      {
        group_id: row.groupId,
        source_type: "youtube",
        source_url: row.sourceUrl,
        external_item_id: row.videoId,
        title: row.title,
        body_text: row.description,
        raw_json: {
          source: "youtube",
          video_id: row.videoId,
        },
        published_at: row.publishedAt,
        fetched_at: new Date().toISOString(),
        status: "success",
        title_hash: toTitleHash(row.title),
      },
      { onConflict: "group_id,source_type,source_url,external_item_id" }
    )
    .select("id")
    .single();

  if (res.error) {
    throw new Error(`Failed to upsert raw_updates: ${res.error.message}`);
  }
}

export async function collectRawUpdatesFromYoutube(): Promise<CollectRawUpdatesYoutubeResult> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error("Missing YOUTUBE_API_KEY");
  }

  const weekKey = await getLatestWeekKey();
  if (!weekKey) {
    return { weekKey: null, targetGroups: 0, youtubeSources: 0, processed: 0, success: 0, failed: 0, skipped: 0 };
  }

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
    processed: 0,
    success: 0,
    failed: 0,
    skipped: 0,
  };

  for (const row of youtubeRows) {
    result.processed += 1;
    const channelId = await resolveChannelId(apiKey, row.external_id, row.url);
    if (!channelId) {
      result.skipped += 1;
      continue;
    }

    try {
      const video = await fetchLatestYoutubeVideo(apiKey, channelId);
      if (!video) {
        result.skipped += 1;
        continue;
      }

      await upsertRawUpdate({
        groupId: row.group_id,
        sourceUrl: video.sourceUrl,
        videoId: video.videoId,
        title: video.title,
        description: video.description,
        publishedAt: video.publishedAt,
      });
      result.success += 1;
    } catch {
      result.failed += 1;
    }
  }

  return result;
}

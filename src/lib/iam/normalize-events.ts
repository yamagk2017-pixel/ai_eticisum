import { createHash } from "crypto";
import { createServerClient } from "@/lib/supabase/server";

type WeeklyTargetRow = {
  group_id: string;
};

type RawUpdateRow = {
  id: string;
  group_id: string;
  source_type: string;
  source_url: string;
  external_item_id: string | null;
  title: string | null;
  body_text: string | null;
  published_at: string | null;
  fetched_at: string;
};

type NormalizedEventRow = {
  id: string;
};

export type NormalizeEventsResult = {
  weekKey: string | null;
  sourceType: "youtube_and_spotify";
  rawCount: number;
  processed: number;
  success: number;
  failed: number;
};

function normalizeHeadline(input: string | null) {
  if (!input) return "youtube update";
  return input
    .toLowerCase()
    .normalize("NFKC")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function dayBucket(isoDate: string | null) {
  if (!isoDate) return "unknown";
  const ts = Date.parse(isoDate);
  if (Number.isNaN(ts)) return "unknown";
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toSummary(text: string | null) {
  if (!text) return null;
  return text.replace(/\s+/g, " ").trim().slice(0, 220);
}

function buildDedupeKey(row: RawUpdateRow, eventDateBucket: string) {
  const seed = row.external_item_id
    ? `${row.source_type}|${row.external_item_id}|${eventDateBucket}`
    : `${row.source_type}|${normalizeHeadline(row.title)}|${eventDateBucket}`;
  return createHash("sha1").update(seed).digest("hex").slice(0, 40);
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

async function getRawUpdates(groupIds: string[]) {
  if (groupIds.length === 0) return [] as RawUpdateRow[];
  const supabase = createServerClient({ requireServiceRole: true });
  const res = await supabase
    .schema("imd")
    .from("raw_updates")
    .select("id,group_id,source_type,source_url,external_item_id,title,body_text,published_at,fetched_at")
    .in("source_type", ["youtube", "spotify_release"])
    .eq("status", "success")
    .in("group_id", groupIds)
    .order("fetched_at", { ascending: false })
    .limit(1000);

  if (res.error) {
    throw new Error(`Failed to load raw_updates: ${res.error.message}`);
  }
  return (res.data ?? []) as RawUpdateRow[];
}

async function upsertNormalizedEvent(raw: RawUpdateRow) {
  const supabase = createServerClient({ requireServiceRole: true });
  const eventDate = raw.published_at ?? raw.fetched_at ?? null;
  const eventDateBucket = dayBucket(eventDate);
  const headline = raw.title?.trim() || (raw.source_type === "spotify_release" ? "Spotify release update" : "YouTube update");
  const summary = toSummary(raw.body_text);
  const dedupeKey = buildDedupeKey(raw, eventDateBucket);
  const eventType = raw.source_type === "spotify_release" ? "music_release" : "event_update";
  const importanceScore = raw.source_type === "spotify_release" ? 55 : 40;

  const eventRes = await supabase
    .schema("imd")
    .from("normalized_events")
    .upsert(
      {
        group_id: raw.group_id,
        event_type: eventType,
        headline,
        summary,
        event_date: eventDate,
        event_date_bucket: eventDateBucket,
        importance_score: importanceScore,
        confidence: 0.6,
        is_major: false,
        is_ongoing: false,
        dedupe_key: dedupeKey,
        dedupe_version: "v1",
      },
      { onConflict: "group_id,dedupe_key" }
    )
    .select("id")
    .single();

  if (eventRes.error) {
    throw new Error(`Failed to upsert normalized_events: ${eventRes.error.message}`);
  }

  const eventId = (eventRes.data as NormalizedEventRow).id;
  const sourceRes = await supabase
    .schema("imd")
    .from("event_sources")
    .upsert(
      {
        event_id: eventId,
        raw_update_id: raw.id,
        source_role: "evidence",
      },
      { onConflict: "event_id,raw_update_id" }
    )
    .select("id")
    .single();

  if (sourceRes.error) {
    throw new Error(`Failed to upsert event_sources: ${sourceRes.error.message}`);
  }
}

export async function normalizeEventsFromRawUpdates(): Promise<NormalizeEventsResult> {
  const weekKey = await getLatestWeekKey();
  if (!weekKey) {
    return {
      weekKey: null,
      sourceType: "youtube_and_spotify",
      rawCount: 0,
      processed: 0,
      success: 0,
      failed: 0,
    };
  }

  const groupIds = await getWeeklyTargetGroupIds(weekKey);
  const raws = await getRawUpdates(groupIds);

  const result: NormalizeEventsResult = {
    weekKey,
    sourceType: "youtube_and_spotify",
    rawCount: raws.length,
    processed: 0,
    success: 0,
    failed: 0,
  };

  for (const raw of raws) {
    result.processed += 1;
    try {
      await upsertNormalizedEvent(raw);
      result.success += 1;
    } catch {
      result.failed += 1;
    }
  }

  return result;
}

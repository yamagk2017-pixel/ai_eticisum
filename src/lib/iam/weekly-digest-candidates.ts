import { createServerClient } from "@/lib/supabase/server";

type WeeklyTargetRow = {
  group_id: string;
  target_reasons: string[] | null;
};

type NormalizedEventRow = {
  id: string;
  group_id: string;
  event_type: string;
  event_date: string | null;
  created_at: string;
};

export type BuildWeeklyDigestCandidatesResult = {
  weekKey: string | null;
  targetGroups: number;
  eligibleEvents: number;
  upsertedCount: number;
};

function parseWeekKeyStartInTokyo(weekKey: string) {
  const ts = Date.parse(`${weekKey}T00:00:00+09:00`);
  if (Number.isNaN(ts)) {
    throw new Error(`Invalid weekKey: ${weekKey}`);
  }
  return ts;
}

function eventTypeScore(eventType: string) {
  if (eventType === "member_change" || eventType === "tour_announcement") return 20;
  if (eventType === "live_announcement" || eventType === "music_release" || eventType === "mv_release") return 15;
  if (eventType === "media_coverage" || eventType === "event_update") return 8;
  return 5;
}

function recencyScore(eventDateIso: string | null) {
  if (!eventDateIso) return 0;
  const now = Date.now();
  const ts = Date.parse(eventDateIso);
  if (Number.isNaN(ts)) return 0;
  const diffDays = Math.floor((now - ts) / (24 * 60 * 60 * 1000));
  if (diffDays <= 2) return 15;
  if (diffDays <= 4) return 10;
  if (diffDays <= 7) return 6;
  return 0;
}

function isPrimarySource(sourceType: string) {
  return sourceType === "youtube" || sourceType === "spotify_release";
}

function computeCandidateScore(params: {
  eventType: string;
  eventDate: string | null;
  sourceCount: number;
  sourceTypes: string[];
  hasIhcReason: boolean;
  hasNandatteReason: boolean;
}) {
  let score = 0;

  if (params.sourceTypes.some(isPrimarySource)) score += 25;
  if (params.sourceCount >= 2) score += 15;
  score += eventTypeScore(params.eventType);
  score += recencyScore(params.eventDate);
  if (params.hasIhcReason) score += 10;
  if (params.hasNandatteReason) score += 5;

  return Math.max(0, Math.min(100, score));
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
    throw new Error(`Failed to load latest week_key: ${res.error.message}`);
  }
  return res.data?.week_key ?? null;
}

async function getWeeklyTargets(weekKey: string) {
  const supabase = createServerClient({ requireServiceRole: true });
  const res = await supabase
    .schema("imd")
    .from("weekly_targets")
    .select("group_id,target_reasons")
    .eq("week_key", weekKey);

  if (res.error) {
    throw new Error(`Failed to load weekly_targets: ${res.error.message}`);
  }
  return (res.data ?? []) as WeeklyTargetRow[];
}

async function getCandidateEvents(groupIds: string[], weekStartTs: number, weekEndTs: number) {
  if (groupIds.length === 0) return [] as NormalizedEventRow[];

  const supabase = createServerClient({ requireServiceRole: true });
  const weekStartIso = new Date(weekStartTs).toISOString();
  const weekEndIso = new Date(weekEndTs).toISOString();
  const res = await supabase
    .schema("imd")
    .from("normalized_events")
    .select("id,group_id,event_type,event_date,created_at")
    .in("group_id", groupIds)
    .gte("created_at", weekStartIso)
    .lt("created_at", weekEndIso)
    .order("event_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(2000);

  if (res.error) {
    throw new Error(`Failed to load normalized_events: ${res.error.message}`);
  }
  return (res.data ?? []) as NormalizedEventRow[];
}

async function getEventSourceAgg(eventIds: string[]) {
  if (eventIds.length === 0) return new Map<string, { sourceCount: number; sourceTypes: string[] }>();
  const supabase = createServerClient({ requireServiceRole: true });
  const res = await supabase
    .schema("imd")
    .from("event_sources")
    .select("event_id,raw_updates!inner(source_type)")
    .in("event_id", eventIds);

  if (res.error) {
    throw new Error(`Failed to load event_sources: ${res.error.message}`);
  }

  const agg = new Map<string, Set<string>>();
  for (const row of (res.data ?? []) as Array<{ event_id: string; raw_updates: { source_type: string } | { source_type: string }[] }>) {
    const set = agg.get(row.event_id) ?? new Set<string>();
    const raw = row.raw_updates;
    if (Array.isArray(raw)) {
      for (const r of raw) {
        if (r?.source_type) set.add(r.source_type);
      }
    } else if (raw?.source_type) {
      set.add(raw.source_type);
    }
    agg.set(row.event_id, set);
  }

  const out = new Map<string, { sourceCount: number; sourceTypes: string[] }>();
  for (const [eventId, set] of agg.entries()) {
    out.set(eventId, { sourceCount: set.size, sourceTypes: [...set] });
  }
  return out;
}

export async function buildWeeklyDigestCandidates(): Promise<BuildWeeklyDigestCandidatesResult> {
  const weekKey = await getLatestWeekKey();
  if (!weekKey) {
    return { weekKey: null, targetGroups: 0, eligibleEvents: 0, upsertedCount: 0 };
  }

  const weekStartTs = parseWeekKeyStartInTokyo(weekKey);
  const weekEndTs = weekStartTs + 7 * 24 * 60 * 60 * 1000;
  const targets = await getWeeklyTargets(weekKey);
  const targetMap = new Map<string, string[]>((targets ?? []).map((row) => [row.group_id, row.target_reasons ?? []]));
  const groupIds = [...targetMap.keys()];
  const events = await getCandidateEvents(groupIds, weekStartTs, weekEndTs);
  const sourceAggMap = await getEventSourceAgg(events.map((event) => event.id));

  const rows = events.map((event) => {
    const reasons = targetMap.get(event.group_id) ?? [];
    const sourceAgg = sourceAggMap.get(event.id) ?? { sourceCount: 0, sourceTypes: [] };
    const score = computeCandidateScore({
      eventType: event.event_type,
      eventDate: event.event_date,
      sourceCount: sourceAgg.sourceCount,
      sourceTypes: sourceAgg.sourceTypes,
      hasIhcReason: reasons.includes("ihc_top20"),
      hasNandatteReason: reasons.includes("nandatte_recent_top20"),
    });
    return {
      week_key: weekKey,
      event_id: event.id,
      candidate_score: score,
      rank_hint: 0,
      status: "hold" as const,
    };
  });

  rows.sort((a, b) => b.candidate_score - a.candidate_score);
  rows.forEach((row, index) => {
    row.rank_hint = index + 1;
  });

  if (rows.length === 0) {
    return { weekKey, targetGroups: groupIds.length, eligibleEvents: 0, upsertedCount: 0 };
  }

  const supabase = createServerClient({ requireServiceRole: true });
  const upsertRes = await supabase
    .schema("imd")
    .from("weekly_digest_candidates")
    .upsert(rows, { onConflict: "week_key,event_id" })
    .select("id");

  if (upsertRes.error) {
    throw new Error(`Failed to upsert weekly_digest_candidates: ${upsertRes.error.message}`);
  }

  return {
    weekKey,
    targetGroups: groupIds.length,
    eligibleEvents: rows.length,
    upsertedCount: (upsertRes.data ?? []).length,
  };
}

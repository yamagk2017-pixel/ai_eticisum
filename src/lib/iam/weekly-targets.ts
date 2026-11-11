import { createServerClient } from "@/lib/supabase/server";
import {
  PLAYLIST_PROJECT_SLUG, buildTargetRows, getPlaylistCutoffForWeek, parsePlaylistSnapshot,
  type PlaylistSnapshotRow, type WeeklyTargetInsertRow,
} from "@/lib/iam/weekly-target-policy";

type NandatteRankingRow = {
  group_id: string | null;
};

export type BuildWeeklyTargetsResult = {
  weekKey: string;
  playlistGroupCount: number;
  playlistTrackCount: number;
  playlistCutoff: string;
  playlistRunId: string;
  /** @deprecated Compatibility alias for playlistGroupCount; no longer IHC top 20. */
  ihcCount: number;
  nandatteRecentCount: number;
  unionCount: number;
  upsertedCount: number;
};

type RpcResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

function getTokyoDateParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(now);

  const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: Number(getPart("year")),
    month: Number(getPart("month")),
    day: Number(getPart("day")),
    weekday: getPart("weekday"),
  };
}

function formatUTCDateAsYYYYMMDD(value: Date) {
  const y = String(value.getUTCFullYear());
  const m = String(value.getUTCMonth() + 1).padStart(2, "0");
  const d = String(value.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getTokyoWeekKey(now = new Date()) {
  const { year, month, day, weekday } = getTokyoDateParts(now);
  const weekdayToOffset: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  const offset = weekdayToOffset[weekday] ?? 0;
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  utcDate.setUTCDate(utcDate.getUTCDate() - offset);
  return formatUTCDateAsYYYYMMDD(utcDate);
}

export function getTokyoPreviousWeekKey(now = new Date()) {
  const currentWeekKey = getTokyoWeekKey(now);
  const ts = Date.parse(`${currentWeekKey}T00:00:00Z`);
  if (Number.isNaN(ts)) {
    throw new Error(`Invalid current week key: ${currentWeekKey}`);
  }
  const previousWeekDate = new Date(ts);
  previousWeekDate.setUTCDate(previousWeekDate.getUTCDate() - 7);
  return formatUTCDateAsYYYYMMDD(previousWeekDate);
}

async function fetchPlaylistGroupIds(weekKey: string) {
  const supabase = createServerClient({ requireServiceRole: true });
  const cutoff = getPlaylistCutoffForWeek(weekKey);
  const result = await supabase
    .schema("ihc")
    .from("release_playlist_runs")
    .select("id,cutoff,status,committed_at,target_tracks")
    .eq("project_slug", PLAYLIST_PROJECT_SLUG)
    .eq("cutoff", cutoff)
    .eq("status", "committed")
    .maybeSingle();
  if (result.error) {
    throw new Error(`Failed to load committed playlist snapshot for ${cutoff}: ${result.error.message}`);
  }
  return parsePlaylistSnapshot((result.data ?? null) as PlaylistSnapshotRow | null, cutoff);
}

async function fetchNandatteRecentTop20GroupIds() {
  const supabase = createServerClient({ requireServiceRole: true });
  const rpcNames = ["get_recent_vote_top20", "get_recent_vote_top10", "get_recent_vote_top5"] as const;
  const rpcParams: Array<Record<string, unknown> | undefined> = [{ p_limit: 20 }, { limit: 20 }, { p_top: 20 }, undefined];

  let lastError: string | null = null;

  for (const name of rpcNames) {
    for (const params of rpcParams) {
      const result = (params
        ? await supabase.schema("nandatte").rpc(name, params)
        : await supabase.schema("nandatte").rpc(name)) as RpcResult<NandatteRankingRow>;

      if (!result.error) {
        return ((result.data ?? []) as NandatteRankingRow[])
          .map((row) => row.group_id)
          .filter((groupId): groupId is string => typeof groupId === "string" && groupId.length > 0)
          .slice(0, 20);
      }
      lastError = result.error.message;
    }
  }

  throw new Error(lastError ?? "NANDATTE recent ranking RPC unavailable");
}

async function replaceWeeklyTargets(weekKey: string, rows: WeeklyTargetInsertRow[]) {
  const supabase = createServerClient({ requireServiceRole: true });
  const deleteRes = await supabase.schema("imd").from("weekly_targets").delete().eq("week_key", weekKey);

  if (deleteRes.error) {
    throw new Error(`Failed to clear imd.weekly_targets for ${weekKey}: ${deleteRes.error.message}`);
  }

  if (rows.length === 0) return 0;

  const res = await supabase
    .schema("imd")
    .from("weekly_targets")
    .upsert(rows, { onConflict: "week_key,group_id" })
    .select("group_id");

  if (res.error) {
    throw new Error(`Failed to upsert imd.weekly_targets: ${res.error.message}`);
  }

  return (res.data ?? []).length;
}

export async function planWeeklyTargets(weekKeyInput?: string) {
  const weekKey = weekKeyInput ?? getTokyoPreviousWeekKey();
  const [playlist, nandatteRecentGroupIds] = await Promise.all([
    fetchPlaylistGroupIds(weekKey), fetchNandatteRecentTop20GroupIds(),
  ]);
  const rows = buildTargetRows(weekKey, playlist.groupIds, nandatteRecentGroupIds);
  return {
    weekKey,
    playlistGroupCount: playlist.groupIds.length,
    playlistTrackCount: playlist.trackCount,
    playlistCutoff: playlist.cutoff,
    playlistRunId: playlist.runId,
    ihcCount: playlist.groupIds.length,
    nandatteRecentCount: nandatteRecentGroupIds.length,
    unionCount: rows.length,
    targets: rows,
  };
}

export async function buildWeeklyTargets(weekKeyInput?: string): Promise<BuildWeeklyTargetsResult> {
  // Planning and snapshot validation finish before any existing targets are cleared.
  const { targets, ...summary } = await planWeeklyTargets(weekKeyInput);
  const upsertedCount = await replaceWeeklyTargets(summary.weekKey, targets);
  return { ...summary, upsertedCount };
}

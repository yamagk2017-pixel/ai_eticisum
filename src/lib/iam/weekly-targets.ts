import { createServerClient } from "@/lib/supabase/server";

type SourceType = "ihc_top20" | "nandatte_recent_top20";

type WeeklyTargetInsertRow = {
  week_key: string;
  group_id: string;
  target_reasons: SourceType[];
  priority: 1 | 2 | 3;
};

type IHCWeeklyRow = {
  group_id: string | null;
};

type NandatteRankingRow = {
  group_id: string | null;
};

export type BuildWeeklyTargetsResult = {
  weekKey: string;
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

async function fetchIhcTop20GroupIds() {
  const supabase = createServerClient({ requireServiceRole: true });

  const latestDateRes = await supabase
    .schema("ihc")
    .from("weekly_rankings")
    .select("week_end_date")
    .order("week_end_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestDateRes.error) {
    throw new Error(`Failed to get latest ihc.weekly_rankings date: ${latestDateRes.error.message}`);
  }

  const latestWeekEndDate = latestDateRes.data?.week_end_date;
  if (!latestWeekEndDate) {
    throw new Error("ihc.weekly_rankings has no data");
  }

  const rowsRes = await supabase
    .schema("ihc")
    .from("weekly_rankings")
    .select("group_id")
    .eq("week_end_date", latestWeekEndDate)
    .order("rank", { ascending: true })
    .limit(20);

  if (rowsRes.error) {
    throw new Error(`Failed to load ihc.weekly_rankings top20 rows: ${rowsRes.error.message}`);
  }

  return ((rowsRes.data ?? []) as IHCWeeklyRow[])
    .map((row) => row.group_id)
    .filter((groupId): groupId is string => typeof groupId === "string" && groupId.length > 0);
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

function buildTargetRows(weekKey: string, ihcGroupIds: string[], nandatteRecentGroupIds: string[]) {
  const sourcesByGroupId = new Map<string, Set<SourceType>>();

  for (const groupId of ihcGroupIds) {
    const current = sourcesByGroupId.get(groupId) ?? new Set<SourceType>();
    current.add("ihc_top20");
    sourcesByGroupId.set(groupId, current);
  }

  for (const groupId of nandatteRecentGroupIds) {
    const current = sourcesByGroupId.get(groupId) ?? new Set<SourceType>();
    current.add("nandatte_recent_top20");
    sourcesByGroupId.set(groupId, current);
  }

  const rows: WeeklyTargetInsertRow[] = [];

  for (const [groupId, sources] of sourcesByGroupId.entries()) {
    const hasIhc = sources.has("ihc_top20");
    const hasNandatteRecent = sources.has("nandatte_recent_top20");
    const priority: 1 | 2 | 3 = hasIhc && hasNandatteRecent ? 1 : hasIhc ? 2 : 3;

    rows.push({
      week_key: weekKey,
      group_id: groupId,
      target_reasons: Array.from(sources),
      priority,
    });
  }

  rows.sort((a, b) => a.priority - b.priority || a.group_id.localeCompare(b.group_id));
  return rows;
}

async function upsertWeeklyTargets(rows: WeeklyTargetInsertRow[]) {
  if (rows.length === 0) return 0;

  const supabase = createServerClient({ requireServiceRole: true });
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

export async function buildWeeklyTargets(weekKeyInput?: string): Promise<BuildWeeklyTargetsResult> {
  const weekKey = weekKeyInput ?? getTokyoPreviousWeekKey();

  const [ihcGroupIds, nandatteRecentGroupIds] = await Promise.all([fetchIhcTop20GroupIds(), fetchNandatteRecentTop20GroupIds()]);

  const rows = buildTargetRows(weekKey, ihcGroupIds, nandatteRecentGroupIds);
  const upsertedCount = await upsertWeeklyTargets(rows);

  return {
    weekKey,
    ihcCount: ihcGroupIds.length,
    nandatteRecentCount: nandatteRecentGroupIds.length,
    unionCount: rows.length,
    upsertedCount,
  };
}

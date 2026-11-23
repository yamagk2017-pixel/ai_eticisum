export const IHC_TARGET_REASON = "ihc_top20";
// Keep the playlist reason readable for the weeks monitored during the migration.
export const PLAYLIST_TARGET_REASON = "imakite_idol_japan";

export type SourceType = typeof IHC_TARGET_REASON | "nandatte_recent_top20";
export type WeeklyTargetInsertRow = {
  week_key: string;
  group_id: string;
  target_reasons: SourceType[];
  priority: 1 | 2 | 3;
};

export class WeeklyRankingNotReadyError extends Error {
  readonly weekEndDate: string;

  constructor(weekEndDate: string) {
    super(`IAM用週間ランキング（${weekEndDate}終了）の7日分のデータが未確定です。既存対象は変更しません。`);
    this.name = "WeeklyRankingNotReadyError";
    this.weekEndDate = weekEndDate;
  }
}

export function getWeeklyRankingEndForWeek(weekKey: string) {
  const start = new Date(`${weekKey}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekKey) || !Number.isFinite(start.getTime()) ||
      start.toISOString().slice(0, 10) !== weekKey || start.getUTCDay() !== 1) {
    throw new Error("IAM week_key must be a valid Monday (YYYY-MM-DD)");
  }
  // Legacy ranking ran Tuesday for Tue–Mon. Monday IAM used the preceding
  // Monday's ranking, i.e. the first day of the monitored Mon–Sun week.
  return weekKey;
}

export function parseWeeklyRanking(value: unknown, expectedEndDate: string) {
  const ranking = value as {
    weekEndDate?: string; algorithmVersion?: string;
    sourceDayCount?: number; top20?: Array<{ group_id: string; rank: number }>;
  } | null;
  if (!ranking || ranking.weekEndDate !== expectedEndDate || ranking.sourceDayCount !== 7) {
    throw new WeeklyRankingNotReadyError(expectedEndDate);
  }
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (ranking.algorithmVersion !== "v1" || !Array.isArray(ranking.top20) || ranking.top20.length !== 20 ||
      ranking.top20.some((row, i) => !row || typeof row.group_id !== "string" ||
        !uuid.test(row.group_id) || row.rank !== i + 1) ||
      new Set(ranking.top20.map((row) => row.group_id.toLowerCase())).size !== 20) {
    throw new Error("Invalid IAM weekly ranking top 20");
  }
  return { groupIds: ranking.top20.map((row) => row.group_id.toLowerCase()),
    weekEndDate: expectedEndDate, algorithmVersion: "v1" as const };
}

export function buildTargetRows(weekKey: string, ihcGroupIds: string[], nandatteRecentGroupIds: string[]) {
  const sourcesByGroupId = new Map<string, Set<SourceType>>();
  for (const groupId of ihcGroupIds.slice(0, 20)) {
    const current = sourcesByGroupId.get(groupId) ?? new Set<SourceType>();
    current.add(IHC_TARGET_REASON);
    sourcesByGroupId.set(groupId, current);
  }
  for (const groupId of nandatteRecentGroupIds.slice(0, 20)) {
    const current = sourcesByGroupId.get(groupId) ?? new Set<SourceType>();
    current.add("nandatte_recent_top20");
    sourcesByGroupId.set(groupId, current);
  }
  return [...sourcesByGroupId].map(([groupId, sources]): WeeklyTargetInsertRow => ({
    week_key: weekKey, group_id: groupId, target_reasons: [...sources],
    priority: sources.size === 2 ? 1 : sources.has(IHC_TARGET_REASON) ? 2 : 3,
  })).sort((a, b) => a.priority - b.priority || a.group_id.localeCompare(b.group_id));
}

export function targetSourceBonus(reasons: readonly string[]) {
  const featured = reasons.includes(PLAYLIST_TARGET_REASON) || reasons.includes(IHC_TARGET_REASON);
  return (featured ? 10 : 0) + (reasons.includes("nandatte_recent_top20") ? 5 : 0);
}

export function targetReasonLabel(reason: string) {
  if (reason === PLAYLIST_TARGET_REASON) return "イマキテアイドル：ジャパン掲載";
  if (reason === IHC_TARGET_REASON) return "イマキテ週間ランキング上位20";
  if (reason === "nandatte_recent_top20") return "NANDATTE直近ランキング上位20";
  return reason;
}

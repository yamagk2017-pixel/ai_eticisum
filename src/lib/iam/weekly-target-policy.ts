export const PLAYLIST_PROJECT_SLUG = "imakite-idol-japan";
export const PLAYLIST_TARGET_REASON = "imakite_idol_japan";

export type SourceType = typeof PLAYLIST_TARGET_REASON | "nandatte_recent_top20";

export type WeeklyTargetInsertRow = {
  week_key: string;
  group_id: string;
  target_reasons: SourceType[];
  priority: 1 | 2 | 3;
};

export type PlaylistSnapshotRow = {
  id: string;
  cutoff: string;
  status: string;
  committed_at: string | null;
  target_tracks: unknown;
};

export class PlaylistSnapshotNotReadyError extends Error {
  readonly cutoff: string;

  constructor(cutoff: string) {
    super(`イマキテアイドル：ジャパンの${cutoff}土曜更新が未確定です。IAMの既存対象は変更しません。`);
    this.name = "PlaylistSnapshotNotReadyError";
    this.cutoff = cutoff;
  }
}

export function getPlaylistCutoffForWeek(weekKey: string) {
  const start = new Date(`${weekKey}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekKey) || !Number.isFinite(start.getTime()) ||
      start.toISOString().slice(0, 10) !== weekKey || start.getUTCDay() !== 1) {
    throw new Error("IAM week_key must be a valid Monday (YYYY-MM-DD)");
  }
  start.setUTCDate(start.getUTCDate() + 5);
  return start.toISOString().slice(0, 10);
}

export function parsePlaylistSnapshot(snapshot: PlaylistSnapshotRow | null, expectedCutoff: string) {
  if (!snapshot || snapshot.status !== "committed" || snapshot.cutoff !== expectedCutoff ||
      !snapshot.committed_at || !Number.isFinite(Date.parse(snapshot.committed_at))) {
    throw new PlaylistSnapshotNotReadyError(expectedCutoff);
  }
  if (!Array.isArray(snapshot.target_tracks) || snapshot.target_tracks.length !== 50) {
    throw new Error("IAM playlist snapshot must contain exactly 50 tracks");
  }

  const groupIds = new Set<string>();
  const trackIds = new Set<string>();
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const track of snapshot.target_tracks) {
    if (!track || typeof track !== "object" || typeof track.group_id !== "string" ||
        !uuid.test(track.group_id) || typeof track.track_id !== "string" || !track.track_id.trim()) {
      throw new Error("IAM playlist snapshot contains a track without a valid group UUID or Track ID");
    }
    groupIds.add(track.group_id.toLowerCase());
    trackIds.add(track.track_id);
  }
  if (trackIds.size !== 50) throw new Error("IAM playlist snapshot contains duplicate Track IDs");

  return { groupIds: [...groupIds], trackCount: 50, cutoff: snapshot.cutoff, runId: snapshot.id };
}

export function buildTargetRows(weekKey: string, playlistGroupIds: string[], nandatteRecentGroupIds: string[]) {
  const sourcesByGroupId = new Map<string, Set<SourceType>>();
  for (const groupId of playlistGroupIds) {
    const current = sourcesByGroupId.get(groupId) ?? new Set<SourceType>();
    current.add(PLAYLIST_TARGET_REASON);
    sourcesByGroupId.set(groupId, current);
  }
  for (const groupId of nandatteRecentGroupIds) {
    const current = sourcesByGroupId.get(groupId) ?? new Set<SourceType>();
    current.add("nandatte_recent_top20");
    sourcesByGroupId.set(groupId, current);
  }
  const rows: WeeklyTargetInsertRow[] = [];
  for (const [groupId, sources] of sourcesByGroupId) {
    const playlist = sources.has(PLAYLIST_TARGET_REASON);
    const nandatte = sources.has("nandatte_recent_top20");
    rows.push({ week_key: weekKey, group_id: groupId, target_reasons: [...sources],
      priority: playlist && nandatte ? 1 : playlist ? 2 : 3 });
  }
  return rows.sort((a, b) => a.priority - b.priority || a.group_id.localeCompare(b.group_id));
}

export function targetSourceBonus(reasons: readonly string[]) {
  // Historical IHC rows keep their score when rebuilding an older digest.
  const featured = reasons.includes(PLAYLIST_TARGET_REASON) || reasons.includes("ihc_top20");
  return (featured ? 10 : 0) + (reasons.includes("nandatte_recent_top20") ? 5 : 0);
}

export function targetReasonLabel(reason: string) {
  if (reason === PLAYLIST_TARGET_REASON) return "イマキテアイドル：ジャパン掲載";
  if (reason === "ihc_top20") return "旧IHC週間ランキング上位20";
  if (reason === "nandatte_recent_top20") return "NANDATTE直近ランキング上位20";
  return reason;
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { IMAKITE_PLAYLIST } from "./imakite-playlist.ts";

export type PlaylistAnnouncement = {
  updatedDate: string;
  coverName: string;
  groupNames: string[];
  text: string;
};

type CommittedRun = {
  committed_at: string;
  cover: unknown;
  added_tracks: unknown;
};

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function requiredText(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field}が登録されていないため、告知文を生成できません。`);
  }
  return value.trim();
}

export function buildPlaylistAnnouncement(run: CommittedRun): PlaylistAnnouncement {
  const committedAt = new Date(run.committed_at);
  if (!Number.isFinite(committedAt.getTime())) {
    throw new Error("公開確定日時が不正なため、告知文を生成できません。");
  }
  const updatedDate = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo", month: "numeric", day: "numeric",
  }).format(committedAt);
  const coverName = requiredText(record(run.cover).artist_name, "カバーアイドル名");
  if (!Array.isArray(run.added_tracks) || !run.added_tracks.length) {
    throw new Error("今回追加された曲がないため、告知文を生成できません。");
  }
  const seen = new Set<string>();
  const groupNames: string[] = [];
  for (const value of run.added_tracks) {
    const track = record(value);
    const groupId = requiredText(track.group_id, "追加曲のグループID");
    if (seen.has(groupId)) continue;
    seen.add(groupId);
    groupNames.push(requiredText(track.group_name, "追加曲のグループ名"));
  }

  const text = `ライブアイドル・地下アイドルのためのプレイリスト

🎧 ${IMAKITE_PLAYLIST.name} 更新（${updatedDate}）

今回のカバーは【${coverName}】！

▼Spotifyで聴く
${IMAKITE_PLAYLIST.url}

🆕 今回リストインした${groupNames.length}組
${groupNames.join("\n")}

[マイライブラリ]への追加お願いします！
#イマキテランキング`;

  return { updatedDate, coverName, groupNames, text };
}

export async function loadPlaylistAnnouncement(client: SupabaseClient) {
  const project = await client.schema("ihc").from("release_playlist_projects")
    .select("slug").eq("spotify_playlist_id", IMAKITE_PLAYLIST.id).maybeSingle();
  if (project.error) throw new Error(`playlist project: ${project.error.message}`);
  if (!project.data) return null;

  const run = await client.schema("ihc").from("release_playlist_runs")
    .select("committed_at,cover,added_tracks")
    .eq("project_slug", project.data.slug).eq("status", "committed")
    .not("committed_at", "is", null)
    .order("committed_at", { ascending: false }).order("cutoff", { ascending: false })
    .limit(1).maybeSingle();
  if (run.error) throw new Error(`playlist run: ${run.error.message}`);
  if (!run.data) return null;
  return buildPlaylistAnnouncement(run.data as CommittedRun);
}

import type { SupabaseClient } from "@supabase/supabase-js";

type Track = { group_id: string; track_name?: string | null };
type Group = { id: string; name_ja: string | null; artist_image_url: string | null };
type Profile = { group_id: string; body: string | null };
type ExternalLink = { group_id: string; service: string; url: string | null };

export type FeaturedIdol = {
  groupId: string;
  name: string | null;
  imageUrl: string | null;
  trackName: string | null;
  profile: string | null;
  links: { label: string; url: string }[];
};

const LINK_LABELS: Record<string, string> = {
  website: "公式サイト", schedule: "スケジュール", x: "X", twitter: "X",
  instagram: "Instagram", tiktok: "TikTok", spotify: "Spotify",
  youtube_channel: "YouTube", youtube: "YouTube", apple_music: "Apple Music",
};

// Only use registered web URLs. Never synthesize a URL from an external ID.
export function registeredWebUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? value : null;
  } catch {
    return null;
  }
}

export async function loadWeeklyFeature(client: SupabaseClient, playlistId: string) {
  const project = await client.schema("ihc").from("release_playlist_projects")
    .select("slug").eq("spotify_playlist_id", playlistId).maybeSingle();
  if (project.error) throw new Error(`playlist project: ${project.error.message}`);
  if (!project.data) return null;

  const run = await client.schema("ihc").from("release_playlist_runs")
    .select("committed_at,target_tracks")
    .eq("project_slug", project.data.slug).eq("status", "committed")
    .not("committed_at", "is", null)
    .order("committed_at", { ascending: false }).order("cutoff", { ascending: false })
    .limit(1).maybeSingle();
  if (run.error) throw new Error(`playlist run: ${run.error.message}`);
  if (!run.data) return null;
  if (!Array.isArray(run.data.target_tracks)) throw new Error("Invalid committed target_tracks");

  // Preserve playlist order, including the cover slot when its IMDB fields are absent.
  const tracks: Track[] = [];
  const seen = new Set<string>();
  for (const track of run.data.target_tracks) {
    if (!track || typeof track.group_id !== "string") throw new Error("Invalid committed group_id");
    if (seen.has(track.group_id)) continue;
    seen.add(track.group_id);
    tracks.push(track);
    if (tracks.length === 3) break;
  }
  if (!tracks.length) return null;
  const ids = tracks.map((track) => track.group_id);
  const [groups, profiles, links] = await Promise.all([
    client.schema("imd").from("groups").select("id,name_ja,artist_image_url").in("id", ids),
    client.schema("imd").from("group_profiles").select("group_id,body").in("group_id", ids).eq("locale", "ja"),
    client.schema("imd").from("external_ids").select("group_id,service,url").in("group_id", ids).order("service"),
  ]);
  // A read error is not an unregistered field; do not render a partial weekly feature.
  for (const result of [groups, profiles, links]) {
    if (result.error) throw new Error(`IMDB: ${result.error.message}`);
  }
  const groupMap = new Map((groups.data as Group[]).map((group) => [group.id, group]));
  const profileMap = new Map((profiles.data as Profile[]).map((profile) => [profile.group_id, profile.body]));
  const idols: FeaturedIdol[] = tracks.map((track) => {
    const group = groupMap.get(track.group_id);
    const urls = new Set<string>();
    const registeredLinks = (links.data as ExternalLink[]).flatMap((link) => {
      const url = registeredWebUrl(link.url);
      if (link.group_id !== track.group_id || !url || urls.has(url)) return [];
      urls.add(url);
      return [{ label: LINK_LABELS[link.service] ?? link.service, url }];
    });
    return {
      groupId: track.group_id,
      name: group?.name_ja || null,
      imageUrl: registeredWebUrl(group?.artist_image_url),
      trackName: typeof track.track_name === "string" && track.track_name ? track.track_name : null,
      profile: profileMap.get(track.group_id) || null,
      links: registeredLinks,
    };
  });
  return { committedAt: run.data.committed_at as string, idols };
}

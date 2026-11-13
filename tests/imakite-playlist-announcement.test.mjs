import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { buildPlaylistAnnouncement, loadPlaylistAnnouncement } from "../src/lib/imakite-playlist-announcement.ts";
import { IMAKITE_PLAYLIST } from "../src/lib/imakite-playlist.ts";

const track = (id, name) => ({ group_id: id, group_name: name });
const run = () => ({
  committed_at: "2026-11-13T15:05:00Z",
  cover: { artist_name: "カバーアイドル" },
  added_tracks: [track("a", "Payrin's"), track("b", "Juice=Juice"), track("a", "Payrin's")],
  target_tracks: [track("old", "継続掲載グループ")],
  cutoff: "2026-11-10",
});

test("uses the publication date in Japan, actual cover, and distinct newly added groups in order", () => {
  const result = buildPlaylistAnnouncement(run());
  assert.equal(result.updatedDate, "11/14");
  assert.equal(result.coverName, "カバーアイドル");
  assert.deepEqual(result.groupNames, ["Payrin's", "Juice=Juice"]);
  assert.equal(result.text, `ライブアイドル・地下アイドルのためのプレイリスト

🎧 イマキテアイドル：ジャパン 更新（11/14）

今回のカバーは【カバーアイドル】！

▼Spotifyで聴く
https://open.spotify.com/playlist/6ACBBRFex0KOvF1V82ppvH

🆕 今回リストインした2組
Payrin's
Juice=Juice

[マイライブラリ]への追加お願いします！
#イマキテランキング`);
});

test("initial publication includes all 50 added groups without a hardcoded 25-group limit", () => {
  const result = buildPlaylistAnnouncement({ ...run(), added_tracks: Array.from({ length: 50 }, (_, i) => track(String(i), `グループ${i}`)) });
  assert.equal(result.groupNames.length, 50);
  assert.match(result.text, /今回リストインした50組/);
  assert.match(result.text, /グループ49\n/);
});

test("same-named groups with different IDs remain separate groups", () => {
  const result = buildPlaylistAnnouncement({ ...run(), added_tracks: [track("a", "同名"), track("b", "同名")] });
  assert.deepEqual(result.groupNames, ["同名", "同名"]);
});

test("missing or malformed publication data cannot produce a partial announcement", () => {
  for (const change of [
    { committed_at: "invalid" }, { cover: null }, { cover: { artist_name: " " } },
    { added_tracks: null }, { added_tracks: [] }, { added_tracks: [null] },
    { added_tracks: [track("a", "")] }, { added_tracks: [track("", "名前")] },
  ]) assert.throws(() => buildPlaylistAnnouncement({ ...run(), ...change }), /告知文を生成できません/);
});

function database({ project = { slug: "selected-project" }, snapshot = run(), fail = false } = {}) {
  const calls = [];
  const client = createClient("https://announcement-test.supabase.co", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, init) => {
      const url = new URL(input);
      calls.push({ path: url.pathname, params: Object.fromEntries(url.searchParams), method: init.method });
      if (url.pathname.endsWith("/release_playlist_projects")) return Response.json(project ? [project] : []);
      if (url.pathname.endsWith("/release_playlist_runs")) {
        if (fail) return Response.json({ message: "unavailable", code: "TEST" }, { status: 403 });
        return Response.json(snapshot ? [snapshot] : []);
      }
      throw new Error(`Unexpected request: ${url.pathname}`);
    } },
  });
  return { client, calls };
}

test("reads only the fixed playlist's latest committed update and returns presentation fields", async () => {
  const { client, calls } = database();
  const result = await loadPlaylistAnnouncement(client);
  assert.equal(calls.length, 2);
  assert(calls.every((call) => call.method === "GET"));
  assert.equal(calls[0].params.spotify_playlist_id, `eq.${IMAKITE_PLAYLIST.id}`);
  assert.equal(calls[1].params.project_slug, "eq.selected-project");
  assert.equal(calls[1].params.status, "eq.committed");
  assert.equal(calls[1].params.committed_at, "not.is.null");
  assert.equal(calls[1].params.order, "committed_at.desc,cutoff.desc");
  assert.equal(calls[1].params.limit, "1");
  assert.deepEqual(result, buildPlaylistAnnouncement(run()));
  assert(!("target_tracks" in result));
});

test("no project or committed run returns an empty state; database errors are not empty states", async () => {
  const missingProject = database({ project: null });
  assert.equal(await loadPlaylistAnnouncement(missingProject.client), null);
  assert.equal(missingProject.calls.length, 1);
  assert.equal(await loadPlaylistAnnouncement(database({ snapshot: null }).client), null);
  await assert.rejects(loadPlaylistAnnouncement(database({ fail: true }).client), /playlist run: unavailable/);
});

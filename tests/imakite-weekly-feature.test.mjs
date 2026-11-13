import assert from "node:assert/strict";
import test from "node:test";
import { loadWeeklyFeature, registeredWebUrl } from "../src/lib/imakite-weekly-data.ts";

// Read-only query double: exercise scope, status, ordering and field omission together.
function database(tables) {
  const queries = [];
  return {
    queries,
    schema(schema) {
      return { from(table) {
        const key = `${schema}.${table}`;
        queries.push(key);
        let rows = [...(tables[key] ?? [])];
        const orders = [];
        const query = {
          select() { return query; },
          eq(column, value) { rows = rows.filter((row) => row[column] === value); return query; },
          in(column, values) { rows = rows.filter((row) => values.includes(row[column])); return query; },
          not(column, operator, value) {
            assert.equal(operator, "is");
            rows = rows.filter((row) => row[column] !== value);
            return query;
          },
          order(column, options) { orders.push([column, options?.ascending !== false]); return query; },
          limit(count) {
            rows.sort((a, b) => {
              for (const [column, ascending] of orders) {
                const comparison = String(a[column]).localeCompare(String(b[column]));
                if (comparison) return ascending ? comparison : -comparison;
              }
              return 0;
            });
            rows = rows.slice(0, count);
            return query;
          },
          maybeSingle() { return Promise.resolve({ data: rows[0] ?? null, error: null }); },
          then(resolve) { return Promise.resolve({ data: rows, error: null }).then(resolve); },
        };
        return query;
      } };
    },
  };
}

const tracks = ["cover", "second", "third", "fourth"].map((group_id) => ({ group_id, track_name: `${group_id} song` }));
const committed = {
  project_slug: "fixed", status: "committed", cutoff: "2026-11-10",
  committed_at: "2026-11-11T10:00:00Z", target_tracks: tracks,
};
const fixture = () => ({
  "ihc.release_playlist_projects": [{ slug: "fixed", spotify_playlist_id: "playlist" }],
  "ihc.release_playlist_runs": [
    { ...committed, committed_at: "2026-11-04T10:00:00Z", target_tracks: [tracks[3]] },
    committed,
    { ...committed, status: "prepared", committed_at: null, target_tracks: [tracks[3]] },
    { ...committed, project_slug: "another-project", committed_at: "2026-11-20T10:00:00Z", target_tracks: [tracks[3]] },
  ],
  "imd.groups": [...tracks].reverse().map(({ group_id }) => ({ id: group_id, name_ja: group_id, slug: `${group_id}-registered`, artist_image_url: `https://images.example/${group_id}` })),
  "imd.group_profiles": [{ group_id: "cover", locale: "ja", body: "  登録された本文\n改行も保持する。  " }],
  "imd.external_ids": [
    { group_id: "cover", service: "website", url: "https://example.com/" },
    { group_id: "cover", service: "x", url: "https://x.com/example" },
    { group_id: "cover", service: "spotify", url: null, external_id: "do-not-infer" },
    { group_id: "cover", service: "bad", url: "javascript:alert(1)" },
    { group_id: "cover", service: "duplicate", url: "https://example.com/" },
  ],
});

test("uses latest committed result in the fixed playlist, preserving track order and registered text", async () => {
  const result = await loadWeeklyFeature(database(fixture()), "playlist");
  assert.equal(result.committedAt, committed.committed_at);
  assert.deepEqual(result.idols.map((idol) => [idol.name, idol.trackName]), tracks.slice(0, 3).map((track) => [track.group_id, track.track_name]));
  assert.equal(result.idols[0].profile, "  登録された本文\n改行も保持する。  ");
  assert.deepEqual(result.idols[0].links, [
    { label: "公式サイト", url: "https://example.com/" }, { label: "X", url: "https://x.com/example" },
  ]);
  assert.equal(result.idols[1].profile, null);
  assert.deepEqual(result.idols.map((idol) => idol.nandatteUrl), ["/nandatte/cover-registered", "/nandatte/second-registered", "/nandatte/third-registered"]);
});

test("a newly committed run replaces all featured artists without changing display code", async () => {
  const tables = fixture();
  tables["ihc.release_playlist_runs"].push({ ...committed, committed_at: "2026-11-14T00:01:00Z", target_tracks: [...tracks].reverse() });
  const result = await loadWeeklyFeature(database(tables), "playlist");
  assert.deepEqual(result.idols.map((idol) => idol.groupId), ["fourth", "third", "second"]);
});

test("missing IMDB fields do not promote the next artist or infer a name, image, profile or link", async () => {
  const tables = fixture();
  tables["imd.groups"] = [];
  tables["imd.group_profiles"] = [];
  tables["imd.external_ids"] = [];
  const result = await loadWeeklyFeature(database(tables), "playlist");
  assert.deepEqual(result.idols[0], { groupId: "cover", name: null, nandatteUrl: null, imageUrl: null, profile: null, trackName: "cover song", links: [] });
});

test("no committed result or unknown playlist renders no feature and reads no profiles", async () => {
  const tables = fixture();
  tables["ihc.release_playlist_runs"] = [{ ...committed, status: "prepared", committed_at: null }];
  const client = database(tables);
  assert.equal(await loadWeeklyFeature(client, "playlist"), null);
  assert(!client.queries.some((query) => query.startsWith("imd.")));
  assert.equal(await loadWeeklyFeature(database(fixture()), "unknown-playlist"), null);
});

test("first three distinct groups preserve the playlist's first cover slot", async () => {
  const tables = fixture();
  tables["ihc.release_playlist_runs"] = [{ ...committed, target_tracks: [tracks[0], tracks[0], ...tracks.slice(1)] }];
  const result = await loadWeeklyFeature(database(tables), "playlist");
  assert.deepEqual(result.idols.map((idol) => idol.groupId), ["cover", "second", "third"]);
});

test("registered web links reject unsafe protocols, relative paths and embedded credentials", () => {
  for (const value of [null, "", "/relative", "javascript:alert(1)", "data:text/html,hello", "https://user:secret@example.com/"]) assert.equal(registeredWebUrl(value), null);
  assert.equal(registeredWebUrl("https://example.com/path?q=1"), "https://example.com/path?q=1");
});

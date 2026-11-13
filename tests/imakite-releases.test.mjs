import assert from "node:assert/strict";
import test from "node:test";
import { isReleaseDate, loadRelease, loadReleaseDates, toPublicRelease } from "../src/lib/imakite-releases-data.ts";

const track = (letter, group = letter) => ({
  track_id: letter.repeat(22), group_id: `internal-${group}`, group_name: group, track_name: `song-${letter}`,
  release_date: "2026-11-13", ihc_score: -1, base_points: 0, news_points: 10, youtube_points: 6,
  total_points: 16, news_count: 3, qualifying_video_count: 3, popularity: 3, wildcard: true,
  activity: { news_ids: ["private-news-id"], video_ids: ["2sJi4cya8wA", "qCOXgvvhidU", "4WvG1CDyQ7M", "javascript:bad"], youtube_coverage: ["internal-coverage"] },
});
const run = (overrides = {}) => ({
  project_slug: "imakite-idol-japan", status: "committed", mode: "weekly", cutoff: "2026-11-14",
  committed_at: "2026-11-13T15:35:52.342278Z", id: "private-run-uuid", evidence: { secret: "raw-evidence" },
  added_tracks: [track("a", "same")], target_tracks: [track("a", "same"), track("b")],
  before_tracks: [track("z", "same"), track("b"), track("c")], ...overrides,
});
function database(rows, failure = null) {
  const queries = [];
  return { queries, schema(schema) { assert.equal(schema, "ihc"); return { from(table) {
    assert.equal(table, "release_playlist_runs");
    let selected, filtered = [...rows]; const orders = [];
    const q = {
      select(columns) { selected = columns; queries.push(columns); return q; },
      eq(col, value) { filtered = filtered.filter((r) => r[col] === value); return q; },
      not(col, op, value) { assert.equal(op, "is"); filtered = filtered.filter((r) => r[col] !== value); return q; },
      order(col, opts) { orders.push([col, opts.ascending]); return q; },
      sorted() { return [...filtered].sort((a,b) => { for (const [col, asc] of orders) { const c = String(a[col]).localeCompare(String(b[col])); if (c) return asc ? c : -c; } return 0; }); },
      project(data) { return data.map((r) => Object.fromEntries(selected.split(",").map((col) => [col, r[col]]))); },
      limit(count) { filtered = q.sorted().slice(0,count); return q; },
      maybeSingle() { return Promise.resolve({ data: q.project(filtered)[0] ?? null, error: failure }); },
      range(start, end) { return Promise.resolve({ data: q.project(q.sorted().slice(start, end + 1)), error: failure }); },
    }; return q;
  } }; } };
}

test("saved results preserve target order and derive replacements, removals and retained counts", () => {
  const saved = run({ added_tracks: [track("a", "same"), track("d")], target_tracks: [track("d"), track("b"), track("a", "same")] });
  const result = toPublicRelease(saved);
  assert.deepEqual([result.added, result.retained, result.total], [2, 1, 3]);
  assert.deepEqual(result.tracks.map((r) => [r.position, r.name]), [[1, "song-d"], [3, "song-a"]]);
  assert.equal(result.tracks[1].replaced[0].name, "song-z");
  assert.equal(result.removed[0].replacement.name, "song-a");
  assert.equal(result.removed[1].replacement, null);
  assert.deepEqual([result.periodStart, result.periodEnd], ["2026-11-07", "2026-11-13"]);
  assert.equal(result.committedAt, "2026-11-13T15:35:52.342Z");
  assert.equal(result.tracks[0].ihc, 0);
  assert.equal(result.tracks[0].rawIhc, -1);
  assert.equal(result.tracks[0].videos.length, 3);
});
test("public projection omits internal UUIDs, raw evidence and non-video activity data", () => {
  const output = JSON.stringify(toPublicRelease(run()));
  for (const privateValue of ["private-run-uuid", "raw-evidence", "private-news-id", "internal-coverage", "internal-same", "javascript:", "group_id", "activity", "evidence"]) assert(!output.includes(privateValue), privateValue);
  assert(output.includes("https://open.spotify.com/track/"));
  assert(output.includes("https://www.youtube.com/watch?v=2sJi4cya8wA"));
});
test("latest committed week switches automatically, excludes other projects and drafts; archive is pinned by cutoff", async () => {
  const old = run({ cutoff: "2026-11-07", committed_at: "2026-11-06T15:30:00Z" });
  const rows = [old, run(), run({ cutoff: "2026-11-21", status: "prepared", committed_at: null }), run({ project_slug: "other", committed_at: "2026-12-01T00:00:00Z" })];
  assert.equal((await loadRelease(database(rows))).date, "2026-11-14");
  assert.equal((await loadRelease(database(rows), "2026-11-07")).date, "2026-11-07");
  rows.push(run({ cutoff: "2026-11-21", committed_at: "2026-11-20T15:30:00Z" }));
  assert.equal((await loadRelease(database(rows))).date, "2026-11-21");
  assert.equal((await loadRelease(database(rows), "2026-11-14")).date, "2026-11-14");
  assert.equal(await loadRelease(database(rows), "2026-12-05"), null);
  const client = database(rows); await loadRelease(client);
  assert.deepEqual(client.queries, ["cutoff,committed_at,mode,added_tracks,target_tracks,before_tracks"]);
});
test("same-cutoff reruns choose the latest commit; archive metadata is deduplicated and paginated", async () => {
  const rows = Array.from({ length: 510 }, (_, i) => {
    const date = new Date(Date.UTC(2020, 0, 4 + i * 7)).toISOString().slice(0, 10);
    return run({ cutoff: date, committed_at: `${date}T00:00:00Z` });
  });
  rows.push({ ...rows[0], committed_at: "2030-01-01T00:00:00Z" });
  const client = database(rows);
  const dates = await loadReleaseDates(client);
  assert.equal(dates.length, 510);
  assert.equal(dates[0], rows[0].cutoff);
  assert.equal(client.queries.length, 2);
  assert(client.queries.every((columns) => columns === "cutoff,committed_at"));
  assert.equal((await loadRelease(database(rows), rows[0].cutoff)).committedAt, "2030-01-01T00:00:00.000Z");
});
test("invalid dates, empty results, malformed saved arrays and database failures are handled distinctly", async () => {
  for (const value of ["2026-02-30", "2026-13-01", "x", "2026-1-01", "2026-11-14T00:00:00Z"]) {
    assert.equal(isReleaseDate(value), false);
    const client = database([run()]); assert.equal(await loadRelease(client, value), null); assert.equal(client.queries.length, 0);
  }
  assert.equal(await loadRelease(database([])), null);
  assert.throws(() => toPublicRelease(run({ target_tracks: null })));
  assert.throws(() => toPublicRelease(run({ target_tracks: [] })));
  await assert.rejects(loadRelease(database([], { message: "unavailable" })), /Release read failed/);
  await assert.rejects(loadReleaseDates(database([], { message: "unavailable" })), /archive read failed/);
});

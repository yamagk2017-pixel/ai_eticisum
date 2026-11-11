import assert from "node:assert/strict";
import test from "node:test";
import {
  PLAYLIST_TARGET_REASON, buildTargetRows, getPlaylistCutoffForWeek, parsePlaylistSnapshot, targetReasonLabel, targetSourceBonus,
} from "../src/lib/iam/weekly-target-policy.ts";

const groupId = (i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
const snapshot = (distinctGroups = 50) => ({
  id: "run-14", cutoff: "2026-11-14", status: "committed", committed_at: "2026-11-13T15:05:00Z",
  target_tracks: Array.from({ length: 50 }, (_, i) => ({ track_id: `track-${i}`, group_id: groupId(i % distinctGroups) })),
});

test("IAM Monday week maps to its Saturday cutoff, including month/year boundaries", () => {
  assert.equal(getPlaylistCutoffForWeek("2026-11-09"), "2026-11-14");
  assert.equal(getPlaylistCutoffForWeek("2026-11-02"), "2026-11-07");
  assert.equal(getPlaylistCutoffForWeek("2026-12-28"), "2027-01-02");
  for (const key of ["2026-11-10", "2026-02-30", "not-a-date"]) assert.throws(() => getPlaylistCutoffForWeek(key));
});

test("all 50 tracks are included rather than only the first 20", () => {
  const selected = parsePlaylistSnapshot(snapshot(), "2026-11-14");
  assert.equal(selected.groupIds.length, 50);
  assert(selected.groupIds.includes(groupId(49)));
  assert.equal(selected.runId, "run-14");
});

test("several songs by the same group create just one monitoring target", () => {
  const selected = parsePlaylistSnapshot(snapshot(45), "2026-11-14");
  assert.equal(selected.trackCount, 50);
  assert.equal(selected.groupIds.length, 45);
});

test("missing, pending, previous-week and future-week snapshots are rejected", () => {
  const current = snapshot();
  for (const row of [null, { ...current, status: "prepared" }, { ...current, committed_at: null },
      { ...current, cutoff: "2026-11-07" }, { ...current, cutoff: "2026-11-21" }]) {
    assert.throws(() => parsePlaylistSnapshot(row, "2026-11-14"), /未確定/);
  }
});

test("partial/corrupt snapshots fail instead of reducing or clearing existing targets", () => {
  assert.throws(() => parsePlaylistSnapshot({ ...snapshot(), target_tracks: [] }, "2026-11-14"), /50/);
  const bad = snapshot(); bad.target_tracks[0].group_id = "a group name";
  assert.throws(() => parsePlaylistSnapshot(bad, "2026-11-14"), /UUID/);
  const duplicate = snapshot(); duplicate.target_tracks[49].track_id = duplicate.target_tracks[0].track_id;
  assert.throws(() => parsePlaylistSnapshot(duplicate, "2026-11-14"), /duplicate/);
});

test("playlist and NANDATTE union removes overlaps and preserves source priority", () => {
  const rows = buildTargetRows("2026-11-09", [groupId(1), groupId(2), groupId(1)], [groupId(2), groupId(3)]);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((r) => [r.group_id, r.priority]), [[groupId(2), 1], [groupId(1), 2], [groupId(3), 3]]);
  assert.deepEqual(rows[0].target_reasons, [PLAYLIST_TARGET_REASON, "nandatte_recent_top20"]);
  assert(!rows.some((r) => r.target_reasons.includes("ihc_top20")));
});

test("50 playlist groups plus 20 non-overlapping NANDATTE groups remain uncapped at 70", () => {
  const rows = buildTargetRows("2026-11-09", Array.from({ length: 50 }, (_, i) => groupId(i)),
    Array.from({ length: 20 }, (_, i) => groupId(i + 50)));
  assert.equal(rows.length, 70);
});

test("new playlist reason inherits 10 points, NANDATTE keeps 5, historical IHC stays compatible", () => {
  assert.equal(targetSourceBonus([PLAYLIST_TARGET_REASON]), 10);
  assert.equal(targetSourceBonus(["nandatte_recent_top20"]), 5);
  assert.equal(targetSourceBonus([PLAYLIST_TARGET_REASON, "nandatte_recent_top20"]), 15);
  assert.equal(targetSourceBonus(["ihc_top20"]), 10);
  assert.equal(targetSourceBonus([PLAYLIST_TARGET_REASON, "ihc_top20"]), 10);
  assert.equal(targetSourceBonus([]), 0);
  assert.equal(targetReasonLabel(PLAYLIST_TARGET_REASON), "イマキテアイドル：ジャパン掲載");
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  IHC_TARGET_REASON, PLAYLIST_TARGET_REASON, buildTargetRows, getWeeklyRankingEndForWeek,
  parseWeeklyRanking, targetReasonLabel, targetSourceBonus,
} from "../src/lib/iam/weekly-target-policy.ts";

const uuid = (i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
const ranking = () => ({ weekEndDate: "2026-11-16", algorithmVersion: "v1", sourceDayCount: 7,
  top20: Array.from({ length: 20 }, (_, i) => ({ group_id: uuid(i), rank: i + 1 })) });

test("IAM uses the preceding published Tue–Mon ranking, including year boundaries", () => {
  assert.equal(getWeeklyRankingEndForWeek("2026-11-16"), "2026-11-16");
  assert.equal(getWeeklyRankingEndForWeek("2026-12-28"), "2026-12-28");
  for (const key of ["2026-11-17", "2026-02-30", "invalid"]) {
    assert.throws(() => getWeeklyRankingEndForWeek(key));
  }
});

test("exactly 20 ranked UUIDs and seven source dates are required", () => {
  assert.equal(parseWeeklyRanking(ranking(), "2026-11-16").groupIds.length, 20);
  for (const value of [null, { ...ranking(), sourceDayCount: 6 }, { ...ranking(), weekEndDate: "2026-11-09" }]) {
    assert.throws(() => parseWeeklyRanking(value, "2026-11-16"), /未確定/);
  }
  const duplicate = ranking(); duplicate.top20[19].group_id = uuid(0);
  const badId = ranking(); badId.top20[0].group_id = "name";
  const badRank = ranking(); badRank.top20[0].rank = 2;
  for (const value of [duplicate, badId, badRank, { ...ranking(), top20: [] }, { ...ranking(), algorithmVersion: "v2" }]) {
    assert.throws(() => parseWeeklyRanking(value, "2026-11-16"), /Invalid/);
  }
});

test("IHC and NANDATTE overlap is deduplicated with the original priorities", () => {
  const rows = buildTargetRows("2026-11-16", [uuid(1), uuid(2), uuid(1)], [uuid(2), uuid(3)]);
  assert.deepEqual(rows.map((r) => [r.group_id, r.priority]), [[uuid(2), 1], [uuid(1), 2], [uuid(3), 3]]);
  assert.deepEqual(rows[0].target_reasons, [IHC_TARGET_REASON, "nandatte_recent_top20"]);
});

test("only 20 per source are monitored, even if a source returns more", () => {
  const rows = buildTargetRows("2026-11-16", Array.from({ length: 50 }, (_, i) => uuid(i)),
    Array.from({ length: 30 }, (_, i) => uuid(i + 50)));
  assert.equal(rows.length, 40);
  assert(!rows.some((row) => row.target_reasons.includes(PLAYLIST_TARGET_REASON)));
});

test("10/5 point bonuses and historical playlist reasons remain readable", () => {
  assert.equal(targetSourceBonus([IHC_TARGET_REASON]), 10);
  assert.equal(targetSourceBonus(["nandatte_recent_top20"]), 5);
  assert.equal(targetSourceBonus([IHC_TARGET_REASON, "nandatte_recent_top20"]), 15);
  assert.equal(targetSourceBonus([PLAYLIST_TARGET_REASON]), 10);
  assert.equal(targetSourceBonus([PLAYLIST_TARGET_REASON, IHC_TARGET_REASON]), 10);
  assert.equal(targetReasonLabel(IHC_TARGET_REASON), "イマキテ週間ランキング上位20");
});

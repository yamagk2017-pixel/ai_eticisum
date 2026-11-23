import assert from "node:assert/strict";
import test from "node:test";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://iam-test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_iam_test_fixture";
const { buildWeeklyTargets, planWeeklyTargets, getTokyoPreviousWeekKey } = await import("../src/lib/iam/weekly-targets.ts");
const uuid = (i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
const completed = () => ({ weekEndDate: "2026-11-16", algorithmVersion: "v1", sourceDayCount: 7,
  top20: Array.from({ length: 20 }, (_, i) => ({ group_id: uuid(i), rank: i + 1 })) });

async function withDatabase(snapshot, action) {
  const originalFetch = globalThis.fetch;
  const calls = [];
  let written = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url ?? input.toString());
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ path: url.pathname, method, body });
    if (url.pathname.endsWith("/rpc/compute_iam_weekly_ranking")) {
      if (!snapshot) return Response.json({ message: "iam_weekly_ranking_not_ready" }, { status: 400 });
      return Response.json(snapshot);
    }
    if (url.pathname.endsWith("/rpc/get_recent_vote_top20")) {
      // Real production RPC takes no parameters; preserve fallback behavior.
      if (body && Object.keys(body).length) return Response.json({ message: "no such signature" }, { status: 404 });
      return Response.json(Array.from({ length: 20 }, (_, i) => ({ group_id: uuid(i + 15) })));
    }
    if (url.pathname.endsWith("/weekly_targets") && method === "DELETE") return new Response(null, { status: 204 });
    if (url.pathname.endsWith("/weekly_targets") && method === "POST") {
      written = body;
      return Response.json(written.map((row) => ({ group_id: row.group_id })));
    }
    throw new Error(`Unexpected database request: ${method} ${url.pathname}`);
  };
  try { await action({ calls, written: () => written }); }
  finally { globalThis.fetch = originalFetch; }
}

test("Monday JST execution keeps the preceding Mon–Sun event window", () => {
  assert.equal(getTokyoPreviousWeekKey(new Date("2026-11-22T18:00:00Z")), "2026-11-16");
});

test("preview computes the matching private ranking without saving anything", async () => {
  await withDatabase(completed(), async ({ calls }) => {
    const plan = await planWeeklyTargets("2026-11-16");
    assert.equal(plan.rankingWeekEndDate, "2026-11-16");
    assert.equal(plan.ihcCount, 20);
    assert.equal(plan.unionCount, 35);
    const rpc = calls.find((call) => call.path.endsWith("/compute_iam_weekly_ranking"));
    assert.deepEqual(rpc.body, { p_week_end_date: "2026-11-16", p_persist: false });
    assert(!calls.some((call) => call.path.endsWith("/weekly_targets")));
  });
});

test("incomplete source dates preserve existing targets", async () => {
  await withDatabase(null, async ({ calls }) => {
    await assert.rejects(buildWeeklyTargets("2026-11-16"), /未確定/);
    assert(!calls.some((call) => call.path.endsWith("/weekly_targets")));
  });
});

test("backfill cannot use a newer week's ranking", async () => {
  await withDatabase(completed(), async ({ calls }) => {
    await assert.rejects(buildWeeklyTargets("2026-11-09"), /未確定/);
    assert(!calls.some((call) => call.path.endsWith("/weekly_targets")));
  });
});

test("normal execution saves the private ranking and writes at most 40 original-source targets", async () => {
  await withDatabase(completed(), async ({ calls, written }) => {
    const result = await buildWeeklyTargets("2026-11-16");
    assert.equal(result.upsertedCount, 35);
    assert.equal(result.ihcCount, 20);
    assert(calls.find((call) => call.path.endsWith("/compute_iam_weekly_ranking")).body.p_persist);
    assert.equal(new Set(written().map((row) => row.group_id)).size, 35);
    assert(written().some((row) => row.target_reasons.includes("ihc_top20")));
    assert(!written().some((row) => row.target_reasons.includes("imakite_idol_japan")));
    assert.equal(calls.filter((call) => call.path.endsWith("/weekly_targets") && call.method === "DELETE").length, 1);
    assert.equal(calls.filter((call) => call.path.endsWith("/weekly_targets") && call.method === "POST").length, 1);
  });
});

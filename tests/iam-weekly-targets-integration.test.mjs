import assert from "node:assert/strict";
import test from "node:test";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://iam-test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_iam_test_fixture";
const { buildWeeklyTargets, planWeeklyTargets } = await import("../src/lib/iam/weekly-targets.ts");
const uuid = (i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;

async function withDatabase(snapshot, action) {
  const originalFetch = globalThis.fetch;
  const calls = [];
  let written = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url ?? input.toString());
    const method = init.method ?? "GET";
    calls.push({ path: url.pathname, method, params: Object.fromEntries(url.searchParams) });
    if (url.pathname.endsWith("/release_playlist_runs")) {
      return Response.json(snapshot ? [snapshot] : []);
    }
    if (url.pathname.endsWith("/rpc/get_recent_vote_top20")) {
      return Response.json(Array.from({ length: 20 }, (_, i) => ({ group_id: uuid(i + 45) })));
    }
    if (url.pathname.endsWith("/weekly_targets") && method === "DELETE") return new Response(null, { status: 204 });
    if (url.pathname.endsWith("/weekly_targets") && method === "POST") {
      written = JSON.parse(init.body);
      return Response.json(written.map((row) => ({ group_id: row.group_id })));
    }
    throw new Error(`Unexpected database request: ${method} ${url.pathname}`);
  };
  try {
    await action({ calls, written: () => written });
  } finally {
    globalThis.fetch = originalFetch;
  }
}

const completed = () => ({ id: "run-14", cutoff: "2026-11-14", status: "committed",
  committed_at: "2026-11-13T15:05:00Z", target_tracks: Array.from({ length: 50 }, (_, i) => ({
    track_id: `track-${i}`, group_id: uuid(i % 45),
  })) });

test("read-only plan queries the exact committed Saturday and includes the whole playlist", async () => {
  await withDatabase(completed(), async ({ calls }) => {
    const plan = await planWeeklyTargets("2026-11-09");
    assert.equal(plan.playlistCutoff, "2026-11-14");
    assert.equal(plan.playlistTrackCount, 50);
    assert.equal(plan.playlistGroupCount, 45);
    assert.equal(plan.unionCount, 65);
    assert.equal(plan.targets.length, 65);
    const query = calls.find((call) => call.path.endsWith("/release_playlist_runs"));
    assert.equal(query.params.project_slug, "eq.imakite-idol-japan");
    assert.equal(query.params.cutoff, "eq.2026-11-14");
    assert.equal(query.params.status, "eq.committed");
    assert(!calls.some((call) => call.path.endsWith("/weekly_targets")));
    assert(!calls.some((call) => call.path.endsWith("/weekly_rankings")));
  });
});

test("missing Saturday snapshot preserves existing weekly targets without any mutation", async () => {
  await withDatabase(null, async ({ calls }) => {
    await assert.rejects(buildWeeklyTargets("2026-11-09"), /2026-11-14.*未確定/);
    assert(!calls.some((call) => call.path.endsWith("/weekly_targets")));
  });
});

test("a backfill cannot substitute the current playlist for its own historical Saturday", async () => {
  await withDatabase(completed(), async ({ calls }) => {
    await assert.rejects(buildWeeklyTargets("2026-11-02"), /2026-11-07.*未確定/);
    assert.equal(calls.find((call) => call.path.endsWith("/release_playlist_runs")).params.cutoff, "eq.2026-11-07");
    assert(!calls.some((call) => call.path.endsWith("/weekly_targets")));
  });
});

test("validated source groups are written once with the new reason and compatible count alias", async () => {
  await withDatabase(completed(), async ({ calls, written }) => {
    const result = await buildWeeklyTargets("2026-11-09");
    assert.equal(result.upsertedCount, 65);
    assert.equal(result.ihcCount, result.playlistGroupCount);
    assert.equal(new Set(written().map((row) => row.group_id)).size, 65);
    assert(written().some((row) => row.target_reasons.includes("imakite_idol_japan")));
    assert(!written().some((row) => row.target_reasons.includes("ihc_top20")));
    assert.equal(calls.filter((call) => call.path.endsWith("/weekly_targets") && call.method === "DELETE").length, 1);
    assert.equal(calls.filter((call) => call.path.endsWith("/weekly_targets") && call.method === "POST").length, 1);
  });
});

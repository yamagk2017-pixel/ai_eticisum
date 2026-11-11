import assert from "node:assert/strict";
import test from "node:test";

import { POST } from "../src/app/api/buzzttara/reactions/route.ts";

const serviceKey = [
  Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
  Buffer.from(JSON.stringify({ role: "service_role", ref: "test-project" })).toString("base64url"),
  "fixture-signature",
].join(".");

async function withDatabase({ key = serviceKey, url = "https://reaction-test.supabase.co", duplicate = false } = {}, action) {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const requests = [];
  const errors = [];
  process.env.NEXT_PUBLIC_SUPABASE_URL = url;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_public_fixture";
  if (key === null) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = key;
  console.error = (...args) => errors.push(args.join(" "));
  globalThis.fetch = async (input, init = {}) => {
    const requestUrl = new URL(typeof input === "string" ? input : input.url ?? input.toString());
    const method = init.method ?? "GET";
    const headers = new Headers(init.headers);
    requests.push({ url: requestUrl, method, headers, body: init.body ? JSON.parse(init.body) : null });
    if (requestUrl.pathname === "/rest/v1/tweet_reactions" && method === "POST") {
      return duplicate
        ? Response.json({ code: "23505", message: "duplicate reaction" }, { status: 409 })
        : new Response(null, { status: 201 });
    }
    if (requestUrl.pathname === "/rest/v1/tweets" && method === "GET") return Response.json([{ like_count: 3 }]);
    if (requestUrl.pathname === "/rest/v1/tweet_tags" && method === "GET") return Response.json([{ like_count: 5 }]);
    if (["/rest/v1/tweets", "/rest/v1/tweet_tags"].includes(requestUrl.pathname) && method === "PATCH") {
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected database request: ${method} ${requestUrl.pathname}`);
  };
  try {
    await action({ requests, errors });
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
    for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
      if (originalEnv[name] === undefined) delete process.env[name];
      else process.env[name] = originalEnv[name];
    }
  }
}

const request = (body, cookie) => new Request("https://example.test/api/buzzttara/reactions", {
  method: "POST",
  headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
  body: JSON.stringify(body),
});

for (const [name, key] of [
  ["missing service key", null],
  ["publishable key supplied as service key", "sb_publishable_not_a_server_key"],
  ["anon JWT supplied as service key", `eyJ0eXAiOiJKV1QifQ.${Buffer.from(JSON.stringify({ role: "anon" })).toString("base64url")}.fixture`],
]) {
  test(`${name} fails closed without using the available public key`, async () => {
    await withDatabase({ key }, async ({ requests }) => {
      const response = await POST(request({ tweetId: "tweet-1", type: "tweet_like" }));
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { ok: false, added: false, error: "Reactions are temporarily unavailable" });
      assert.equal(requests.length, 0);
      assert.equal(response.headers.get("set-cookie"), null);
    });
  });
}

test("missing URL fails closed before contacting the database", async () => {
  await withDatabase({ url: "" }, async ({ requests }) => {
    assert.equal((await POST(request({ tweetId: "tweet-1", type: "tweet_like" }))).status, 503);
    assert.equal(requests.length, 0);
  });
});

test("a new tweet reaction uses the service key for registration and the counter", async () => {
  await withDatabase({}, async ({ requests }) => {
    const response = await POST(request({ tweetId: "tweet-1", type: "tweet_like" }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, added: true, count: 4 });
    assert.match(response.headers.get("set-cookie"), /buzzttara_user_key=.*HttpOnly/i);
    assert.deepEqual(requests.map(({ method }) => method), ["POST", "GET", "PATCH"]);
    assert.equal(requests[0].body.tweet_id, "tweet-1");
    assert.match(requests[0].body.user_key, /^[0-9a-f-]{36}$/);
    assert.deepEqual(requests[2].body, { like_count: 4 });
    for (const { headers } of requests) assert.equal(headers.get("authorization"), `Bearer ${serviceKey}`);
  });
});

test("a duplicate reaction is accepted without reading or changing counters", async () => {
  await withDatabase({ duplicate: true }, async ({ requests }) => {
    const response = await POST(request({ tweetId: "tweet-1", type: "tweet_like" }, "buzzttara_user_key=existing-user"));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, added: false });
    assert.equal(requests.length, 1);
    assert.equal(requests[0].body.user_key, "existing-user");
    assert.equal(response.headers.get("set-cookie"), null);
  });
});

test("a tag reaction remains scoped to its tweet and tag", async () => {
  await withDatabase({}, async ({ requests }) => {
    const response = await POST(request({ tweetId: "tweet-1", type: "tag_like", tweetTagId: "tag-1" }, "buzzttara_user_key=existing-user"));
    assert.deepEqual(await response.json(), { ok: true, added: true, count: 6 });
    assert.equal(requests[0].body.tweet_tag_id, "tag-1");
    assert.equal(requests[1].url.searchParams.get("tweet_id"), "eq.tweet-1");
    assert.equal(requests[1].url.searchParams.get("id"), "eq.tag-1");
    assert.equal(requests[2].url.searchParams.get("tweet_id"), "eq.tweet-1");
    assert.deepEqual(requests[2].body, { like_count: 6 });
  });
});

test("invalid reaction input never contacts the database", async () => {
  await withDatabase({}, async ({ requests }) => {
    const response = await POST(request({ tweetId: "tweet-1", type: "tag_like" }));
    assert.equal(response.status, 400);
    assert.equal(requests.length, 0);
  });
});

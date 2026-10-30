import assert from "node:assert/strict";
import {test} from "node:test";
import type {SanityClientLike} from "@sanity/preview-url-secret";
import {createStudioPreviewHandler, validateStudioPreviewSecret} from "../src/lib/preview/studio-link";
import {verifyPreviewLinkSignature} from "../src/lib/preview/share-link";

test("Studio issuance requires a valid Sanity proof and still signs bounded local preview paths", async () => {
  const oldSecret = process.env.PREVIEW_LINK_SECRET;
  process.env.PREVIEW_LINK_SECRET = "test-signing-secret";
  try {
    const handler = createStudioPreviewHandler(async (secret) => secret === "valid-session");
    const request = (secret?: string, body: unknown = {path: "/news/draft-only", ttlMinutes: 60}, origin?: string) => new Request("https://www.musicite.net/api/draft/studio-link", {
      method: "POST", headers: {"Content-Type": "application/json", ...(secret ? {"X-Sanity-Preview-Secret": secret} : {}), ...(origin ? {Origin: origin} : {})}, body: JSON.stringify(body),
    });
    assert.equal((await handler(request())).status, 401);
    assert.equal((await handler(request("invalid"))).status, 401);
    assert.equal((await handler(request("valid-session", {path: "https://evil.test"}))).status, 400);
    assert.equal((await handler(request("valid-session", {path: "/news/draft-only"}, "https://evil.test"))).status, 403);
    const response = await handler(request("valid-session", {path: "/news/draft-only", ttlMinutes: 999999}));
    assert.equal(response.status, 200);
    assert.match(response.headers.get("cache-control")!, /no-store/);
    const payload = await response.json();
    assert.equal(payload.ttlMinutes, 30 * 24 * 60);
    const url = new URL(payload.previewUrl);
    assert.equal(url.pathname, "/api/draft/enable");
    assert.ok(verifyPreviewLinkSignature(url.searchParams.get("path")!, Number(url.searchParams.get("exp")), url.searchParams.get("sig")!));
    assert.ok(!payload.previewUrl.includes("valid-session"), "Sanity proof must not be included in share links");
    const failing = createStudioPreviewHandler(async () => {throw Error("Upstream unavailable");});
    assert.equal((await failing(request("valid-session"))).status, 503);
  } finally {
    if (oldSecret === undefined) delete process.env.PREVIEW_LINK_SECRET;
    else process.env.PREVIEW_LINK_SECRET = oldSecret;
  }
});

test("Sanity standard validation uses raw uncached reads and rejects missing/expired proofs", async () => {
  let found = true;
  const client = {
    config: () => ({token: "server-only-read-token"}),
    withConfig: (config: Record<string, unknown>) => {
      assert.equal(config.useCdn, false);
      assert.equal(config.perspective, "raw");
      return client;
    },
    fetch: async (query: string, params: {secret: string}, options: {cache: string}) => {
      assert.equal(options.cache, "no-store");
      assert.match(query, /_updatedAt/);
      assert.match(query, /3600/);
      return {private: found ? {_id: "drafts.proof", _updatedAt: new Date().toISOString(), secret: params.secret, studioUrl: "https://www.musicite.net/studio"} : null, public: null};
    },
  } as unknown as SanityClientLike;
  assert.ok(await validateStudioPreviewSecret("proof", client));
  found = false;
  assert.equal(await validateStudioPreviewSecret("expired-or-invalid", client), false);
});

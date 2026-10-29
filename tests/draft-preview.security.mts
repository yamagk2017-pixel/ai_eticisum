import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
import {test} from "node:test";
import {GET as enable} from "../src/app/api/draft/enable/route";
import {GET as shareGet, POST as sharePost} from "../src/app/api/draft/share-link/route";
import {signPreviewLink} from "../src/lib/preview/share-link";
import {resolvePreviewPath} from "../src/sanity/preview-path";

test("signed preview issuance and rejection rules", async () => {
  const previous = {...process.env};
  process.env.PREVIEW_LINK_SECRET = randomBytes(32).toString("hex");
  process.env.PREVIEW_SHARE_SECRET = randomBytes(32).toString("hex");
  try {
    const path = resolvePreviewPath({_type: "newsArticle", slug: {current: "draft-only"}})!;
    assert.equal(path, "/news/draft-only");
    const request = (params: Record<string, string>) => new Request(`https://example.test/api/draft/enable?${new URLSearchParams(params)}`);
    assert.equal((await enable(request({path}))).status, 401);
    const now = Math.floor(Date.now() / 1000);
    for (const exp of [now - 60, now + 31 * 86400]) {
      assert.equal((await enable(request({path, exp: String(exp), sig: signPreviewLink(path, exp)}))).status, 401);
    }
    const exp = now + 600;
    assert.equal((await enable(request({path: "/news/changed", exp: String(exp), sig: signPreviewLink(path, exp)}))).status, 401);
    assert.equal((await sharePost(new Request("https://example.test", {method: "POST"}))).status, 401);
    const issue = (body: unknown) => sharePost(new Request("https://example.test", {
      method: "POST", headers: {Authorization: `Bearer ${process.env.PREVIEW_SHARE_SECRET}`, "Content-Type": "application/json"},
      body: JSON.stringify(body),
    }));
    assert.equal((await issue({path: "//untrusted.test"})).status, 400);
    const response = await issue({path, ttlMinutes: 10});
    assert.equal(response.status, 200);
    assert.match(response.headers.get("cache-control")!, /no-store/);
    const payload = await response.json();
    const url = new URL(payload.previewUrl);
    assert.equal(url.searchParams.get("path"), path);
    assert.equal(url.searchParams.get("sig"), signPreviewLink(path, Number(url.searchParams.get("exp"))));
    const legacy = await shareGet(new Request(`https://example.test?${new URLSearchParams({path, secret: process.env.PREVIEW_SHARE_SECRET!})}`));
    assert.equal(legacy.status, 200);
  } finally {
    for (const key of ["PREVIEW_LINK_SECRET", "PREVIEW_SHARE_SECRET"]) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});

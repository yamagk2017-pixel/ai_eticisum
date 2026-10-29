import assert from "node:assert/strict";
import {test} from "node:test";
import {createHmac} from "node:crypto";

// Run against `next build && next start` with the same server environment.
// PREVIEW_TEST_ORIGIN=http://localhost:3000 PREVIEW_TEST_DRAFT_PATH=/news/your-draft-slug node --env-file=.env.local --import tsx --test tests/draft-preview.integration.mts
// Credentials and signed URLs are kept in memory and never printed.
const origin = process.env.PREVIEW_TEST_ORIGIN;
const secret = process.env.PREVIEW_SHARE_SECRET;
const signingSecret = process.env.PREVIEW_LINK_SECRET;
const path = process.env.PREVIEW_TEST_DRAFT_PATH || "";
const enabled = Boolean(origin && secret && signingSecret && path);

function signed(exp: number, target = path) {
  const sig = createHmac("sha256", signingSecret!).update(`${target}\n${exp}`).digest("base64url");
  return new URL(`/api/draft/enable?${new URLSearchParams({path: target, exp: String(exp), sig})}`, origin);
}

async function status(url: URL | string, expected: number) {
  const response = await fetch(url, {redirect: "manual"});
  assert.equal(response.status, expected, "Unexpected preview HTTP status");
  return response;
}

test("production server preserves the preview security boundary", {skip: !enabled}, async () => {
  await status(`${origin}/api/draft/enable?path=${path}`, 401);
  await status(signed(Math.floor(Date.now() / 1000) - 60), 401);
  const tampered = signed(Math.floor(Date.now() / 1000) + 600);
  tampered.searchParams.set("path", "/news/tampered");
  await status(tampered, 401);
  await status(signed(Math.floor(Date.now() / 1000) + 31 * 86400), 401);
  await status(`${origin}${path}`, 404);
  const denied = await fetch(`${origin}/api/draft/share-link`, {
    method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({path}),
  });
  assert.equal(denied.status, 401);
  const issued = await fetch(`${origin}/api/draft/share-link`, {
    method: "POST",
    headers: {"Content-Type": "application/json", Authorization: `Bearer ${secret}`},
    body: JSON.stringify({path, ttlMinutes: 10}),
  });
  assert.equal(issued.status, 200);
  assert.match(issued.headers.get("cache-control") ?? "", /no-store/);
  const payload = await issued.json();
  const previewUrl = new URL(payload.previewUrl);
  // Exercise the local production server, even when its share origin is production.
  const entry = await status(new URL(previewUrl.pathname + previewUrl.search, origin), 307);
  const cookie = entry.headers.get("set-cookie")?.match(/__prerender_bypass=[^;]+/)?.[0];
  assert.ok(cookie, "Draft cookie must be set");
  assert.equal(new URL(entry.headers.get("location")!).pathname, path);
  const article = await fetch(`${origin}${path}`, {
    headers: {Cookie: cookie},
  });
  assert.equal(article.status, 200, "Draft-only article must render with the preview cookie");
  assert.ok((await article.text()).length > 0);
  await status(`${origin}${path}`, 404);
  const listing = await fetch(`${origin}/news`);
  const publishedPath = (await listing.text()).match(/href="(\/news\/(?!wp[\/"?])[^"?]+)"/)?.[1];
  assert.ok(publishedPath, "Published article link must exist in the news listing");
  await status(`${origin}${publishedPath}`, 200);
});

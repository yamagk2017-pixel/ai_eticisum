import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {test} from "node:test";
import {createClient} from "@sanity/client";
import {createPreviewSecret} from "@sanity/preview-url-secret/create-secret";
import {createStudioPreviewHandler, validateStudioPreviewSecret} from "../src/lib/preview/studio-link";

// Opt-in smoke test. Creates and removes one temporary Sanity authentication
// document, never publishes articles and never prints tokens or preview links.
test("real Sanity proof authorizes issuance and revocation invalidates it", {skip: process.env.STUDIO_PREVIEW_SMOKE !== "1"}, async () => {
  const id = `musicite-preview-smoke-${randomUUID()}`;
  const client = createClient({projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!, dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
    apiVersion: "2026-02-24", token: process.env.SANITY_API_WRITE_TOKEN!, useCdn: false});
  try {
    const {secret} = await createPreviewSecret(client, "musicite-preview-smoke", "https://www.musicite.net/studio", undefined, id);
    assert.ok(await validateStudioPreviewSecret(secret));
    const request = () => new Request("https://www.musicite.net/api/draft/studio-link", {method: "POST",
      headers: {"Content-Type": "application/json", "X-Sanity-Preview-Secret": secret},
      body: JSON.stringify({path: "/news/bsgravity-audition-2027-entry"})});
    const response = await createStudioPreviewHandler()(request());
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(new URL(payload.previewUrl).origin, "https://www.musicite.net");
    await client.delete(`drafts.${id}`);
    assert.equal(await validateStudioPreviewSecret(secret), false);
    assert.equal((await createStudioPreviewHandler()(request())).status, 401);
  } finally {await client.delete(`drafts.${id}`);}
});

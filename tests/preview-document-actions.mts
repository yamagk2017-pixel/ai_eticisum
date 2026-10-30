import assert from "node:assert/strict";
import {test} from "node:test";
import {createPreviewHandler} from "../src/sanity/document-actions/preview-share-handler";

test("logged-in Studio opens/copies preview without asking for keys; failures close reserved tabs", async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const originalFetch = globalThis.fetch;
  let opened = false;
  let closed = false;
  let destination = "";
  let copied = "";
  let completed = 0;
  let createdSecrets = 0;
  const popup = {opener: {}, location: {replace: (url: string) => {destination = url;}}, close: () => {closed = true;}};
  try {
    Object.defineProperty(globalThis, "window", {configurable: true, value: {
      prompt: () => {throw Error("No key/expiry prompts should be shown");},
      alert: () => {}, open: () => {opened = true; return popup;},
    }});
    Object.defineProperty(globalThis, "navigator", {configurable: true, value: {
      clipboard: {writeText: async (url: string) => {copied = url;}},
    }});
    globalThis.fetch = async (url, init) => {
      assert.equal(url, "/api/draft/studio-link");
      assert.equal(init?.method, "POST");
      assert.equal(new Headers(init?.headers).get("X-Sanity-Preview-Secret"), "session-proof");
      assert.equal(JSON.parse(String(init?.body)).path, "/news/draft-only");
      return Response.json({previewUrl: "https://www.musicite.net/api/draft/enable?sig=test"});
    };
    const common = {path: "/news/draft-only", createSecret: async () => {
      assert.ok(opened, "Reserve popup before awaiting Sanity authentication");
      createdSecrets++; return {secret: "session-proof"};
    }, onComplete: () => {completed++;}};
    await createPreviewHandler({...common, mode: "open"})();
    assert.equal(popup.opener, null);
    assert.equal(destination, "https://www.musicite.net/api/draft/enable?sig=test");
    assert.equal(closed, false);
    assert.equal(completed, 1);
    await createPreviewHandler({...common, mode: "copy"})();
    assert.equal(copied, destination);
    assert.equal(createdSecrets, 2);
    globalThis.fetch = async () => Response.json({error: "Unauthorized"}, {status: 401});
    await createPreviewHandler({...common, mode: "open"})();
    assert.ok(closed, "Failed issuance must close the reserved tab");
    closed = false;
    await createPreviewHandler({...common, mode: "open", createSecret: async () => {throw Error("Logged out");}})();
    assert.ok(closed, "Expired Sanity sessions must close the tab without issuing a URL");
    assert.equal(completed, 4);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, descriptor] of [["window", originalWindow], ["navigator", originalNavigator]] as const) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

import assert from "node:assert/strict";
import {test} from "node:test";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import type {DocumentActionComponent} from "sanity";
import {CopyPreviewShareLinkAction, OpenPreviewAction} from "../src/sanity/document-actions/copy-preview-share-link-action";

function renderAction(action: DocumentActionComponent, complete: () => void) {
  let result: ReturnType<DocumentActionComponent>;
  function Harness() {
    result = action({draft: {_type: "newsArticle", slug: {current: "draft-only"}}, published: null,
      onComplete: complete} as unknown as Parameters<DocumentActionComponent>[0]);
    return null;
  }
  renderToStaticMarkup(createElement(Harness));
  return result!;
}

test("Studio opens signed preview in reserved tab and keeps copy action", async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const originalFetch = globalThis.fetch;
  let opened = false;
  let closed = false;
  let destination = "";
  let copied = "";
  let completed = 0;
  const popup = {opener: {}, location: {replace: (url: string) => {destination = url;}}, close: () => {closed = true;}};
  try {
    Object.defineProperty(globalThis, "window", {configurable: true, value: {
      prompt: (message: string) => message.includes("SECRET") ? "test-input" : "10",
      alert: () => {}, open: () => {opened = true; return popup;},
    }});
    Object.defineProperty(globalThis, "navigator", {configurable: true, value: {
      clipboard: {writeText: async (url: string) => {copied = url;}},
    }});
    globalThis.fetch = async (url, init) => {
      assert.equal(url, "/api/draft/share-link");
      assert.equal(init?.method, "POST");
      assert.equal(JSON.parse(String(init?.body)).path, "/news/draft-only");
      return Response.json({previewUrl: "https://example.test/api/draft/enable?sig=test"});
    };
    const open = renderAction(OpenPreviewAction, () => {completed++;});
    assert.equal(open?.label, "プレビューを開く");
    await open?.onHandle?.();
    assert.ok(opened);
    assert.equal(popup.opener, null);
    assert.equal(destination, "https://example.test/api/draft/enable?sig=test");
    assert.equal(closed, false);
    assert.equal(completed, 1);
    opened = false;
    const copy = renderAction(CopyPreviewShareLinkAction, () => {completed++;});
    await copy?.onHandle?.();
    assert.equal(copied, destination);
    assert.equal(opened, false);
    globalThis.fetch = async () => Response.json({error: "Unauthorized"}, {status: 401});
    await open?.onHandle?.();
    assert.ok(closed, "Failed issuance must close the reserved blank tab");
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, descriptor] of [["window", originalWindow], ["navigator", originalNavigator]] as const) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

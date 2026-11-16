import assert from "node:assert/strict";
import {test} from "node:test";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {SanityArticleBody} from "../src/components/news/sanity-article-body.tsx";
import {normalizeSpeakerColors} from "../src/lib/news/speaker-colors.ts";

const span = (text: string, marks: string[] = []) => ({_type: "span", _key: text, text, marks});
const block = (text: string) => ({_type: "block", _key: text, style: "normal", children: [span(text)], markDefs: []});
const colors = [{speakerName: "ミッポ", color: "#f97316"}, {speakerName: "別の人", color: "#3b82f6"}];
const render = (value: unknown, speakerColors = colors, interview = true) => renderToStaticMarkup(
  createElement(SanityArticleBody, {value, speakerColors, boldSpeakerParagraph: interview})
);

test("one setting colors repeated prefixes, supports both colons, and preserves dialogue text", () => {
  const html = render([block("ミッポ：最初の回答"), block("ミッポ:次の回答"), block("別の人：回答"), block("――質問"), block("説明の中にミッポ：という文字があります"), block("他の人：ミッポ：と回答")]);
  assert.match(html, /<strong style="color:#f97316">ミッポ：<\/strong>最初の回答/);
  assert.match(html, /<strong style="color:#f97316">ミッポ:<\/strong>次の回答/);
  assert.match(html, /<strong style="color:#3b82f6">別の人：<\/strong>回答/);
  assert.match(html, /<strong>他の人：<\/strong>ミッポ：と回答/);
  assert.equal((html.match(/style="color:/g) || []).length, 3);
  assert.ok(html.replace(/<[^>]*>/g, "").includes("説明の中にミッポ：という文字があります"));
  assert.ok(html.includes("font-bold"));
});

test("speaker settings override legacy orange marks and retain answer links and emphasis", () => {
  const value = [{...block(""), children: [span("ミッ", ["orange"]), span("ポ：", ["orange"]), span("答え", ["em"]), span("https://example.com", ["website"])], markDefs: [{_type: "link", _key: "website", href: "https://example.com"}]}];
  const html = render(value, [{speakerName: "ミッポ", color: "#123abc"}]);
  assert.match(html, /<strong style="color:#123abc">ミッポ：<\/strong><em>答え<\/em>/);
  assert.ok(html.includes('href="https://example.com"'));
  assert.ok(html.includes("https://example.com</a>"));
  assert.equal((html.match(/<a /g) || []).length, 1);
  assert.ok(!html.includes("#f97316"));
});

test("custom colors work without the interview tag and never recolor other prefixes", () => {
  const html = render([block("ミッポ：本文"), block("他の人：本文")], colors, false);
  assert.match(html, /<strong style="color:#f97316">ミッポ：<\/strong>本文/);
  assert.ok(html.includes("他の人：本文"));
  assert.ok(!html.includes("<strong>他の人"));
});

test("invalid CSS values are ignored, names normalize, and an empty setting preserves legacy behavior", () => {
  assert.deepEqual(normalizeSpeakerColors([{speakerName: " ミッポ： ", color: "#ABCDEF"}, {speakerName: "ミッポ", color: "#123456"}, {speakerName: "無効", color: "url(https://example.com)"}, null]), [{speakerName: "ミッポ", color: "#abcdef"}]);
  assert.deepEqual(normalizeSpeakerColors(null), []);
  const html = render([block("ミッポ：本文")], []);
  assert.match(html, /<strong>ミッポ：<\/strong>本文/);
  assert.ok(!html.includes("style="));
});

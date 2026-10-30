import assert from "node:assert/strict";
import {test} from "node:test";
import {paginateNewsArchive} from "../src/lib/news/pagination";
import {getWpNewsArchiveIndex, getWpNewsArchiveArticles} from "../src/lib/news/wp";
import type {NewsArticle} from "../src/lib/news/types";

function article(id: number, source: NewsArticle["source"] = "wp"): NewsArticle {
  return {source, routeType: "wp-id", path: `/news/wp/${id}`, id, slug: String(id), url: null,
    publishedAt: new Date(Date.UTC(2026, 0, 1) - id * 60000).toISOString(), titleHtml: `Post ${id}`,
    excerptHtml: "", contentHtml: "", featuredImageUrl: null, featuredImageAlt: null, categories: [], tags: []};
}

test("all 171 pages include every unique post, including beyond the 100-post boundary", async () => {
  const wpIndex = Array.from({length: 3413}, (_, i) => article(i + 1));
  const imported = wpIndex.slice(0, 99).map((a) => ({...a, source: "sanity_wp_import" as const}));
  const native = [1, 2, 3].map((id) => ({...article(id), source: "sanity" as const, path: `/news/native-${id}`}));
  const paths: string[] = [];
  let largestDetailRequest = 0;
  for (let page = 1; page <= 171; page++) {
    const result = await paginateNewsArchive({page, pageSize: 20, wpIndex, sanityArticles: [...imported, ...native],
      loadWpArticles: async (ids) => {
        largestDetailRequest = Math.max(largestDetailRequest, ids.length);
        return ids.map((id) => article(id)).reverse(); // API order must not affect archive order.
      }});
    assert.equal(result.total, 3416);
    assert.equal(result.totalPages, 171);
    assert.equal(result.page, page);
    assert.equal(result.items.length, page === 171 ? 16 : 20);
    paths.push(...result.items.map((item) => item.path));
    if (page === 1) assert.equal(result.items.find((item) => item.path === "/news/wp/1")?.source, "sanity_wp_import");
  }
  assert.equal(new Set(paths).size, 3416);
  assert.equal(paths.length, 3416);
  assert.equal(largestDetailRequest, 20);
});

test("empty and out-of-range archives produce valid page ranges", async () => {
  const base = {page: 999, pageSize: 20, sanityArticles: [], loadWpArticles: async (ids: number[]) => ids.map((id) => article(id))};
  const empty = await paginateNewsArchive({...base, wpIndex: []});
  assert.deepEqual([empty.page, empty.totalPages, empty.items.length], [1, 1, 0]);
  const last = await paginateNewsArchive({...base, wpIndex: Array.from({length: 105}, (_, i) => article(i + 1))});
  assert.deepEqual([last.page, last.totalPages, last.items.length], [6, 6, 5]);
  await assert.rejects(paginateNewsArchive({...base, wpIndex: [article(1)], loadWpArticles: async () => []}), /unavailable/);
});

test("WordPress index uses bounded batches, preserves filters, and retries transient failures", async () => {
  const previousFetch = globalThis.fetch;
  const previousBase = process.env.WP_API_BASE_URL;
  process.env.WP_API_BASE_URL = "https://example.test";
  const pages: number[] = [];
  let retry = false;
  try {
    globalThis.fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/categories")) return Response.json([{id: 7}]);
      if (url.pathname.endsWith("/tags")) return Response.json([{id: 9}]);
      if (url.searchParams.has("include")) {
        const ids = url.searchParams.get("include")!.split(",").map(Number);
        assert.ok(ids.length <= 20);
        assert.equal(url.searchParams.get("per_page"), String(ids.length));
        return Response.json(ids.map((id) => ({id, date_gmt: "2026-01-01T00:00:00", title: {rendered: `Post ${id}`}})));
      }
      assert.equal(url.searchParams.get("per_page"), "100");
      assert.equal(url.searchParams.has("_embed"), false);
      assert.equal(url.searchParams.get("categories"), "7");
      assert.equal(url.searchParams.get("tags"), "9");
      const page = Number(url.searchParams.get("page"));
      if (page === 2 && !retry) {retry = true; return new Response("Unavailable", {status: 503});}
      pages.push(page);
      const count = page === 35 ? 13 : 100;
      return Response.json(Array.from({length: count}, (_, i) => ({id: (page - 1) * 100 + i + 1, date_gmt: "2026-01-01T00:00:00"})),
        {headers: {"x-wp-total": "3413", "x-wp-totalpages": "35"}});
    };
    const index = await getWpNewsArchiveIndex({categorySlug: "events", tagSlug: "idol"});
    assert.equal(index.length, 3413);
    assert.equal(new Set(index.map((item) => item.id)).size, 3413);
    assert.equal(pages.length, 35);
    assert.ok(retry);
    assert.equal((await getWpNewsArchiveArticles([3401, 3413])).length, 2);
    globalThis.fetch = async () => new Response("Unavailable", {status: 503});
    await assert.rejects(getWpNewsArchiveIndex({}), /503/);
    await assert.rejects(getWpNewsArchiveIndex({categorySlug: "events"}), /503/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousBase === undefined) delete process.env.WP_API_BASE_URL;
    else process.env.WP_API_BASE_URL = previousBase;
  }
});

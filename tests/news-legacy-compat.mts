import assert from "node:assert/strict";
import {test} from "node:test";
import {evaluate, parse} from "groq-js";
import {normalizeNewsDate} from "../src/lib/news/datetime";
import {rewriteWpImageUrl, rewriteWpImageUrlsInHtml} from "../src/lib/wp/images";
import {fetchWpPostById} from "../src/lib/wp/client";
import {paginateNewsArchive} from "../src/lib/news/pagination";

test("legacy Japan-local dates and explicit offsets represent the same instant in any server timezone", () => {
  const previous = process.env.TZ;
  try {
    for (const timezone of ["UTC", "Asia/Tokyo", "America/Los_Angeles"]) {
      process.env.TZ = timezone;
      for (const date of ["2025-07-01T15:15:17", "2025-07-01T15:15:17+09:00", "2025-07-01T06:15:17Z"]) {
        assert.equal(normalizeNewsDate(date), "2025-07-01T06:15:17.000Z");
      }
    }
    assert.equal(normalizeNewsDate("invalid"), null);
    assert.equal(normalizeNewsDate(undefined), null);
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test("upload URL normalization covers both sources, HTML srcset, and an optional CDN", () => {
  const previous = process.env.WP_IMAGE_CDN_BASE_URL;
  delete process.env.WP_IMAGE_CDN_BASE_URL;
  try {
    const path = "/inm/wp-content/uploads/2025/07/hero.jpg";
    for (const host of ["www.musicite.net", "musicite.net", "musicite.sub.jp"]) {
      for (const scheme of ["http", "https"]) {
        assert.equal(rewriteWpImageUrl(`${scheme}://${host}${path}?v=2#photo`), `https://musicite.sub.jp${path}?v=2#photo`);
      }
    }
    for (const url of ["https://cdn.sanity.io/images/hero.jpg", "https://www.musicite.net/news/wp/20281", "https://other.test/inm/wp-content/uploads/photo.jpg", "invalid"]) {
      assert.equal(rewriteWpImageUrl(url), url);
    }
    assert.equal(rewriteWpImageUrl(null), null);
    const html = `<a href="https://www.musicite.net${path}"><img src="http://musicite.sub.jp${path}" srcset="https://www.musicite.net${path} 1x, https://musicite.net${path} 2x"></a>`;
    assert.equal(rewriteWpImageUrlsInHtml(html), `<a href="https://musicite.sub.jp${path}"><img src="https://musicite.sub.jp${path}" srcset="https://musicite.sub.jp${path} 1x, https://musicite.sub.jp${path} 2x"></a>`);
    process.env.WP_IMAGE_CDN_BASE_URL = "https://images.example.test/cache/";
    assert.equal(rewriteWpImageUrl(`https://www.musicite.net${path}?v=2`), `https://images.example.test/cache${path}?v=2`);
  } finally {
    if (previous === undefined) delete process.env.WP_IMAGE_CDN_BASE_URL;
    else process.env.WP_IMAGE_CDN_BASE_URL = previous;
  }
});

test("WordPress fallback corrects the featured image and body without changing article links", async () => {
  const previousFetch = globalThis.fetch;
  const previousBase = process.env.WP_API_BASE_URL;
  const previousCdn = process.env.WP_IMAGE_CDN_BASE_URL;
  process.env.WP_API_BASE_URL = "https://wp.example.test";
  delete process.env.WP_IMAGE_CDN_BASE_URL;
  try {
    globalThis.fetch = async () => Response.json([{
      id: 20281, date: "2025-07-01T15:15:17", link: "https://www.musicite.net/gk/sp/20281.php",
      title: {rendered: "SOMOSOMO"},
      content: {rendered: '<img src="https://www.musicite.net/inm/wp-content/uploads/hero.jpg">'},
      _embedded: {"wp:featuredmedia": [{source_url: "https://www.musicite.net/inm/wp-content/uploads/hero.jpg"}]},
    }]);
    const article = await fetchWpPostById(20281);
    assert.equal(article?.date, "2025-07-01T06:15:17.000Z");
    assert.equal(article?.featuredImageUrl, "https://musicite.sub.jp/inm/wp-content/uploads/hero.jpg");
    assert.match(article?.contentHtml ?? "", /src="https:\/\/musicite\.sub\.jp\//);
    assert.equal(article?.url, "https://www.musicite.net/gk/sp/20281.php");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousBase === undefined) delete process.env.WP_API_BASE_URL;
    else process.env.WP_API_BASE_URL = previousBase;
    if (previousCdn === undefined) delete process.env.WP_IMAGE_CDN_BASE_URL;
    else process.env.WP_IMAGE_CDN_BASE_URL = previousCdn;
  }
});

test("actual Sanity queries retain legacy articles, reservations, filters, citations and source priority", async () => {
  const previousProject = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const previousDataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
  const previousCdn = process.env.WP_IMAGE_CDN_BASE_URL;
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ||= "legacy-test";
  process.env.NEXT_PUBLIC_SANITY_DATASET ||= "production";
  delete process.env.WP_IMAGE_CDN_BASE_URL;
  const {sanityClient} = await import("../src/lib/sanity/client");
  const {getSanityNewsPage, getSanityNewsList, getSanityNewsArchive, getSanityWpImportedNewsByWpPostId, getSanityNewsBySlug} = await import("../src/lib/news/sanity");
  const previousFetch = sanityClient.fetch;
  const ref = (id: string) => ({_type: "reference", _ref: id});
  const legacy = (id: number, date: string) => ({
    _id: `wp.${id}`, _type: "wpImportedArticle", wpPostId: id, title: `Imported ${id}`, publishedAt: date,
    heroImageExternalUrl: "https://www.musicite.net/inm/wp-content/uploads/hero.jpg",
    legacyBodyHtml: '<img src="https://www.musicite.net/inm/wp-content/uploads/body.jpg">',
    categories: [ref("category.sp")], tags: [ref("tag.somosomo")],
  });
  const dataset = [
    {_id: "category.sp", _type: "newsCategory", title: "特集", slug: {current: "sp"}},
    {_id: "tag.somosomo", _type: "newsTag", title: "SOMOSOMO", slug: {current: "somosomo"}},
    legacy(20281, "2025-07-01T15:15:17"),
    legacy(2, "2025-07-01T15:15:17.250"),
    legacy(3, "2025-07-01T06:15:16Z"),
    legacy(4, "2025-07-01T15:15:15+09:00"),
    {...legacy(5, "2025-07-01T15:15:18"), citationSourceArticle: ref("native")}, // Still future at the fixed test clock.
    legacy(6, "2025-07-01T06:15:18Z"),
    legacy(7, "2025-07-01T15:15:18+09:00"),
    legacy(8, "invalid"),
    {...legacy(9, "2025-07-01T15:15:17"), publishedAt: undefined},
    {...legacy(10, "2025-07-01T15:15:17"), _id: "drafts.wp.10"},
    {...legacy(11, "2025-07-01T15:15:17"), tags: []},
    {_id: "native", _type: "newsArticle", title: "Native", slug: {current: "native"}, publishedAt: "2025-07-01T06:15:17.100Z"},
    {_id: "native.future", _type: "newsArticle", slug: {current: "native-future"}, publishedAt: "2025-07-01T06:15:18Z"},
    {_id: "native.invalid", _type: "newsArticle", slug: {current: "native-invalid"}, publishedAt: "2025-07-01T15:15:17"},
    {...legacy(12, "2025-07-01T15:15:16"), citationSourceArticle: ref("native")},
  ];
  const queries: string[] = [];
  sanityClient.fetch = (async (query: string, params?: Record<string, unknown>) => {
    queries.push(query);
    const value = await evaluate(parse(query, {params}), {dataset, params, timestamp: new Date("2025-07-01T06:15:17.500Z")});
    return value.get();
  }) as typeof sanityClient.fetch;
  try {
    const page = await getSanityNewsPage({page: 1, pageSize: 2, categorySlug: "sp", tagSlug: "somosomo"});
    assert.equal(page.total, 5);
    assert.deepEqual(page.items.map(a => a.id), [2, 20281]);
    const second = await getSanityNewsPage({page: 2, pageSize: 2, categorySlug: "sp", tagSlug: "somosomo"});
    assert.deepEqual(second.items.map(a => a.id), [3, 12]);
    assert.equal(second.total, page.total);
    assert.equal(page.items[1].publishedAt, "2025-07-01T06:15:17.000Z");
    assert.equal(page.items[1].featuredImageUrl, "https://musicite.sub.jp/inm/wp-content/uploads/hero.jpg");
    assert.equal((await getSanityNewsPage({page: 1, pageSize: 20, categorySlug: "unknown"})).total, 0);
    const detail = await getSanityWpImportedNewsByWpPostId(20281);
    assert.equal(detail?.source, "sanity_wp_import");
    assert.equal(detail?.publishedAt, page.items[1].publishedAt);
    assert.equal(detail?.featuredImageUrl, page.items[1].featuredImageUrl);
    assert.match(detail?.contentHtml ?? "", /https:\/\/musicite\.sub\.jp\//);
    for (const id of [5, 6, 7, 8, 9]) assert.equal(await getSanityWpImportedNewsByWpPostId(id), null);
    assert.equal(await getSanityNewsBySlug("native-invalid"), null);
    assert.equal(await getSanityNewsBySlug("native-future"), null);
    const native = await getSanityNewsBySlug("native");
    assert.deepEqual(native?.citedByArticles.map(a => a.path), ["/news/wp/12"]);
    assert.equal(native?.citedByArticles[0].publishedAt, "2025-07-01T06:15:16.000Z");
    const all = await getSanityNewsList(20);
    assert.equal(all.length, 7);
    assert.deepEqual(all.slice(0, 3).map(a => a.path), ["/news/wp/2", "/news/native", "/news/wp/20281"]);
    const merged = await paginateNewsArchive({page: 1, pageSize: 20, wpIndex: [{id: 20281, publishedAt: detail!.publishedAt}], sanityArticles: all,
      loadWpArticles: async () => {throw new Error("Imported article must not be loaded from WordPress");}});
    assert.equal(merged.total, all.length);
    assert.equal(merged.items.find(a => a.id === 20281)?.source, "sanity_wp_import");
    // Query semantics were evaluated above. Exercise batching with projected API
    // responses so this resource-boundary check does not run quadratic draft lookups.
    const archiveDocs = Array.from({length: 1001}, (_, i) => legacy(10000 + i, "2024-01-01T09:00:00"));
    queries.length = 0;
    sanityClient.fetch = (async (query: string, params?: Record<string, unknown>) => {
      queries.push(query);
      if (query.trim().startsWith("count(")) return archiveDocs.length;
      return archiveDocs.slice(Number(params?.start), Number(params?.end));
    }) as typeof sanityClient.fetch;
    const archive = await getSanityNewsArchive({});
    assert.equal(archive.length, 1001);
    assert.equal(new Set(archive.map(a => a.path)).size, archive.length);
    assert.equal(queries.filter(q => q.trim().startsWith("count(")).length, 1);
    assert.equal(queries.length, 4); // One count plus three batches, rather than 11 list/count pairs.
    assert.equal(archive[0].path, "/news/wp/10000");
    assert.equal(archive.at(-1)?.path, "/news/wp/11000");
  } finally {
    sanityClient.fetch = previousFetch;
    if (previousProject === undefined) delete process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
    else process.env.NEXT_PUBLIC_SANITY_PROJECT_ID = previousProject;
    if (previousDataset === undefined) delete process.env.NEXT_PUBLIC_SANITY_DATASET;
    else process.env.NEXT_PUBLIC_SANITY_DATASET = previousDataset;
    if (previousCdn === undefined) delete process.env.WP_IMAGE_CDN_BASE_URL;
    else process.env.WP_IMAGE_CDN_BASE_URL = previousCdn;
  }
});

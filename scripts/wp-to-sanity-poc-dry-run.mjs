#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {createClient} from "@sanity/client";
import {createClient as createSupabaseClient} from "@supabase/supabase-js";

function parseArgs(argv) {
  const args = {
    limit: 10,
    page: 1,
    output: null,
    includeIds: [],
    apply: false,
  };

  for (const arg of argv) {
    if (arg.startsWith("--limit=")) {
      const n = Number(arg.slice("--limit=".length));
      if (Number.isFinite(n) && n > 0) args.limit = Math.min(Math.trunc(n), 100);
      continue;
    }
    if (arg.startsWith("--page=")) {
      const n = Number(arg.slice("--page=".length));
      if (Number.isFinite(n) && n > 0) args.page = Math.max(Math.trunc(n), 1);
      continue;
    }
    if (arg.startsWith("--output=")) {
      const output = arg.slice("--output=".length).trim();
      if (output) args.output = output;
      continue;
    }
    if (arg.startsWith("--include-ids=")) {
      const value = arg.slice("--include-ids=".length);
      const ids = value
        .split(",")
        .map((v) => Number(v.trim()))
        .filter((n) => Number.isFinite(n) && n > 0)
        .map((n) => Math.trunc(n));
      args.includeIds = Array.from(new Set([...args.includeIds, ...ids]));
      continue;
    }
    if (arg === "--apply") {
      args.apply = true;
    }
  }

  return args;
}

async function loadLocalEnv(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index <= 0) continue;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^['\"]|['\"]$/g, "");
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // ignore missing .env.local
  }
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value.trim();
}

function optionalEnv(name) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : null;
}

function normalizeBaseUrl(url) {
  return url.replace(/\/+$/, "");
}

function stripHtml(html) {
  return String(html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function formatStamp(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${y}${m}${d}-${hh}${mm}${ss}`;
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildIssuesCsv(results) {
  const rows = results.filter(
    (item) =>
      item.blockers.length > 0 ||
      item.warnings.length > 0 ||
      item.featuredImageStatus !== "ok" ||
      item.missingCategorySlugs.length > 0 ||
      item.missingTagSlugs.length > 0
  );

  const header = [
    "wpPostId",
    "title",
    "operation",
    "featuredImageStatus",
    "blockers",
    "warnings",
    "missingCategorySlugs",
    "missingTagSlugs",
    "originalWpUrl",
  ];

  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.wpPostId,
        row.title,
        row.operation,
        row.featuredImageStatus,
        row.blockers.join("|"),
        row.warnings.join("|"),
        row.missingCategorySlugs.join("|"),
        row.missingTagSlugs.join("|"),
        row.payload?.originalWpUrl ?? "",
      ]
        .map(csvEscape)
        .join(",")
    );
  }

  return {
    rows,
    csvText: `${lines.join("\n")}\n`,
  };
}

function createArrayKey(prefix, seed, index) {
  const base = String(seed ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `${prefix}-${index}-${base || "item"}`;
}

async function fetchWpPosts({baseUrl, limit, page}) {
  const params = new URLSearchParams({
    per_page: String(limit),
    page: String(page),
    _embed: "",
    orderby: "date",
    order: "desc",
  });
  const endpoint = `${normalizeBaseUrl(baseUrl)}/wp-json/wp/v2/posts?${params.toString()}`;
  const response = await fetch(endpoint, {headers: {Accept: "application/json"}});
  if (!response.ok) {
    throw new Error(`WP API error: ${response.status} ${response.statusText}`);
  }
  const json = await response.json();
  if (!Array.isArray(json)) return [];

  return json.map(mapWpPostApiItem);
}

function mapWpPostApiItem(post) {
  const termGroups = post?._embedded?.["wp:term"];
  const terms = Array.isArray(termGroups) ? termGroups.flat() : [];

  const categories = terms
    .filter((t) => t?.taxonomy === "category")
    .map((t) => ({
      id: t?.id,
      name: typeof t?.name === "string" ? t.name.trim() : "",
      slug: typeof t?.slug === "string" ? t.slug.trim() : "",
    }))
    .filter((t) => t.name);

  const tags = terms
    .filter((t) => t?.taxonomy === "post_tag")
    .map((t) => ({
      id: t?.id,
      name: typeof t?.name === "string" ? t.name.trim() : "",
      slug: typeof t?.slug === "string" ? t.slug.trim() : "",
    }))
    .filter((t) => t.name);

  const featured = Array.isArray(post?._embedded?.["wp:featuredmedia"]) ? post._embedded["wp:featuredmedia"][0] : null;
  const bodyHtml = typeof post?.content?.rendered === "string" ? post.content.rendered : "";
  const featuredImageFromEmbed = typeof featured?.source_url === "string" ? featured.source_url : null;
  const featuredImageUrl = featuredImageFromEmbed;
  const featuredMediaId =
    typeof post?.featured_media === "number" && Number.isFinite(post.featured_media) && post.featured_media > 0
      ? post.featured_media
      : null;
  const featuredImageStatus = featuredImageFromEmbed
    ? "ok"
    : featured?.code === "rest_forbidden"
      ? "api_denied"
      : featuredMediaId
        ? "unresolved"
        : "no_featured_media";
  const featuredImageSource = featuredImageFromEmbed
    ? "wp_featured_media"
    : "none";

  return {
    wpPostId: Number(post?.id),
    publishedAt: typeof post?.date === "string" ? post.date : null,
    title: stripHtml(post?.title?.rendered ?? "(no title)"),
    titleHtml: typeof post?.title?.rendered === "string" ? post.title.rendered : "",
    originalWpUrl: typeof post?.link === "string" ? post.link : null,
    legacyBodyHtml: bodyHtml,
    excerpt: stripHtml(post?.excerpt?.rendered ?? ""),
    featuredImageUrl,
    featuredImageSource,
    featuredImageStatus,
    featuredMediaId,
    categories,
    tags,
  };
}

async function fetchWpPostsByIds({baseUrl, ids}) {
  if (!Array.isArray(ids) || ids.length === 0) return [];

  const params = new URLSearchParams({
    include: ids.join(","),
    per_page: String(Math.min(ids.length, 100)),
    _embed: "",
  });
  const endpoint = `${normalizeBaseUrl(baseUrl)}/wp-json/wp/v2/posts?${params.toString()}`;
  const response = await fetch(endpoint, {headers: {Accept: "application/json"}});
  if (!response.ok) {
    throw new Error(`WP API error (include): ${response.status} ${response.statusText}`);
  }
  const json = await response.json();
  if (!Array.isArray(json)) return [];
  return json.map(mapWpPostApiItem);
}

async function fetchImdGroups({supabaseUrl, supabaseKey}) {
  const supabase = createSupabaseClient(supabaseUrl, supabaseKey, {
    auth: {persistSession: false, autoRefreshToken: false},
  });

  const rows = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const {data, error} = await supabase
      .schema("imd")
      .from("groups")
      .select("id,name_ja,slug,status")
      .eq("status", "active")
      .range(from, to);

    if (error) throw new Error(`Supabase query error: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  const bySlug = new Map();
  for (const row of rows) {
    if (typeof row.slug === "string" && row.slug.trim()) {
      bySlug.set(row.slug.trim(), {
        id: typeof row.id === "string" ? row.id : null,
        nameJa: typeof row.name_ja === "string" ? row.name_ja : null,
        slug: row.slug.trim(),
      });
    }
  }

  return bySlug;
}

async function fetchSanityLookups({projectId, dataset, apiVersion, token}) {
  const client = createClient({
    projectId,
    dataset,
    apiVersion,
    token: token ?? undefined,
    useCdn: false,
    perspective: token ? "drafts" : "published",
  });

  const [categories, tags] = await Promise.all([
    client.fetch('*[_type == "newsCategory" && defined(slug.current)]{_id, "slug": slug.current}'),
    client.fetch('*[_type == "newsTag" && defined(slug.current)]{_id, "slug": slug.current}'),
  ]);

  const categoryBySlug = new Map();
  for (const row of categories ?? []) {
    if (typeof row?._id === "string" && typeof row?.slug === "string" && row.slug.trim()) {
      categoryBySlug.set(row.slug.trim(), row._id);
    }
  }

  const tagBySlug = new Map();
  for (const row of tags ?? []) {
    if (typeof row?._id === "string" && typeof row?.slug === "string" && row.slug.trim()) {
      tagBySlug.set(row.slug.trim(), row._id);
    }
  }

  return {client, categoryBySlug, tagBySlug};
}

async function fetchExistingByWpPostId(client, wpPostIds) {
  if (wpPostIds.length === 0) return new Map();
  const rows = await client.fetch(
    '*[_type == "wpImportedArticle" && wpPostId in $ids]{_id, wpPostId}',
    {ids: wpPostIds}
  );

  const map = new Map();
  for (const row of rows ?? []) {
    if (typeof row?._id === "string" && Number.isFinite(row?.wpPostId)) {
      map.set(Number(row.wpPostId), row._id);
    }
  }
  return map;
}

function buildPayload({post, categoryBySlug, tagBySlug, imdGroupBySlug, nowIso}) {
  const categoryRefs = [];
  const missingCategorySlugs = [];
  for (const category of post.categories) {
    if (!category.slug) continue;
    const refId = categoryBySlug.get(category.slug);
    if (refId) {
      categoryRefs.push({
        _type: "reference",
        _ref: refId,
        _key: createArrayKey("cat", refId, categoryRefs.length),
      });
    } else {
      missingCategorySlugs.push(category.slug);
    }
  }

  const tagRefs = [];
  const missingTagSlugs = [];
  const relatedGroups = [];
  const seenGroupIds = new Set();

  for (const tag of post.tags) {
    if (!tag.slug) continue;

    const tagRefId = tagBySlug.get(tag.slug);
    if (tagRefId) {
      tagRefs.push({
        _type: "reference",
        _ref: tagRefId,
        _key: createArrayKey("tag", tagRefId, tagRefs.length),
      });
    } else {
      missingTagSlugs.push(tag.slug);
    }

    const matchedGroup = imdGroupBySlug.get(tag.slug);
    if (matchedGroup?.id && !seenGroupIds.has(matchedGroup.id)) {
      relatedGroups.push({
        _type: "relatedGroup",
        _key: createArrayKey("rg", matchedGroup.id, relatedGroups.length),
        groupNameJa: matchedGroup.nameJa ?? tag.name,
        imdGroupId: matchedGroup.id,
      });
      seenGroupIds.add(matchedGroup.id);
    }
  }

  const hasLegacyBodyHtml = typeof post.legacyBodyHtml === "string" && post.legacyBodyHtml.trim().length > 0;
  const legacyBodyHtml = hasLegacyBodyHtml
    ? post.legacyBodyHtml
    : "<p>[migration-warning] 本文を取得できませんでした。元記事をご確認ください。</p>";

  const migrationNotes = [
    post.featuredImageUrl ? `heroImageExternalUrl=${post.featuredImageUrl}` : "heroImageExternalUrl=(none)",
    `heroImageSource=${post.featuredImageSource ?? "none"}`,
    hasLegacyBodyHtml ? null : "legacyBodyHtml=placeholder_applied",
    missingCategorySlugs.length > 0 ? `missingCategorySlugs=${missingCategorySlugs.join("|")}` : null,
    missingTagSlugs.length > 0 ? `missingTagSlugs=${missingTagSlugs.join("|")}` : null,
  ]
    .filter(Boolean)
    .join("; ");

  const payload = {
    title: post.title,
    publishedAt: post.publishedAt,
    heroImageExternalUrl: post.featuredImageUrl || undefined,
    categories: categoryRefs,
    tags: tagRefs,
    relatedGroups,
    legacyBodyHtml,
    wpPostId: post.wpPostId,
    originalWpUrl: post.originalWpUrl,
    excerpt: post.excerpt || undefined,
    importedAt: nowIso,
    bodyMigrationStatus: "legacy_html",
    migrationNotes,
  };

  const blockers = [];
  const warnings = [];
  if (!post.publishedAt) blockers.push("missing_publishedAt");
  if (!post.originalWpUrl) blockers.push("missing_originalWpUrl");
  if (!hasLegacyBodyHtml) warnings.push("legacyBodyHtml_missing");
  if (!post.featuredImageUrl) {
    if (post.featuredImageStatus === "api_denied") warnings.push("featuredImage_api_denied");
    else if (post.featuredImageStatus === "unresolved") warnings.push("featuredImage_unresolved");
    else warnings.push("featuredImage_missing");
  }

  return {
    payload,
    missingCategorySlugs,
    missingTagSlugs,
    blockers,
    warnings,
    relatedGroupCount: relatedGroups.length,
  };
}

function getWpImportedArticleId(wpPostId) {
  return `wpImportedArticle.wp.${wpPostId}`;
}

async function applyWpImportedArticles(client, results) {
  const upsertable = results.filter((item) => item.blockers.length === 0);
  const skipped = results.filter((item) => item.blockers.length > 0).map((item) => ({
    wpPostId: item.wpPostId,
    reason: item.blockers.join("|"),
  }));

  let appliedCreates = 0;
  let appliedUpdates = 0;
  const failed = [];

  const chunkSize = 25;
  for (let i = 0; i < upsertable.length; i += chunkSize) {
    const chunk = upsertable.slice(i, i + chunkSize);
    const mutations = [];

    for (const item of chunk) {
      const targetId = item.existingSanityId ?? getWpImportedArticleId(item.wpPostId);
      const isCreate = !item.existingSanityId;

      if (isCreate) {
        mutations.push({
          createIfNotExists: {
            _id: targetId,
            _type: "wpImportedArticle",
          },
        });
      }

      mutations.push({
        patch: {
          id: targetId,
          set: item.payload,
        },
      });

      if (isCreate) appliedCreates += 1;
      else appliedUpdates += 1;
    }

    try {
      await client.mutate(mutations, {visibility: "sync"});
    } catch (error) {
      for (const item of chunk) {
        failed.push({
          wpPostId: item.wpPostId,
          message: error instanceof Error ? error.message : String(error),
        });
      }
      appliedCreates -= chunk.filter((item) => !item.existingSanityId).length;
      appliedUpdates -= chunk.filter((item) => Boolean(item.existingSanityId)).length;
    }
  }

  return {
    appliedCreates,
    appliedUpdates,
    skipped,
    failed,
  };
}

async function main() {
  await loadLocalEnv(path.resolve(process.cwd(), ".env.local"));
  const args = parseArgs(process.argv.slice(2));

  const wpApiBaseUrl = requiredEnv("WP_API_BASE_URL");
  const sanityProjectId = requiredEnv("NEXT_PUBLIC_SANITY_PROJECT_ID");
  const sanityDataset = requiredEnv("NEXT_PUBLIC_SANITY_DATASET");
  const sanityApiVersion = requiredEnv("NEXT_PUBLIC_SANITY_API_VERSION");
  const sanityReadToken =
    optionalEnv("SANITY_API_READ_TOKEN") || optionalEnv("SANITY_API_WRITE_TOKEN") || optionalEnv("SANITY_API_TOKEN");
  const sanityWriteToken = optionalEnv("SANITY_API_WRITE_TOKEN");

  if (args.apply && !sanityWriteToken) {
    throw new Error("Missing required env: SANITY_API_WRITE_TOKEN");
  }

  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseKey = optionalEnv("SUPABASE_SERVICE_ROLE_KEY") || optionalEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  if (!supabaseKey) throw new Error("Missing Supabase key: SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

  const [wpPosts, imdGroupBySlug, sanityLookups] = await Promise.all([
    fetchWpPosts({baseUrl: wpApiBaseUrl, limit: args.limit, page: args.page}),
    fetchImdGroups({supabaseUrl, supabaseKey}),
    fetchSanityLookups({
      projectId: sanityProjectId,
      dataset: sanityDataset,
      apiVersion: sanityApiVersion,
      token: args.apply ? sanityWriteToken : sanityReadToken,
    }),
  ]);

  const includedPosts = await fetchWpPostsByIds({baseUrl: wpApiBaseUrl, ids: args.includeIds});

  const postById = new Map();
  for (const post of [...wpPosts, ...includedPosts]) {
    if (Number.isFinite(post.wpPostId)) postById.set(post.wpPostId, post);
  }
  const mergedWpPosts = Array.from(postById.values()).sort((a, b) => {
    const aTime = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const bTime = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return bTime - aTime;
  });

  const existingByWpPostId = await fetchExistingByWpPostId(
    sanityLookups.client,
    mergedWpPosts.map((post) => post.wpPostId)
  );

  const nowIso = new Date().toISOString();
  const results = mergedWpPosts.map((post) => {
    const built = buildPayload({
      post,
      categoryBySlug: sanityLookups.categoryBySlug,
      tagBySlug: sanityLookups.tagBySlug,
      imdGroupBySlug,
      nowIso,
    });

    const existingId = existingByWpPostId.get(post.wpPostId) ?? null;
    const operation = existingId ? "would-update" : "would-create";

    return {
      wpPostId: post.wpPostId,
      title: post.title,
      publishedAt: post.publishedAt,
      operation,
      existingSanityId: existingId,
      relatedGroupCount: built.relatedGroupCount,
      missingCategorySlugs: built.missingCategorySlugs,
      missingTagSlugs: built.missingTagSlugs,
      blockers: built.blockers,
      warnings: built.warnings,
      featuredImageStatus: post.featuredImageStatus,
      featuredMediaId: post.featuredMediaId,
      payload: built.payload,
    };
  });

  const summary = {
    mode: args.apply ? "apply" : "dry-run",
    checkedPosts: results.length,
    wouldCreate: results.filter((r) => r.operation === "would-create").length,
    wouldUpdate: results.filter((r) => r.operation === "would-update").length,
    postsWithBlockers: results.filter((r) => r.blockers.length > 0).length,
    postsWithWarnings: results.filter((r) => r.warnings.length > 0).length,
    postsMissingFeaturedImage: results.filter((r) => r.featuredImageStatus !== "ok").length,
    postsWithRelatedGroups: results.filter((r) => r.relatedGroupCount > 0).length,
    totalMissingCategorySlugRefs: results.reduce((acc, r) => acc + r.missingCategorySlugs.length, 0),
    totalMissingTagSlugRefs: results.reduce((acc, r) => acc + r.missingTagSlugs.length, 0),
  };

  let applyResult = null;
  if (args.apply) {
    applyResult = await applyWpImportedArticles(sanityLookups.client, results);
    summary.appliedCreates = applyResult.appliedCreates;
    summary.appliedUpdates = applyResult.appliedUpdates;
    summary.applySkipped = applyResult.skipped.length;
    summary.applyFailed = applyResult.failed.length;
  }

  const outputPath = args.output
    ? path.resolve(process.cwd(), args.output)
    : path.resolve(
        process.cwd(),
        "reports",
        `wp-to-sanity-poc-${args.apply ? "apply" : "dry-run"}-${formatStamp()}.json`
      );

  await fs.mkdir(path.dirname(outputPath), {recursive: true});
  await fs.writeFile(
    outputPath,
    JSON.stringify(
      {
        generatedAt: nowIso,
        params: {limit: args.limit, page: args.page, includeIds: args.includeIds, apply: args.apply},
        summary,
        apply: applyResult,
        results,
      },
      null,
      2
    ),
    "utf8"
  );

  const issuesOutputPath = outputPath.replace(/\.json$/i, ".issues.csv");
  const issuesCsv = buildIssuesCsv(results);
  await fs.writeFile(issuesOutputPath, issuesCsv.csvText, "utf8");

  console.log(`Dry-run report written: ${outputPath}`);
  console.log(`Issues CSV written: ${issuesOutputPath} (${issuesCsv.rows.length} rows)`);
  console.log("--- summary ---");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error("[wp-to-sanity-poc-dry-run]", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {createClient} from "@sanity/client";

function parseArgs(argv) {
  const args = {
    dryRun: true,
    output: null,
  };

  for (const arg of argv) {
    if (arg === "--apply") {
      args.dryRun = false;
      continue;
    }
    if (arg === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (arg.startsWith("--output=")) {
      const v = arg.slice("--output=".length).trim();
      if (v) args.output = v;
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
      const idx = trimmed.indexOf("=");
      if (idx <= 0) continue;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim().replace(/^['\"]|['\"]$/g, "");
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // ignore
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

function stripHtml(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
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

async function fetchWpTermsAll({baseUrl, taxonomy}) {
  const items = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const params = new URLSearchParams({
      per_page: "100",
      page: String(page),
      hide_empty: "false",
      orderby: "name",
      order: "asc",
    });
    const endpoint = `${normalizeBaseUrl(baseUrl)}/wp-json/wp/v2/${taxonomy}?${params.toString()}`;
    const res = await fetch(endpoint, {headers: {Accept: "application/json"}});
    if (!res.ok) {
      throw new Error(`WP ${taxonomy} API error: ${res.status} ${res.statusText}`);
    }

    const pageItems = await res.json();
    if (!Array.isArray(pageItems)) break;

    items.push(
      ...pageItems.map((item) => ({
        id: Number(item?.id),
        name: stripHtml(item?.name ?? ""),
        slug: typeof item?.slug === "string" ? item.slug.trim() : "",
      }))
    );

    const headerPages = Number(res.headers.get("x-wp-totalpages") ?? "1");
    totalPages = Number.isFinite(headerPages) && headerPages > 0 ? headerPages : 1;
    page += 1;
  }

  return items.filter((item) => Number.isFinite(item.id) && item.id > 0 && item.name);
}

function buildSanityDoc({term, typeName, idPrefix}) {
  return {
    _id: `${idPrefix}.${term.id}`,
    _type: typeName,
    title: term.name,
    slug: term.slug ? {_type: "slug", current: term.slug} : undefined,
  };
}

async function fetchExistingBySlug(client, typeName, slugs) {
  if (slugs.length === 0) return new Map();

  const rows = await client.fetch(
    '*[_type == $type && slug.current in $slugs]{_id, "slug": slug.current, title}',
    {type: typeName, slugs}
  );

  const map = new Map();
  for (const row of rows ?? []) {
    if (typeof row?._id === "string" && typeof row?.slug === "string") {
      map.set(row.slug, {_id: row._id, title: typeof row?.title === "string" ? row.title : ""});
    }
  }
  return map;
}

function diffDoc(term, existing) {
  if (!existing) return "create";
  if (existing.title !== term.name) return "update";
  return "noop";
}

async function syncOneType({client, wpTerms, typeName, idPrefix, dryRun}) {
  const slugs = Array.from(new Set(wpTerms.map((t) => t.slug).filter(Boolean)));
  const existingBySlug = await fetchExistingBySlug(client, typeName, slugs);

  const rows = [];
  const mutations = [];
  for (const term of wpTerms) {
    if (!term.slug) {
      rows.push({
        wpTermId: term.id,
        slug: "",
        title: term.name,
        action: "skip",
        reason: "empty_slug",
        sanityId: null,
      });
      continue;
    }

    const existing = existingBySlug.get(term.slug) ?? null;
    const action = diffDoc(term, existing);
    const targetId = existing?._id ?? `${idPrefix}.${term.id}`;

    rows.push({
      wpTermId: term.id,
      slug: term.slug,
      title: term.name,
      action,
      reason: null,
      sanityId: targetId,
    });

    if (action === "noop") continue;

    const doc = buildSanityDoc({term, typeName, idPrefix});
    if (existing) {
      mutations.push({
        patch: {
          id: existing._id,
          set: {title: doc.title, slug: doc.slug},
        },
      });
    } else {
      mutations.push({createIfNotExists: doc});
      mutations.push({
        patch: {
          id: doc._id,
          set: {title: doc.title, slug: doc.slug},
        },
      });
    }
  }

  if (!dryRun && mutations.length > 0) {
    const chunkSize = 400;
    for (let i = 0; i < mutations.length; i += chunkSize) {
      const chunk = mutations.slice(i, i + chunkSize);
      await client.mutate(chunk, {visibility: "sync"});
    }
  }

  const summary = {
    sourceCount: wpTerms.length,
    creates: rows.filter((r) => r.action === "create").length,
    updates: rows.filter((r) => r.action === "update").length,
    noops: rows.filter((r) => r.action === "noop").length,
    skips: rows.filter((r) => r.action === "skip").length,
  };

  return {summary, rows};
}

async function main() {
  await loadLocalEnv(path.resolve(process.cwd(), ".env.local"));
  const args = parseArgs(process.argv.slice(2));

  const wpApiBaseUrl = requiredEnv("WP_API_BASE_URL");
  const sanityProjectId = requiredEnv("NEXT_PUBLIC_SANITY_PROJECT_ID");
  const sanityDataset = requiredEnv("NEXT_PUBLIC_SANITY_DATASET");
  const sanityApiVersion = requiredEnv("NEXT_PUBLIC_SANITY_API_VERSION");
  const sanityWriteToken = optionalEnv("SANITY_API_WRITE_TOKEN");
  const sanityReadToken = optionalEnv("SANITY_API_READ_TOKEN") || optionalEnv("SANITY_API_TOKEN");
  const sanityToken = args.dryRun ? sanityReadToken || sanityWriteToken : sanityWriteToken;

  if (!args.dryRun && !sanityToken) {
    throw new Error("Missing required env: SANITY_API_WRITE_TOKEN");
  }

  const client = createClient({
    projectId: sanityProjectId,
    dataset: sanityDataset,
    apiVersion: sanityApiVersion,
    token: sanityToken ?? undefined,
    useCdn: false,
  });

  const [wpCategories, wpTags] = await Promise.all([
    fetchWpTermsAll({baseUrl: wpApiBaseUrl, taxonomy: "categories"}),
    fetchWpTermsAll({baseUrl: wpApiBaseUrl, taxonomy: "tags"}),
  ]);

  const [categorySync, tagSync] = await Promise.all([
    syncOneType({
      client,
      wpTerms: wpCategories,
      typeName: "newsCategory",
      idPrefix: "newsCategory.wp",
      dryRun: args.dryRun,
    }),
    syncOneType({
      client,
      wpTerms: wpTags,
      typeName: "newsTag",
      idPrefix: "newsTag.wp",
      dryRun: args.dryRun,
    }),
  ]);

  const report = {
    generatedAt: new Date().toISOString(),
    mode: args.dryRun ? "dry-run" : "apply",
    category: categorySync.summary,
    tag: tagSync.summary,
    details: {
      category: categorySync.rows,
      tag: tagSync.rows,
    },
  };

  const outputPath = args.output
    ? path.resolve(process.cwd(), args.output)
    : path.resolve(process.cwd(), "reports", `wp-taxonomy-sync-${args.dryRun ? "dry-run" : "apply"}-${formatStamp()}.json`);

  await fs.mkdir(path.dirname(outputPath), {recursive: true});
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");

  console.log(`Taxonomy sync report written: ${outputPath}`);
  console.log("--- summary ---");
  console.log(JSON.stringify({mode: report.mode, category: report.category, tag: report.tag}, null, 2));
}

main().catch((error) => {
  console.error("[wp-sync-taxonomies-to-sanity]", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

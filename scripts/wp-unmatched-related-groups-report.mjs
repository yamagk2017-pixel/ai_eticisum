#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {createClient} from "@supabase/supabase-js";

function parseArgs(argv) {
  const result = {
    limit: 10,
    page: 1,
    dryRun: false,
    output: null,
  };

  for (const arg of argv) {
    if (arg === "--dry-run") {
      result.dryRun = true;
      continue;
    }
    if (arg.startsWith("--limit=")) {
      const n = Number(arg.slice("--limit=".length));
      if (Number.isFinite(n) && n > 0) result.limit = Math.min(Math.trunc(n), 100);
      continue;
    }
    if (arg.startsWith("--page=")) {
      const n = Number(arg.slice("--page=".length));
      if (Number.isFinite(n) && n > 0) result.page = Math.max(Math.trunc(n), 1);
      continue;
    }
    if (arg.startsWith("--output=")) {
      const value = arg.slice("--output=".length).trim();
      if (value) result.output = value;
    }
  }

  return result;
}

function formatDateForFile(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${y}${m}${d}-${hh}${mm}${ss}`;
}

async function loadLocalEnv(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^['\"]|['\"]$/g, "");
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

function normalizeBaseUrl(url) {
  return url.replace(/\/+$/, "");
}

function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

async function fetchWpPosts({baseUrl, limit, page}) {
  const params = new URLSearchParams({
    per_page: String(limit),
    page: String(page),
    _embed: "",
  });
  const endpoint = `${normalizeBaseUrl(baseUrl)}/wp-json/wp/v2/posts?${params.toString()}`;

  const res = await fetch(endpoint, {
    headers: {Accept: "application/json"},
  });

  if (!res.ok) {
    throw new Error(`WP API error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  if (!Array.isArray(json)) return [];

  return json.map((post) => {
    const termGroups = post?._embedded?.["wp:term"];
    const terms = Array.isArray(termGroups) ? termGroups.flat() : [];
    const tags = terms
      .filter((t) => t?.taxonomy === "post_tag" && typeof t?.name === "string")
      .map((t) => ({
        name: t.name,
        slug: typeof t.slug === "string" ? t.slug : null,
      }));

    return {
      wpPostId: post.id,
      title: stripHtml(post?.title?.rendered ?? "(no title)"),
      originalWpUrl: typeof post?.link === "string" ? post.link : "",
      publishedAt: typeof post?.date === "string" ? post.date : "",
      wpTagSlugs: tags
        .map((tag) => tag.slug)
        .filter((slug) => typeof slug === "string" && slug.trim())
        .map((slug) => slug.trim()),
      wpTagNames: tags.map((tag) => tag.name.trim()).filter(Boolean),
    };
  });
}

async function fetchImdGroupSlugs({supabaseUrl, supabaseKey}) {
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {persistSession: false, autoRefreshToken: false},
  });

  const slugs = new Set();
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const {data, error} = await supabase
      .schema("imd")
      .from("groups")
      .select("slug,status")
      .eq("status", "active")
      .range(from, to);

    if (error) throw new Error(`Supabase query error: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data) {
      if (typeof row.slug === "string" && row.slug.trim()) {
        slugs.add(row.slug.trim());
      }
    }

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return slugs;
}

function classifyReason(wpTagSlugs, imdSlugs) {
  if (wpTagSlugs.length === 0) return "no_wp_tag_slug";
  const matched = wpTagSlugs.some((slug) => imdSlugs.has(slug));
  return matched ? null : "no_imd_slug_exact_match";
}

async function main() {
  await loadLocalEnv(path.resolve(process.cwd(), ".env.local"));

  const args = parseArgs(process.argv.slice(2));
  const wpApiBaseUrl = requiredEnv("WP_API_BASE_URL");
  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "").trim();

  if (!supabaseKey) {
    throw new Error("Missing Supabase key: SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }

  const [wpPosts, imdSlugs] = await Promise.all([
    fetchWpPosts({baseUrl: wpApiBaseUrl, limit: args.limit, page: args.page}),
    fetchImdGroupSlugs({supabaseUrl, supabaseKey}),
  ]);

  const unmatched = wpPosts
    .map((post) => ({
      ...post,
      reason: classifyReason(post.wpTagSlugs, imdSlugs),
    }))
    .filter((post) => post.reason !== null);

  const header = [
    "wpPostId",
    "title",
    "originalWpUrl",
    "publishedAt",
    "wpTagSlugs",
    "wpTagNames",
    "reason",
  ];

  const lines = [header.join(",")];
  for (const item of unmatched) {
    lines.push(
      [
        item.wpPostId,
        item.title,
        item.originalWpUrl,
        item.publishedAt,
        item.wpTagSlugs.join("|"),
        item.wpTagNames.join("|"),
        item.reason,
      ]
        .map(csvEscape)
        .join(",")
    );
  }

  const outputPath = args.output
    ? path.resolve(process.cwd(), args.output)
    : path.resolve(process.cwd(), "reports", `wp-related-groups-unmatched-${formatDateForFile()}.csv`);

  if (args.dryRun) {
    console.log("[dry-run] CSV file was not written.");
    console.log(`target: ${outputPath}`);
  } else {
    await fs.mkdir(path.dirname(outputPath), {recursive: true});
    await fs.writeFile(outputPath, `${lines.join("\n")}\n`, "utf8");
    console.log(`CSV written: ${outputPath}`);
  }

  console.log("--- summary ---");
  console.log(`source posts checked: ${wpPosts.length}`);
  console.log(`imd active slugs: ${imdSlugs.size}`);
  console.log(`unmatched posts: ${unmatched.length}`);
}

main().catch((error) => {
  console.error("[wp-unmatched-related-groups-report]", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

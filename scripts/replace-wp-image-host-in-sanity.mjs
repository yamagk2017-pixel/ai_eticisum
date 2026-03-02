#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {createClient} from "@sanity/client";

function parseArgs(argv) {
  const args = {
    from: null,
    to: null,
    apply: false,
    output: null,
  };

  for (const arg of argv) {
    if (arg.startsWith("--from=")) {
      const value = arg.slice("--from=".length).trim();
      if (value) args.from = value;
      continue;
    }
    if (arg.startsWith("--to=")) {
      const value = arg.slice("--to=".length).trim();
      if (value) args.to = value;
      continue;
    }
    if (arg.startsWith("--output=")) {
      const value = arg.slice("--output=".length).trim();
      if (value) args.output = value;
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
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function replaceAllSafe(input, from, to) {
  if (typeof input !== "string" || !input) return {value: input ?? null, count: 0};
  const count = input.split(from).length - 1;
  if (count <= 0) return {value: input, count: 0};
  return {value: input.split(from).join(to), count};
}

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function fetchTargets(client, fromHost) {
  const query = `
    *[
      _type == "wpImportedArticle" &&
      (
        (defined(heroImageExternalUrl) && heroImageExternalUrl match $hostWildcard) ||
        (defined(legacyBodyHtml) && legacyBodyHtml match $hostWildcard)
      ) &&
      !(_id in path("drafts.**"))
    ]{
      _id,
      wpPostId,
      title,
      heroImageExternalUrl,
      legacyBodyHtml
    }
  `;

  const hostWildcard = `*${fromHost}*`;
  return client.fetch(query, {hostWildcard});
}

async function applyUpdates(client, rows) {
  let updated = 0;
  let failed = 0;
  const failures = [];

  for (const group of chunk(rows, 50)) {
    const tx = client.transaction();
    for (const row of group) {
      const patch = {};
      if (row.heroChanged) patch.heroImageExternalUrl = row.newHeroImageExternalUrl;
      if (row.bodyChanged) patch.legacyBodyHtml = row.newLegacyBodyHtml;
      tx.patch(row._id, {set: patch});
    }

    try {
      await tx.commit({visibility: "sync"});
      updated += group.length;
    } catch (error) {
      failed += group.length;
      for (const row of group) {
        failures.push({
          wpPostId: row.wpPostId,
          sanityId: row._id,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return {updated, failed, failures};
}

async function main() {
  await loadLocalEnv(path.resolve(process.cwd(), ".env.local"));
  const args = parseArgs(process.argv.slice(2));

  if (!args.from || !args.to) {
    throw new Error("Required args: --from=<oldHost> --to=<newHost>");
  }
  if (args.from === args.to) {
    throw new Error("`--from` and `--to` must be different.");
  }

  const projectId = requiredEnv("NEXT_PUBLIC_SANITY_PROJECT_ID");
  const dataset = requiredEnv("NEXT_PUBLIC_SANITY_DATASET");
  const apiVersion = requiredEnv("NEXT_PUBLIC_SANITY_API_VERSION");
  const readToken = optionalEnv("SANITY_API_READ_TOKEN") || optionalEnv("SANITY_API_WRITE_TOKEN");
  const writeToken = optionalEnv("SANITY_API_WRITE_TOKEN");
  if (args.apply && !writeToken) {
    throw new Error("Missing required env: SANITY_API_WRITE_TOKEN");
  }

  const client = createClient({
    projectId,
    dataset,
    apiVersion,
    token: args.apply ? writeToken : readToken,
    useCdn: false,
  });

  const targets = await fetchTargets(client, args.from);

  const rows = targets.map((doc) => {
    const heroOld = typeof doc.heroImageExternalUrl === "string" ? doc.heroImageExternalUrl : null;
    const bodyOld = typeof doc.legacyBodyHtml === "string" ? doc.legacyBodyHtml : null;

    const heroReplaced = replaceAllSafe(heroOld, args.from, args.to);
    const bodyReplaced = replaceAllSafe(bodyOld, args.from, args.to);

    return {
      _id: doc._id,
      wpPostId: Number.isFinite(doc.wpPostId) ? Number(doc.wpPostId) : null,
      title: typeof doc.title === "string" ? doc.title : "",
      heroChanged: heroReplaced.count > 0,
      bodyChanged: bodyReplaced.count > 0,
      heroReplaceCount: heroReplaced.count,
      bodyReplaceCount: bodyReplaced.count,
      oldHeroImageExternalUrl: heroOld,
      newHeroImageExternalUrl: heroReplaced.value,
      newLegacyBodyHtml: bodyReplaced.value,
    };
  }).filter((row) => row.heroChanged || row.bodyChanged);

  const totalHeroReplacements = rows.reduce((sum, row) => sum + row.heroReplaceCount, 0);
  const totalBodyReplacements = rows.reduce((sum, row) => sum + row.bodyReplaceCount, 0);

  let applyResult = null;
  if (args.apply) {
    applyResult = await applyUpdates(client, rows);
  }

  const stamp = formatStamp();
  const reportsDir = path.resolve(process.cwd(), "reports");
  const mode = args.apply ? "apply" : "dry-run";
  const baseName = args.output
    ? path.resolve(process.cwd(), args.output)
    : path.join(reportsDir, `wp-image-host-replace-${mode}-${stamp}`);

  const jsonPath = baseName.endsWith(".json") ? baseName : `${baseName}.json`;
  const csvPath = baseName.endsWith(".json") ? baseName.replace(/\.json$/i, ".csv") : `${baseName}.csv`;

  const report = {
    mode,
    from: args.from,
    to: args.to,
    scannedDocs: targets.length,
    affectedDocs: rows.length,
    docsWithHeroReplacement: rows.filter((r) => r.heroChanged).length,
    docsWithBodyReplacement: rows.filter((r) => r.bodyChanged).length,
    totalHeroReplacements,
    totalBodyReplacements,
    apply: applyResult,
    generatedAt: new Date().toISOString(),
    items: rows.map((row) => ({
      sanityId: row._id,
      wpPostId: row.wpPostId,
      title: row.title,
      heroChanged: row.heroChanged,
      bodyChanged: row.bodyChanged,
      heroReplaceCount: row.heroReplaceCount,
      bodyReplaceCount: row.bodyReplaceCount,
      oldHeroImageExternalUrl: row.oldHeroImageExternalUrl,
      newHeroImageExternalUrl: row.newHeroImageExternalUrl,
    })),
  };

  const csvHeader = [
    "sanityId",
    "wpPostId",
    "title",
    "heroChanged",
    "bodyChanged",
    "heroReplaceCount",
    "bodyReplaceCount",
    "oldHeroImageExternalUrl",
    "newHeroImageExternalUrl",
  ];
  const csvLines = [csvHeader.join(",")];
  for (const row of rows) {
    csvLines.push(
      [
        row._id,
        row.wpPostId ?? "",
        row.title,
        row.heroChanged ? "1" : "0",
        row.bodyChanged ? "1" : "0",
        row.heroReplaceCount,
        row.bodyReplaceCount,
        row.oldHeroImageExternalUrl ?? "",
        row.newHeroImageExternalUrl ?? "",
      ]
        .map(csvEscape)
        .join(",")
    );
  }

  await fs.mkdir(path.dirname(jsonPath), {recursive: true});
  await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await fs.writeFile(csvPath, `${csvLines.join("\n")}\n`, "utf8");

  console.log(`Report written: ${jsonPath}`);
  console.log(`CSV written: ${csvPath}`);
  console.log("--- summary ---");
  console.log(
    JSON.stringify(
      {
        mode,
        from: args.from,
        to: args.to,
        scannedDocs: targets.length,
        affectedDocs: rows.length,
        docsWithHeroReplacement: rows.filter((r) => r.heroChanged).length,
        docsWithBodyReplacement: rows.filter((r) => r.bodyChanged).length,
        totalHeroReplacements,
        totalBodyReplacements,
        appliedUpdatedDocs: applyResult?.updated ?? 0,
        applyFailedDocs: applyResult?.failed ?? 0,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("[replace-wp-image-host-in-sanity]", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});


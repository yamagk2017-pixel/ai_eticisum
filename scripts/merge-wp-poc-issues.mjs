#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

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

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += ch;
  }

  values.push(current);
  return values;
}

function parseCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const header = parseCsvLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const row = {};
    for (let j = 0; j < header.length; j += 1) {
      row[header[j]] = cols[j] ?? "";
    }
    rows.push(row);
  }

  return rows;
}

function unionPipe(a, b) {
  const set = new Set();
  for (const source of [a, b]) {
    for (const part of String(source ?? "").split("|")) {
      const trimmed = part.trim();
      if (trimmed) set.add(trimmed);
    }
  }
  return Array.from(set).sort().join("|");
}

async function main() {
  const reportsDir = path.resolve(process.cwd(), "reports");
  const files = (await fs.readdir(reportsDir))
    .filter((name) => /^wp-to-sanity-poc-.*\.issues\.csv$/i.test(name))
    .sort();

  if (files.length === 0) {
    throw new Error("No wp-to-sanity-poc *.issues.csv files found in reports/");
  }

  const merged = new Map();

  for (const file of files) {
    const filePath = path.join(reportsDir, file);
    const raw = await fs.readFile(filePath, "utf8");
    const rows = parseCsv(raw);

    for (const row of rows) {
      const id = String(row.wpPostId ?? "").trim();
      if (!id) continue;

      const existing = merged.get(id);
      if (!existing) {
        merged.set(id, {
          wpPostId: id,
          title: row.title ?? "",
          featuredImageStatus: row.featuredImageStatus ?? "",
          blockers: row.blockers ?? "",
          warnings: row.warnings ?? "",
          missingCategorySlugs: row.missingCategorySlugs ?? "",
          missingTagSlugs: row.missingTagSlugs ?? "",
          originalWpUrl: row.originalWpUrl ?? "",
          firstSeenFile: file,
          lastSeenFile: file,
          occurrences: 1,
          sourceFiles: file,
        });
        continue;
      }

      existing.title = existing.title || row.title || "";
      existing.featuredImageStatus = existing.featuredImageStatus || row.featuredImageStatus || "";
      existing.blockers = unionPipe(existing.blockers, row.blockers);
      existing.warnings = unionPipe(existing.warnings, row.warnings);
      existing.missingCategorySlugs = unionPipe(existing.missingCategorySlugs, row.missingCategorySlugs);
      existing.missingTagSlugs = unionPipe(existing.missingTagSlugs, row.missingTagSlugs);
      existing.originalWpUrl = existing.originalWpUrl || row.originalWpUrl || "";
      existing.lastSeenFile = file;
      existing.occurrences += 1;
      existing.sourceFiles = unionPipe(existing.sourceFiles, file);
    }
  }

  const header = [
    "wpPostId",
    "title",
    "featuredImageStatus",
    "blockers",
    "warnings",
    "missingCategorySlugs",
    "missingTagSlugs",
    "originalWpUrl",
    "occurrences",
    "firstSeenFile",
    "lastSeenFile",
    "sourceFiles",
  ];

  const lines = [header.join(",")];
  const rows = Array.from(merged.values()).sort((a, b) => Number(a.wpPostId) - Number(b.wpPostId));
  for (const row of rows) {
    lines.push(header.map((key) => csvEscape(row[key] ?? "")).join(","));
  }

  const outPath = path.join(reportsDir, `wp-to-sanity-poc-issues-merged-${formatStamp()}.csv`);
  await fs.writeFile(outPath, `${lines.join("\n")}\n`, "utf8");

  console.log(`Merged issues CSV written: ${outPath}`);
  console.log(`Source files: ${files.length}`);
  console.log(`Unique wpPostId rows: ${rows.length}`);
}

main().catch((error) => {
  console.error("[merge-wp-poc-issues]", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});


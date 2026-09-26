#!/usr/bin/env node

import {randomUUID} from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {parse as parseYaml} from "yaml";

type DraftDocumentType = "News" | "Radio" | "Event";
type SanityDocumentType = "newsArticle" | "radioAnnouncement" | "eventAnnouncement";

type PrepareOptions = {
  source: string;
  documentType: DraftDocumentType;
  hero?: string;
  outputDir?: string;
};

type PushOptions = {
  draft: string;
  apply: boolean;
};

type DraftMetadata = {
  documentType?: unknown;
  title?: unknown;
  slug?: unknown;
  publishedAt?: unknown;
  heroImage?: unknown;
  categories?: unknown;
  tags?: unknown;
  relatedGroups?: unknown;
  excerpt?: unknown;
  seoTitle?: unknown;
  seoDescription?: unknown;
  broadcastDate?: unknown;
  eventTimeText?: unknown;
  personality?: unknown;
  representativePerformers?: unknown;
  archiveUrl?: unknown;
  afterTalkUrl?: unknown;
  eventTitle?: unknown;
  eventDate?: unknown;
  eventEndDate?: unknown;
  venue?: unknown;
  officialSiteUrl?: unknown;
  organizer?: unknown;
  appendEtcForRelatedGroups?: unknown;
  appendEtcForRepresentativePerformers?: unknown;
  eventPrice?: unknown;
  eventPricePlusOneDrink?: unknown;
  ticketSalesUrl?: unknown;
  streamingUrl?: unknown;
  streamingDeadline?: unknown;
  streamingPrice?: unknown;
  isMyRelatedEvent?: unknown;
};

type DraftState = {
  version: 2;
  documentId: string;
  documentType: SanityDocumentType;
  createdAt: string;
};

type SanityLookup = {
  _id: string;
  title?: string;
  slug?: string;
};

type ImdGroup = {
  id: string;
  name_ja: string | null;
  slug: string | null;
};

type ImdRelatedGroupCheck = {
  groupNameJa: string;
  status: "matched" | "verified" | "not-found" | "ambiguous" | "invalid-id";
  imdGroupId?: string;
  matchedNameJa?: string;
  candidates?: Array<{imdGroupId: string; groupNameJa: string}>;
};

type SanityClientLike = {
  fetch<T>(query: string, params?: Record<string, unknown>): Promise<T>;
  assets: {
    upload(type: "image", body: Buffer, options: {filename: string}): Promise<{_id: string}>;
  };
  transaction(): {
    createIfNotExists(document: Record<string, unknown>): ReturnType<SanityClientLike["transaction"]>;
    patch(id: string, patch: {set: Record<string, unknown>}): ReturnType<SanityClientLike["transaction"]>;
    commit(options: {visibility: "sync"}): Promise<unknown>;
  };
};

const SUPPORTED_SOURCE_EXTENSIONS = new Set([".txt", ".md", ".docx", ".pdf"]);
const SUPPORTED_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const SANITY_TYPE_BY_DRAFT_TYPE: Record<DraftDocumentType, SanityDocumentType> = {
  News: "newsArticle",
  Radio: "radioAnnouncement",
  Event: "eventAnnouncement",
};

function readOption(args: string[], name: string) {
  const prefix = `--${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length).trim();

  const index = args.indexOf(`--${name}`);
  if (index >= 0) return args[index + 1]?.trim() || undefined;
  return undefined;
}

function parsePrepareOptions(args: string[]): PrepareOptions {
  const source = readOption(args, "source");
  if (!source) throw new Error("Missing required option: --source=/path/to/manuscript");
  const documentType = parseDocumentType(readOption(args, "type"));

  return {
    source,
    documentType,
    hero: readOption(args, "hero"),
    outputDir: readOption(args, "output-dir"),
  };
}

function parseDocumentType(value: unknown): DraftDocumentType {
  const normalized = textValue(value).toLowerCase();
  if (normalized === "news") return "News";
  if (normalized === "radio") return "Radio";
  if (normalized === "event") return "Event";
  throw new Error("Article type must be explicitly specified as News, Radio, or Event.");
}

function parsePushOptions(args: string[]): PushOptions {
  const draft = readOption(args, "draft");
  if (!draft) throw new Error("Missing required option: --draft=/path/to/draft.md");
  return {draft, apply: args.includes("--apply")};
}

function normalizeText(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function firstContentLine(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean)
    ?.replace(/^#{1,6}\s+/, "")
    .slice(0, 200) ?? "";
}

function tokyoDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    stamp: `${values.year}${values.month}${values.day}-${values.hour}${values.minute}${values.second}`,
    iso: `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}+09:00`,
  };
}

function yamlString(value: string) {
  return JSON.stringify(value);
}

function normalizeSlug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[’']/g, "")
    .replace(/&/g, " and ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120)
    .replace(/-$/g, "");
}

function generatedSlug(title: string, publishedAt: string, documentType: DraftDocumentType) {
  const fromTitle = normalizeSlug(title);
  if (fromTitle) return fromTitle;

  const parsed = new Date(publishedAt);
  const timestamp = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return `${documentType.toLowerCase()}-${tokyoDateParts(timestamp).stamp}`;
}

function buildDraftMarkdown(params: {
  documentType: DraftDocumentType;
  title: string;
  publishedAt: string;
  heroPath: string;
  body: string;
}) {
  const commonFields = [
    "---",
    `documentType: ${params.documentType}`,
    `title: ${yamlString(params.title)}`,
    'slug: ""',
    `publishedAt: ${yamlString(params.publishedAt)}`,
    `heroImage: ${yamlString(params.heroPath)}`,
    "categories: []",
    "tags: []",
    "relatedGroups: []",
  ];
  const typeFields = params.documentType === "Radio"
    ? [
        'broadcastDate: ""',
        'eventTimeText: ""',
        'personality: ""',
        "representativePerformers: []",
        'archiveUrl: ""',
        'afterTalkUrl: ""',
      ]
    : params.documentType === "Event"
      ? [
          'eventTitle: ""',
          'eventDate: ""',
          'eventEndDate: ""',
          'eventTimeText: ""',
          'venue: ""',
          'officialSiteUrl: ""',
          'organizer: ""',
          "representativePerformers: []",
          "appendEtcForRelatedGroups: false",
          "appendEtcForRepresentativePerformers: false",
          'eventPrice: ""',
          "eventPricePlusOneDrink: false",
          'ticketSalesUrl: ""',
          'streamingUrl: ""',
          'streamingDeadline: ""',
          'streamingPrice: ""',
          "isMyRelatedEvent: false",
        ]
      : [];
  return [
    ...commonFields,
    ...typeFields,
    'excerpt: ""',
    'seoTitle: ""',
    'seoDescription: ""',
    "---",
    "",
    "# 本文",
    "",
    params.body,
    "",
  ].join("\n");
}

async function assertReadableFile(filePath: string, label: string) {
  const stats = await fs.stat(filePath).catch(() => null);
  if (!stats?.isFile()) throw new Error(`${label} is not a readable file: ${filePath}`);
}

async function extractManuscript(sourcePath: string) {
  const extension = path.extname(sourcePath).toLowerCase();
  if (!SUPPORTED_SOURCE_EXTENSIONS.has(extension)) {
    throw new Error(`Unsupported manuscript type: ${extension || "(no extension)"}`);
  }

  const buffer = await fs.readFile(sourcePath);
  if (extension === ".docx") {
    const moduleUrl = new URL("../src/lib/sanity/press-release-docx.ts", import.meta.url).href;
    const {parsePressReleaseDocx} = await import(moduleUrl);
    const parsed = await parsePressReleaseDocx(buffer);
    return {title: parsed.title, text: normalizeText(parsed.plainText)};
  }
  if (extension === ".pdf") {
    const moduleUrl = new URL("../src/lib/sanity/press-release-pdf.ts", import.meta.url).href;
    const {parsePressReleasePdf} = await import(moduleUrl);
    const parsed = await parsePressReleasePdf(buffer);
    return {title: parsed.title, text: normalizeText(parsed.plainText)};
  }

  const text = normalizeText(buffer.toString("utf8"));
  if (!text) throw new Error("The manuscript is empty.");
  return {title: firstContentLine(text), text};
}

async function prepareWorkspace(options: PrepareOptions) {
  const sourcePath = path.resolve(options.source);
  await assertReadableFile(sourcePath, "Manuscript");

  const sourceExtension = path.extname(sourcePath).toLowerCase();
  const heroPath = options.hero ? path.resolve(options.hero) : null;
  let heroExtension = "";
  if (heroPath) {
    await assertReadableFile(heroPath, "Hero image");
    heroExtension = path.extname(heroPath).toLowerCase();
    if (!SUPPORTED_IMAGE_EXTENSIONS.has(heroExtension)) {
      throw new Error(`Unsupported hero image type: ${heroExtension || "(no extension)"}`);
    }
  }

  const extracted = await extractManuscript(sourcePath);
  const now = tokyoDateParts();
  const workspacePath = path.resolve(
    options.outputDir ?? path.join(process.cwd(), "tmp", "news-drafts", now.stamp)
  );

  await fs.mkdir(workspacePath, {recursive: true});
  const copiedSourcePath = path.join(workspacePath, `source${sourceExtension}`);
  await fs.copyFile(sourcePath, copiedSourcePath);

  let copiedHeroRelativePath = "";
  if (heroPath) {
    copiedHeroRelativePath = `./hero${heroExtension}`;
    await fs.copyFile(heroPath, path.join(workspacePath, `hero${heroExtension}`));
  }

  const extractedPath = path.join(workspacePath, "extracted.txt");
  const draftPath = path.join(workspacePath, "draft.md");
  const statePath = path.join(workspacePath, "state.json");
  const state: DraftState = {
    version: 2,
    documentId: `${SANITY_TYPE_BY_DRAFT_TYPE[options.documentType]}.local.${randomUUID()}`,
    documentType: SANITY_TYPE_BY_DRAFT_TYPE[options.documentType],
    createdAt: new Date().toISOString(),
  };
  await fs.writeFile(extractedPath, `${extracted.text}\n`, "utf8");
  await fs.writeFile(
    draftPath,
    buildDraftMarkdown({
      documentType: options.documentType,
      title: extracted.title,
      publishedAt: now.iso,
      heroPath: copiedHeroRelativePath,
      body: extracted.text,
    }),
    "utf8"
  );
  await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");

  return {
    documentType: options.documentType,
    sanityDocumentType: SANITY_TYPE_BY_DRAFT_TYPE[options.documentType],
    workspacePath,
    draftPath,
    sourcePath: copiedSourcePath,
    extractedPath,
    heroPath: copiedHeroRelativePath ? path.resolve(workspacePath, copiedHeroRelativePath) : null,
    statePath,
    warnings: copiedHeroRelativePath ? [] : ["heroImage is empty; the Sanity draft can still be created."],
  };
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringList(value: unknown) {
  if (Array.isArray(value)) return value.map(textValue).filter(Boolean);
  const text = textValue(value);
  return text ? text.split(",").map((item) => item.trim()).filter(Boolean) : [];
}

function parseDraftMarkdown(raw: string) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match) throw new Error("draft.md must start with a YAML front matter block enclosed by --- lines.");

  const metadata = parseYaml(match[1]) as DraftMetadata | null;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new Error("The draft.md metadata block is malformed.");
  }

  const body = normalizeText(match[2].replace(/^\s*#\s+本文\s*\n/i, ""));
  return {metadata, body};
}

function createKey() {
  return randomUUID().replace(/-/g, "").slice(0, 12);
}

function inlineSpans(text: string) {
  const children: Array<{_type: "span"; _key: string; text: string; marks: string[]}> = [];
  const markDefs: Array<{_type: "link"; _key: string; href: string}> = [];
  const pattern = /\*\*|\[([^\]]+)\]\((https?:\/\/[^)]+)\)|(https?:\/\/[^\s)]+)/g;
  const matches = [...text.matchAll(pattern)];
  const strongMarkerIndexes = matches.flatMap((match, index) => (match[0] === "**" ? [index] : []));
  const pairedStrongMarkers = new Set(strongMarkerIndexes.slice(0, strongMarkerIndexes.length - (strongMarkerIndexes.length % 2)));
  let lastIndex = 0;
  let strong = false;

  const addSpan = (spanText: string, marks: string[]) => {
    if (!spanText) return;
    children.push({_type: "span", _key: createKey(), text: spanText, marks});
  };

  const addTextWithStrong = (spanText: string, baseMarks: string[]) => {
    const boldPattern = /\*\*([\s\S]+?)\*\*/g;
    let boldLastIndex = 0;
    for (const boldMatch of spanText.matchAll(boldPattern)) {
      const index = boldMatch.index ?? 0;
      addSpan(spanText.slice(boldLastIndex, index), baseMarks);
      addSpan(boldMatch[1], [...baseMarks, "strong"]);
      boldLastIndex = index + boldMatch[0].length;
    }
    addSpan(spanText.slice(boldLastIndex), baseMarks);
  };

  for (const [matchIndex, match] of matches.entries()) {
    const index = match.index ?? 0;
    addSpan(text.slice(lastIndex, index), strong ? ["strong"] : []);

    if (match[0] === "**") {
      if (pairedStrongMarkers.has(matchIndex)) strong = !strong;
      else addSpan("**", strong ? ["strong"] : []);
      lastIndex = index + match[0].length;
      continue;
    }

    const label = match[1] || match[3] || "";
    const href = match[2] || match[3] || "";
    const markKey = createKey();
    markDefs.push({_type: "link", _key: markKey, href});
    addTextWithStrong(label, [...(strong ? ["strong"] : []), markKey]);
    lastIndex = index + match[0].length;
  }

  addSpan(text.slice(lastIndex), strong ? ["strong"] : []);
  if (children.length === 0) {
    children.push({_type: "span", _key: createKey(), text, marks: []});
  }
  return {children, markDefs};
}

function markdownToPortableText(markdown: string) {
  const paragraphs = markdown.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  return paragraphs.map((paragraph) => {
    let style: "normal" | "h2" | "h3" | "blockquote" = "normal";
    let text = paragraph;
    if (/^###\s+/.test(text)) {
      style = "h3";
      text = text.replace(/^###\s+/, "");
    } else if (/^#{1,2}\s+/.test(text)) {
      style = "h2";
      text = text.replace(/^#{1,2}\s+/, "");
    } else if (/^>\s?/.test(text)) {
      style = "blockquote";
      text = text.replace(/^>\s?/gm, "");
    }

    const inline = inlineSpans(text);
    return {
      _type: "block",
      _key: createKey(),
      style,
      children: inline.children,
      markDefs: inline.markDefs,
    };
  });
}

async function loadLocalEnv(filePath: string) {
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
    // .env.local is optional until a Sanity operation is requested.
  }
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

async function createSanityClient(): Promise<SanityClientLike> {
  await loadLocalEnv(path.resolve(process.cwd(), ".env.local"));
  const {createClient} = await import("@sanity/client");
  return createClient({
    projectId: requiredEnv("NEXT_PUBLIC_SANITY_PROJECT_ID"),
    dataset: requiredEnv("NEXT_PUBLIC_SANITY_DATASET"),
    apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION?.trim() || "2026-02-24",
    token: requiredEnv("SANITY_API_WRITE_TOKEN"),
    useCdn: false,
    perspective: "raw",
  }) as unknown as SanityClientLike;
}

async function readOrCreateState(workspacePath: string, documentType: SanityDocumentType) {
  const statePath = path.join(workspacePath, "state.json");
  try {
    const state = JSON.parse(await fs.readFile(statePath, "utf8")) as DraftState;
    if (state.version !== 2 || !state.documentId || !state.documentType) {
      throw new Error(`Invalid news draft state: ${statePath}`);
    }
    if (state.documentType !== documentType) {
      throw new Error(
        `documentType cannot be changed after workspace creation (${state.documentType} -> ${documentType}).`
      );
    }
    return state;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") throw error;
    const state: DraftState = {
      version: 2,
      documentId: `${documentType}.local.${randomUUID()}`,
      documentType,
      createdAt: new Date().toISOString(),
    };
    await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    return state;
  }
}

function slugDate(value: string) {
  const parsed = new Date(value);
  const stamp = tokyoDateParts(Number.isNaN(parsed.getTime()) ? new Date() : parsed).stamp;
  return stamp.slice(0, 8);
}

async function resolveUniqueSlug(
  client: SanityClientLike,
  baseInput: string,
  publishedAt: string,
  documentId: string,
  documentType: DraftDocumentType
) {
  const base = normalizeSlug(baseInput) || generatedSlug("", publishedAt, documentType);
  const dateCandidate = `${base}-${slugDate(publishedAt)}`;
  const candidates = [base, dateCandidate, ...Array.from({length: 98}, (_, index) => `${dateCandidate}-${index + 2}`)];

  for (const candidate of candidates) {
    const available = await client.fetch<boolean>(
      `!defined(*[
        _type in ["newsArticle", "eventAnnouncement", "radioAnnouncement"] &&
        !sanity::versionOf($publishedId) &&
        slug.current == $slug
      ][0]._id)`,
      {publishedId: documentId, slug: candidate}
    );
    if (available) return candidate;
  }
  throw new Error("Could not find an available slug after 100 attempts.");
}

function lookupReferences(requested: string[], available: SanityLookup[], label: string) {
  const warnings: string[] = [];
  const references = requested.flatMap((value, index) => {
    const normalized = value.toLocaleLowerCase("ja-JP");
    const match = available.find(
      (item) => item.title?.toLocaleLowerCase("ja-JP") === normalized || item.slug?.toLocaleLowerCase("ja-JP") === normalized
    );
    if (!match) {
      warnings.push(`${label} not found in Sanity: ${value}`);
      return [];
    }
    return [{_type: "reference", _key: `ref-${index}-${createKey()}`, _ref: match._id}];
  });
  return {references, warnings};
}

function relatedGroupInputs(value: unknown) {
  const items = Array.isArray(value) ? value : textValue(value) ? [value] : [];
  return items.flatMap((item, index) => {
    if (typeof item === "string" && item.trim()) {
      return [{
        groupNameJa: item.trim(),
        displayOrder: index + 1,
      }];
    }
    if (item && typeof item === "object" && "groupNameJa" in item && textValue(item.groupNameJa)) {
      const group = item as {groupNameJa?: unknown; imdGroupId?: unknown; displayOrder?: unknown};
      return [{
        groupNameJa: textValue(group.groupNameJa),
        ...(textValue(group.imdGroupId) ? {imdGroupId: textValue(group.imdGroupId)} : {}),
        displayOrder: typeof group.displayOrder === "number" ? group.displayOrder : index + 1,
      }];
    }
    return [];
  });
}

function normalizeGroupName(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("ja-JP");
}

async function fetchImdGroups() {
  await loadLocalEnv(path.resolve(process.cwd(), ".env.local"));
  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!supabaseKey) {
    throw new Error("Missing required env: SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }

  const {createClient} = await import("@supabase/supabase-js");
  const client = createClient(supabaseUrl, supabaseKey, {
    auth: {persistSession: false, autoRefreshToken: false},
  });
  const rows: ImdGroup[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const {data, error} = await client
      .schema("imd")
      .from("groups")
      .select("id,name_ja,slug")
      .order("name_ja", {ascending: true})
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Failed to query IMDB imd.groups: ${error.message}`);
    const page = (data ?? []) as ImdGroup[];
    rows.push(...page.filter((row) => typeof row.id === "string"));
    if (page.length < pageSize) break;
  }

  return rows;
}

async function resolveRelatedGroupObjects(value: unknown) {
  const inputs = relatedGroupInputs(value);
  if (inputs.length === 0) {
    return {objects: [], checks: [] as ImdRelatedGroupCheck[], warnings: [] as string[]};
  }

  const available = await fetchImdGroups();
  const byId = new Map(available.map((group) => [group.id, group]));
  const byNormalizedName = new Map<string, ImdGroup[]>();
  for (const group of available) {
    if (!group.name_ja) continue;
    const key = normalizeGroupName(group.name_ja);
    byNormalizedName.set(key, [...(byNormalizedName.get(key) ?? []), group]);
  }

  const warnings: string[] = [];
  const checks: ImdRelatedGroupCheck[] = [];
  const objects = inputs.map((input, index) => {
    let imdGroupId = input.imdGroupId;

    if (imdGroupId) {
      const matched = byId.get(imdGroupId);
      if (!matched) {
        warnings.push(`IMDB group ID not found for ${input.groupNameJa}: ${imdGroupId}`);
        checks.push({groupNameJa: input.groupNameJa, status: "invalid-id", imdGroupId});
        imdGroupId = undefined;
      } else {
        checks.push({
          groupNameJa: input.groupNameJa,
          status: "verified",
          imdGroupId,
          ...(matched.name_ja ? {matchedNameJa: matched.name_ja} : {}),
        });
        if (matched.name_ja && normalizeGroupName(matched.name_ja) !== normalizeGroupName(input.groupNameJa)) {
          warnings.push(`IMDB group name differs for ${input.groupNameJa}: ${matched.name_ja} (${imdGroupId})`);
        }
      }
    } else {
      const matches = byNormalizedName.get(normalizeGroupName(input.groupNameJa)) ?? [];
      if (matches.length === 1) {
        imdGroupId = matches[0].id;
        checks.push({
          groupNameJa: input.groupNameJa,
          status: "matched",
          imdGroupId,
          ...(matches[0].name_ja ? {matchedNameJa: matches[0].name_ja} : {}),
        });
      } else if (matches.length === 0) {
        warnings.push(`IMDB group not found: ${input.groupNameJa}`);
        checks.push({groupNameJa: input.groupNameJa, status: "not-found"});
      } else {
        const candidates = matches
          .filter((match): match is ImdGroup & {name_ja: string} => typeof match.name_ja === "string")
          .map((match) => ({imdGroupId: match.id, groupNameJa: match.name_ja}));
        warnings.push(`Multiple IMDB groups found: ${input.groupNameJa}`);
        checks.push({groupNameJa: input.groupNameJa, status: "ambiguous", candidates});
      }
    }

    return {
      _type: "relatedGroup",
      _key: `group-${index}-${createKey()}`,
      groupNameJa: input.groupNameJa,
      ...(imdGroupId ? {imdGroupId} : {}),
      displayOrder: input.displayOrder,
    };
  });

  return {objects, checks, warnings};
}

function representativePerformerObjects(value: unknown) {
  const items = Array.isArray(value) ? value : textValue(value) ? [value] : [];
  return items.flatMap((item, index) => {
    if (typeof item === "string" && item.trim()) {
      return [{_type: "representativePerformer", _key: `performer-${index}-${createKey()}`, name: item.trim()}];
    }
    if (!item || typeof item !== "object" || !("name" in item) || !textValue(item.name)) return [];

    const performer = item as {name?: unknown; group?: unknown};
    const group = performer.group && typeof performer.group === "object"
      ? performer.group as {groupNameJa?: unknown; imdGroupId?: unknown}
      : null;
    return [{
      _type: "representativePerformer",
      _key: `performer-${index}-${createKey()}`,
      name: textValue(performer.name),
      ...(group && textValue(group.groupNameJa)
        ? {
            group: {
              groupNameJa: textValue(group.groupNameJa),
              ...(textValue(group.imdGroupId) ? {imdGroupId: textValue(group.imdGroupId)} : {}),
            },
          }
        : {}),
    }];
  });
}

function booleanValue(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.trim().toLowerCase() === "true";
  return false;
}

function setTextFields(set: Record<string, unknown>, metadata: DraftMetadata, fields: Array<keyof DraftMetadata>) {
  for (const field of fields) {
    const value = textValue(metadata[field]);
    if (value) set[field] = value;
  }
}

function setDateField(
  set: Record<string, unknown>,
  warnings: string[],
  metadata: DraftMetadata,
  field: keyof DraftMetadata,
  required = false
) {
  const value = textValue(metadata[field]);
  if (!value) {
    if (required) warnings.push(`Missing required field: ${String(field)}`);
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    warnings.push(`Invalid date field omitted: ${String(field)} (${value})`);
    return;
  }
  set[field] = value;
}

async function buildSanityDraft(options: PushOptions) {
  const draftPath = path.resolve(options.draft);
  await assertReadableFile(draftPath, "Draft");
  const workspacePath = path.dirname(draftPath);
  const rawDraft = await fs.readFile(draftPath, "utf8");
  const {metadata, body} = parseDraftMarkdown(rawDraft);
  const documentType = parseDocumentType(metadata.documentType);
  const sanityDocumentType = SANITY_TYPE_BY_DRAFT_TYPE[documentType];
  const state = await readOrCreateState(workspacePath, sanityDocumentType);
  const client = await createSanityClient();
  const title = textValue(metadata.title);
  const publishedAt = textValue(metadata.publishedAt);
  const requestedSlug = textValue(metadata.slug) || generatedSlug(title, publishedAt, documentType);
  const slug = await resolveUniqueSlug(client, requestedSlug, publishedAt, state.documentId, documentType);
  const warnings: string[] = [];

  const [categories, tags] = await Promise.all([
    client.fetch<SanityLookup[]>(`*[_type == "newsCategory"]{_id, title, "slug": slug.current}`),
    client.fetch<SanityLookup[]>(`*[_type == "newsTag"]{_id, title, "slug": slug.current}`),
  ]);
  const categoryResult = lookupReferences(stringList(metadata.categories), categories, "Category");
  const tagResult = lookupReferences(stringList(metadata.tags), tags, "Tag");
  const relatedGroupResult = await resolveRelatedGroupObjects(metadata.relatedGroups);
  warnings.push(...categoryResult.warnings, ...tagResult.warnings, ...relatedGroupResult.warnings);

  const bodyBlocks = markdownToPortableText(body);
  const set: Record<string, unknown> = {
    slug: {_type: "slug", current: slug},
    categories: categoryResult.references,
    tags: tagResult.references,
    relatedGroups: relatedGroupResult.objects,
  };
  if (title) set.title = title;
  else warnings.push("Missing required field: title");
  if (publishedAt && !Number.isNaN(Date.parse(publishedAt))) set.publishedAt = new Date(publishedAt).toISOString();
  else warnings.push("Missing or invalid required field: publishedAt");
  if (bodyBlocks.length > 0) set.body = bodyBlocks;
  else warnings.push("Missing required field: body");

  for (const field of ["excerpt", "seoTitle", "seoDescription"] as const) {
    const value = textValue(metadata[field]);
    if (value) set[field] = value;
  }

  if (documentType === "Radio") {
    setDateField(set, warnings, metadata, "broadcastDate", true);
    const eventTimeText = textValue(metadata.eventTimeText);
    if (eventTimeText) set.eventTimeText = eventTimeText;
    else warnings.push("Missing required field: eventTimeText");
    setTextFields(set, metadata, ["personality", "archiveUrl", "afterTalkUrl"]);
    set.representativePerformers = representativePerformerObjects(metadata.representativePerformers);
  }

  if (documentType === "Event") {
    const eventTitle = textValue(metadata.eventTitle);
    if (eventTitle) set.eventTitle = eventTitle;
    else warnings.push("Missing required field: eventTitle");
    setDateField(set, warnings, metadata, "eventDate");
    setDateField(set, warnings, metadata, "eventEndDate");
    setDateField(set, warnings, metadata, "streamingDeadline");
    setTextFields(set, metadata, [
      "eventTimeText",
      "venue",
      "officialSiteUrl",
      "organizer",
      "eventPrice",
      "ticketSalesUrl",
      "streamingUrl",
      "streamingPrice",
    ]);
    set.representativePerformers = representativePerformerObjects(metadata.representativePerformers);
    set.appendEtcForRelatedGroups = booleanValue(metadata.appendEtcForRelatedGroups);
    set.appendEtcForRepresentativePerformers = booleanValue(metadata.appendEtcForRepresentativePerformers);
    set.eventPricePlusOneDrink = booleanValue(metadata.eventPricePlusOneDrink);
    set.isMyRelatedEvent = booleanValue(metadata.isMyRelatedEvent);
  }

  const heroValue = textValue(metadata.heroImage);
  const heroPath = heroValue ? path.resolve(workspacePath, heroValue) : null;
  const heroExists = heroPath ? (await fs.stat(heroPath).catch(() => null))?.isFile() === true : false;
  if (!heroExists) warnings.push("Missing or unreadable required field: heroImage");

  const draftId = `drafts.${state.documentId}`;

  // Create the draft before uploading assets. This both verifies write access and
  // preserves an incomplete draft if a later upload or patch fails.
  if (options.apply) {
    await client
      .transaction()
      .createIfNotExists({_id: draftId, _type: sanityDocumentType})
      .commit({visibility: "sync"});
  }

  if (options.apply && heroPath && heroExists) {
    const asset = await client.assets.upload("image", await fs.readFile(heroPath), {filename: path.basename(heroPath)});
    set.heroImage = {_type: "image", asset: {_type: "reference", _ref: asset._id}};
  }

  const payload = {_id: draftId, _type: sanityDocumentType, ...set};
  await fs.writeFile(path.join(workspacePath, "sanity-payload.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  if (options.apply) {
    await client.transaction().patch(draftId, {set}).commit({visibility: "sync"});
  }

  return {
    mode: options.apply ? "apply" : "dry-run",
    draftId,
    documentType,
    sanityDocumentType,
    slug,
    workspacePath,
    payloadPath: path.join(workspacePath, "sanity-payload.json"),
    relatedGroupsCheck: relatedGroupResult.checks,
    warnings,
  };
}

function printUsage() {
  console.log(`Usage:
  npm run draft:news -- prepare --type=News --source=/path/to/source.txt [--hero=/path/to/hero.jpg]
  npm run draft:news -- push --draft=/path/to/draft.md
  npm run draft:news -- push --draft=/path/to/draft.md --apply

Options:
  --type         Required article type: News, Radio, or Event
  --source       Plain text, Markdown, DOCX, or PDF manuscript
  --hero         Optional JPG, PNG, WebP, or GIF hero image
  --output-dir   Optional explicit workspace directory
  --draft        Prepared draft.md file
  --apply        Create or update the Sanity draft; omitted means dry-run`);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === "help" || command === "--help") {
    printUsage();
    return;
  }
  let result: unknown;
  if (command === "prepare") result = await prepareWorkspace(parsePrepareOptions(args));
  else if (command === "push") result = await buildSanityDraft(parsePushOptions(args));
  else throw new Error(`Unknown command: ${command}`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

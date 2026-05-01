import { createServerClient } from "@/lib/supabase/server";

type CandidateEventRow = {
  event_id: string;
};

type EventRow = {
  id: string;
  group_id: string;
  headline: string;
  summary: string | null;
  event_type: string;
  event_date: string | null;
  created_at: string;
};

type GroupRow = {
  id: string;
  name_ja: string | null;
  slug: string | null;
};

type ExistingComplementRow = {
  group_id: string;
  status: "completed" | "budget_limited" | "error" | "skipped";
};

type CostRow = {
  estimated_cost_usd: number | string | null;
};

type GroupTask = {
  groupId: string;
  groupName: string;
  allowedDomains: string[];
  events: Array<{ headline: string; summary: string | null; eventType: string; eventDate: string | null }>;
};

type GroupExternalIdRow = {
  group_id: string;
  service: string | null;
  url: string | null;
};

type MajorTopicRow = {
  title: string;
  eventDate: string;
  sourceUrl: string;
};

type UsageInfo = {
  inputTokens: number;
  outputTokens: number;
};

type OpenAiComplementResult = {
  summary: string | null;
  bullets: string[];
  sources: string[];
  majorOngoingTopics: string[];
  usage: UsageInfo;
};

export type BuildWeeklyGroupComplementsResult = {
  weekKey: string | null;
  eligibleGroups: number;
  processed: number;
  completed: number;
  budgetLimited: number;
  skippedExisting: number;
  errors: number;
  dailySpentUsd: number;
  monthlySpentUsd: number;
  dailyBudgetUsd: number;
  monthlyBudgetUsd: number;
};

const DEFAULT_MODEL = "gpt-5.4-mini";
const INPUT_RATE_USD_PER_1M = 0.75;
const OUTPUT_RATE_USD_PER_1M = 4.5;
const BUDGET_LIMIT_MESSAGE = "利用限度（料金）の上限に達しました";
const MAX_INPUT_EVENTS = 8;
const MAX_BULLETS = 3;
const MAX_MAJOR_TOPICS = 3;
const MAX_SOURCES = 8;
const MAX_ALLOWED_DOMAINS_PER_GROUP = 32;

const SERVICE_DOMAIN_FALLBACKS: Record<string, string[]> = {
  youtube: ["youtube.com", "youtu.be"],
  youtube_channel: ["youtube.com", "youtu.be"],
  spotify: ["open.spotify.com"],
  spotify_release: ["open.spotify.com"],
  x: ["x.com"],
  x_profile: ["x.com"],
  twitter: ["x.com", "twitter.com"],
  twitter_profile: ["x.com", "twitter.com"],
  instagram: ["instagram.com"],
  tiktok: ["tiktok.com"],
  ticketdive: ["ticketdive.com"],
};

function parseUsd(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return num;
}

function parseCsvDomains(value: string | undefined) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => normalizeDomain(item))
    .filter((item): item is string => Boolean(item));
}

function normalizeDomain(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  const withoutProtocol = trimmed.replace(/^https?:\/\//, "");
  const hostOnly = withoutProtocol.split("/")[0]?.split("?")[0]?.split("#")[0] ?? "";
  if (!hostOnly) return null;
  if (!/^[a-z0-9.-]+$/.test(hostOnly)) return null;
  return hostOnly.replace(/^\.+|\.+$/g, "");
}

function extractDomainFromUrl(url: string | null) {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`);
    return normalizeDomain(parsed.hostname);
  } catch {
    return normalizeDomain(trimmed);
  }
}

function isHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function parseDateOnly(value: string) {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const ts = Date.parse(`${trimmed}T00:00:00+09:00`);
  if (!Number.isFinite(ts)) return null;
  return trimmed;
}

function addMonthsDateJst(dateOnly: string, months: number) {
  const ts = Date.parse(`${dateOnly}T00:00:00+09:00`);
  if (!Number.isFinite(ts)) return dateOnly;
  const date = new Date(ts);
  date.setUTCMonth(date.getUTCMonth() + months);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isDateWithinRange(dateOnly: string, startDateOnly: string, endDateOnly: string) {
  return dateOnly >= startDateOnly && dateOnly <= endDateOnly;
}

function getTokyoDateParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const find = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    year: Number(find("year")),
    month: Number(find("month")),
    day: Number(find("day")),
  };
}

function getTokyoDayRangeUtcIso(now = new Date()) {
  const { year, month, day } = getTokyoDateParts(now);
  const startTs = Date.UTC(year, month - 1, day, -9, 0, 0, 0);
  const endTs = startTs + 24 * 60 * 60 * 1000;
  return {
    startIso: new Date(startTs).toISOString(),
    endIso: new Date(endTs).toISOString(),
  };
}

function getTokyoMonthRangeUtcIso(now = new Date()) {
  const { year, month } = getTokyoDateParts(now);
  const startTs = Date.UTC(year, month - 1, 1, -9, 0, 0, 0);
  const endTs = Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 1, -9, 0, 0, 0);
  return {
    startIso: new Date(startTs).toISOString(),
    endIso: new Date(endTs).toISOString(),
  };
}

function extractOutputText(data: Record<string, unknown>) {
  if (typeof data.output_text === "string") {
    return data.output_text;
  }

  const output = Array.isArray(data.output) ? data.output : [];
  const texts: string[] = [];

  for (const item of output) {
    const content = typeof item === "object" && item !== null ? (item as { content?: unknown }).content : null;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (typeof part !== "object" || part === null) continue;
      const p = part as { type?: unknown; text?: unknown };
      if ((p.type === "output_text" || p.type === "text") && typeof p.text === "string") {
        texts.push(p.text);
      }
    }
  }

  return texts.join("\n").trim();
}

function parseUsage(data: Record<string, unknown>, fallbackInputText: string, fallbackOutputText: string): UsageInfo {
  const usageRaw = data.usage;
  if (typeof usageRaw === "object" && usageRaw !== null) {
    const usage = usageRaw as {
      input_tokens?: unknown;
      output_tokens?: unknown;
    };
    const inputTokens = typeof usage.input_tokens === "number" ? usage.input_tokens : 0;
    const outputTokens = typeof usage.output_tokens === "number" ? usage.output_tokens : 0;
    if (inputTokens > 0 || outputTokens > 0) {
      return { inputTokens, outputTokens };
    }
  }

  return {
    inputTokens: Math.max(1, Math.ceil(fallbackInputText.length / 4)),
    outputTokens: Math.max(1, Math.ceil(fallbackOutputText.length / 4)),
  };
}

function parseJsonObject(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

function parseStringArray(value: unknown, limit: number) {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const v of value) {
    if (typeof v !== "string") continue;
    const trimmed = v.trim();
    if (!trimmed) continue;
    out.push(trimmed.slice(0, 220));
    if (out.length >= limit) break;
  }
  return out;
}

function parseMajorTopicRows(value: unknown, limit: number) {
  if (!Array.isArray(value)) return [] as MajorTopicRow[];
  const out: MajorTopicRow[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const topic = item as {
      title?: unknown;
      event_date?: unknown;
      source_url?: unknown;
    };
    const title = typeof topic.title === "string" ? topic.title.trim().slice(0, 220) : "";
    const eventDate = typeof topic.event_date === "string" ? parseDateOnly(topic.event_date) : null;
    const sourceUrl = typeof topic.source_url === "string" && isHttpUrl(topic.source_url.trim()) ? topic.source_url.trim() : "";
    if (!title || !eventDate || !sourceUrl) continue;
    out.push({ title, eventDate, sourceUrl });
    if (out.length >= limit) break;
  }
  return out;
}

function validateMajorTopicsInRange(topics: MajorTopicRow[], startDateOnly: string, endDateOnly: string, limit: number) {
  const seen = new Set<string>();
  const labels: string[] = [];
  const topicSources: string[] = [];

  for (const topic of topics) {
    if (!isDateWithinRange(topic.eventDate, startDateOnly, endDateOnly)) continue;
    const key = `${topic.eventDate}|${topic.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push(`${topic.eventDate} ${topic.title}`.slice(0, 220));
    topicSources.push(topic.sourceUrl);
    if (labels.length >= limit) break;
  }

  return { labels, topicSources };
}

function extractWebSearchSources(data: Record<string, unknown>) {
  const output = Array.isArray(data.output) ? data.output : [];
  const urls: string[] = [];
  for (const item of output) {
    if (typeof item !== "object" || item === null) continue;
    const row = item as { type?: unknown; action?: unknown };
    if (typeof row.type !== "string" || !row.type.startsWith("web_search_call")) continue;
    if (typeof row.action !== "object" || row.action === null) continue;
    const action = row.action as { sources?: unknown };
    if (!Array.isArray(action.sources)) continue;
    for (const source of action.sources) {
      if (typeof source !== "object" || source === null) continue;
      const src = source as { url?: unknown };
      if (typeof src.url !== "string") continue;
      const trimmed = src.url.trim();
      if (!trimmed || !isHttpUrl(trimmed)) continue;
      urls.push(trimmed);
    }
  }
  return urls;
}

function mergeUniqueUrls(...groups: string[][]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const group of groups) {
    for (const url of group) {
      const trimmed = url.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      out.push(trimmed);
    }
  }
  return out;
}

function estimateCostUsd(inputTokens: number, outputTokens: number) {
  return (inputTokens / 1_000_000) * INPUT_RATE_USD_PER_1M + (outputTokens / 1_000_000) * OUTPUT_RATE_USD_PER_1M;
}

async function getLatestWeekKey() {
  const supabase = createServerClient({ requireServiceRole: true });
  const res = await supabase
    .schema("imd")
    .from("weekly_digest_candidates")
    .select("week_key")
    .order("week_key", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (res.error) {
    throw new Error(`Failed to load latest week_key from weekly_digest_candidates: ${res.error.message}`);
  }
  return res.data?.week_key ?? null;
}

async function getCandidateEvents(weekKey: string) {
  const supabase = createServerClient({ requireServiceRole: true });
  const candidateRes = await supabase
    .schema("imd")
    .from("weekly_digest_candidates")
    .select("event_id")
    .eq("week_key", weekKey);
  if (candidateRes.error) {
    throw new Error(`Failed to load weekly_digest_candidates: ${candidateRes.error.message}`);
  }

  const eventIds = ((candidateRes.data ?? []) as CandidateEventRow[]).map((row) => row.event_id);
  if (eventIds.length === 0) return [] as EventRow[];

  const eventRes = await supabase
    .schema("imd")
    .from("normalized_events")
    .select("id,group_id,headline,summary,event_type,event_date,created_at")
    .in("id", eventIds)
    .order("event_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (eventRes.error) {
    throw new Error(`Failed to load normalized_events: ${eventRes.error.message}`);
  }

  return (eventRes.data ?? []) as EventRow[];
}

async function getGroupMap(groupIds: string[]) {
  if (groupIds.length === 0) return new Map<string, GroupRow>();
  const supabase = createServerClient({ requireServiceRole: true });
  const res = await supabase.schema("imd").from("groups").select("id,name_ja,slug").in("id", groupIds);
  if (res.error) {
    throw new Error(`Failed to load groups: ${res.error.message}`);
  }
  return new Map(((res.data ?? []) as GroupRow[]).map((row) => [row.id, row]));
}

async function getGroupAllowedDomains(groupIds: string[]) {
  if (groupIds.length === 0) return new Map<string, string[]>();
  const supabase = createServerClient({ requireServiceRole: true });
  const res = await supabase
    .schema("imd")
    .from("external_ids")
    .select("group_id,service,url")
    .in("group_id", groupIds);
  if (res.error) {
    throw new Error(`Failed to load external_ids for search domains: ${res.error.message}`);
  }

  const commonDomains = parseCsvDomains(process.env.IAM_OPENAI_WEB_SEARCH_COMMON_ALLOWED_DOMAINS);
  const perGroupDomains = new Map<string, string[]>();

  for (const row of (res.data ?? []) as GroupExternalIdRow[]) {
    if (!row.group_id) continue;
    const current = perGroupDomains.get(row.group_id) ?? [];
    const service = row.service?.trim().toLowerCase() ?? "";
    const fromService = SERVICE_DOMAIN_FALLBACKS[service] ?? [];
    const fromUrl = extractDomainFromUrl(row.url);
    if (fromUrl) current.push(fromUrl);
    current.push(...fromService);
    perGroupDomains.set(row.group_id, current);
  }

  for (const groupId of groupIds) {
    const merged = [...(perGroupDomains.get(groupId) ?? []), ...commonDomains]
      .map((domain) => normalizeDomain(domain))
      .filter((domain): domain is string => Boolean(domain));
    const unique = [...new Set(merged)].slice(0, MAX_ALLOWED_DOMAINS_PER_GROUP);
    perGroupDomains.set(groupId, unique);
  }

  return perGroupDomains;
}

async function getExistingComplements(weekKey: string, groupIds: string[]) {
  if (groupIds.length === 0) return new Map<string, ExistingComplementRow["status"]>();
  const supabase = createServerClient({ requireServiceRole: true });
  const res = await supabase
    .schema("imd")
    .from("weekly_group_complements")
    .select("group_id,status")
    .eq("week_key", weekKey)
    .in("group_id", groupIds);
  if (res.error) {
    throw new Error(`Failed to load existing weekly_group_complements: ${res.error.message}`);
  }
  const rows = (res.data ?? []) as ExistingComplementRow[];
  return new Map(rows.map((row) => [row.group_id, row.status]));
}

async function sumCostUsdBetween(startIso: string, endIso: string) {
  const supabase = createServerClient({ requireServiceRole: true });
  const res = await supabase
    .schema("imd")
    .from("weekly_group_complements")
    .select("estimated_cost_usd")
    .gte("created_at", startIso)
    .lt("created_at", endIso);
  if (res.error) {
    throw new Error(`Failed to load weekly_group_complements costs: ${res.error.message}`);
  }
  return ((res.data ?? []) as CostRow[]).reduce((sum, row) => {
    const value = row.estimated_cost_usd;
    if (typeof value === "number") return sum + value;
    if (typeof value === "string") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? sum + parsed : sum;
    }
    return sum;
  }, 0);
}

async function upsertComplementRow(payload: {
  weekKey: string;
  groupId: string;
  status: "completed" | "budget_limited" | "error" | "skipped";
  summary?: string | null;
  bullets?: string[];
  sources?: string[];
  majorOngoingTopics?: string[];
  model?: string | null;
  estimatedInputTokens?: number | null;
  estimatedOutputTokens?: number | null;
  estimatedCostUsd?: number | null;
  errorMessage?: string | null;
}) {
  const supabase = createServerClient({ requireServiceRole: true });
  const res = await supabase
    .schema("imd")
    .from("weekly_group_complements")
    .upsert(
      {
        week_key: payload.weekKey,
        group_id: payload.groupId,
        status: payload.status,
        summary: payload.summary ?? null,
        bullets: payload.bullets ?? [],
        sources: payload.sources ?? [],
        major_ongoing_topics: payload.majorOngoingTopics ?? [],
        model: payload.model ?? null,
        estimated_input_tokens: payload.estimatedInputTokens ?? null,
        estimated_output_tokens: payload.estimatedOutputTokens ?? null,
        estimated_cost_usd: payload.estimatedCostUsd ?? null,
        error_message: payload.errorMessage ?? null,
      },
      { onConflict: "week_key,group_id" }
    )
    .select("id")
    .single();
  if (res.error) {
    throw new Error(`Failed to upsert weekly_group_complements: ${res.error.message}`);
  }
}

async function fetchOpenAiComplement(params: {
  apiKey: string;
  model: string;
  groupName: string;
  majorStartDate: string;
  majorEndDate: string;
  allowedDomains: string[];
  events: Array<{ headline: string; summary: string | null; eventType: string; eventDate: string | null }>;
}) {
  const nowJst = params.majorStartDate;
  const systemPrompt =
    "あなたは日本の女性アイドルグループ活動状況の補足調査アシスタントです。与えられた活動情報を踏まえてWeb検索で補足情報を収集し、必ずJSONで返してください。音楽活動・ライブ活動・体制変更に関係する情報のみ採用し、同名の別分野（企業・一般人物・別ジャンル）は除外してください。推測は禁止です。";
  const eventsText = params.events
    .slice(0, MAX_INPUT_EVENTS)
    .map(
      (event, index) =>
        `${index + 1}. [${event.eventType}] ${event.eventDate ? `date=${event.eventDate}` : "date=unknown"} ${event.headline} ${event.summary ?? ""}`
    )
    .join("\n");
  const userPrompt = [
    `対象グループ: ${params.groupName}`,
    "既知アクティビティ:",
    eventsText || "(なし)",
    "",
    "要件:",
    `- 基準日(Asia/Tokyo): ${nowJst}`,
    "- 調査対象は日本の女性アイドルグループ文脈に限定",
    "- アイドル文脈でない情報（企業ニュース、同名の別人物、無関係ジャンル）は採用しない",
    "- 通常補足は、過去1週間の活動状況と今後1週間の活動予定を対象に整理",
    `- 重大ニュースは、基準日以降〜今後6か月以内（${params.majorStartDate}〜${params.majorEndDate}）に予定・発表されているもののみ対象`,
    `- major_ongoing_topics は event_date が ${params.majorStartDate}〜${params.majorEndDate} のものだけを含める`,
    "- 重大ニュース例: 新メンバー加入、解散・活動休止、大型ワンマン、大型ツアー、活動を左右する重要発表",
    "- summary は通常補足（過去1週間+今後1週間）中心で短く整理",
    "- bullets は3件まで、sources は8件まで",
    "- major_ongoing_topics は3件まで。各要素は title, event_date(YYYY-MM-DD), source_url(https://...) を必須とする",
    "- event_date が不明または範囲外の重大ニュースは出力しない",
    "- 次のJSON形式のみを返す",
    '{"summary":"...","bullets":["..."],"major_ongoing_topics":[{"title":"...","event_date":"YYYY-MM-DD","source_url":"https://..."}],"sources":["https://..."]}',
  ]
    .filter(Boolean)
    .join("\n");

  const searchTool: Record<string, unknown> = {
    type: "web_search",
    user_location: {
      type: "approximate",
      country: "JP",
      city: "Tokyo",
      region: "Tokyo",
      timezone: "Asia/Tokyo",
    },
    search_context_size: process.env.IAM_OPENAI_WEB_SEARCH_CONTEXT_SIZE ?? "medium",
  };

  if (params.allowedDomains.length > 0) {
    searchTool.filters = { allowed_domains: params.allowedDomains };
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      input: [
        { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
        { role: "user", content: [{ type: "input_text", text: userPrompt }] },
      ],
      tools: [searchTool],
      tool_choice: "required",
      include: ["web_search_call.action.sources"],
      text: {
        format: {
          type: "json_schema",
          name: "weekly_group_complement",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["summary", "bullets", "major_ongoing_topics", "sources"],
            properties: {
              summary: { type: "string" },
              bullets: { type: "array", items: { type: "string" } },
              major_ongoing_topics: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["title", "event_date", "source_url"],
                  properties: {
                    title: { type: "string" },
                    event_date: { type: "string", format: "date" },
                    source_url: { type: "string" },
                  },
                },
              },
              sources: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
      temperature: 0.1,
      max_output_tokens: 900,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI Responses API error: ${response.status} ${text.slice(0, 260)}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  const outputText = extractOutputText(data);
  const parsed = parseJsonObject(outputText);

  const summary =
    (parsed && typeof parsed.summary === "string" ? parsed.summary : outputText || null)?.trim().slice(0, 500) ?? null;
  const bullets = parseStringArray(parsed?.bullets, MAX_BULLETS);
  const majorTopicsRaw = parseMajorTopicRows(parsed?.major_ongoing_topics, MAX_MAJOR_TOPICS);
  const validatedMajorTopics = validateMajorTopicsInRange(majorTopicsRaw, params.majorStartDate, params.majorEndDate, MAX_MAJOR_TOPICS);
  const modelSources = parseStringArray(parsed?.sources, MAX_SOURCES);
  const webSearchSources = extractWebSearchSources(data).slice(0, MAX_SOURCES);
  const sources = mergeUniqueUrls(validatedMajorTopics.topicSources, modelSources, webSearchSources).slice(0, MAX_SOURCES);
  const usage = parseUsage(data, `${systemPrompt}\n${userPrompt}`, outputText);

  return { summary, bullets, majorOngoingTopics: validatedMajorTopics.labels, sources, usage } as OpenAiComplementResult;
}

function buildTasks(events: EventRow[], groupMap: Map<string, GroupRow>, domainMap: Map<string, string[]>) {
  const map = new Map<string, GroupTask>();
  for (const event of events) {
    const group = groupMap.get(event.group_id);
    const groupName = group?.name_ja?.trim() || group?.slug?.trim() || event.group_id;
    const current = map.get(event.group_id) ?? {
      groupId: event.group_id,
      groupName,
      allowedDomains: domainMap.get(event.group_id) ?? [],
      events: [],
    };
    current.events.push({
      headline: event.headline,
      summary: event.summary,
      eventType: event.event_type,
      eventDate: event.event_date,
    });
    map.set(event.group_id, current);
  }
  return [...map.values()].sort((a, b) => a.groupName.localeCompare(b.groupName));
}

export async function buildWeeklyGroupComplements(weekKeyInput?: string): Promise<BuildWeeklyGroupComplementsResult> {
  const weekKey = weekKeyInput ?? (await getLatestWeekKey());
  const defaultResult = {
    weekKey,
    eligibleGroups: 0,
    processed: 0,
    completed: 0,
    budgetLimited: 0,
    skippedExisting: 0,
    errors: 0,
    dailySpentUsd: 0,
    monthlySpentUsd: 0,
    dailyBudgetUsd: parseUsd(process.env.IAM_OPENAI_BUDGET_DAILY_USD, 2.5),
    monthlyBudgetUsd: parseUsd(process.env.IAM_OPENAI_BUDGET_MONTHLY_USD, 10),
  };

  if (!weekKey) return defaultResult;

  const model = process.env.IAM_OPENAI_MODEL || DEFAULT_MODEL;
  const apiKey = process.env.OPENAI_API_KEY;
  const dailyBudgetUsd = parseUsd(process.env.IAM_OPENAI_BUDGET_DAILY_USD, 2.5);
  const monthlyBudgetUsd = parseUsd(process.env.IAM_OPENAI_BUDGET_MONTHLY_USD, 10);
  const perCallReserveUsd = parseUsd(process.env.IAM_OPENAI_PER_CALL_RESERVE_USD, 0.12);

  const events = await getCandidateEvents(weekKey);
  const groupIds = [...new Set(events.map((event) => event.group_id))];
  const groupMap = await getGroupMap(groupIds);
  const domainMap = await getGroupAllowedDomains(groupIds);
  const tasks = buildTasks(events, groupMap, domainMap);
  const existingMap = await getExistingComplements(weekKey, tasks.map((task) => task.groupId));

  const baseDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const majorEndDate = addMonthsDateJst(baseDate, 6);

  const dayRange = getTokyoDayRangeUtcIso();
  const monthRange = getTokyoMonthRangeUtcIso();
  let dailySpentUsd = await sumCostUsdBetween(dayRange.startIso, dayRange.endIso);
  let monthlySpentUsd = await sumCostUsdBetween(monthRange.startIso, monthRange.endIso);

  const result: BuildWeeklyGroupComplementsResult = {
    weekKey,
    eligibleGroups: tasks.length,
    processed: 0,
    completed: 0,
    budgetLimited: 0,
    skippedExisting: 0,
    errors: 0,
    dailySpentUsd,
    monthlySpentUsd,
    dailyBudgetUsd,
    monthlyBudgetUsd,
  };

  for (const task of tasks) {
    const existingStatus = existingMap.get(task.groupId);
    if (existingStatus) {
      result.skippedExisting += 1;
      continue;
    }

    result.processed += 1;

    const willHitDaily = dailySpentUsd + perCallReserveUsd > dailyBudgetUsd;
    const willHitMonthly = monthlySpentUsd + perCallReserveUsd > monthlyBudgetUsd;
    if (willHitDaily || willHitMonthly) {
      await upsertComplementRow({
        weekKey,
        groupId: task.groupId,
        status: "budget_limited",
        summary: BUDGET_LIMIT_MESSAGE,
        bullets: [],
        majorOngoingTopics: [],
        sources: [],
        model,
      });
      result.budgetLimited += 1;
      continue;
    }

    if (!apiKey) {
      await upsertComplementRow({
        weekKey,
        groupId: task.groupId,
        status: "error",
        summary: null,
        bullets: [],
        majorOngoingTopics: [],
        sources: [],
        model,
        errorMessage: "Missing OPENAI_API_KEY",
      });
      result.errors += 1;
      continue;
    }

    try {
      const complement = await fetchOpenAiComplement({
        apiKey,
        model,
        groupName: task.groupName,
        majorStartDate: baseDate,
        majorEndDate,
        allowedDomains: task.allowedDomains,
        events: task.events,
      });
      const costUsd = estimateCostUsd(complement.usage.inputTokens, complement.usage.outputTokens);
      dailySpentUsd += costUsd;
      monthlySpentUsd += costUsd;

      await upsertComplementRow({
        weekKey,
        groupId: task.groupId,
        status: "completed",
        summary: complement.summary,
        bullets: complement.bullets,
        majorOngoingTopics: complement.majorOngoingTopics,
        sources: complement.sources,
        model,
        estimatedInputTokens: complement.usage.inputTokens,
        estimatedOutputTokens: complement.usage.outputTokens,
        estimatedCostUsd: costUsd,
      });
      result.completed += 1;
    } catch (error) {
      await upsertComplementRow({
        weekKey,
        groupId: task.groupId,
        status: "error",
        summary: null,
        bullets: [],
        majorOngoingTopics: [],
        sources: [],
        model,
        errorMessage: error instanceof Error ? error.message.slice(0, 600) : "Unknown error",
      });
      result.errors += 1;
    }
  }

  result.dailySpentUsd = dailySpentUsd;
  result.monthlySpentUsd = monthlySpentUsd;
  return result;
}

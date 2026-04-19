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
  slug: string | null;
  events: Array<{ headline: string; summary: string | null; eventType: string }>;
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

function parseUsd(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return num;
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

function estimateCostUsd(inputTokens: number, outputTokens: number) {
  return (inputTokens / 1_000_000) * INPUT_RATE_USD_PER_1M + (outputTokens / 1_000_000) * OUTPUT_RATE_USD_PER_1M;
}

async function getLatestWeekKey() {
  const supabase = createServerClient({ requireServiceRole: true });
  const res = await supabase
    .schema("imd")
    .from("weekly_targets")
    .select("week_key")
    .order("week_key", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (res.error) {
    throw new Error(`Failed to load latest week_key: ${res.error.message}`);
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
    .select("id,group_id,headline,summary,event_type")
    .in("id", eventIds);
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
  slug: string | null;
  events: Array<{ headline: string; summary: string | null; eventType: string }>;
}) {
  const nowJst = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date()
  );
  const systemPrompt =
    "あなたはアイドル活動状況の補足調査アシスタントです。与えられた活動情報を踏まえて、Web検索で補足情報を収集し、JSONのみで返してください。推測を避け、要点を短くまとめます。";
  const eventsText = params.events
    .slice(0, 8)
    .map((event, index) => `${index + 1}. [${event.eventType}] ${event.headline} ${event.summary ?? ""}`)
    .join("\n");
  const userPrompt = [
    `対象グループ: ${params.groupName}`,
    params.slug ? `slug: ${params.slug}` : "",
    "既知アクティビティ:",
    eventsText || "(なし)",
    "",
    "要件:",
    `- 基準日(Asia/Tokyo): ${nowJst}`,
    "- 通常補足は直近7日以内を優先",
    "- 重大ニュースは直近180日以内を対象",
    "- 重大ニュースは「現在も有効なもの」のみ major_ongoing_topics に含める",
    "- 重大ニュース例: 解散・活動休止・新メンバー加入・大型ワンマン・活動を左右する重要発表",
    "- summary は通常補足中心で短く整理",
    "- sources はURL文字列配列",
    "- bullets は3件まで",
    "- major_ongoing_topics は3件まで",
    "- 次のJSON形式のみを返す",
    '{"summary":"...","bullets":["..."],"major_ongoing_topics":["..."],"sources":["https://..."]}',
  ]
    .filter(Boolean)
    .join("\n");

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
      tools: [{ type: "web_search_preview" }],
      tool_choice: "auto",
      temperature: 0.2,
      max_output_tokens: 700,
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
  const bullets = parseStringArray(parsed?.bullets, 3);
  const majorOngoingTopics = parseStringArray(parsed?.major_ongoing_topics, 3);
  const sources = parseStringArray(parsed?.sources, 8);
  const usage = parseUsage(data, `${systemPrompt}\n${userPrompt}`, outputText);

  return { summary, bullets, majorOngoingTopics, sources, usage } as OpenAiComplementResult;
}

function buildTasks(events: EventRow[], groupMap: Map<string, GroupRow>) {
  const map = new Map<string, GroupTask>();
  for (const event of events) {
    const group = groupMap.get(event.group_id);
    const groupName = group?.name_ja?.trim() || group?.slug?.trim() || event.group_id;
    const current = map.get(event.group_id) ?? {
      groupId: event.group_id,
      groupName,
      slug: group?.slug ?? null,
      events: [],
    };
    current.events.push({
      headline: event.headline,
      summary: event.summary,
      eventType: event.event_type,
    });
    map.set(event.group_id, current);
  }
  return [...map.values()].sort((a, b) => a.groupName.localeCompare(b.groupName));
}

export async function buildWeeklyGroupComplements(): Promise<BuildWeeklyGroupComplementsResult> {
  const weekKey = await getLatestWeekKey();
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
  const tasks = buildTasks(events, groupMap);
  const existingMap = await getExistingComplements(weekKey, tasks.map((task) => task.groupId));

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
        slug: task.slug,
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

import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type VoteRow = {
  group_id: string | null;
  updated_at: string | null;
};

type GroupRow = {
  id: string;
  name_ja: string | null;
  slug: string | null;
  activity_started_month: string | null;
};

type PopularityRow = {
  group_id: string | null;
  artist_popularity: number | null;
  snapshot_date: string | null;
};

type DokonanoPoint = {
  groupId: string;
  name: string;
  slug: string | null;
  nandatteHref: string | null;
  careerMonths: number;
  attentionScore: number;
  artistPopularity: number;
  voteCount: number;
  freshnessDays: number;
  freshnessBand: "hot" | "warm" | "active" | "cool" | "stale";
  activityStartedMonth: string | null;
};

type DokonanoApiResponse = {
  points: DokonanoPoint[];
  meta: {
    totalGroups: number;
    p95Votes: number;
    weights: {
      spotify: number;
      vote: number;
    };
  };
  popularitySourceTable: string | null;
  generatedAt: string;
  error?: string;
};

const PAGE_SIZE = 1000;
const GROUP_CHUNK_SIZE = 300;
const IHC_TABLE_CANDIDATES = ["daily_ranking", "daily_rankings"] as const;
const SPOTIFY_WEIGHT = 0.7;
const VOTE_WEIGHT = 0.3;
const FRESHNESS_THRESHOLDS = {
  hot: 1,
  warm: 2,
  active: 4,
  cool: 7,
} as const;

function isMissingRelationError(message: string): boolean {
  return message.includes("does not exist") || message.includes("relation") || message.includes("schema cache");
}

function clampPopularity(value: number | null | undefined): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  if (parsed < 0) return 0;
  if (parsed > 100) return 100;
  return parsed;
}

function calculateCareerMonths(activityStartedMonth: string | null): number {
  if (!activityStartedMonth) return 0;
  const date = new Date(activityStartedMonth);
  if (Number.isNaN(date.getTime())) return 0;
  const now = new Date();
  const months = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
  return Math.max(0, months);
}

function calculateFreshnessDays(lastVoteAt: string | null): number {
  if (!lastVoteAt) return 9999;
  const ts = Date.parse(lastVoteAt);
  if (Number.isNaN(ts)) return 9999;
  const diffMs = Date.now() - ts;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

function getFreshnessBand(days: number): DokonanoPoint["freshnessBand"] {
  if (days <= FRESHNESS_THRESHOLDS.hot) return "hot";
  if (days <= FRESHNESS_THRESHOLDS.warm) return "warm";
  if (days <= FRESHNESS_THRESHOLDS.active) return "active";
  if (days <= FRESHNESS_THRESHOLDS.cool) return "cool";
  return "stale";
}

function calculateP95(values: number[]): number {
  if (values.length === 0) return 1;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  return Math.max(1, sorted[index] ?? 1);
}

async function loadVoteStatsByGroup() {
  const supabase = createServerClient();
  const stats = new Map<string, { voteCount: number; lastVoteAt: string | null }>();
  let from = 0;

  while (true) {
    const res = await supabase
      .schema("nandatte")
      .from("votes")
      .select("group_id,updated_at")
      .not("group_id", "is", null)
      .range(from, from + PAGE_SIZE - 1);

    if (res.error) {
      throw new Error(`nandatte.votes fetch failed: ${res.error.message}`);
    }

    const rows = (res.data ?? []) as VoteRow[];
    for (const row of rows) {
      if (!row.group_id) continue;
      const current = stats.get(row.group_id) ?? { voteCount: 0, lastVoteAt: null };
      const voteCount = current.voteCount + 1;
      let lastVoteAt = current.lastVoteAt;
      if (row.updated_at && (!lastVoteAt || Date.parse(row.updated_at) > Date.parse(lastVoteAt))) {
        lastVoteAt = row.updated_at;
      }
      stats.set(row.group_id, { voteCount, lastVoteAt });
    }

    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return stats;
}

async function loadGroupMeta(groupIds: string[]) {
  const supabase = createServerClient();
  const groupMap = new Map<string, GroupRow>();

  for (let i = 0; i < groupIds.length; i += GROUP_CHUNK_SIZE) {
    const chunk = groupIds.slice(i, i + GROUP_CHUNK_SIZE);
    if (chunk.length === 0) continue;

    const res = await supabase
      .schema("imd")
      .from("groups")
      .select("id,name_ja,slug,activity_started_month")
      .in("id", chunk);

    if (res.error) {
      throw new Error(`imd.groups fetch failed: ${res.error.message}`);
    }

    const rows = (res.data ?? []) as GroupRow[];
    for (const row of rows) {
      groupMap.set(row.id, row);
    }
  }

  return groupMap;
}

async function tryLoadPopularityMapByTable(tableName: string, groupIds: string[]) {
  const supabase = createServerClient();
  const target = new Set(groupIds);
  const popularityMap = new Map<string, number>();
  let from = 0;
  let guard = 0;

  while (popularityMap.size < target.size && guard < 600) {
    const res = await supabase
      .schema("ihc")
      .from(tableName)
      .select("group_id,artist_popularity,snapshot_date")
      .order("snapshot_date", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (res.error) {
      if (isMissingRelationError(res.error.message)) {
        return {
          missing: true as const,
          popularityMap: new Map<string, number>(),
        };
      }
      throw new Error(`ihc.${tableName} fetch failed: ${res.error.message}`);
    }

    const rows = (res.data ?? []) as PopularityRow[];
    if (rows.length === 0) break;

    for (const row of rows) {
      const groupId = row.group_id;
      if (!groupId || !target.has(groupId) || popularityMap.has(groupId)) continue;
      popularityMap.set(groupId, clampPopularity(row.artist_popularity));
    }

    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
    guard += 1;
  }

  return {
    missing: false as const,
    popularityMap,
  };
}

async function loadPopularityMap(groupIds: string[]) {
  for (const tableName of IHC_TABLE_CANDIDATES) {
    const result = await tryLoadPopularityMapByTable(tableName, groupIds);
    if (!result.missing) {
      return {
        tableName,
        popularityMap: result.popularityMap,
      };
    }
  }
  throw new Error("ihc.daily_ranking / ihc.daily_rankings was not found");
}

export async function GET() {
  try {
    const voteStats = await loadVoteStatsByGroup();
    const groupIds = Array.from(voteStats.keys());

    if (groupIds.length === 0) {
      return NextResponse.json<DokonanoApiResponse>(
        {
          points: [],
          meta: {
            totalGroups: 0,
            p95Votes: 1,
            weights: { spotify: SPOTIFY_WEIGHT, vote: VOTE_WEIGHT },
          },
          popularitySourceTable: null,
          generatedAt: new Date().toISOString(),
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const [groupMap, popularityResult] = await Promise.all([
      loadGroupMeta(groupIds),
      loadPopularityMap(groupIds),
    ]);

    const p95Votes = calculateP95(Array.from(voteStats.values()).map((row) => row.voteCount));
    const p95VotesAdjusted = Math.max(0, p95Votes - 1);
    const logDenominator = Math.log1p(p95VotesAdjusted);

    const points: DokonanoPoint[] = groupIds
      .map((groupId) => {
        const group = groupMap.get(groupId);
        const vote = voteStats.get(groupId);
        const voteCount = vote?.voteCount ?? 0;
        const artistPopularity = popularityResult.popularityMap.get(groupId) ?? 0;
        const p = artistPopularity / 100;
        const adjustedVotes = Math.max(0, voteCount - 1);
        const v =
          logDenominator > 0
            ? Math.min(1, Math.log1p(adjustedVotes) / logDenominator)
            : 0;
        const attentionScore = 100 * (SPOTIFY_WEIGHT * p + VOTE_WEIGHT * v);
        const freshnessDays = calculateFreshnessDays(vote?.lastVoteAt ?? null);
        const careerMonths = calculateCareerMonths(group?.activity_started_month ?? null);
        const slug = group?.slug ?? null;
        return {
          groupId,
          name: group?.name_ja ?? groupId,
          slug,
          nandatteHref: slug ? `/nandatte/${slug}` : null,
          careerMonths,
          attentionScore: Number(attentionScore.toFixed(2)),
          artistPopularity,
          voteCount,
          freshnessDays,
          freshnessBand: getFreshnessBand(freshnessDays),
          activityStartedMonth: group?.activity_started_month ?? null,
        };
      })
      .filter((row) => row.voteCount >= 1)
      .sort((a, b) => {
        if (b.attentionScore !== a.attentionScore) return b.attentionScore - a.attentionScore;
        return a.name.localeCompare(b.name, "ja");
      });

    return NextResponse.json<DokonanoApiResponse>(
      {
        points,
        meta: {
          totalGroups: points.length,
          p95Votes,
          weights: { spotify: SPOTIFY_WEIGHT, vote: VOTE_WEIGHT },
        },
        popularitySourceTable: popularityResult.tableName,
        generatedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json<DokonanoApiResponse>(
      {
        points: [],
        meta: {
          totalGroups: 0,
          p95Votes: 1,
          weights: { spotify: SPOTIFY_WEIGHT, vote: VOTE_WEIGHT },
        },
        popularitySourceTable: null,
        generatedAt: new Date().toISOString(),
        error: message,
      },
      { status: 500 }
    );
  }
}

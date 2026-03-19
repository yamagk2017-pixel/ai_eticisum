import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type VoteItemWithGroupRow = {
  group_id: string | null;
  updated_at?: string | null;
};

type MetricCountRpcRow = {
  count: number | string | null;
};

type GroupRow = {
  id: string;
  name_ja: string | null;
  slug: string | null;
};

type PopularityRow = {
  group_id: string | null;
  artist_popularity: number | null;
  snapshot_date: string | null;
};

type DounanoPoint = {
  groupId: string;
  name: string;
  slug: string | null;
  nandatteHref: string | null;
  popularity: number;
  voteCount: number;
  freshnessDays: number;
  freshnessBand: "hot" | "warm" | "active" | "cool" | "stale";
};

type DounanoScatterApiResponse = {
  points: DounanoPoint[];
  median: {
    popularity: number;
    voteCount: number;
  };
  meta: {
    totalGroups: number;
    totalVotes: number;
    totalNarrativeItems: number;
    avgItemsPerVote: number;
  };
  popularitySourceTable: string | null;
  generatedAt: string;
  error?: string;
};

const PAGE_SIZE = 1000;
const GROUP_CHUNK_SIZE = 300;
const IHC_TABLE_CANDIDATES = ["daily_ranking", "daily_rankings"] as const;
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

function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0;
  const left = sorted[middle - 1] ?? 0;
  const right = sorted[middle] ?? 0;
  return (left + right) / 2;
}

function calculateFreshnessDays(lastVoteAt: string | null): number {
  if (!lastVoteAt) return 9999;
  const ts = Date.parse(lastVoteAt);
  if (Number.isNaN(ts)) return 9999;
  const diffMs = Date.now() - ts;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

function getFreshnessBand(days: number): DounanoPoint["freshnessBand"] {
  if (days <= FRESHNESS_THRESHOLDS.hot) return "hot";
  if (days <= FRESHNESS_THRESHOLDS.warm) return "warm";
  if (days <= FRESHNESS_THRESHOLDS.active) return "active";
  if (days <= FRESHNESS_THRESHOLDS.cool) return "cool";
  return "stale";
}

function toCount(value: number | string | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

async function loadGroupIdsWithVotes() {
  const supabase = createServerClient();
  const groupIdSet = new Set<string>();
  const lastVoteAtByGroup = new Map<string, string>();
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

    const rows = (res.data ?? []) as VoteItemWithGroupRow[];
    for (const row of rows) {
      const groupId = row.group_id ?? null;
      if (!groupId) continue;
      groupIdSet.add(groupId);
      if (row.updated_at) {
        const current = lastVoteAtByGroup.get(groupId);
        if (!current || Date.parse(row.updated_at) > Date.parse(current)) {
          lastVoteAtByGroup.set(groupId, row.updated_at);
        }
      }
    }

    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return { groupIds: Array.from(groupIdSet), lastVoteAtByGroup };
}

async function loadNarrativeVoteTotalsByGroup(groupIds: string[]) {
  const supabase = createServerClient();
  const narrativeTotals = new Map<string, number>();
  let totalVotes = 0;
  let totalNarrativeItems = 0;
  const CONCURRENCY = 20;

  for (let i = 0; i < groupIds.length; i += CONCURRENCY) {
    const chunk = groupIds.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map(async (groupId) => {
        const [metricCountsRes, voteTotalRes] = await Promise.all([
          supabase.schema("nandatte").rpc("get_group_metric_counts", { p_group_id: groupId }),
          supabase.schema("nandatte").rpc("get_group_vote_total", { p_group_id: groupId }),
        ]);

        if (metricCountsRes.error) {
          throw new Error(`get_group_metric_counts failed for ${groupId}: ${metricCountsRes.error.message}`);
        }
        if (voteTotalRes.error) {
          throw new Error(`get_group_vote_total failed for ${groupId}: ${voteTotalRes.error.message}`);
        }

        const rows = (metricCountsRes.data ?? []) as MetricCountRpcRow[];
        const total = rows.reduce((sum, row) => sum + toCount(row.count), 0);
        const votes = toCount(voteTotalRes.data as number | string | null | undefined);
        return { groupId, total, votes };
      })
    );

    for (const result of results) {
      narrativeTotals.set(result.groupId, result.total);
      totalVotes += result.votes;
      totalNarrativeItems += result.total;
    }
  }

  return { narrativeTotals, totalVotes, totalNarrativeItems };
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
      .select("id,name_ja,slug")
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
    const { groupIds, lastVoteAtByGroup } = await loadGroupIdsWithVotes();

    if (groupIds.length === 0) {
      return NextResponse.json<DounanoScatterApiResponse>(
        {
          points: [],
          median: { popularity: 0, voteCount: 0 },
          meta: {
            totalGroups: 0,
            totalVotes: 0,
            totalNarrativeItems: 0,
            avgItemsPerVote: 0,
          },
          popularitySourceTable: null,
          generatedAt: new Date().toISOString(),
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const { narrativeTotals, totalVotes, totalNarrativeItems } = await loadNarrativeVoteTotalsByGroup(groupIds);

    const [groupMap, popularityResult] = await Promise.all([
      loadGroupMeta(groupIds),
      loadPopularityMap(groupIds),
    ]);

    const points: DounanoPoint[] = groupIds
      .map((groupId) => {
        const group = groupMap.get(groupId);
        const slug = group?.slug ?? null;
        return {
          groupId,
          name: group?.name_ja ?? groupId,
          slug,
          nandatteHref: slug ? `/nandatte/${slug}` : null,
          popularity: popularityResult.popularityMap.get(groupId) ?? 0,
          voteCount: narrativeTotals.get(groupId) ?? 0,
          freshnessDays: calculateFreshnessDays(lastVoteAtByGroup.get(groupId) ?? null),
          freshnessBand: getFreshnessBand(calculateFreshnessDays(lastVoteAtByGroup.get(groupId) ?? null)),
        };
      })
      .filter((row) => row.voteCount >= 1)
      .sort((a, b) => {
        if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
        return a.name.localeCompare(b.name, "ja");
      });

    const median = {
      popularity: computeMedian(points.map((row) => row.popularity)),
      voteCount: computeMedian(points.map((row) => row.voteCount)),
    };
    const avgItemsPerVote = totalVotes > 0 ? totalNarrativeItems / totalVotes : 0;

    return NextResponse.json<DounanoScatterApiResponse>(
      {
        points,
        median,
        meta: {
          totalGroups: points.length,
          totalVotes,
          totalNarrativeItems,
          avgItemsPerVote,
        },
        popularitySourceTable: popularityResult.tableName,
        generatedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json<DounanoScatterApiResponse>(
      {
        points: [],
        median: { popularity: 0, voteCount: 0 },
        meta: {
          totalGroups: 0,
          totalVotes: 0,
          totalNarrativeItems: 0,
          avgItemsPerVote: 0,
        },
        popularitySourceTable: null,
        generatedAt: new Date().toISOString(),
        error: message,
      },
      { status: 500 }
    );
  }
}

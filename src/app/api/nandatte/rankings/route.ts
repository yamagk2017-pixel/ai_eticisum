import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

type RankingRow = {
  group_id: string;
  vote_count: number;
  last_vote_at: string | null;
};

type GroupRow = {
  id: string;
  name_ja: string | null;
  slug: string | null;
  artist_image_url: string | null;
};

type RankingItem = RankingRow & {
  name: string;
  slug: string | null;
  imageUrl: string | null;
};

type RankingsApiResponse = {
  voteTop: RankingItem[];
  recentTop: RankingItem[];
  error?: string;
};

type RpcResult = {
  data: unknown[] | null;
  error: { message: string } | null;
};

async function callRankingRpc(
  kind: "vote" | "recent",
  limit: number
): Promise<RankingRow[]> {
  const supabase = createServerClient();
  const names =
    kind === "vote"
      ? ["get_vote_top20", "get_vote_top10", "get_vote_top5"]
      : ["get_recent_vote_top20", "get_recent_vote_top10", "get_recent_vote_top5"];
  const paramsList: Array<Record<string, unknown> | undefined> = [
    { p_limit: limit },
    { limit },
    { p_top: limit },
    undefined,
  ];

  let lastError: string | null = null;

  for (const name of names) {
    for (const params of paramsList) {
      const res = (params
        ? await supabase.schema("nandatte").rpc(name, params)
        : await supabase.schema("nandatte").rpc(name)) as RpcResult;

      if (!res.error) {
        return ((res.data ?? []) as RankingRow[]).slice(0, limit);
      }
      lastError = res.error.message;
    }
  }

  throw new Error(lastError ?? "NANDATTE ranking RPC unavailable");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedLimit = Number(searchParams.get("limit") ?? "10");
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(50, Math.max(1, Math.floor(requestedLimit)))
    : 10;

  try {
    const [voteRows, recentRows] = await Promise.all([
      callRankingRpc("vote", limit),
      callRankingRpc("recent", limit),
    ]);
    const groupIds = Array.from(new Set([...voteRows, ...recentRows].map((row) => row.group_id)));

    let groups: GroupRow[] = [];
    if (groupIds.length > 0) {
      const supabase = createServerClient();
      const groupsRes = await supabase
        .schema("imd")
        .from("groups")
        .select("id,name_ja,slug,artist_image_url")
        .in("id", groupIds);

      if (!groupsRes.error) {
        groups = (groupsRes.data ?? []) as GroupRow[];
      }
    }

    const groupMap = new Map(groups.map((group) => [group.id, group]));
    const toRankingItem = (row: RankingRow): RankingItem => {
      const group = groupMap.get(row.group_id);
      return {
        ...row,
        name: group?.name_ja ?? row.group_id,
        slug: group?.slug ?? null,
        imageUrl: group?.artist_image_url ?? null,
      };
    };

    return NextResponse.json<RankingsApiResponse>(
      {
        voteTop: voteRows.map(toRankingItem),
        recentTop: recentRows.map(toRankingItem),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    return NextResponse.json<RankingsApiResponse>(
      {
        voteTop: [],
        recentTop: [],
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

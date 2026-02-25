import {NextResponse} from "next/server";
import {createServerClient} from "@/lib/supabase/server";

type ChartRow = {
  label: string | null;
  count: number | null;
  kind: string | null;
  metric_id: string | null;
  freeword_id: string | null;
};

type ChartApiResponse = {
  items: {label: string; count: number}[];
  totalVotes: number | null;
  voteRank: number | null;
  rank: number | null;
  error?: string;
};

export async function GET(request: Request) {
  const {searchParams} = new URL(request.url);
  const groupId = (searchParams.get("groupId") ?? "").trim();

  if (!groupId) {
    return NextResponse.json<ChartApiResponse>(
      {items: [], totalVotes: null, voteRank: null, rank: null, error: "Missing groupId"},
      {status: 400}
    );
  }

  try {
    const supabase = createServerClient();
    const [countsRes, totalRes, voteRankRes, rankRes] = await Promise.all([
      supabase.schema("nandatte").rpc("get_group_metric_counts", {p_group_id: groupId}),
      supabase.schema("nandatte").rpc("get_group_vote_total", {p_group_id: groupId}),
      supabase.schema("nandatte").rpc("get_group_vote_rank", {p_group_id: groupId}),
      supabase
        .schema("ihc")
        .from("daily_rankings")
        .select("rank")
        .eq("group_id", groupId)
        .order("snapshot_date", {ascending: false})
        .limit(1)
        .maybeSingle(),
    ]);

    if (countsRes.error) {
      throw new Error(`get_group_metric_counts failed: ${countsRes.error.message}`);
    }
    if (totalRes.error) {
      throw new Error(`get_group_vote_total failed: ${totalRes.error.message}`);
    }

    const counts = ((countsRes.data ?? []) as ChartRow[])
      .map((row) => ({
        label: (row.label ?? "").trim(),
        count: Number(row.count ?? 0),
        kind: row.kind ?? null,
      }))
      .filter((row) => row.label && Number.isFinite(row.count))
      .sort((a, b) => (b.count !== a.count ? b.count - a.count : a.label.localeCompare(b.label, "ja")))
      .slice(0, 5)
      .map(({label, count}) => ({label, count}));

    return NextResponse.json<ChartApiResponse>({
      items: counts,
      totalVotes: Number(totalRes.data ?? 0),
      voteRank: voteRankRes.error ? null : Number(voteRankRes.data ?? null),
      rank: rankRes.error ? null : (rankRes.data?.rank ?? null),
    });
  } catch (error) {
    console.error("[news/nandatte-chart]", {groupId, error});
    return NextResponse.json<ChartApiResponse>(
      {
        items: [],
        totalVotes: null,
        voteRank: null,
        rank: null,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      {status: 500}
    );
  }
}

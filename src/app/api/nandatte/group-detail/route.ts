import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

type GroupRow = {
  id: string;
  name_ja: string | null;
  slug: string | null;
  artist_image_url: string | null;
};

type ExternalIdRow = {
  id: string;
  group_id: string;
  service: string;
  external_id: string | null;
  url: string | null;
  meta: unknown;
  created_at: string | null;
};

type GroupProfileRow = {
  body: string | null;
};

type GroupAttributeKVRow = {
  key: string;
  value: string | null;
};

type EventRow = {
  event_name: string | null;
  event_date: string | null;
  venue_name: string | null;
  event_url: string | null;
};

type MetricRow = {
  id: string;
  label: string;
  type: "fixed" | "free" | string;
};

type MetricCountRpcRow = {
  label: string | null;
  count: number | null;
  kind: string | null;
  metric_id: string | null;
  freeword_id: string | null;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const safeSlug = (searchParams.get("slug") ?? "").trim();

  if (!safeSlug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  try {
    const supabase = createServerClient({ requireServiceRole: true });

    const { data: groupData, error: groupError } = await supabase
      .schema("imd")
      .from("groups")
      .select("id,name_ja,slug,artist_image_url")
      .ilike("slug", safeSlug)
      .maybeSingle();

    if (groupError) {
      throw new Error(groupError.message);
    }

    const group = (groupData ?? null) as GroupRow | null;
    if (!group?.id) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const [
      externalIdsRes,
      profileRes,
      attributesRes,
      eventRes,
      metricsRes,
      freeMetricRes,
      metricCountsRes,
      totalVotesRes,
      voteRankRes,
      rankRes,
    ] = await Promise.all([
      supabase
        .schema("imd")
        .from("external_ids")
        .select("id,group_id,service,external_id,url,meta,created_at")
        .eq("group_id", group.id),
      supabase
        .schema("imd")
        .from("group_profiles")
        .select("body")
        .eq("group_id", group.id)
        .eq("locale", "ja")
        .maybeSingle(),
      supabase
        .schema("imd")
        .from("group_attributes")
        .select("key,value")
        .eq("group_id", group.id)
        .eq("locale", "ja")
        .in("key", ["members", "location", "agency"]),
      supabase
        .from("events")
        .select("event_name,event_date,venue_name,event_url")
        .eq("group_id", group.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .schema("nandatte")
        .from("metrics")
        .select("id,label,type")
        .eq("type", "fixed")
        .order("label", { ascending: true }),
      supabase
        .schema("nandatte")
        .from("metrics")
        .select("id")
        .eq("type", "free")
        .limit(1)
        .maybeSingle(),
      supabase
        .schema("nandatte")
        .rpc("get_group_metric_counts", { p_group_id: group.id }),
      supabase
        .schema("nandatte")
        .rpc("get_group_vote_total", { p_group_id: group.id }),
      supabase
        .schema("nandatte")
        .rpc("get_group_vote_rank", { p_group_id: group.id }),
      supabase
        .schema("ihc")
        .from("daily_rankings")
        .select("rank")
        .eq("group_id", group.id)
        .order("snapshot_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (externalIdsRes.error) console.error("[api/nandatte/group-detail] external_ids", externalIdsRes.error.message);
    if (profileRes.error) console.error("[api/nandatte/group-detail] group_profiles", profileRes.error.message);
    if (attributesRes.error) console.error("[api/nandatte/group-detail] group_attributes", attributesRes.error.message);
    if (eventRes.error) console.error("[api/nandatte/group-detail] events", eventRes.error.message);
    if (metricsRes.error) console.error("[api/nandatte/group-detail] metrics", metricsRes.error.message);
    if (freeMetricRes.error) console.error("[api/nandatte/group-detail] free metric", freeMetricRes.error.message);
    if (metricCountsRes.error) console.error("[api/nandatte/group-detail] get_group_metric_counts", metricCountsRes.error.message);
    if (totalVotesRes.error) console.error("[api/nandatte/group-detail] get_group_vote_total", totalVotesRes.error.message);
    if (voteRankRes.error) console.error("[api/nandatte/group-detail] get_group_vote_rank", voteRankRes.error.message);
    if (rankRes.error) console.error("[api/nandatte/group-detail] daily_rankings", rankRes.error.message);

    const groupAttributes = (() => {
      const rows = (attributesRes.data ?? []) as GroupAttributeKVRow[];
      if (rows.length === 0) return null;
      const map = new Map<string, string | null>();
      for (const row of rows) map.set(row.key, row.value ?? null);
      return {
        members: map.get("members") ?? null,
        location: map.get("location") ?? null,
        agency: map.get("agency") ?? null,
      };
    })();

    const metricCounts = ((metricCountsRes.data ?? []) as MetricCountRpcRow[]).map((row) => ({
      label: row.label ?? "",
      count: Number(row.count ?? 0),
      kind: row.kind ?? "fixed",
      metric_id: row.metric_id,
      freeword_id: row.freeword_id,
    }));

    const fallbackFixedMetrics = Array.from(
      new Map(
        metricCounts
          .filter((row) => row.kind === "fixed" && typeof row.metric_id === "string" && row.metric_id.length > 0)
          .map((row) => [
            row.metric_id as string,
            {
              id: row.metric_id as string,
              label: row.label,
              type: "fixed" as const,
            },
          ])
      ).values()
    ).sort((a, b) => a.label.localeCompare(b.label, "ja"));

    const effectiveFixedMetrics =
      metricsRes.error || (metricsRes.data ?? []).length === 0
        ? fallbackFixedMetrics
        : ((metricsRes.data ?? []) as MetricRow[]);
    const fallbackFreeMetricId =
      metricCounts.find((row) => row.kind === "freeword" && typeof row.metric_id === "string" && row.metric_id.length > 0)
        ?.metric_id ?? null;
    const effectiveFreeMetricId = freeMetricRes.data?.id ?? fallbackFreeMetricId;

    return NextResponse.json(
      {
        group,
        externalIds: (externalIdsRes.data ?? []) as ExternalIdRow[],
        profileBody: ((profileRes.data as GroupProfileRow | null)?.body ?? null) as string | null,
        groupAttributes,
        latestEvent: (eventRes.data as EventRow | null) ?? null,
        fixedMetrics: effectiveFixedMetrics,
        freeMetricId: effectiveFreeMetricId,
        metricCounts,
        totalVotes: totalVotesRes.error ? 0 : Number(totalVotesRes.data ?? 0),
        voteRank:
          voteRankRes.error || voteRankRes.data == null || Number.isNaN(Number(voteRankRes.data))
            ? null
            : Number(voteRankRes.data),
        rank: rankRes.error ? null : (rankRes.data?.rank ?? null),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[api/nandatte/group-detail]", { safeSlug, error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

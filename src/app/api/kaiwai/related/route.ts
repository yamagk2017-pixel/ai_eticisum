import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type VoteRow = {
  user_id: string | null;
  group_id: string | null;
};

type GroupRow = {
  id: string;
  name_ja: string | null;
  slug: string | null;
};

type RelatedItem = {
  groupId: string;
  name: string;
  slug: string | null;
  overlapUsers: number;
};

type RelatedApiResponse = {
  baseGroupId: string;
  items: RelatedItem[];
  error?: string;
};

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0)));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const baseGroupId = (searchParams.get("groupId") ?? "").trim();

  if (!baseGroupId) {
    return NextResponse.json<RelatedApiResponse>(
      { baseGroupId: "", items: [], error: "Missing groupId" },
      { status: 400 }
    );
  }

  try {
    const supabase = createServerClient({ requireServiceRole: true });

    const baseVotesRes = await supabase
      .schema("nandatte")
      .from("votes")
      .select("user_id,group_id")
      .eq("group_id", baseGroupId);

    if (baseVotesRes.error) {
      throw new Error(baseVotesRes.error.message);
    }

    const baseVotes = (baseVotesRes.data ?? []) as VoteRow[];
    const baseUserIds = uniqueStrings(baseVotes.map((row) => row.user_id));

    if (baseUserIds.length === 0) {
      return NextResponse.json<RelatedApiResponse>(
        { baseGroupId, items: [] },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const allVotesRes = await supabase
      .schema("nandatte")
      .from("votes")
      .select("user_id,group_id")
      .in("user_id", baseUserIds);

    if (allVotesRes.error) {
      throw new Error(allVotesRes.error.message);
    }

    const allVotes = (allVotesRes.data ?? []) as VoteRow[];
    const overlapMap = new Map<string, number>();

    for (const row of allVotes) {
      if (!row.user_id || !row.group_id || row.group_id === baseGroupId) continue;
      overlapMap.set(row.group_id, (overlapMap.get(row.group_id) ?? 0) + 1);
    }

    const relatedGroupIds = Array.from(overlapMap.keys());
    const groupMap = new Map<string, GroupRow>();

    if (relatedGroupIds.length > 0) {
      const groupsRes = await supabase
        .schema("imd")
        .from("groups")
        .select("id,name_ja,slug")
        .in("id", relatedGroupIds);

      if (!groupsRes.error) {
        const groups = (groupsRes.data ?? []) as GroupRow[];
        for (const group of groups) {
          groupMap.set(group.id, group);
        }
      }
    }

    const items: RelatedItem[] = relatedGroupIds
      .map((groupId) => {
        const group = groupMap.get(groupId);
        return {
          groupId,
          name: group?.name_ja ?? groupId,
          slug: group?.slug ?? null,
          overlapUsers: overlapMap.get(groupId) ?? 0,
        };
      })
      .sort((a, b) => {
        if (b.overlapUsers !== a.overlapUsers) return b.overlapUsers - a.overlapUsers;
        return a.name.localeCompare(b.name, "ja");
      });

    return NextResponse.json<RelatedApiResponse>(
      { baseGroupId, items },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json<RelatedApiResponse>(
      {
        baseGroupId,
        items: [],
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

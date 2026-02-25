import {NextResponse} from "next/server";
import {createServerClient} from "@/lib/supabase/server";

type ResultRow = {
  id: string;
  name_ja: string | null;
  slug: string | null;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const limitParam = Number(url.searchParams.get("limit") ?? "10");
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.trunc(limitParam), 1), 20) : 10;

  if (!q) {
    return NextResponse.json({items: []});
  }

  try {
    const supabase = createServerClient();
    const {data, error} = await supabase
      .schema("imd")
      .from("groups")
      .select("id,name_ja,slug")
      .ilike("name_ja", `%${q}%`)
      .order("name_ja", {ascending: true})
      .limit(limit);

    if (error) {
      console.error("[imd-groups-search]", error.message);
      return NextResponse.json({error: "Failed to query imd.groups"}, {status: 500});
    }

    const items = (data ?? [])
      .filter((row): row is ResultRow => typeof row?.id === "string" && typeof row?.name_ja === "string")
      .map((row) => ({
        imdGroupId: row.id,
        groupNameJa: row.name_ja,
        slug: row.slug,
      }));

    return NextResponse.json({items});
  } catch (error) {
    console.error("[imd-groups-search]", error);
    return NextResponse.json({error: "Unexpected error"}, {status: 500});
  }
}

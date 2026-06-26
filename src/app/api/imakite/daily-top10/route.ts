import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

type RowRecord = Record<string, unknown>;

type DailyTop10Item = {
  snapshotDate: string;
  rank: number;
  artistName: string;
  score: number;
  latestTrackName: string | null;
  spotifyEmbedUrl: string | null;
  artistImageUrl: string | null;
};

type DailyTop10Response = {
  snapshotDate: string | null;
  items: DailyTop10Item[];
  error?: string;
};

function pickString(row: RowRecord | null, keys: string[]) {
  if (!row) return null;
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function pickNumber(row: RowRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

function toSpotifyEmbedUrl(value: string | null) {
  if (!value) return null;
  if (value.includes("open.spotify.com/embed/")) {
    return value;
  }

  const match = value.match(/open\.spotify\.com\/(track|album|playlist)\/([A-Za-z0-9]+)/);
  if (!match) return null;

  return `https://open.spotify.com/embed/${match[1]}/${match[2]}`;
}

export async function GET() {
  try {
    const supabase = createServerClient();
    const latestRes = await supabase
      .schema("ihc")
      .from("daily_top20")
      .select("snapshot_date")
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestRes.error) {
      throw new Error(latestRes.error.message);
    }

    const snapshotDate = pickString((latestRes.data ?? null) as RowRecord | null, [
      "snapshot_date",
    ]);

    if (!snapshotDate) {
      return NextResponse.json<DailyTop10Response>(
        { snapshotDate: null, items: [] },
        { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
      );
    }

    const rowsRes = await supabase
      .schema("ihc")
      .from("daily_top20")
      .select("*")
      .eq("snapshot_date", snapshotDate)
      .order("rank", { ascending: true })
      .limit(10);

    if (rowsRes.error) {
      throw new Error(rowsRes.error.message);
    }

    const items = ((rowsRes.data ?? []) as RowRecord[])
      .map((row) => {
        const rank = pickNumber(row, ["rank"]) ?? 0;
        const rawEmbedUrl = pickString(row, [
          "latest_track_embed_link",
          "track_embed_link",
          "spotify_embed_url",
          "spotify_track_url",
          "track_url",
        ]);

        return {
          snapshotDate,
          rank,
          artistName: pickString(row, ["artist_name", "group_name"]) ?? "-",
          score: pickNumber(row, ["total_score", "score", "weekly_score"]) ?? 0,
          latestTrackName: pickString(row, ["latest_track_name", "track_name"]),
          spotifyEmbedUrl: toSpotifyEmbedUrl(rawEmbedUrl),
          artistImageUrl: pickString(row, ["artist_image_url", "image_url"]),
        };
      })
      .filter((item) => item.rank > 0)
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 10);

    return NextResponse.json<DailyTop10Response>(
      { snapshotDate, items },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
    );
  } catch (error) {
    return NextResponse.json<DailyTop10Response>(
      {
        snapshotDate: null,
        items: [],
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

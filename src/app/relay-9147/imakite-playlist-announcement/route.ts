import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { loadPlaylistAnnouncement } from "@/lib/imakite-playlist-announcement";

// Under /relay-9147 so the console's Basic authentication also protects this read.
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const announcement = await loadPlaylistAnnouncement(
      createServerClient({ requireServiceRole: true, noStore: true }),
    );
    return NextResponse.json({ announcement }, { headers });
  } catch (error) {
    console.error("[imakite/playlist-announcement] Failed to generate announcement", error);
    return NextResponse.json(
      { error: "プレイリストの告知文を生成できませんでした。公開済みの更新データを確認して再試行してください。" },
      { status: 500, headers },
    );
  }
}

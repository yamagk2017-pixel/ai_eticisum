import { NextRequest, NextResponse } from "next/server";
import { buildWeeklyTargets } from "@/lib/iam/weekly-targets";
import { collectRawUpdatesFromYoutube } from "@/lib/iam/raw-updates-youtube";
import { collectRawUpdatesFromSpotify } from "@/lib/iam/raw-updates-spotify";
import { normalizeEventsFromRawUpdates } from "@/lib/iam/normalize-events";
import { buildWeeklyDigestCandidates } from "@/lib/iam/weekly-digest-candidates";
import { buildWeeklyGroupComplements } from "@/lib/iam/weekly-group-complements";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    const authHeader = request.headers.get("authorization");
    if (!secret || authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startedAt = Date.now();
    const weeklyTargets = await buildWeeklyTargets();
    const rawUpdatesYoutube = await collectRawUpdatesFromYoutube();
    const rawUpdatesSpotify = await collectRawUpdatesFromSpotify();
    const normalizedEvents = await normalizeEventsFromRawUpdates();
    const weeklyDigestCandidates = await buildWeeklyDigestCandidates();
    const weeklyGroupComplements = await buildWeeklyGroupComplements();
    const completedAt = Date.now();

    return NextResponse.json({
      message: "IAM weekly pipeline completed",
      durationMs: completedAt - startedAt,
      weeklyTargets,
      rawUpdatesYoutube,
      rawUpdatesSpotify,
      normalizedEvents,
      weeklyDigestCandidates,
      weeklyGroupComplements,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

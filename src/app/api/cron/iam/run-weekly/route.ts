import { NextRequest, NextResponse } from "next/server";
import { buildWeeklyTargets } from "@/lib/iam/weekly-targets";
import { collectRawUpdatesFromYoutube } from "@/lib/iam/raw-updates-youtube";
import { normalizeEventsFromRawUpdates } from "@/lib/iam/normalize-events";

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
    const normalizedEvents = await normalizeEventsFromRawUpdates();
    const completedAt = Date.now();

    return NextResponse.json({
      message: "IAM weekly pipeline completed",
      durationMs: completedAt - startedAt,
      weeklyTargets,
      rawUpdatesYoutube,
      normalizedEvents,
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


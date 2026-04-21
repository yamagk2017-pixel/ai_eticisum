import { NextRequest, NextResponse } from "next/server";
import { buildWeeklyTargets } from "@/lib/iam/weekly-targets";
import { collectRawUpdatesFromYoutube } from "@/lib/iam/raw-updates-youtube";
import { collectRawUpdatesFromSpotify } from "@/lib/iam/raw-updates-spotify";
import { normalizeEventsFromRawUpdates } from "@/lib/iam/normalize-events";
import { buildWeeklyDigestCandidates } from "@/lib/iam/weekly-digest-candidates";
import { buildWeeklyGroupComplements } from "@/lib/iam/weekly-group-complements";
import { internalServerErrorResponse, isAuthorizedCronRequest, unauthorizedCronResponse } from "@/lib/api/cron";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorizedCronRequest(request)) return unauthorizedCronResponse();

    const startedAt = Date.now();
    const weeklyTargets = await buildWeeklyTargets();
    let rawUpdatesYoutube:
      | Awaited<ReturnType<typeof collectRawUpdatesFromYoutube>>
      | {
          weekKey: string | null;
          targetGroups: number;
          youtubeSources: number;
          discoveredVideos: number;
          processed: number;
          success: number;
          failed: number;
          skipped: number;
          errors: Array<{ groupId: string; message: string }>;
        };

    try {
      rawUpdatesYoutube = await collectRawUpdatesFromYoutube();
    } catch (error) {
      rawUpdatesYoutube = {
        weekKey: weeklyTargets.weekKey,
        targetGroups: weeklyTargets.unionCount,
        youtubeSources: 0,
        discoveredVideos: 0,
        processed: 0,
        success: 0,
        failed: 1,
        skipped: 0,
        errors: [{ groupId: "pipeline", message: error instanceof Error ? error.message : "Unknown error" }],
      };
    }

    let rawUpdatesSpotify:
      | Awaited<ReturnType<typeof collectRawUpdatesFromSpotify>>
      | {
          weekKey: string | null;
          targetGroups: number;
          spotifySources: number;
          releasesDiscovered: number;
          processed: number;
          success: number;
          failed: number;
          skipped: number;
          errors: Array<{ groupId: string; message: string }>;
        };

    try {
      rawUpdatesSpotify = await collectRawUpdatesFromSpotify();
    } catch (error) {
      rawUpdatesSpotify = {
        weekKey: weeklyTargets.weekKey,
        targetGroups: weeklyTargets.unionCount,
        spotifySources: 0,
        releasesDiscovered: 0,
        processed: 0,
        success: 0,
        failed: 1,
        skipped: 0,
        errors: [{ groupId: "pipeline", message: error instanceof Error ? error.message : "Unknown error" }],
      };
    }

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
    return internalServerErrorResponse(error);
  }
}

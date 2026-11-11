import { NextRequest, NextResponse } from "next/server";
import { buildWeeklyTargets, planWeeklyTargets } from "@/lib/iam/weekly-targets";
import { PlaylistSnapshotNotReadyError } from "@/lib/iam/weekly-target-policy";
import { internalServerErrorResponse, isAuthorizedCronRequest, unauthorizedCronResponse } from "@/lib/api/cron";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorizedCronRequest(request)) return unauthorizedCronResponse();

    const result = await buildWeeklyTargets();
    return NextResponse.json({
      message: "IAM weekly_targets updated",
      ...result,
    });
  } catch (error) {
    return internalServerErrorResponse(error);
  }
}

// POST is an authenticated, read-only preview. Older deployments return 405,
// so checking a rollout cannot accidentally invoke the existing mutating GET.
export async function POST(request: NextRequest) {
  try {
    if (!isAuthorizedCronRequest(request)) return unauthorizedCronResponse();
    const plan = await planWeeklyTargets(request.nextUrl.searchParams.get("week_key") ?? undefined);
    return NextResponse.json({ message: "IAM weekly targets preview", dryRun: true, upsertedCount: 0, ...plan });
  } catch (error) {
    if (error instanceof PlaylistSnapshotNotReadyError) {
      return NextResponse.json({ error: "playlist_snapshot_not_ready", message: error.message,
        expectedCutoff: error.cutoff, dryRun: true, upsertedCount: 0 }, { status: 409 });
    }
    return internalServerErrorResponse(error);
  }
}

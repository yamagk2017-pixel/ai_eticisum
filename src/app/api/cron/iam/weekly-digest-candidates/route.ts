import { NextRequest, NextResponse } from "next/server";
import { buildWeeklyDigestCandidates } from "@/lib/iam/weekly-digest-candidates";
import { internalServerErrorResponse, isAuthorizedCronRequest, unauthorizedCronResponse } from "@/lib/api/cron";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorizedCronRequest(request)) return unauthorizedCronResponse();

    const result = await buildWeeklyDigestCandidates();
    return NextResponse.json({
      message: "IAM weekly_digest_candidates updated",
      ...result,
    });
  } catch (error) {
    return internalServerErrorResponse(error);
  }
}

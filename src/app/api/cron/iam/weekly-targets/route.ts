import { NextRequest, NextResponse } from "next/server";
import { buildWeeklyTargets } from "@/lib/iam/weekly-targets";
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

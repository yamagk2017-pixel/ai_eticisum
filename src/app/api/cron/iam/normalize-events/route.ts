import { NextRequest, NextResponse } from "next/server";
import { normalizeEventsFromRawUpdates } from "@/lib/iam/normalize-events";
import { internalServerErrorResponse, isAuthorizedCronRequest, unauthorizedCronResponse } from "@/lib/api/cron";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorizedCronRequest(request)) return unauthorizedCronResponse();

    const result = await normalizeEventsFromRawUpdates();
    return NextResponse.json({
      message: "IAM normalized_events updated",
      ...result,
    });
  } catch (error) {
    return internalServerErrorResponse(error);
  }
}

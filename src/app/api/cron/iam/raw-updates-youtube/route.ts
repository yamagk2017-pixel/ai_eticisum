import { NextRequest, NextResponse } from "next/server";
import { collectRawUpdatesFromYoutube } from "@/lib/iam/raw-updates-youtube";
import { internalServerErrorResponse, isAuthorizedCronRequest, unauthorizedCronResponse } from "@/lib/api/cron";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorizedCronRequest(request)) return unauthorizedCronResponse();

    const result = await collectRawUpdatesFromYoutube();
    return NextResponse.json({
      message: "IAM raw_updates (youtube) collected",
      ...result,
    });
  } catch (error) {
    return internalServerErrorResponse(error);
  }
}

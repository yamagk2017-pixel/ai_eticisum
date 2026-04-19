import { NextRequest, NextResponse } from "next/server";
import { normalizeEventsFromRawUpdates } from "@/lib/iam/normalize-events";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    const authHeader = request.headers.get("authorization");
    if (!secret || authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await normalizeEventsFromRawUpdates();
    return NextResponse.json({
      message: "IAM normalized_events updated",
      ...result,
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


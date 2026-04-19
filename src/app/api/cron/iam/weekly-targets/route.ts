import { NextRequest, NextResponse } from "next/server";
import { buildWeeklyTargets } from "@/lib/iam/weekly-targets";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    const authHeader = request.headers.get("authorization");
    if (!secret || authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await buildWeeklyTargets();
    return NextResponse.json({
      message: "IAM weekly_targets updated",
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


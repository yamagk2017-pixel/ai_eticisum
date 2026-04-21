import { NextRequest, NextResponse } from "next/server";

export function isAuthorizedCronRequest(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  return Boolean(secret && authHeader === `Bearer ${secret}`);
}

export function unauthorizedCronResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function internalServerErrorResponse(error: unknown) {
  return NextResponse.json(
    {
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    },
    { status: 500 }
  );
}

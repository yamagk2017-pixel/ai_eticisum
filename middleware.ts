import { NextRequest, NextResponse } from "next/server";

const REALM = "Restricted";

function unauthorizedResponse() {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${REALM}"`,
      "Cache-Control": "no-store",
    },
  });
}

export function middleware(request: NextRequest) {
  const expectedUser = process.env.RELAY9147_BASIC_AUTH_USER;
  const expectedPass = process.env.RELAY9147_BASIC_AUTH_PASS;

  // If credentials are not configured, fail closed.
  if (!expectedUser || !expectedPass) return unauthorizedResponse();

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Basic ")) return unauthorizedResponse();

  const encoded = authHeader.slice(6).trim();
  let decoded = "";

  try {
    decoded = atob(encoded);
  } catch {
    return unauthorizedResponse();
  }

  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex === -1) return unauthorizedResponse();

  const user = decoded.slice(0, separatorIndex);
  const pass = decoded.slice(separatorIndex + 1);

  if (user !== expectedUser || pass !== expectedPass) {
    return unauthorizedResponse();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/relay-9147/:path*"],
};

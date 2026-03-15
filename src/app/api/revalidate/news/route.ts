import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

type RevalidatePayload = {
  slug?: string | { current?: string | null } | null;
  wpId?: number | string;
  wpPostId?: number | string;
  document?: {
    slug?: { current?: string | null } | null;
    wpPostId?: number | string | null;
  } | null;
  result?: {
    slug?: { current?: string | null } | null;
    wpPostId?: number | string | null;
  } | null;
  paths?: string[];
};

function sanitizePath(value: string): string | null {
  const path = value.trim();
  if (!path.startsWith("/news")) return null;
  if (path.includes("..")) return null;
  return path;
}

function pickSlug(payload: RevalidatePayload): string | null {
  if (typeof payload.slug === "string" && payload.slug.trim()) return payload.slug.trim();
  if (payload.slug && typeof payload.slug === "object") {
    const nested = payload.slug.current;
    if (typeof nested === "string" && nested.trim()) return nested.trim();
  }
  const fromDocument = payload.document?.slug?.current;
  if (typeof fromDocument === "string" && fromDocument.trim()) return fromDocument.trim();
  const fromResult = payload.result?.slug?.current;
  if (typeof fromResult === "string" && fromResult.trim()) return fromResult.trim();
  return null;
}

function pickWpId(payload: RevalidatePayload): number | null {
  const candidates = [payload.wpId, payload.wpPostId, payload.document?.wpPostId, payload.result?.wpPostId];
  for (const value of candidates) {
    const wpId = Number(value);
    if (Number.isFinite(wpId) && wpId > 0) return Math.trunc(wpId);
  }
  return null;
}

export async function POST(request: NextRequest) {
  const configuredToken = process.env.NEWS_REVALIDATE_TOKEN;
  if (!configuredToken) {
    return NextResponse.json({ error: "Missing NEWS_REVALIDATE_TOKEN" }, { status: 500 });
  }

  const requestToken =
    request.headers.get("x-revalidate-token") ??
    request.nextUrl.searchParams.get("token") ??
    "";
  if (requestToken !== configuredToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: RevalidatePayload = {};
  try {
    payload = (await request.json()) as RevalidatePayload;
  } catch {
    // Empty body is allowed.
  }

  const paths = new Set<string>(["/news"]);
  const slug = pickSlug(payload);
  if (slug) paths.add(`/news/${slug}`);

  const wpId = pickWpId(payload);
  if (wpId) paths.add(`/news/wp/${wpId}`);

  if (Array.isArray(payload.paths)) {
    for (const rawPath of payload.paths) {
      if (typeof rawPath !== "string") continue;
      const safePath = sanitizePath(rawPath);
      if (safePath) paths.add(safePath);
    }
  }

  for (const path of paths) revalidatePath(path);

  return NextResponse.json({
    ok: true,
    revalidated: Array.from(paths),
    revalidatedAt: new Date().toISOString(),
  });
}

import {NextResponse} from "next/server";
import {getPreviewShareOrigin, normalizePreviewPath, signPreviewLink} from "@/lib/preview/share-link";

function getTtlMinutes(value: string | null) {
  const defaultMinutes = 60 * 24 * 5;
  const n = Number(value ?? String(defaultMinutes));
  if (!Number.isFinite(n)) return defaultMinutes;
  return Math.min(60 * 24 * 30, Math.max(1, Math.trunc(n)));
}

function isAuthorized(url: URL) {
  const provided = url.searchParams.get("secret")?.trim();
  const expected = process.env.PREVIEW_SHARE_SECRET?.trim();
  return Boolean(provided && expected && provided === expected);
}

function issueShareLink(pathValue: string | null, ttlValue: string | null) {
  const path = normalizePreviewPath(pathValue);
  if (!path) {
    return NextResponse.json(
      {error: "Invalid preview path"},
      {status: 400, headers: {"Cache-Control": "private, no-store, max-age=0"}}
    );
  }
  const ttlMinutes = getTtlMinutes(ttlValue);
  const exp = Math.floor(Date.now() / 1000) + ttlMinutes * 60;
  const sig = signPreviewLink(path, exp);
  const origin = getPreviewShareOrigin();

  const previewUrl = `${origin}/api/draft/enable?path=${encodeURIComponent(path)}&exp=${exp}&sig=${encodeURIComponent(sig)}`;

  return NextResponse.json(
    {
      previewUrl,
      path,
      expiresAt: new Date(exp * 1000).toISOString(),
      ttlMinutes,
    },
    {headers: {"Cache-Control": "private, no-store, max-age=0"}}
  );
}

function unauthorized() {
  return NextResponse.json({error: "Unauthorized"}, {
    status: 401, headers: {"Cache-Control": "private, no-store, max-age=0"},
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!isAuthorized(url)) return unauthorized();
  return issueShareLink(url.searchParams.get("path"), url.searchParams.get("ttlMinutes"));
}

export async function POST(request: Request) {
  const expected = process.env.PREVIEW_SHARE_SECRET?.trim();
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) return unauthorized();
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({error: "Invalid request"}, {status: 400});
  }
  return issueShareLink(
    typeof body?.path === "string" ? body.path : null,
    typeof body?.ttlMinutes === "number" ? String(body.ttlMinutes) : null,
  );
}

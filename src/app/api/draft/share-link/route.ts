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

export async function GET(request: Request) {
  const url = new URL(request.url);

  if (!isAuthorized(url)) {
    return NextResponse.json({error: "Unauthorized"}, {status: 401});
  }

  const path = normalizePreviewPath(url.searchParams.get("path"));
  if (!path) {
    return NextResponse.json(
      {error: "Invalid preview path"},
      {status: 400, headers: {"Cache-Control": "private, no-store, max-age=0"}}
    );
  }
  const ttlMinutes = getTtlMinutes(url.searchParams.get("ttlMinutes"));
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

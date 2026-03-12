import {NextResponse} from "next/server";
import {getPreviewShareOrigin, signPreviewLink} from "@/lib/preview/share-link";

function toSafePath(value: string | null) {
  const path = typeof value === "string" ? value.trim() : "";
  if (!path) return "/";
  if (!path.startsWith("/")) return "/";
  if (path.startsWith("//")) return "/";
  return path;
}

function getTtlMinutes(value: string | null) {
  const n = Number(value ?? "60");
  if (!Number.isFinite(n)) return 60;
  return Math.min(60 * 24 * 7, Math.max(1, Math.trunc(n)));
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

  const path = toSafePath(url.searchParams.get("path"));
  const ttlMinutes = getTtlMinutes(url.searchParams.get("ttlMinutes"));
  const exp = Math.floor(Date.now() / 1000) + ttlMinutes * 60;
  const sig = signPreviewLink(path, exp);
  const origin = getPreviewShareOrigin();

  const previewUrl = `${origin}/api/draft/enable?path=${encodeURIComponent(path)}&exp=${exp}&sig=${encodeURIComponent(sig)}`;

  return NextResponse.json({
    previewUrl,
    path,
    expiresAt: new Date(exp * 1000).toISOString(),
    ttlMinutes,
  });
}


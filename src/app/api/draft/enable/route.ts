import {draftMode} from "next/headers";
import {NextResponse} from "next/server";
import {
  MAX_PREVIEW_TTL_SECONDS,
  normalizePreviewPath,
  verifyPreviewLinkSignature,
} from "@/lib/preview/share-link";

function unauthorized(message: string) {
  return new NextResponse(message, {
    status: 401,
    headers: {"Cache-Control": "private, no-store, max-age=0"},
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const path = normalizePreviewPath(url.searchParams.get("path"));
  const expRaw = url.searchParams.get("exp");
  const sig = url.searchParams.get("sig");

  if (!path || !expRaw || !sig || !/^\d+$/.test(expRaw) || !/^[A-Za-z0-9_-]{43}$/.test(sig)) {
    return unauthorized("Invalid preview link");
  }

  const exp = Number(expRaw);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(exp) || exp < now) {
    return unauthorized("Preview link expired");
  }
  if (exp > now + MAX_PREVIEW_TTL_SECONDS) {
    return unauthorized("Preview link expiry is too far in the future");
  }

  try {
    if (!verifyPreviewLinkSignature(path, exp, sig)) {
      return unauthorized("Invalid preview signature");
    }
  } catch {
    return unauthorized("Invalid preview signature");
  }

  const draft = await draftMode();
  draft.enable();
  const response = NextResponse.redirect(new URL(path, request.url));
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

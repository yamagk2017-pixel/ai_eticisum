import {validatePreviewUrl} from "@sanity/preview-url-secret";
import type {SanityClientLike} from "@sanity/preview-url-secret";
import {getSanityClient} from "@/lib/sanity/client";
import {getPreviewShareOrigin, normalizePreviewPath, signPreviewLink, MAX_PREVIEW_TTL_SECONDS} from "./share-link";

export async function validateStudioPreviewSecret(secret: string, client?: SanityClientLike) {
  const url = new URL("https://preview.invalid/");
  url.searchParams.set("sanity-preview-secret", secret);
  // Sanity validates this against the configured project's dataset. The browser
  // never receives the server read token or either environment signing secret.
  const result = await validatePreviewUrl(client ?? getSanityClient(), url.href);
  return result.isValid;
}

const headers = {"Cache-Control": "private, no-store, max-age=0"};

export function createStudioPreviewHandler(validate = validateStudioPreviewSecret) {
  return async function handle(request: Request) {
    const secret = request.headers.get("x-sanity-preview-secret")?.trim();
    if (!secret || secret.length > 256) return Response.json({error: "Sanityにログインし直してください。"}, {status: 401, headers});
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return Response.json({error: "Invalid origin"}, {status: 403, headers});
    let body;
    try {body = await request.json();} catch {return Response.json({error: "Invalid request"}, {status: 400, headers});}
    const path = normalizePreviewPath(typeof body?.path === "string" ? body.path : null);
    if (!path) return Response.json({error: "Invalid preview path"}, {status: 400, headers});
    try {
      if (!await validate(secret)) return Response.json({error: "プレビューの認証が切れました。Sanityから開き直してください。"}, {status: 401, headers});
      const requested = typeof body?.ttlMinutes === "number" && Number.isFinite(body.ttlMinutes) ? body.ttlMinutes : 60;
      const ttlMinutes = Math.min(MAX_PREVIEW_TTL_SECONDS / 60, Math.max(1, Math.trunc(requested)));
      const exp = Math.floor(Date.now() / 1000) + ttlMinutes * 60;
      const sig = signPreviewLink(path, exp);
      const previewUrl = `${getPreviewShareOrigin()}/api/draft/enable?${new URLSearchParams({path, exp: String(exp), sig})}`;
      return Response.json({previewUrl, path, ttlMinutes, expiresAt: new Date(exp * 1000).toISOString()}, {headers});
    } catch {
      return Response.json({error: "プレビューの認証に失敗しました。時間をおいて再度お試しください。"}, {status: 503, headers});
    }
  };
}

import {createHmac, timingSafeEqual} from "node:crypto";

export const MAX_PREVIEW_TTL_SECONDS = 60 * 60 * 24 * 30;

function base64UrlEncode(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlToBuffer(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

function getSigningSecret() {
  const secret = process.env.PREVIEW_LINK_SECRET?.trim();
  if (!secret) {
    throw new Error("PREVIEW_LINK_SECRET is not configured");
  }
  return secret;
}

function createPayload(path: string, exp: number) {
  return `${path}\n${exp}`;
}

export function normalizePreviewPath(value: string | null | undefined) {
  const path = typeof value === "string" ? value.trim() : "";
  if (!path || path.length > 2048) return null;
  if (/[\\\u0000-\u001f\u007f]/.test(path)) return null;
  if (path.includes("..") || path.startsWith("//")) return null;
  if (path !== "/news" && !path.startsWith("/news/") && !path.startsWith("/news?")) {
    return null;
  }

  try {
    const parsed = new URL(path, "https://preview.invalid");
    if (parsed.origin !== "https://preview.invalid") return null;
    if (parsed.pathname !== "/news" && !parsed.pathname.startsWith("/news/")) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function signPreviewLink(path: string, exp: number) {
  const secret = getSigningSecret();
  const payload = createPayload(path, exp);
  const signature = createHmac("sha256", secret).update(payload).digest();
  return base64UrlEncode(signature);
}

export function verifyPreviewLinkSignature(path: string, exp: number, signature: string) {
  const expected = signPreviewLink(path, exp);
  const expectedBuf = base64UrlToBuffer(expected);
  const providedBuf = base64UrlToBuffer(signature);
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

export function getPreviewShareOrigin() {
  const fromEnv =
    process.env.PREVIEW_SHARE_ORIGIN?.trim() ||
    process.env.SANITY_STUDIO_PREVIEW_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_SITE_ORIGIN?.trim() ||
    "https://www.musicite.net";
  return fromEnv.replace(/\/$/, "");
}

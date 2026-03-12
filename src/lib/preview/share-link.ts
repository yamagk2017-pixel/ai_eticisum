import {createHmac, timingSafeEqual} from "node:crypto";

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


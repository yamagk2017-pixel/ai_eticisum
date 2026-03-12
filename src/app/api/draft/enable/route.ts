import {draftMode} from "next/headers";
import {redirect} from "next/navigation";
import {verifyPreviewLinkSignature} from "@/lib/preview/share-link";

function toSafePath(value: string | null) {
  const path = typeof value === "string" ? value.trim() : "";
  if (!path) return "/";
  if (!path.startsWith("/")) return "/";
  if (path.startsWith("//")) return "/";
  return path;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const path = toSafePath(url.searchParams.get("path"));
  const expRaw = url.searchParams.get("exp");
  const sig = url.searchParams.get("sig");

  if (expRaw || sig) {
    if (!expRaw || !sig || !/^\d+$/.test(expRaw)) {
      return new Response("Invalid preview link", {status: 401});
    }

    const exp = Number(expRaw);
    const now = Math.floor(Date.now() / 1000);
    if (exp < now) {
      return new Response("Preview link expired", {status: 401});
    }

    if (!verifyPreviewLinkSignature(path, exp, sig)) {
      return new Response("Invalid preview signature", {status: 401});
    }
  }

  const draft = await draftMode();
  draft.enable();
  redirect(path);
}

import {draftMode} from "next/headers";
import {redirect} from "next/navigation";

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
  const draft = await draftMode();
  draft.disable();
  redirect(path);
}


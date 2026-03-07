import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

type ReactionType = "tweet_like" | "tag_like";

type ReactionRequestBody = {
  tweetId?: string;
  type?: ReactionType;
  tweetTagId?: string;
};

type ReactionApiResponse = {
  ok: boolean;
  added: boolean;
  count?: number | null;
  error?: string;
};

function parseBody(body: ReactionRequestBody) {
  const tweetId = body.tweetId?.trim();
  const type = body.type;
  const tweetTagId = body.tweetTagId?.trim() ?? "";

  if (!tweetId || (type !== "tweet_like" && type !== "tag_like")) return null;
  if (type === "tag_like" && !tweetTagId) return null;
  if (type === "tweet_like" && tweetTagId) return null;
  return { tweetId, type, tweetTagId };
}

export async function POST(request: Request) {
  let body: ReactionRequestBody;
  try {
    body = (await request.json()) as ReactionRequestBody;
  } catch {
    return NextResponse.json<ReactionApiResponse>(
      { ok: false, added: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = parseBody(body);
  if (!parsed) {
    return NextResponse.json<ReactionApiResponse>(
      { ok: false, added: false, error: "Invalid payload" },
      { status: 400 }
    );
  }

  const userCookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith("buzzttara_user_key="));
  const existingUserKey = userCookie?.split("=")[1] ?? null;
  const userKey = existingUserKey || randomUUID();

  const supabase = createServerClient();
  const reactionRow = {
    user_key: userKey,
    tweet_id: parsed.tweetId,
    target_type: parsed.type,
    tweet_tag_id: parsed.tweetTagId,
  };

  const insertRes = await supabase.from("tweet_reactions").insert(reactionRow);
  if (insertRes.error) {
    if (insertRes.error.code === "23505") {
      const response = NextResponse.json<ReactionApiResponse>({ ok: true, added: false }, { status: 200 });
      if (!existingUserKey) {
        response.cookies.set("buzzttara_user_key", userKey, {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 365,
        });
      }
      return response;
    }

    return NextResponse.json<ReactionApiResponse>(
      { ok: false, added: false, error: insertRes.error.message },
      { status: 500 }
    );
  }

  if (parsed.type === "tweet_like") {
    const currentRes = await supabase
      .from("tweets")
      .select("like_count")
      .eq("id", parsed.tweetId)
      .maybeSingle();
    if (currentRes.error || !currentRes.data) {
      return NextResponse.json<ReactionApiResponse>(
        { ok: false, added: false, error: currentRes.error?.message ?? "Tweet not found" },
        { status: 500 }
      );
    }
    const current = typeof currentRes.data.like_count === "number" ? currentRes.data.like_count : 0;
    const next = current + 1;
    const updateRes = await supabase.from("tweets").update({ like_count: next }).eq("id", parsed.tweetId);
    if (updateRes.error) {
      return NextResponse.json<ReactionApiResponse>(
        { ok: false, added: false, error: updateRes.error.message },
        { status: 500 }
      );
    }
    const response = NextResponse.json<ReactionApiResponse>({ ok: true, added: true, count: next }, { status: 200 });
    if (!existingUserKey) {
      response.cookies.set("buzzttara_user_key", userKey, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    return response;
  }

  const currentTagRes = await supabase
    .from("tweet_tags")
    .select("like_count")
    .eq("id", parsed.tweetTagId)
    .eq("tweet_id", parsed.tweetId)
    .maybeSingle();
  if (currentTagRes.error || !currentTagRes.data) {
    return NextResponse.json<ReactionApiResponse>(
      { ok: false, added: false, error: currentTagRes.error?.message ?? "Tag mapping not found" },
      { status: 500 }
    );
  }
  const currentTagCount = typeof currentTagRes.data.like_count === "number" ? currentTagRes.data.like_count : 0;
  const nextTagCount = currentTagCount + 1;
  const updateTagRes = await supabase
    .from("tweet_tags")
    .update({ like_count: nextTagCount })
    .eq("id", parsed.tweetTagId)
    .eq("tweet_id", parsed.tweetId);
  if (updateTagRes.error) {
    return NextResponse.json<ReactionApiResponse>(
      { ok: false, added: false, error: updateTagRes.error.message },
      { status: 500 }
    );
  }

  const response = NextResponse.json<ReactionApiResponse>(
    { ok: true, added: true, count: nextTagCount },
    { status: 200 }
  );
  if (!existingUserKey) {
    response.cookies.set("buzzttara_user_key", userKey, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}

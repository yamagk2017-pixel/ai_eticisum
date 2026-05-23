import { NextResponse } from "next/server";
import { fetchTweet } from "react-tweet/api";

const TWEET_ID = /^[0-9]+$/;

type TweetApiResponse = {
  data: Record<string, unknown> | null;
  notFound?: true;
  tombstone?: true;
  error?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeEntities(value: unknown): Record<string, unknown> {
  const source = isRecord(value) ? value : {};
  const media = toArray(source.media);

  return {
    ...source,
    hashtags: toArray(source.hashtags),
    urls: toArray(source.urls),
    user_mentions: toArray(source.user_mentions),
    symbols: toArray(source.symbols),
    ...(media.length > 0 ? { media } : {}),
  };
}

function normalizeTweet(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null;

  const normalized: Record<string, unknown> = {
    ...value,
    entities: normalizeEntities(value.entities),
  };

  if (value.quoted_tweet) {
    normalized.quoted_tweet = normalizeTweet(value.quoted_tweet);
  }
  if (value.parent) {
    normalized.parent = normalizeTweet(value.parent);
  }

  return normalized;
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = rawId?.trim();

  if (!id || id.length > 40 || !TWEET_ID.test(id)) {
    return NextResponse.json<TweetApiResponse>(
      { data: null, error: "Invalid tweet id" },
      { status: 400 }
    );
  }

  try {
    const { data, notFound, tombstone } = await fetchTweet(id);

    if (notFound) {
      return NextResponse.json<TweetApiResponse>(
        { data: null, notFound: true },
        { status: 404 }
      );
    }
    if (tombstone) {
      return NextResponse.json<TweetApiResponse>(
        { data: null, tombstone: true },
        { status: 404 }
      );
    }

    const normalized = normalizeTweet(data);
    if (!normalized) {
      return NextResponse.json<TweetApiResponse>(
        { data: null, error: "Tweet payload is empty" },
        { status: 404 }
      );
    }

    return NextResponse.json<TweetApiResponse>({ data: normalized });
  } catch (error) {
    console.error("[api/tweet/[id]]", { id, error });
    return NextResponse.json<TweetApiResponse>(
      { data: null, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

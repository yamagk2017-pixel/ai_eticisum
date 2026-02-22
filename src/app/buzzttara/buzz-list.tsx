"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SafeTweetEmbed } from "./safe-tweet-embed";

type Status = "idle" | "loading" | "error";

type TagRow = {
  id: string;
  name: string | null;
  icon: string | null;
};

type TweetTagRow = {
  id: string;
  like_count: number | null;
  tags: TagRow | null;
};

type TweetRow = {
  id: string;
  tweet_url: string;
  idol_name: string;
  group_id: string | null;
  view_count: number | null;
  likeCount: number | null;
  created_at: string | null;
  admin_comment: string | null;
  tweet_tags: TweetTagRow[];
};

type GroupMapRow = { id: string; name_ja: string | null; slug: string | null };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function normalizeTweet(rawRow: unknown): TweetRow | null {
  const row = asRecord(rawRow);
  const id = typeof row.id === "string" ? row.id : null;
  const tweetUrl = typeof row.tweet_url === "string" ? row.tweet_url : null;
  const idolName = typeof row.idol_name === "string" ? row.idol_name : null;
  if (!id || !tweetUrl || !idolName) return null;

  const rawTweetTags = Array.isArray(row.tweet_tags) ? row.tweet_tags : [];
  const tweetTags: TweetTagRow[] = rawTweetTags.map((item) => {
    const tagRow = asRecord(asRecord(item).tags);
    return {
      id: typeof asRecord(item).id === "string" ? (asRecord(item).id as string) : crypto.randomUUID(),
      like_count:
        typeof asRecord(item).like_count === "number" ? (asRecord(item).like_count as number) : null,
      tags: {
        id: typeof tagRow.id === "string" ? tagRow.id : "",
        name: typeof tagRow.name === "string" ? tagRow.name : null,
        icon: typeof tagRow.icon === "string" ? tagRow.icon : null,
      },
    };
  });

  return {
    id,
    tweet_url: tweetUrl,
    idol_name: idolName,
    group_id: typeof row.group_id === "string" ? row.group_id : null,
    view_count: typeof row.view_count === "number" ? row.view_count : null,
    likeCount: typeof row.like_count === "number" ? row.like_count : null,
    created_at: typeof row.created_at === "string" ? row.created_at : null,
    admin_comment: typeof row.admin_comment === "string" ? row.admin_comment : null,
    tweet_tags: tweetTags,
  };
}

function formatCount(value: number | null): string {
  if (value === null) return "-";
  return new Intl.NumberFormat("ja-JP").format(value);
}

function extractTweetId(tweetUrl: string): string | null {
  const match = tweetUrl.match(/status\/(\d+)/);
  return match?.[1] ?? null;
}

export function BuzzList() {
  const [tweets, setTweets] = useState<TweetRow[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");
  const [groupsMap, setGroupsMap] = useState<Map<string, GroupMapRow>>(new Map());

  useEffect(() => {
    const run = async () => {
      setStatus("loading");
      const supabase = createClient();

      const { data, error } = await supabase
        .from("tweets")
        .select("id,tweet_url,idol_name,group_id,view_count,like_count,created_at,admin_comment,tweet_tags(id,like_count,tags(id,name,icon))")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        setStatus("error");
        setMessage(error.message);
        return;
      }

      const normalized = ((data ?? []) as unknown[])
        .map((row) => normalizeTweet(row))
        .filter((row): row is TweetRow => row !== null);
      setTweets(normalized);

      const groupIds = Array.from(new Set(normalized.map((row) => row.group_id).filter((id): id is string => !!id)));
      if (groupIds.length > 0) {
        const { data: groupRows } = await supabase
          .schema("imd")
          .from("groups")
          .select("id,name_ja,slug")
          .in("id", groupIds);

        const map = new Map<string, GroupMapRow>(
          ((groupRows ?? []) as GroupMapRow[]).map((row) => [row.id, row])
        );
        setGroupsMap(map);
      } else {
        setGroupsMap(new Map());
      }

      setStatus("idle");
    };

    run().catch((err: unknown) => {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Unknown error");
    });
  }, []);

  const countLabel = useMemo(() => `${tweets.length.toString()}件`, [tweets.length]);

  if (status === "error") {
    return (
      <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-100">
        投稿データの取得に失敗しました: {message}
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">{countLabel}のバズッタラ</h2>
        </div>
      </div>

      {status === "loading" && <p className="text-sm text-zinc-400">読み込み中...</p>}

      {status === "idle" && tweets.length === 0 && (
        <p className="text-sm text-zinc-400">表示できる投稿がありません。</p>
      )}

      <div className="columns-1 gap-4 md:columns-2 lg:columns-3">
        {tweets.map((tweet) => {
          const group = tweet.group_id ? groupsMap.get(tweet.group_id) : undefined;
          const tweetId = extractTweetId(tweet.tweet_url);
          return (
          <article
            key={tweet.id}
            className="mb-4 break-inside-avoid rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 transition hover:border-zinc-600"
          >
            <div className="flex items-baseline gap-3">
              <div>
                {group?.slug ? (
                  <Link
                    href={`/nandatte/${group.slug}`}
                    className="text-sm text-zinc-400 underline decoration-zinc-500/80 underline-offset-4 hover:text-zinc-200"
                  >
                    {group.name_ja ?? "グループ未設定"}
                  </Link>
                ) : (
                  <p className="text-sm text-zinc-400">{group?.name_ja ?? "グループ未設定"}</p>
                )}
                <div className="mt-1 flex items-baseline gap-2">
                  <Link
                    href={`/buzzttara/tweet/${tweet.id}`}
                    className="text-xl font-semibold text-white underline decoration-zinc-300/80 underline-offset-4 hover:text-cyan-200"
                  >
                    {tweet.idol_name}
                  </Link>
                  <span className="text-sm text-zinc-300">さんのバズったポスト</span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-300">
              <span className="rounded-full border border-zinc-700 px-2 py-1">
                view {formatCount(tweet.view_count)}
              </span>
              <span className="rounded-full border border-zinc-700 px-2 py-1">
                いいね {formatCount(tweet.likeCount)}
              </span>
                {tweet.tweet_tags
                  .filter((item) => item.tags?.name !== "SEXY" && item.tags?.name !== "Wow")
                  .map((item) => (
                    <span
                      key={item.id}
                      className="rounded-full border border-zinc-700 bg-zinc-800/40 px-2 py-1 text-zinc-200"
                    >
                      {(item.tags?.icon ?? "") + " " + (item.tags?.name ?? "tag")} ({formatCount(item.like_count)})
                    </span>
                  ))}
            </div>

            <div className="overflow-hidden">
              <SafeTweetEmbed tweetId={tweetId} tweetUrl={tweet.tweet_url} compact />
            </div>

          </article>
          );
        })}
      </div>
    </section>
  );
}

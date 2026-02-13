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

function formatDate(dateText: string | null): string {
  if (!dateText) return "-";
  const timestamp = Date.parse(dateText);
  if (Number.isNaN(timestamp)) return dateText;
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
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

        const map = new Map<string, GroupMapRow>();
        for (const group of (groupRows ?? []) as GroupMapRow[]) {
          map.set(group.id, group);
        }
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
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">BUZZTTARA</p>
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">バズ投稿ピックアップ</h2>
          <p className="mt-2 text-sm text-zinc-300">
            既存buzzttaraの投稿データ（`public.tweets`）を時系列で表示。{countLabel}
          </p>
        </div>
      </div>

      {status === "loading" && <p className="text-sm text-zinc-400">読み込み中...</p>}

      {status === "idle" && tweets.length === 0 && (
        <p className="text-sm text-zinc-400">表示できる投稿がありません。</p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {tweets.map((tweet) => {
          const group = tweet.group_id ? groupsMap.get(tweet.group_id) : undefined;
          const tweetId = extractTweetId(tweet.tweet_url);
          return (
          <article
            key={tweet.id}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 transition hover:border-zinc-600"
          >
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <p className="text-sm text-zinc-400">{group?.name_ja ?? "グループ未設定"}</p>
                <h3 className="text-xl font-semibold text-white">{tweet.idol_name}</h3>
                {tweetId && <p className="mt-1 text-xs text-zinc-500">Tweet ID: {tweetId}</p>}
              </div>
              <p className="text-xs text-zinc-400">{formatDate(tweet.created_at)}</p>
            </div>

            {tweet.admin_comment && (
              <p className="mt-3 rounded-xl border border-zinc-700 bg-zinc-800/40 px-3 py-2 text-xs text-zinc-200">
                {tweet.admin_comment}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-3 text-xs text-zinc-300">
              <span className="rounded-full border border-zinc-700 px-2 py-1">
                いいね {formatCount(tweet.likeCount)}
              </span>
              <span className="rounded-full border border-zinc-700 px-2 py-1">
                閲覧 {formatCount(tweet.view_count)}
              </span>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950/60">
              <SafeTweetEmbed tweetId={tweetId} tweetUrl={tweet.tweet_url} compact />
            </div>

            {tweet.tweet_tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
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
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <a
                href={tweet.tweet_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex rounded-full border border-cyan-400/50 px-3 py-1 text-xs text-cyan-200 hover:border-cyan-300"
              >
                Xで見る →
              </a>
              <Link
                href={`/buzzttara/tweet/${tweet.id}`}
                className="inline-flex rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-200 hover:border-zinc-500"
              >
                詳細 →
              </Link>
              {group?.slug && (
                <Link
                  href={`/nandatte/${group.slug}`}
                  className="inline-flex rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-200 hover:border-zinc-500"
                >
                  グループ詳細 →
                </Link>
              )}
            </div>
          </article>
          );
        })}
      </div>
    </section>
  );
}

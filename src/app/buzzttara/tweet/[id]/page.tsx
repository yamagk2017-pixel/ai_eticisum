"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Status = "idle" | "loading" | "error";

type DetailTag = { id: string; name: string | null; icon: string | null; likeCount: number | null };

type TweetDetail = {
  id: string;
  tweetUrl: string;
  idolName: string;
  groupId: string | null;
  viewCount: number | null;
  likeCount: number | null;
  createdAt: string | null;
  adminComment: string | null;
  tags: DetailTag[];
};

type GroupInfo = {
  id: string;
  name_ja: string | null;
  slug: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
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

export default function BuzzttaraTweetDetailPage() {
  const params = useParams<{ id: string }>();
  const tweetIdParam = params?.id;

  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");
  const [tweet, setTweet] = useState<TweetDetail | null>(null);
  const [group, setGroup] = useState<GroupInfo | null>(null);

  useEffect(() => {
    if (!tweetIdParam) return;

    const run = async () => {
      setStatus("loading");
      const supabase = createClient();

      const { data, error } = await supabase
        .from("tweets")
        .select("id,tweet_url,idol_name,group_id,view_count,like_count,created_at,admin_comment,tweet_tags(id,like_count,tags(id,name,icon))")
        .eq("id", tweetIdParam)
        .maybeSingle();

      if (error) {
        setStatus("error");
        setMessage(error.message);
        return;
      }

      if (!data) {
        setStatus("error");
        setMessage("投稿が見つかりません。");
        return;
      }

      const row = asRecord(data);
      const rawTweetTags = Array.isArray(row.tweet_tags) ? row.tweet_tags : [];
      const tags: DetailTag[] = rawTweetTags.map((item) => {
        const r = asRecord(item);
        const tag = asRecord(r.tags);
        return {
          id: typeof r.id === "string" ? r.id : crypto.randomUUID(),
          name: typeof tag.name === "string" ? tag.name : null,
          icon: typeof tag.icon === "string" ? tag.icon : null,
          likeCount: typeof r.like_count === "number" ? r.like_count : null,
        };
      });

      const nextTweet: TweetDetail = {
        id: String(row.id),
        tweetUrl: String(row.tweet_url),
        idolName: String(row.idol_name),
        groupId: typeof row.group_id === "string" ? row.group_id : null,
        viewCount: typeof row.view_count === "number" ? row.view_count : null,
        likeCount: typeof row.like_count === "number" ? row.like_count : null,
        createdAt: typeof row.created_at === "string" ? row.created_at : null,
        adminComment: typeof row.admin_comment === "string" ? row.admin_comment : null,
        tags,
      };
      setTweet(nextTweet);

      if (nextTweet.groupId) {
        const { data: groupRow } = await supabase
          .schema("imd")
          .from("groups")
          .select("id,name_ja,slug")
          .eq("id", nextTweet.groupId)
          .maybeSingle();
        if (groupRow) {
          setGroup(groupRow as GroupInfo);
        }
      } else {
        setGroup(null);
      }

      setStatus("idle");
    };

    run().catch((err: unknown) => {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Unknown error");
    });
  }, [tweetIdParam]);

  const embedUrl = (() => {
    if (!tweet?.tweetUrl) return null;
    const id = extractTweetId(tweet.tweetUrl);
    if (!id) return null;
    return `https://platform.twitter.com/embed/Tweet.html?id=${id}&theme=dark`;
  })();

  if (status === "error") {
    return (
      <div className="min-h-screen bg-zinc-950 text-white">
        <main className="mx-auto w-full max-w-5xl px-6 py-16">
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-100">
            投稿の取得に失敗しました: {message}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-16">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/buzzttara"
            className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-200 hover:border-zinc-500"
          >
            一覧へ戻る
          </Link>
          {group?.slug && (
            <Link
              href={`/nandatte/${group.slug}`}
              className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-200 hover:border-zinc-500"
            >
              グループ詳細へ
            </Link>
          )}
        </div>

        {status === "loading" && <p className="text-sm text-zinc-400">読み込み中...</p>}

        {tweet && (
          <>
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
              <p className="text-sm text-zinc-400">{group?.name_ja ?? "グループ未設定"}</p>
              <h1 className="mt-1 text-3xl font-semibold">{tweet.idolName}</h1>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-300">
                <span className="rounded-full border border-zinc-700 px-2 py-1">
                  投稿日 {formatDate(tweet.createdAt)}
                </span>
                <span className="rounded-full border border-zinc-700 px-2 py-1">
                  閲覧 {formatCount(tweet.viewCount)}
                </span>
                <span className="rounded-full border border-zinc-700 px-2 py-1">
                  いいね {formatCount(tweet.likeCount)}
                </span>
              </div>
              {tweet.adminComment && (
                <p className="mt-4 whitespace-pre-wrap rounded-xl border border-zinc-700 bg-zinc-800/40 p-3 text-sm text-zinc-200">
                  {tweet.adminComment}
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
              <h2 className="text-lg font-semibold">投稿</h2>
              {embedUrl ? (
                <iframe
                  src={embedUrl}
                  title="Tweet Embed"
                  className="mt-4 h-[560px] w-full rounded-xl border border-zinc-700"
                  loading="lazy"
                />
              ) : (
                <p className="mt-4 text-sm text-zinc-400">埋め込み表示に対応していないURLです。</p>
              )}
              <a
                href={tweet.tweetUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex rounded-full border border-cyan-400/50 px-3 py-1 text-xs text-cyan-200 hover:border-cyan-300"
              >
                Xで開く →
              </a>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
              <h2 className="text-lg font-semibold">タグ</h2>
              {tweet.tags.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  {tweet.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="rounded-full border border-zinc-700 bg-zinc-800/40 px-2 py-1 text-zinc-200"
                    >
                      {(tag.icon ?? "") + " " + (tag.name ?? "tag")} ({formatCount(tag.likeCount)})
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-zinc-400">タグはまだ設定されていません。</p>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SafeTweetEmbed } from "../../safe-tweet-embed";

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

type ExternalIdRow = {
  service: string;
  external_id: string | null;
  url: string | null;
};

type EventRow = {
  event_name: string | null;
  event_date: string | null;
  venue_name: string | null;
  event_url: string | null;
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

function buildSpotifyEmbedUrl(spotifyUrl: string | null, spotifyExternalId: string | null): string | null {
  if (spotifyUrl) {
    const match = spotifyUrl.match(/spotify\.com\/(track|album|artist|playlist)\/([A-Za-z0-9]+)/);
    if (match) {
      return `https://open.spotify.com/embed/${match[1]}/${match[2]}`;
    }
  }
  if (spotifyExternalId) {
    return `https://open.spotify.com/embed/artist/${spotifyExternalId}`;
  }
  return null;
}

export default function BuzzttaraTweetDetailPage() {
  const params = useParams<{ id: string }>();
  const tweetIdParam = params?.id;

  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");
  const [tweet, setTweet] = useState<TweetDetail | null>(null);
  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [externalIds, setExternalIds] = useState<ExternalIdRow[]>([]);
  const [latestEvent, setLatestEvent] = useState<EventRow | null>(null);
  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(null);
  const [youtubeStatus, setYoutubeStatus] = useState<"idle" | "loading" | "error">("idle");

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

      let imdGroupId: string | null = null;
      if (nextTweet.groupId) {
        const { data: byId } = await supabase
          .schema("imd")
          .from("groups")
          .select("id,name_ja,slug")
          .eq("id", nextTweet.groupId)
          .maybeSingle();
        if (byId) {
          imdGroupId = byId.id;
          setGroup(byId as GroupInfo);
        } else {
          setGroup(null);
        }
      } else {
        setGroup(null);
      }

      if (imdGroupId) {
        const { data: extRows } = await supabase
          .schema("imd")
          .from("external_ids")
          .select("service,external_id,url")
          .eq("group_id", imdGroupId);
        setExternalIds((extRows ?? []) as ExternalIdRow[]);
      } else {
        setExternalIds([]);
      }

      if (imdGroupId) {
        const { data: eventRow } = await supabase
          .from("events")
          .select("event_name,event_date,venue_name,event_url")
          .eq("group_id", imdGroupId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        setLatestEvent((eventRow as EventRow | null) ?? null);
      } else {
        setLatestEvent(null);
      }

      setStatus("idle");
    };

    run().catch((err: unknown) => {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Unknown error");
    });
  }, [tweetIdParam]);

  const serviceMap = (() => {
    const map = new Map<string, ExternalIdRow>();
    for (const row of externalIds) {
      if (!map.has(row.service)) {
        map.set(row.service, row);
      }
    }
    return map;
  })();

  const websiteUrl = serviceMap.get("website")?.url ?? null;
  const spotifyUrl = serviceMap.get("spotify")?.url ?? null;
  const spotifyExternalId = serviceMap.get("spotify")?.external_id ?? null;
  const spotifyEmbedUrl = buildSpotifyEmbedUrl(spotifyUrl, spotifyExternalId);
  const youtubeUrl = serviceMap.get("youtube_channel")?.url ?? null;
  const youtubeExternalId = serviceMap.get("youtube_channel")?.external_id ?? null;

  useEffect(() => {
    const run = async () => {
      if (!youtubeUrl && !youtubeExternalId) {
        setYoutubeVideoId(null);
        setYoutubeStatus("idle");
        return;
      }
      setYoutubeStatus("loading");
      const params = new URLSearchParams();
      if (youtubeUrl) params.set("url", youtubeUrl);
      if (youtubeExternalId) params.set("external_id", youtubeExternalId);
      const res = await fetch(`/api/youtube?${params.toString()}`);
      const data = (await res.json()) as { videoId?: string };
      setYoutubeVideoId(data.videoId ?? null);
      setYoutubeStatus("idle");
    };

    run().catch(() => {
      setYoutubeVideoId(null);
      setYoutubeStatus("error");
    });
  }, [youtubeExternalId, youtubeUrl]);

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
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
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
              <div className="mt-4">
                <SafeTweetEmbed tweetId={extractTweetId(tweet.tweetUrl)} tweetUrl={tweet.tweetUrl} />
              </div>
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
            </div>

            <aside className="space-y-6">
              <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
                <h2 className="text-lg font-semibold">公式サイト</h2>
                {websiteUrl ? (
                  <a
                    href={websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex break-all text-sm text-cyan-200 hover:text-cyan-100"
                  >
                    {websiteUrl}
                  </a>
                ) : (
                  <p className="mt-3 text-sm text-zinc-400">公式サイトURLが未登録です。</p>
                )}
              </section>

              <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
                <h2 className="text-lg font-semibold">Spotify</h2>
                {spotifyEmbedUrl ? (
                  <iframe
                    className="mt-3 w-full rounded-xl border border-zinc-700"
                    src={spotifyEmbedUrl}
                    height="352"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                    title="Spotify preview"
                  />
                ) : (
                  <p className="mt-3 text-sm text-zinc-400">Spotify情報が未登録です。</p>
                )}
              </section>

              <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
                <h2 className="text-lg font-semibold">おすすめ動画</h2>
                {youtubeStatus === "loading" && (
                  <p className="mt-3 text-sm text-zinc-400">動画を読み込み中...</p>
                )}
                {youtubeStatus !== "loading" && youtubeVideoId ? (
                  <iframe
                    className="mt-3 w-full rounded-xl border border-zinc-700"
                    src={`https://www.youtube.com/embed/${youtubeVideoId}`}
                    height="220"
                    loading="lazy"
                    title="YouTube preview"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  youtubeStatus !== "loading" && (
                    <p className="mt-3 text-sm text-zinc-400">おすすめ動画を取得できませんでした。</p>
                  )
                )}
              </section>

              <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
                <h2 className="text-lg font-semibold">直近のイベント情報</h2>
                {latestEvent ? (
                  <div className="mt-3 space-y-2 text-sm text-zinc-200">
                    <p className="text-zinc-300">{latestEvent.event_date ?? "日程未定"}</p>
                    <a
                      href={
                        latestEvent.event_url?.startsWith("http")
                          ? latestEvent.event_url
                          : `https://ticketdive.com/event/${latestEvent.event_url ?? ""}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex text-cyan-200 hover:text-cyan-100"
                    >
                      {latestEvent.event_name ?? "イベント詳細"}
                    </a>
                    <p className="text-zinc-400">{latestEvent.venue_name ?? "-"}</p>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-zinc-400">直近のイベント情報はありません。</p>
                )}
              </section>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

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
  created_at?: string | null;
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

function normalizeUrl(url: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (
    trimmed.startsWith("youtube.com/") ||
    trimmed.startsWith("www.youtube.com/") ||
    trimmed.startsWith("youtu.be/")
  ) {
    return `https://${trimmed}`;
  }
  if (trimmed.startsWith("@")) {
    return `https://www.youtube.com/${trimmed}`;
  }
  return trimmed;
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
  const [youtubeError, setYoutubeError] = useState<string | null>(null);

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
          .select("service,external_id,url,created_at")
          .eq("group_id", imdGroupId)
          .order("created_at", { ascending: false });
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
        continue;
      }
      const current = map.get(row.service);
      const nextScore = (row.url ? 1 : 0) + (row.external_id ? 1 : 0);
      const currentScore = ((current?.url ? 1 : 0) + (current?.external_id ? 1 : 0)) || 0;
      if (nextScore > currentScore) {
        map.set(row.service, row);
      }
    }
    return map;
  })();

  const websiteUrl = serviceMap.get("website")?.url ?? null;
  const spotifyUrl = serviceMap.get("spotify")?.url ?? null;
  const spotifyExternalId = serviceMap.get("spotify")?.external_id ?? null;
  const spotifyEmbedUrl = buildSpotifyEmbedUrl(spotifyUrl, spotifyExternalId);
  const youtubeRow = serviceMap.get("youtube_channel") ?? null;
  const youtubeUrl = normalizeUrl(youtubeRow?.url ?? null);
  const youtubeExternalId = (() => {
    if (youtubeRow?.external_id) return youtubeRow.external_id;
    const raw = (youtubeRow?.url ?? "").trim();
    if (raw.startsWith("UC")) return raw;
    return null;
  })();

  useEffect(() => {
    const run = async () => {
      if (!youtubeUrl && !youtubeExternalId) {
        setYoutubeVideoId(null);
        setYoutubeStatus("idle");
        setYoutubeError(null);
        return;
      }
      setYoutubeStatus("loading");
      setYoutubeError(null);
      const params = new URLSearchParams();
      if (youtubeUrl) params.set("url", youtubeUrl);
      if (youtubeExternalId) params.set("external_id", youtubeExternalId);
      const res = await fetch(`/api/youtube?${params.toString()}`);
      const data = (await res.json()) as { videoId?: string; error?: string };
      if (!res.ok) {
        setYoutubeVideoId(null);
        setYoutubeStatus("error");
        setYoutubeError(data.error ?? `API error: ${res.status}`);
        return;
      }
      if (!data.videoId) {
        setYoutubeVideoId(null);
        setYoutubeStatus("error");
        setYoutubeError(data.error ?? "動画IDを取得できませんでした。");
        return;
      }
      setYoutubeVideoId(data.videoId);
      setYoutubeStatus("idle");
    };

    run().catch(() => {
      setYoutubeVideoId(null);
      setYoutubeStatus("error");
      setYoutubeError("YouTube APIの呼び出しに失敗しました。");
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
        </div>

        {status === "loading" && <p className="text-sm text-zinc-400">読み込み中...</p>}

        {tweet && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
            <section>
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
                <h1 className="text-3xl font-semibold">{tweet.idolName}</h1>
                <p className="text-sm text-zinc-300">さんのバズったポスト</p>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-300">
                <span>{formatDate(tweet.createdAt)}</span>
                <span className="rounded-full border border-zinc-700 px-2 py-1">
                  view {formatCount(tweet.viewCount)}
                </span>
                <span className="rounded-full border border-zinc-700 px-2 py-1">
                  いいね {formatCount(tweet.likeCount)}
                </span>
                {tweet.tags
                  .filter((tag) => tag.name !== "SEXY" && tag.name !== "Wow")
                  .map((tag) => (
                    <span
                      key={tag.id}
                      className="rounded-full border border-zinc-700 bg-zinc-800/40 px-2 py-1 text-zinc-200"
                    >
                      {(tag.icon ?? "") + " " + (tag.name ?? "tag")} ({formatCount(tag.likeCount)})
                    </span>
                  ))}
              </div>
            </section>

            <section className="pt-0">
              <div className="mt-1">
                <SafeTweetEmbed tweetId={extractTweetId(tweet.tweetUrl)} tweetUrl={tweet.tweetUrl} />
              </div>
            </section>

            {tweet.adminComment && (
              <section className="pt-4">
                <h2 className="text-lg font-semibold">管理者からのコメント</h2>
                <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-200">{tweet.adminComment}</p>
              </section>
            )}

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
                    className="mt-3 block w-full"
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
                    <p className="mt-3 text-sm text-zinc-400">
                      おすすめ動画を取得できませんでした。{youtubeError ? `(${youtubeError})` : ""}
                    </p>
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

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RelatedGroupsSidebar } from "@/components/news/related-groups-sidebar";
import type { NewsRelatedGroupInfo } from "@/lib/news/related-groups";
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


export default function BuzzttaraTweetDetailPage() {
  const params = useParams<{ id: string }>();
  const tweetIdParam = params?.id;

  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");
  const [tweet, setTweet] = useState<TweetDetail | null>(null);
  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [externalIds, setExternalIds] = useState<ExternalIdRow[]>([]);
  const [latestEvent, setLatestEvent] = useState<EventRow | null>(null);
  const [likeSaving, setLikeSaving] = useState(false);
  const [tagSavingIds, setTagSavingIds] = useState<Record<string, boolean>>({});
  const [tweetLikeLocked, setTweetLikeLocked] = useState(false);
  const [tagLikeLockedIds, setTagLikeLockedIds] = useState<Record<string, boolean>>({});
  const countedViewTweetIdsRef = useRef<Set<string>>(new Set());

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

  useEffect(() => {
    if (!tweet?.id) return;
    if (countedViewTweetIdsRef.current.has(tweet.id)) return;
    countedViewTweetIdsRef.current.add(tweet.id);

    const run = async () => {
      const supabase = createClient();
      const nextViewCount = (tweet.viewCount ?? 0) + 1;
      setTweet((prev) => (prev ? { ...prev, viewCount: nextViewCount } : prev));
      const { error } = await supabase.from("tweets").update({ view_count: nextViewCount }).eq("id", tweet.id);
      if (error) {
        setTweet((prev) => (prev ? { ...prev, viewCount: tweet.viewCount } : prev));
      }
    };

    run().catch(() => {
      setTweet((prev) => (prev ? { ...prev, viewCount: tweet.viewCount } : prev));
    });
  }, [tweet?.id, tweet?.viewCount]);

  const handleLikeClick = async () => {
    if (!tweet || likeSaving || tweetLikeLocked) return;
    setLikeSaving(true);
    try {
      const res = await fetch("/api/buzzttara/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tweetId: tweet.id, type: "tweet_like" }),
      });
      const payload = (await res.json()) as { ok?: boolean; added?: boolean; count?: number | null };
      if (res.ok && payload.ok) {
        setTweetLikeLocked(true);
        if (payload.added && typeof payload.count === "number") {
          setTweet((prev) => (prev ? { ...prev, likeCount: payload.count ?? prev.likeCount } : prev));
        }
      }
    } catch {
      // Keep UI unchanged on network failures.
    }
    setLikeSaving(false);
  };

  const handleTagLikeClick = async (tweetTagId: string) => {
    if (!tweet || tagSavingIds[tweetTagId] || tagLikeLockedIds[tweetTagId]) return;

    setTagSavingIds((prev) => ({ ...prev, [tweetTagId]: true }));
    try {
      const res = await fetch("/api/buzzttara/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tweetId: tweet.id, type: "tag_like", tweetTagId }),
      });
      const payload = (await res.json()) as { ok?: boolean; added?: boolean; count?: number | null };
      if (res.ok && payload.ok) {
        setTagLikeLockedIds((prev) => ({ ...prev, [tweetTagId]: true }));
        if (payload.added && typeof payload.count === "number") {
          setTweet((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              tags: prev.tags.map((tag) =>
                tag.id === tweetTagId ? { ...tag, likeCount: payload.count ?? tag.likeCount } : tag
              ),
            };
          });
        }
      }
    } catch {
      // Keep UI unchanged on network failures.
    }
    setTagSavingIds((prev) => ({ ...prev, [tweetTagId]: false }));
  };

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

  const sidebarGroups: NewsRelatedGroupInfo[] = group
    ? [
        {
          imdGroupId: group.id,
          groupNameJa: group.name_ja ?? "グループ",
          slug: group.slug ?? null,
          websiteUrl: serviceMap.get("website")?.url ?? null,
          scheduleUrl: serviceMap.get("schedule")?.url ?? null,
          xUrl: serviceMap.get("x")?.url ?? serviceMap.get("twitter")?.url ?? null,
          instagramUrl: serviceMap.get("instagram")?.url ?? null,
          tiktokUrl: serviceMap.get("tiktok")?.url ?? null,
          spotifyUrl: serviceMap.get("spotify")?.url ?? null,
          spotifyExternalId: serviceMap.get("spotify")?.external_id ?? null,
          youtubeUrl: serviceMap.get("youtube_channel")?.url ?? null,
          youtubeExternalId: serviceMap.get("youtube_channel")?.external_id ?? null,
          latestEvent: latestEvent
            ? {
                eventName: latestEvent.event_name ?? null,
                eventDate: latestEvent.event_date ?? null,
                venueName: latestEvent.venue_name ?? null,
                eventUrl: latestEvent.event_url ?? null,
              }
            : null,
        },
      ]
    : [];

  if (status === "error") {
    return (
      <div className="min-h-screen bg-[var(--ui-page)] text-[var(--ui-text)]">
        <main className="mx-auto w-full max-w-5xl px-10 py-16 sm:px-12">
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-100">
            投稿の取得に失敗しました: {message}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--ui-page)] text-[var(--ui-text)]">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-10 pt-8 pb-16 sm:px-12">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/buzzttara"
            className="rounded-full border border-zinc-400 px-3 py-1 text-xs text-[var(--ui-text)] hover:border-zinc-500"
          >
            一覧へ戻る
          </Link>
        </div>

        {status === "loading" && <p className="text-sm text-[var(--ui-text-subtle)]">読み込み中...</p>}

        {tweet && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2 rounded-2xl">
            <section>
              {group?.slug ? (
                <Link
                  href={`/nandatte/${group.slug}`}
                  className="text-sm text-[var(--ui-text-muted)] underline decoration-zinc-400 underline-offset-4 hover:text-[var(--ui-text)]"
                >
                  {group.name_ja ?? "グループ未設定"}
                </Link>
              ) : (
                <p className="text-sm text-[var(--ui-text-muted)]">{group?.name_ja ?? "グループ未設定"}</p>
              )}
              <div className="mt-1 flex items-baseline gap-2">
                <h1 className="text-4xl font-semibold sm:text-[2.6rem]">{tweet.idolName}</h1>
                <p className="text-sm text-[var(--ui-text-muted)]">さんのバズったポスト</p>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--ui-text-muted)]">
                <span>{formatDate(tweet.createdAt)}</span>
                <span className="rounded-full border border-zinc-400 px-2 py-1">
                  view {formatCount(tweet.viewCount)}
                </span>
                <button
                  type="button"
                  onClick={handleLikeClick}
                  disabled={likeSaving || tweetLikeLocked}
                  className="rounded-full border border-zinc-400 px-2 py-1 hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  いいね {formatCount(tweet.likeCount)}
                </button>
                {tweet.tags
                  .filter((tag) => tag.name !== "SEXY" && tag.name !== "Wow")
                  .map((tag) => (
                    <button
                      type="button"
                      onClick={() => handleTagLikeClick(tag.id)}
                      disabled={!!tagSavingIds[tag.id] || !!tagLikeLockedIds[tag.id]}
                      key={tag.id}
                      className="rounded-full border border-zinc-400 bg-transparent px-2 py-1 text-[var(--ui-text-muted)] hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {(tag.icon ?? "") + " " + (tag.name ?? "tag")} ({formatCount(tag.likeCount)})
                    </button>
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
                <h2 className="text-lg font-semibold">コメント</h2>
                <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--ui-text)]">{tweet.adminComment}</p>
              </section>
            )}

            </div>

            {sidebarGroups.length > 0 ? <RelatedGroupsSidebar groups={sidebarGroups} /> : null}
          </div>
        )}
      </main>
    </div>
  );
}

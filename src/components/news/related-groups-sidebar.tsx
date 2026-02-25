"use client";

import {useEffect, useMemo, useState} from "react";
import type {NewsRelatedGroupInfo} from "@/lib/news/related-groups";

type YoutubeApiResponse = {
  videoId?: string;
  error?: string;
};

function normalizeUrl(url: string | null) {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (
    trimmed.startsWith("youtube.com/") ||
    trimmed.startsWith("www.youtube.com/") ||
    trimmed.startsWith("youtu.be/")
  ) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

function buildSpotifyEmbedUrl(spotifyUrl: string | null, spotifyExternalId: string | null): string | null {
  if (spotifyUrl) {
    const match = spotifyUrl.match(/spotify\.com\/(track|album|artist|playlist)\/([A-Za-z0-9]+)/);
    if (match) return `https://open.spotify.com/embed/${match[1]}/${match[2]}`;
  }
  if (spotifyExternalId) {
    const uriMatch = spotifyExternalId.match(/^spotify:(track|album|artist|playlist):([A-Za-z0-9]+)$/);
    if (uriMatch) return `https://open.spotify.com/embed/${uriMatch[1]}/${uriMatch[2]}`;
    if (/^[A-Za-z0-9]+$/.test(spotifyExternalId)) {
      return `https://open.spotify.com/embed/artist/${spotifyExternalId}`;
    }
  }
  return null;
}

export function RelatedGroupsSidebar({groups}: {groups: NewsRelatedGroupInfo[]}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(null);
  const [youtubeStatus, setYoutubeStatus] = useState<"idle" | "loading" | "error">("idle");
  const [youtubeError, setYoutubeError] = useState<string | null>(null);

  useEffect(() => {
    if (activeIndex > groups.length - 1) setActiveIndex(0);
  }, [activeIndex, groups.length]);

  const active = groups[activeIndex] ?? null;

  const websiteUrl = active?.websiteUrl ?? null;
  const spotifyUrl = active?.spotifyUrl ?? null;
  const spotifyExternalId = active?.spotifyExternalId ?? null;
  const spotifyEmbedUrl = useMemo(
    () => buildSpotifyEmbedUrl(spotifyUrl, spotifyExternalId),
    [spotifyExternalId, spotifyUrl]
  );
  const youtubeUrl = normalizeUrl(active?.youtubeUrl ?? null);
  const youtubeExternalId = active?.youtubeExternalId ?? null;
  const latestNewsPath = active?.slug ? `/news?tag=${encodeURIComponent(active.slug)}` : null;

  useEffect(() => {
    let ignore = false;

    const run = async () => {
      if (!active || (!youtubeUrl && !youtubeExternalId)) {
        setYoutubeVideoId(null);
        setYoutubeStatus("idle");
        setYoutubeError(null);
        return;
      }

      setYoutubeStatus("loading");
      setYoutubeError(null);
      setYoutubeVideoId(null);

      try {
        const params = new URLSearchParams();
        if (youtubeUrl) params.set("url", youtubeUrl);
        if (youtubeExternalId) params.set("external_id", youtubeExternalId);
        const res = await fetch(`/api/youtube?${params.toString()}`);
        const json = (await res.json()) as YoutubeApiResponse;
        if (ignore) return;
        if (!res.ok || !json.videoId) {
          setYoutubeStatus("error");
          setYoutubeError(json.error ?? `status ${res.status}`);
          return;
        }
        setYoutubeVideoId(json.videoId);
        setYoutubeStatus("idle");
      } catch (error) {
        if (ignore) return;
        setYoutubeStatus("error");
        setYoutubeError(error instanceof Error ? error.message : "Unknown error");
      }
    };

    void run();
    return () => {
      ignore = true;
    };
  }, [active, youtubeExternalId, youtubeUrl]);

  if (!active) return null;

  return (
    <aside className="space-y-6 lg:sticky lg:top-20">
      <section>
        {groups.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            {groups.map((group, index) => (
              <button
                key={`${group.imdGroupId ?? group.groupNameJa}-${index}`}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  index === activeIndex
                    ? "border-[var(--ui-border)] bg-zinc-300 text-zinc-900 dark:bg-zinc-400 dark:text-zinc-900"
                    : "border-[var(--ui-border)] bg-transparent text-[var(--ui-text)]"
                }`}
              >
                {group.groupNameJa}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section>
        <h2 className="font-mincho-jp text-xl font-medium leading-tight sm:text-2xl">公式サイト</h2>
        {websiteUrl ? (
          <a
            href={websiteUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex break-all text-sm text-cyan-200 underline decoration-cyan-300/70 underline-offset-4 hover:text-cyan-100"
          >
            {websiteUrl}
          </a>
        ) : (
          <p className="mt-3 text-sm text-zinc-400">公式サイトURLが未登録です。</p>
        )}
      </section>

      <section>
        <h2 className="font-mincho-jp text-xl font-medium leading-tight sm:text-2xl">最新ニュース</h2>
        {latestNewsPath ? (
          <a
            href={latestNewsPath}
            className="mt-3 inline-flex text-sm text-cyan-200 underline decoration-cyan-300/70 underline-offset-4 hover:text-cyan-100"
          >
            {active.groupNameJa}の最新ニュースを見る
          </a>
        ) : (
          <p className="mt-3 text-sm text-zinc-400">最新ニュースへのリンクを作成できません。</p>
        )}
      </section>

      <section>
        <h2 className="font-mincho-jp text-xl font-medium leading-tight sm:text-2xl">直近のイベント情報</h2>
        {active.latestEvent ? (
          <div className="mt-3 space-y-2 text-sm text-zinc-200">
            <p className="text-zinc-300">{active.latestEvent.eventDate ?? "日程未定"}</p>
            <a
              href={
                active.latestEvent.eventUrl
                  ? active.latestEvent.eventUrl.startsWith("http")
                    ? active.latestEvent.eventUrl
                    : `https://ticketdive.com/event/${active.latestEvent.eventUrl}`
                  : "#"
              }
              target="_blank"
              rel="noreferrer"
              className={`inline-flex underline decoration-cyan-300/70 underline-offset-4 ${
                active.latestEvent.eventUrl
                  ? "text-cyan-200 hover:text-cyan-100"
                  : "pointer-events-none text-zinc-500"
              }`}
            >
              {active.latestEvent.eventName ?? "イベント詳細"}
            </a>
            <p className="text-zinc-400">{active.latestEvent.venueName ?? "-"}</p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-400">直近のイベント情報はありません。</p>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-mincho-jp text-xl font-medium leading-tight sm:text-2xl">Spotify</h2>
          {spotifyUrl ? (
            <a
              href={spotifyUrl}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-sm text-cyan-200 underline decoration-cyan-300/70 underline-offset-4 hover:text-cyan-100"
            >
              Spotifyで開く
            </a>
          ) : null}
        </div>
        {spotifyEmbedUrl ? (
          <iframe
            className="mt-3 block w-full"
            src={spotifyEmbedUrl}
            height="352"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            title={`Spotify preview - ${active.groupNameJa}`}
          />
        ) : (
          <p className="mt-3 text-sm text-zinc-400">Spotify情報が未登録です。</p>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-mincho-jp text-xl font-medium leading-tight sm:text-2xl">YouTube</h2>
          {youtubeUrl ? (
            <a
              href={youtubeUrl}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-sm text-cyan-200 underline decoration-cyan-300/70 underline-offset-4 hover:text-cyan-100"
            >
              YouTubeで開く
            </a>
          ) : null}
        </div>
        {youtubeStatus === "loading" && (
          <p className="mt-3 text-sm text-zinc-400">動画を読み込み中...</p>
        )}
        {youtubeStatus !== "loading" && youtubeVideoId ? (
          <iframe
            className="mt-3 w-full rounded-xl border border-zinc-700"
            src={`https://www.youtube.com/embed/${youtubeVideoId}`}
            height="220"
            loading="lazy"
            title={`YouTube preview - ${active.groupNameJa}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          youtubeStatus !== "loading" && (
            <p className="mt-3 text-sm text-zinc-400">
              YouTubeの最新動画が取得できませんでした。{youtubeError ? `(${youtubeError})` : ""}
            </p>
          )
        )}
      </section>
    </aside>
  );
}

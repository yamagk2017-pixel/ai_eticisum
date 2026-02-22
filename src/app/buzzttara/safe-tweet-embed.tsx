"use client";

import { useEffect, useState, type ComponentType } from "react";

type Mode = "loading" | "ready" | "fallback";

type TweetComponentProps = {
  id: string;
};

type SafeTweetEmbedProps = {
  tweetId: string | null;
  tweetUrl: string;
  compact?: boolean;
  className?: string;
};

export function SafeTweetEmbed({ tweetId, tweetUrl, compact = false, className = "" }: SafeTweetEmbedProps) {
  const [mode, setMode] = useState<Mode>("loading");
  const [TweetComponent, setTweetComponent] = useState<ComponentType<TweetComponentProps> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!tweetId) {
        if (!cancelled) setMode("fallback");
        return;
      }

      const hostname = window.location.hostname;
      const isV0Preview = hostname.includes("preview-") || hostname.includes("vusercontent.net");
      if (isV0Preview) {
        if (!cancelled) setMode("fallback");
        return;
      }

      try {
        const tweetModule = await import("react-tweet");
        if (!cancelled) {
          const Tweet = tweetModule.Tweet as ComponentType<TweetComponentProps>;
          setTweetComponent(() => Tweet);
          setMode("ready");
        }
      } catch {
        if (!cancelled) {
          setMode("fallback");
        }
      }
    };

    run().catch(() => {
      if (!cancelled) setMode("fallback");
    });

    return () => {
      cancelled = true;
    };
  }, [tweetId]);

  if (mode === "ready" && TweetComponent && tweetId) {
    return (
      <div className={`buzzttara-tweet-theme ${className}`.trim()}>
        <TweetComponent id={tweetId} />
      </div>
    );
  }

  return (
    <div className={`${className} rounded-xl border border-zinc-700 bg-zinc-900/70 p-4 text-center`.trim()}>
      <p className={`text-zinc-300 ${compact ? "text-xs" : "text-sm"}`}>
        {mode === "loading" ? "ツイートを読み込み中..." : "埋め込みを表示できないため、Xでご確認ください。"}
      </p>
      <a
        href={tweetUrl}
        target="_blank"
        rel="noreferrer"
        className={`mt-3 inline-flex rounded-full border border-cyan-400/50 px-3 py-1 text-cyan-200 hover:border-cyan-300 ${
          compact ? "text-xs" : "text-sm"
        }`}
      >
        Xで開く →
      </a>
    </div>
  );
}

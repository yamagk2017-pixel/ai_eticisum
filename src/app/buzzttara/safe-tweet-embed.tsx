"use client";

import {
  Component,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";

type Mode = "loading" | "ready" | "fallback";

type TweetComponentProps = {
  id: string;
  apiUrl?: string;
};

type SafeTweetEmbedProps = {
  tweetId: string | null;
  tweetUrl: string;
  compact?: boolean;
  className?: string;
};

type TweetBoundaryProps = {
  children: ReactNode;
  fallback: ReactNode;
  onError: () => void;
};

type TweetBoundaryState = {
  hasError: boolean;
};

class TweetRenderBoundary extends Component<TweetBoundaryProps, TweetBoundaryState> {
  constructor(props: TweetBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): TweetBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(): void {
    this.props.onError();
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

export function SafeTweetEmbed({ tweetId, tweetUrl, compact = false, className = "" }: SafeTweetEmbedProps) {
  const [mode, setMode] = useState<Mode>("loading");
  const [TweetComponent, setTweetComponent] = useState<ComponentType<TweetComponentProps> | null>(null);

  const fallbackNode = useMemo(
    () => (
      <div
        className={`${className} rounded-xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-4 text-center`.trim()}
      >
        <p className={`text-[var(--ui-text-muted)] ${compact ? "text-xs" : "text-sm"}`}>
          {mode === "loading" ? "ツイートを読み込み中..." : "埋め込みを表示できないため、Xでご確認ください。"}
        </p>
        <a
          href={tweetUrl}
          target="_blank"
          rel="noreferrer"
          className={`mt-3 inline-flex rounded-full border border-zinc-400 px-3 py-1 text-[var(--ui-link)] hover:text-[var(--ui-link-hover)] ${
            compact ? "text-xs" : "text-sm"
          }`}
        >
          Xで開く →
        </a>
      </div>
    ),
    [className, compact, mode, tweetUrl]
  );

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
      <TweetRenderBoundary fallback={fallbackNode} onError={() => setMode("fallback")}>
        <div className={`buzzttara-tweet-theme ${className}`.trim()}>
          <TweetComponent id={tweetId} apiUrl={`/api/tweet/${tweetId}`} />
        </div>
      </TweetRenderBoundary>
    );
  }

  return fallbackNode;
}

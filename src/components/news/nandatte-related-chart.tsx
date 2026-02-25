"use client";

import {useEffect, useMemo, useState} from "react";
import type {NewsRelatedGroupInfo} from "@/lib/news/related-groups";
import {createClient} from "@/lib/supabase/client";

type ChartApiResponse = {
  items: {label: string; count: number}[];
  totalVotes: number | null;
  voteRank: number | null;
  rank: number | null;
  error?: string;
};

type Props = {
  groups: NewsRelatedGroupInfo[];
};

export function NandatteRelatedChart({groups}: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [data, setData] = useState<ChartApiResponse | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    if (activeIndex > groups.length - 1) setActiveIndex(0);
  }, [activeIndex, groups.length]);

  const active = groups[activeIndex] ?? null;
  const nandattePath = active?.slug ? `/nandatte/${active.slug}` : null;

  useEffect(() => {
    const supabase = createClient();

    const fetchUser = async () => {
      const {data} = await supabase.auth.getUser();
      setIsLoggedIn(Boolean(data.user));
    };

    void fetchUser();

    const {data: listener} = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(Boolean(session?.user));
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    const run = async () => {
      if (!active?.imdGroupId) {
        setData(null);
        setStatus("idle");
        setErrorMessage(null);
        return;
      }

      setStatus("loading");
      setErrorMessage(null);
      try {
        const res = await fetch(`/api/news/nandatte-chart?groupId=${encodeURIComponent(active.imdGroupId)}`);
        const json = (await res.json()) as ChartApiResponse;
        if (ignore) return;
        if (!res.ok) {
          setStatus("error");
          setErrorMessage(json.error ?? `status ${res.status}`);
          return;
        }
        setData(json);
        setStatus("idle");
      } catch (error) {
        if (ignore) return;
        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : "Unknown error");
      }
    };
    void run();
    return () => {
      ignore = true;
    };
  }, [active?.imdGroupId]);

  const maxCount = useMemo(() => data?.items?.[0]?.count ?? 0, [data]);
  const rankDisplay =
    data?.rank == null ? "-" : !isLoggedIn && data.rank > 100 ? "非公開" : data.rank;

  if (!active) return null;

  return (
    <section className="mt-10 border-t border-[var(--ui-border)] px-4 pb-4 pt-8 sm:px-5 sm:pb-5">
      <div className="flex flex-col gap-2">
        <h2 className="font-mincho-jp text-xl font-medium leading-tight text-[var(--ui-text)] sm:text-2xl">
          {active.groupNameJa}ってこんなグループ「ナンダッテ」
        </h2>
        <p className="text-xs text-[var(--ui-text-subtle)]">ナンダッテ投票の上位ワード（上位5件）</p>
      </div>

      {groups.length > 1 ? (
        <div className="mt-4 flex flex-wrap gap-2">
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

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--ui-text-subtle)]">
        <span>総投票数 {data?.totalVotes ?? "-"}</span>
        <span>投票ランキング {data?.voteRank ?? "-"}</span>
        <span>イマキテ総合順位 {rankDisplay}</span>
      </div>

      {status === "loading" ? (
        <p className="mt-6 text-sm text-[var(--ui-text-subtle)]">棒グラフを読み込み中...</p>
      ) : status === "error" ? (
        <p className="mt-6 text-sm text-[var(--ui-text-subtle)]">棒グラフを取得できませんでした。{errorMessage ? ` (${errorMessage})` : ""}</p>
      ) : (data?.items.length ?? 0) === 0 ? (
        <p className="mt-6 text-sm text-[var(--ui-text-subtle)]">まだ投票がありません。</p>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 sm:gap-x-5">
          {data!.items.slice(0, 5).map((item, index) => {
            const width = maxCount ? Math.max(4, Math.round((item.count / maxCount) * 100)) : 0;
            const isTopFive = index < 5;
            return (
              <div key={`${item.label}-${index}`} className="px-1 py-2">
                <div className="flex items-center justify-between gap-4 text-sm text-[var(--ui-text)]">
                  <span className="font-medium">
                    {index + 1}. {item.label}
                  </span>
                  <span className="text-[var(--ui-text-subtle)]">{item.count}</span>
                </div>
                <div className="mt-2 h-4 w-full bg-zinc-800/70">
                  <div
                    className={`h-4 ${isTopFive ? "bg-zinc-400" : "bg-zinc-600"}`}
                    style={{width: `${width}%`}}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-5">
        {nandattePath ? (
          <a
            href={nandattePath}
            className="inline-flex items-center text-sm text-[var(--ui-text-subtle)] underline underline-offset-2"
          >
            <span>{active.groupNameJa}をもっと詳しく</span>
            <span aria-hidden="true">→</span>
          </a>
        ) : (
          <p className="text-xs text-[var(--ui-text-subtle)]">ナンダッテ詳細ページのリンクは未登録です。</p>
        )}
      </div>
    </section>
  );
}

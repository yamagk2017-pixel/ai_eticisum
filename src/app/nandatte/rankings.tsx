"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type RankingRow = {
  group_id: string;
  vote_count: number;
  last_vote_at: string | null;
  name?: string | null;
  slug?: string | null;
  imageUrl?: string | null;
};

type RankItem = RankingRow & {
  name: string;
  slug: string | null;
  imageUrl: string | null;
};

type RankingsProps = {
  showMoreLinks?: boolean;
  moreHrefBase?: string;
  prioritize?: "vote" | "recent";
  splitListColumns?: boolean;
  limit?: number;
  loggedInLimit?: number;
  layout?: "side-by-side" | "stacked";
};

function formatShortDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ja-JP");
}

function formatCompactDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ja-JP", { month: "2-digit", day: "2-digit" }).format(date);
}

export function Rankings({
  showMoreLinks = false,
  moreHrefBase = "/nandatte/ranking",
  prioritize = "vote",
  splitListColumns = false,
  limit = 5,
  loggedInLimit,
  layout = "side-by-side",
}: RankingsProps = {}) {
  const [voteTop, setVoteTop] = useState<RankItem[]>([]);
  const [recentTop, setRecentTop] = useState<RankItem[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState<string>("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const maxFetchLimit = Math.max(limit, loggedInLimit ?? limit);

  useEffect(() => {
    const run = async () => {
      setStatus("loading");
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getUser();
      setIsLoggedIn(!!authData.user);
      const response = await fetch(`/api/nandatte/rankings?limit=${maxFetchLimit}`, {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        voteTop?: RankingRow[];
        recentTop?: RankingRow[];
        error?: string;
      };

      if (!response.ok) {
        setStatus("error");
        setMessage(payload.error ?? "Unknown error");
        return;
      }

      const toRankItem = (row: RankingRow): RankItem => {
        return {
          ...row,
          name: row.name ?? row.group_id,
          slug: row.slug ?? null,
          imageUrl: row.imageUrl ?? null,
        };
      };

      setVoteTop((payload.voteTop ?? []).map(toRankItem));
      setRecentTop((payload.recentTop ?? []).map(toRankItem));
      setStatus("idle");
    };

    run().catch((err: unknown) => {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Unknown error");
    });
  }, [maxFetchLimit]);

  const effectiveLimit = loggedInLimit && isLoggedIn ? loggedInLimit : limit;
  const voteList = useMemo(() => voteTop.slice(0, effectiveLimit), [effectiveLimit, voteTop]);
  const recentList = useMemo(() => recentTop.slice(0, effectiveLimit), [effectiveLimit, recentTop]);

  const sections =
    prioritize === "recent"
      ? ([
          { key: "recent", title: "最新アップデート", items: recentList },
          { key: "vote", title: "投票ランキング", items: voteList },
        ] as const)
      : ([
          { key: "vote", title: "投票ランキング", items: voteList },
          { key: "recent", title: "最新アップデート", items: recentList },
        ] as const);

  const [firstSection, secondSection] = sections;

  const renderSection = (section: (typeof sections)[number]) => (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-mincho-jp text-2xl font-semibold">{section.title}</h2>
        {showMoreLinks && (
          <Link
            className="text-sm text-zinc-400 underline decoration-zinc-600 underline-offset-4 hover:text-zinc-200"
            href={`${moreHrefBase}?focus=${section.key}`}
          >
            more...
          </Link>
        )}
      </div>
      {status === "loading" && (
        <p className="mt-4 text-sm text-zinc-400">読み込み中...</p>
      )}
      {status === "idle" && section.items.length === 0 && (
        <p className="mt-4 text-sm text-zinc-400">
          {section.key === "vote" ? "まだ投票がありません。" : "まだ更新がありません。"}
        </p>
      )}
      <ol
        className={[
          "mt-4 text-base text-zinc-200",
          splitListColumns ? "grid grid-cols-2 gap-x-5 gap-y-1" : "flex flex-col gap-1",
        ].join(" ")}
      >
        {section.items.map((item, index) => (
          <li key={`${section.key}-${item.group_id}-${index}`} className="min-w-0 p-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md border border-zinc-700 bg-zinc-800/60">
                  <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-zinc-700 to-zinc-800 text-[10px] text-zinc-300">
                    {item.name.slice(0, 1)}
                  </div>
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      fill
                      sizes="40px"
                      className="relative object-cover"
                      unoptimized
                    />
                  ) : null}
                </div>
                <span
                  className={`min-w-0 truncate font-medium ${
                    section.key === "vote" || section.key === "recent" ? "text-zinc-700" : ""
                  }`}
                >
                  <span className="mr-2 text-sm text-zinc-400">{index + 1}.</span>
                  {item.slug ? (
                    <Link
                      className={`underline decoration-zinc-500 underline-offset-2 ${
                        section.key === "vote" || section.key === "recent"
                          ? "text-zinc-700 hover:text-zinc-900"
                          : "hover:text-white"
                      }`}
                      href={`/nandatte/${item.slug}`}
                    >
                      {item.name}
                    </Link>
                  ) : (
                    item.name
                  )}
                </span>
              </div>
              <span className="shrink-0 text-xs text-zinc-500">
                {section.key === "vote" ? (
                  `${item.vote_count}票`
                ) : (
                  <>
                    <span className="sm:hidden">{formatCompactDate(item.last_vote_at)}</span>
                    <span className="hidden sm:inline">{formatShortDate(item.last_vote_at)}</span>
                  </>
                )}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );

  if (status === "error") {
    return (
      <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-100">
        ランキングの取得に失敗しました: {message}
      </div>
    );
  }

  if (layout === "stacked") {
    return (
      <section className="flex w-full max-w-5xl flex-col gap-10">
        {renderSection(firstSection)}
        <div className="h-px w-full bg-zinc-800/80" aria-hidden="true" />
        {renderSection(secondSection)}
      </section>
    );
  }

  return (
    <section className="grid w-full max-w-5xl gap-6 md:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] md:gap-8">
      {renderSection(firstSection)}
      <div className="hidden bg-zinc-800/80 md:block" aria-hidden="true" />
      {renderSection(secondSection)}
    </section>
  );
}

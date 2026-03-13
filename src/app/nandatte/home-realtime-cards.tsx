"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type NandatteSummaryItem = {
  groupId: string;
  name: string;
  slug: string | null;
  imageUrl: string | null;
  voteCount: number;
  lastVoteAt: string | null;
};

type RankingApiRow = {
  group_id: string;
  vote_count: number;
  last_vote_at: string | null;
  name: string;
  slug: string | null;
  imageUrl: string | null;
};

type RankingsApiResponse = {
  voteTop?: RankingApiRow[];
  recentTop?: RankingApiRow[];
  error?: string;
};

type BaseRealtimeCardProps = {
  pollIntervalMs?: number;
};

type HomeNandatteVoteRealtimeCardProps = BaseRealtimeCardProps & {
  initialVoteTop: NandatteSummaryItem[];
};

type HomeNandatteRecentRealtimeCardProps = BaseRealtimeCardProps & {
  initialRecentTop: NandatteSummaryItem[];
};

function formatShortDate(value: string | null) {
  if (!value) return "-";
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) return value;
  return new Intl.DateTimeFormat("ja-JP", { month: "2-digit", day: "2-digit" }).format(new Date(ts));
}

function toSummaryItems(rows: RankingApiRow[] | undefined): NandatteSummaryItem[] {
  return (rows ?? []).slice(0, 3).map((row) => ({
    groupId: row.group_id,
    name: row.name ?? row.group_id,
    slug: row.slug ?? null,
    imageUrl: row.imageUrl ?? null,
    voteCount: Number.isFinite(row.vote_count) ? row.vote_count : 0,
    lastVoteAt: row.last_vote_at ?? null,
  }));
}

export function HomeNandatteVoteRealtimeCard({
  initialVoteTop,
  pollIntervalMs = 15000,
}: HomeNandatteVoteRealtimeCardProps) {
  const [voteTop, setVoteTop] = useState<NandatteSummaryItem[]>(initialVoteTop);

  useEffect(() => {
    let cancelled = false;
    const fetchLatest = async () => {
      try {
        const res = await fetch("/api/nandatte/rankings?limit=3&focus=vote", {
          method: "GET",
          cache: "no-store",
        });
        const payload = (await res.json()) as RankingsApiResponse;
        if (!res.ok || cancelled) return;
        setVoteTop(toSummaryItems(payload.voteTop));
      } catch {
        // Keep current values and retry on next poll.
      }
    };

    fetchLatest().catch(() => null);
    const timer = setInterval(() => {
      fetchLatest().catch(() => null);
    }, pollIntervalMs);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pollIntervalMs]);

  const voteItems = useMemo(() => voteTop.slice(0, 3), [voteTop]);

  return (
    <div className="mb-12 break-inside-avoid">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link href="/nandatte" className="text-xs font-semibold tracking-[0.08em] text-emerald-500 underline">
              ナンダッテ
            </Link>
            <span className="text-xs text-[var(--ui-text-muted)]">リアルなアイドルチャート</span>
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <h2 className="font-mincho-jp text-2xl font-semibold">投票ランキング</h2>
            <Link
              href="/nandatte/ranking?focus=vote"
              className="shrink-0 whitespace-nowrap text-xs text-[var(--ui-text-muted)]"
            >
              more...
            </Link>
          </div>
        </div>
      </div>
      <ol className="mt-4 space-y-2 text-sm">
        {voteItems.length > 0 ? (
          voteItems.map((item, index) => (
            <li key={`nandatte-vote-${item.groupId}-${index}`} className="flex items-center justify-between gap-3 rounded-md">
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-[var(--ui-panel)]">
                  {item.imageUrl ? (
                    <Image src={item.imageUrl} alt={item.name} fill sizes="40px" className="object-cover" unoptimized />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-700 dark:to-zinc-800" />
                  )}
                </div>
                <span className="truncate">
                  <span className="mr-2 text-xs text-[var(--ui-text-subtle)]">#{index + 1}</span>
                  {item.slug ? <Link href={`/nandatte/${item.slug}`}>{item.name}</Link> : item.name}
                </span>
              </div>
              <span className="shrink-0 text-xs text-[var(--ui-text-muted)]">{item.voteCount}票</span>
            </li>
          ))
        ) : (
          <li className="rounded-md text-xs text-[var(--ui-text-muted)]">データなし</li>
        )}
      </ol>
    </div>
  );
}

export function HomeNandatteRecentRealtimeCard({
  initialRecentTop,
  pollIntervalMs = 15000,
}: HomeNandatteRecentRealtimeCardProps) {
  const [recentTop, setRecentTop] = useState<NandatteSummaryItem[]>(initialRecentTop);

  useEffect(() => {
    let cancelled = false;
    const fetchLatest = async () => {
      try {
        const res = await fetch("/api/nandatte/rankings?limit=3&focus=recent", {
          method: "GET",
          cache: "no-store",
        });
        const payload = (await res.json()) as RankingsApiResponse;
        if (!res.ok || cancelled) return;
        setRecentTop(toSummaryItems(payload.recentTop));
      } catch {
        // Keep current values and retry on next poll.
      }
    };

    fetchLatest().catch(() => null);
    const timer = setInterval(() => {
      fetchLatest().catch(() => null);
    }, pollIntervalMs);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pollIntervalMs]);

  const recentItems = useMemo(() => recentTop.slice(0, 3), [recentTop]);

  return (
    <div className="mb-12 break-inside-avoid">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link href="/nandatte" className="text-xs font-semibold tracking-[0.08em] text-emerald-500 underline">
              ナンダッテ
            </Link>
            <span className="text-xs text-[var(--ui-text-muted)]">リアルなアイドルチャート</span>
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <h2 className="font-mincho-jp text-2xl font-semibold">最新アップデート</h2>
            <Link
              href="/nandatte/ranking?focus=recent"
              className="shrink-0 whitespace-nowrap text-xs text-[var(--ui-text-muted)]"
            >
              more...
            </Link>
          </div>
        </div>
      </div>
      <ol className="mt-4 space-y-2 text-sm">
        {recentItems.length > 0 ? (
          recentItems.map((item, index) => (
            <li
              key={`nandatte-recent-${item.groupId}-${index}`}
              className="flex items-center justify-between gap-3 rounded-md"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-[var(--ui-panel)]">
                  {item.imageUrl ? (
                    <Image src={item.imageUrl} alt={item.name} fill sizes="40px" className="object-cover" unoptimized />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-700 dark:to-zinc-800" />
                  )}
                </div>
                <span className="truncate">
                  <span className="mr-2 text-xs text-[var(--ui-text-subtle)]">#{index + 1}</span>
                  {item.slug ? <Link href={`/nandatte/${item.slug}`}>{item.name}</Link> : item.name}
                </span>
              </div>
              <span className="shrink-0 text-xs text-[var(--ui-text-muted)]">{formatShortDate(item.lastVoteAt)}</span>
            </li>
          ))
        ) : (
          <li className="rounded-md text-xs text-[var(--ui-text-muted)]">データなし</li>
        )}
      </ol>
    </div>
  );
}

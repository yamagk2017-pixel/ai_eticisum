"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type DailyTopRow = {
  snapshot_date: string;
  group_id: string;
  rank: number;
  artist_name: string;
  score: number | string;
  latest_track_name: string | null;
  latest_track_embed_link: string | null;
  artist_image_url: string | null;
};

type Status = "idle" | "loading" | "error";

type RankingListProps = {
  date?: string;
  title?: string;
  showArchiveLink?: boolean;
};

type GroupSlugRow = {
  id: string;
  slug: string | null;
};

function formatJapaneseDate(dateString: string) {
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-");
  if (!year || !month || !day) return dateString;
  return `${year}年${month}月${day}日付`;
}

function formatScore(value: number | string) {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num.toFixed(2) : "-";
}

function cardClass(rank: number) {
  if (rank === 1) {
    return "lg:col-span-2 lg:row-span-2";
  }
  if (rank === 2 || rank === 3) {
    return "lg:col-span-1 lg:row-span-1";
  }
  return "lg:col-span-1";
}

function cardHeight(rank: number) {
  if (rank === 1) {
    return "min-h-[360px]";
  }
  if (rank === 2 || rank === 3) {
    return "min-h-[240px]";
  }
  return "min-h-[180px]";
}

export function ImakiteRankingList({ date, title, showArchiveLink }: RankingListProps) {
  const [rows, setRows] = useState<DailyTopRow[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");
  const [activeDate, setActiveDate] = useState<string | null>(date ?? null);
  const [slugMap, setSlugMap] = useState<Map<string, string | null>>(new Map());

  useEffect(() => {
    const run = async () => {
      setStatus("loading");
      const supabase = createClient();

      let targetDate = date ?? null;
      if (!targetDate) {
        const latestRes = await supabase
          .schema("ihc")
          .from("daily_top20")
          .select("snapshot_date")
          .order("snapshot_date", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestRes.error) {
          setStatus("error");
          setMessage(latestRes.error.message);
          return;
        }
        targetDate = latestRes.data?.snapshot_date ?? null;
      }

      if (!targetDate) {
        setStatus("error");
        setMessage("最新日の取得に失敗しました。");
        return;
      }

      const { data, error } = await supabase
        .schema("ihc")
        .from("daily_top20")
        .select(
          "snapshot_date,group_id,rank,artist_name,score,latest_track_name,latest_track_embed_link,artist_image_url"
        )
        .eq("snapshot_date", targetDate)
        .order("rank", { ascending: true });

      if (error) {
        setStatus("error");
        setMessage(error.message);
        return;
      }

      const rowsData = (data ?? []) as DailyTopRow[];
      setRows(rowsData);
      const groupIds = Array.from(new Set(rowsData.map((row) => row.group_id)));
      if (groupIds.length > 0) {
        const { data: groupsData } = await supabase
          .schema("imd")
          .from("groups")
          .select("id,slug")
          .in("id", groupIds);
        const map = new Map<string, string | null>(
          ((groupsData ?? []) as GroupSlugRow[]).map((group) => [group.id, group.slug])
        );
        setSlugMap(map);
      } else {
        setSlugMap(new Map());
      }
      setActiveDate(targetDate);
      setStatus("idle");
    };

    run().catch((err: unknown) => {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Unknown error");
    });
  }, [date]);

  const dateLabel = useMemo(() => (activeDate ? formatJapaneseDate(activeDate) : ""), [activeDate]);

  if (status === "error") {
    return (
      <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-100">
        ランキングの取得に失敗しました: {message}
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-400">
            IMAKITE RANKING
          </p>
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">
            {title ?? "今日のランキング"}
          </h2>
          {dateLabel && <p className="mt-2 text-sm text-zinc-300">{dateLabel}</p>}
        </div>
        {showArchiveLink && (
          <Link
            href="/imakite/archive"
            className="rounded-full border border-zinc-700 px-4 py-2 text-xs text-zinc-200 hover:border-zinc-500"
          >
            過去のランキングを見る →
          </Link>
        )}
      </div>

      {status === "loading" && <p className="text-sm text-zinc-400">読み込み中...</p>}

      {status === "idle" && rows.length === 0 && (
        <p className="text-sm text-zinc-400">該当日のランキングがありません。</p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {rows.map((row) => (
          <article
            key={`${row.snapshot_date}-${row.rank}-${row.group_id}`}
            className={`relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70 shadow-lg backdrop-blur ${
              cardClass(row.rank)
            } ${cardHeight(row.rank)}`}
          >
            <div className="absolute inset-0">
              {row.artist_image_url ? (
                <img
                  src={row.artist_image_url}
                  alt={row.artist_name}
                  className="h-full w-full object-cover opacity-70"
                  loading="lazy"
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950" />
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-slate-950/20 via-slate-950/40 to-slate-950/90" />
            </div>

            <div className="relative flex h-full flex-col justify-end gap-4 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-amber-300">{row.rank}位</p>
                  <h3 className="mt-1 text-xl font-semibold text-white sm:text-2xl">
                    {slugMap.get(row.group_id) ? (
                      <Link
                        href={`/nandatte/${slugMap.get(row.group_id)}`}
                        className="underline decoration-amber-200/70 underline-offset-4 hover:text-amber-100"
                      >
                        {row.artist_name}
                      </Link>
                    ) : (
                      row.artist_name
                    )}
                  </h3>
                  {row.latest_track_name && (
                    <p className="mt-1 text-sm text-zinc-200">♪ {row.latest_track_name}</p>
                  )}
                </div>
                <div className="rounded-full bg-black/40 px-3 py-1 text-sm font-semibold text-amber-200">
                  {formatScore(row.score)} pts
                </div>
              </div>

              {row.latest_track_embed_link ? (
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                  <iframe
                    title={`${row.artist_name} - ${row.latest_track_name ?? "Spotify"}`}
                    src={row.latest_track_embed_link}
                    width="100%"
                    height={row.rank === 1 ? 152 : 104}
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                  />
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-6 text-sm text-zinc-300">
                  Spotify埋め込みがありません。
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function formatArchiveDateLabel(dateString: string) {
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-");
  if (!year || !month || !day) return dateString;
  return `${year}年${month}月${day}日`;
}

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
type RankingSource = "daily" | "weekly";

type RankingListProps = {
  date?: string;
  title?: string;
  showArchiveLink?: boolean;
  source?: RankingSource;
};

type GroupSlugRow = {
  id: string;
  slug: string | null;
  artist_image_url: string | null;
};

type RowRecord = Record<string, unknown>;

function getRankingConfig(source: RankingSource) {
  if (source === "weekly") {
    return {
      tables: ["weekly_rankings"],
      dateColumns: ["week_end_date"],
      archiveHref: "/imakite/weekly/archive",
      label: "WEEKLY",
      defaultTitle: "今週のランキング",
    };
  }
  return {
    tables: ["daily_top20"],
    dateColumns: ["snapshot_date"],
    archiveHref: "/imakite/archive",
    label: "DAILY",
    defaultTitle: "今日のランキング",
  };
}

function pickString(row: RowRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return null;
}

function pickNumber(row: RowRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

function formatJapaneseDate(dateString: string) {
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-");
  if (!year || !month || !day) return dateString;
  return `${year}年${month}月${day}日付`;
}

function formatJapaneseDatePlain(dateString: string) {
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-");
  if (!year || !month || !day) return dateString;
  return `${year}年${month}月${day}日`;
}

function formatWeeklyRangeLabel(weekEndDate: string) {
  if (!weekEndDate) return "";
  const [year, month, day] = weekEndDate.split("-").map(Number);
  if (!year || !month || !day) return weekEndDate;

  const end = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(end.getTime())) return weekEndDate;

  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - 6);

  const startIso = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}-${String(
    start.getUTCDate()
  ).padStart(2, "0")}`;

  return `${formatJapaneseDatePlain(startIso)}〜${formatJapaneseDatePlain(weekEndDate)}`;
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

async function resolveLatestDate(
  source: RankingSource,
  tables: string[],
  dateColumns: string[]
): Promise<{ date: string | null; column: string | null; table: string | null; error: string | null }> {
  const supabase = createClient();
  let hadSuccessfulQuery = false;
  let lastError: string | null = null;

  for (const table of tables) {
    for (const column of dateColumns) {
      const latestRes = await supabase
        .schema("ihc")
        .from(table)
        .select(column)
        .order(column, { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestRes.error) {
        lastError = latestRes.error.message;
        continue;
      }

      hadSuccessfulQuery = true;
      const latestRow = (latestRes.data ?? null) as RowRecord | null;
      const value = latestRow?.[column];
      if (typeof value === "string" && value.length > 0) {
        return { date: value, column, table, error: null };
      }
    }
  }

  return {
    date: null,
    column: null,
    table: null,
    error:
      source === "weekly"
        ? lastError
          ? `週次ランキングの最新日取得に失敗しました: ${lastError}`
          : hadSuccessfulQuery
            ? "週次ランキングデータが見つかりません。ihc.weekly_rankings の week_end_date データ、またはRLSのSELECTポリシーを確認してください。"
            : "週次ランキングの最新日を取得できませんでした。weekly_rankings / week_end_date を確認してください。"
        : lastError ?? "最新日の取得に失敗しました。",
  };
}

export function ImakiteRankingList({
  date,
  title,
  showArchiveLink,
  source = "daily",
}: RankingListProps) {
  const [rows, setRows] = useState<DailyTopRow[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");
  const [activeDate, setActiveDate] = useState<string | null>(date ?? null);
  const [slugMap, setSlugMap] = useState<Map<string, string | null>>(new Map());
  const [playlistEmbedLink, setPlaylistEmbedLink] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      setStatus("loading");
      const supabase = createClient();
      const config = getRankingConfig(source);

      let targetDate = date ?? null;
      let targetColumn: string | null = null;
      let targetTable: string | null = null;

      if (!targetDate) {
        const latest = await resolveLatestDate(source, config.tables, config.dateColumns);
        if (latest.error || !latest.date || !latest.column || !latest.table) {
          setStatus("error");
          setMessage(latest.error ?? "最新日の取得に失敗しました。");
          return;
        }
        targetDate = latest.date;
        targetColumn = latest.column;
        targetTable = latest.table;
      }

      if (targetDate && !targetColumn) {
        targetColumn = config.dateColumns[0] ?? "snapshot_date";
      }

      if (targetDate && !targetTable) {
        targetTable = config.tables[0] ?? null;
      }

      if (!targetDate || !targetColumn || !targetTable) {
        setStatus("error");
        setMessage("対象日の取得に失敗しました。");
        return;
      }

      const orderedTables = [targetTable, ...config.tables.filter((table) => table !== targetTable)];
      const orderedColumns = [
        targetColumn,
        ...config.dateColumns.filter((column) => column !== targetColumn),
      ];

      let data: RowRecord[] = [];
      let queryError: string | null = null;
      let querySucceeded = false;

      for (const table of orderedTables) {
        for (const column of orderedColumns) {
          const result = await supabase
            .schema("ihc")
            .from(table)
            .select("*")
            .eq(column, targetDate)
            .order("rank", { ascending: true })
            .limit(20);

          if (result.error) {
            queryError = result.error.message;
            continue;
          }

          data = (result.data ?? []) as RowRecord[];
          targetTable = table;
          targetColumn = column;
          querySucceeded = true;

          if (data.length > 0) {
            break;
          }
        }

        if (querySucceeded && data.length > 0) {
          break;
        }
      }

      if (!querySucceeded && queryError) {
        setStatus("error");
        setMessage(queryError);
        return;
      }

      const rowsData = data
        .map((row) => {
          const snapshotDate = pickString(row, config.dateColumns) ?? targetDate;
          const groupId = pickString(row, ["group_id"]) ?? "";
          const rank = pickNumber(row, ["rank"]) ?? 0;
          const artistName = pickString(row, ["artist_name", "group_name"]) ?? "-";
          const score = pickNumber(row, ["total_score", "score", "weekly_score"]) ?? 0;

          return {
            snapshot_date: snapshotDate,
            group_id: groupId,
            rank,
            artist_name: artistName,
            score,
            latest_track_name: pickString(row, ["latest_track_name", "track_name"]),
            latest_track_embed_link: pickString(row, [
              "latest_track_embed_link",
              "track_embed_link",
            ]),
            artist_image_url: pickString(row, ["artist_image_url", "image_url"]),
          };
        })
        .filter((row) => row.rank > 0)
        .sort((a, b) => a.rank - b.rank)
        .slice(0, 20);

      const groupIds = Array.from(
        new Set(rowsData.map((row) => row.group_id).filter((groupId) => groupId.length > 0))
      );

      if (groupIds.length > 0) {
        const { data: groupsData } = await supabase
          .schema("imd")
          .from("groups")
          .select("id,slug,artist_image_url")
          .in("id", groupIds);

        const map = new Map<string, GroupSlugRow>(
          ((groupsData ?? []) as GroupSlugRow[]).map((group) => [group.id, group])
        );
        setSlugMap(new Map(Array.from(map.entries()).map(([id, group]) => [id, group.slug])));
        setRows(
          rowsData.map((row) => ({
            ...row,
            artist_image_url: map.get(row.group_id)?.artist_image_url ?? null,
          }))
        );
      } else {
        setSlugMap(new Map());
        setRows(rowsData);
      }

      if (source === "weekly") {
        const { data: playlistRow, error: playlistError } = await supabase
          .schema("ihc")
          .from("weekly_playlists")
          .select("spotify_embed_url,spotify_playlist_url")
          .eq("week_end_date", targetDate)
          .maybeSingle();

        if (!playlistError) {
          const embedUrl =
            pickString((playlistRow ?? null) as RowRecord, ["spotify_embed_url"]) ??
            pickString((playlistRow ?? null) as RowRecord, ["spotify_playlist_url"]);
          if (embedUrl) {
            setPlaylistEmbedLink(embedUrl);
          } else {
            const firstRow = ((data ?? [])[0] ?? null) as RowRecord | null;
            setPlaylistEmbedLink(
              firstRow
                ? pickString(firstRow, [
                    "playlist_embed_link",
                    "spotify_playlist_embed_link",
                    "weekly_playlist_embed_link",
                  ])
                : null
            );
          }
        } else {
          const firstRow = ((data ?? [])[0] ?? null) as RowRecord | null;
          setPlaylistEmbedLink(
            firstRow
              ? pickString(firstRow, [
                  "playlist_embed_link",
                  "spotify_playlist_embed_link",
                  "weekly_playlist_embed_link",
                ])
              : null
          );
        }
      } else {
        setPlaylistEmbedLink(null);
      }

      setActiveDate(targetDate);
      setStatus("idle");
    };

    run().catch((err: unknown) => {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Unknown error");
    });
  }, [date, source]);

  const config = useMemo(() => getRankingConfig(source), [source]);
  const dateLabel = useMemo(() => (activeDate ? formatJapaneseDate(activeDate) : ""), [activeDate]);
  const eyebrowLabel =
    source === "daily" && dateLabel
      ? dateLabel
      : source === "weekly" && activeDate
        ? formatWeeklyRangeLabel(activeDate)
        : `IMAKITE RANKING ${config.label}`;

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
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-400">
            {eyebrowLabel}
          </p>
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">
            {title ?? config.defaultTitle}
          </h2>
          {source !== "daily" && source !== "weekly" && dateLabel && (
            <p className="mt-2 text-sm text-zinc-300">{dateLabel}</p>
          )}
        </div>
        {showArchiveLink && (
          <Link
            href={config.archiveHref}
            className="rounded-full border border-zinc-700 px-4 py-2 text-xs text-zinc-200 hover:border-zinc-500"
          >
            過去のランキングを見る →
          </Link>
        )}
      </div>

      {source === "weekly" && playlistEmbedLink && (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
          <iframe
            title="Weekly Playlist"
            src={playlistEmbedLink}
            width="100%"
            height={352}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          />
        </div>
      )}

      {status === "loading" && <p className="text-sm text-zinc-400">読み込み中...</p>}

      {status === "idle" && rows.length === 0 && (
        <p className="text-sm text-zinc-400">該当日のランキングがありません。</p>
      )}

      {source === "daily" ? (
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

              <div className="relative flex h-full flex-col justify-start gap-4 p-5">
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
                  <div className="mt-auto overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                    <iframe
                      title={`${row.artist_name} - ${row.latest_track_name ?? "Spotify"}`}
                      src={row.latest_track_embed_link}
                      width="100%"
                      height={row.rank === 1 ? 152 : 80}
                      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="mt-auto rounded-2xl border border-white/10 bg-black/30 px-4 py-6 text-sm text-zinc-300">
                    Spotify埋め込みがありません。
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((row) => (
            <article
              key={`${row.snapshot_date}-${row.rank}-${row.group_id}`}
              className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70 shadow-lg backdrop-blur"
            >
              <div className="flex items-start gap-4 p-4 sm:p-5">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-slate-800 sm:h-24 sm:w-24">
                  {row.artist_image_url ? (
                    <img
                      src={row.artist_image_url}
                      alt={row.artist_name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900" />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-amber-300">{row.rank}位</p>
                      <h3 className="truncate text-xl font-semibold text-white sm:text-2xl">
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
                    </div>
                    <div className="rounded-full bg-black/40 px-3 py-1 text-sm font-semibold text-amber-200">
                      {formatScore(row.score)} pts
                    </div>
                  </div>
                  {row.latest_track_name && (
                    <p className="truncate text-sm text-zinc-200">♪ {row.latest_track_name}</p>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function formatArchiveDateLabel(dateString: string) {
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-");
  if (!year || !month || !day) return dateString;
  return `${year}年${month}月${day}日`;
}

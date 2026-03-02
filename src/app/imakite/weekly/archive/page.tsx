"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatArchiveDateLabel } from "../../ranking-list";

type Status = "idle" | "loading" | "error";

type ArchiveRow = {
  week_end_date?: string;
  snapshot_date?: string;
  week_start_date?: string;
  week_date?: string;
};

type PlaylistRow = {
  week_end_date: string;
  spotify_embed_url: string | null;
  spotify_playlist_url: string | null;
};

function extractDate(row: ArchiveRow) {
  return row.week_end_date ?? row.snapshot_date ?? row.week_start_date ?? row.week_date ?? null;
}

function toEmbedUrl(row: PlaylistRow): string | null {
  if (row.spotify_embed_url) {
    return row.spotify_embed_url;
  }
  if (!row.spotify_playlist_url) {
    return null;
  }

  const match = row.spotify_playlist_url.match(/spotify\.com\/playlist\/([A-Za-z0-9]+)/);
  if (!match) {
    return null;
  }
  return `https://open.spotify.com/embed/playlist/${match[1]}`;
}

export default function ImakiteWeeklyArchivePage() {
  const [dates, setDates] = useState<string[]>([]);
  const [playlistMap, setPlaylistMap] = useState<Map<string, PlaylistRow>>(new Map());
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    const run = async () => {
      setStatus("loading");
      const supabase = createClient();

      const [rankingsRes, playlistsRes] = await Promise.all([
        supabase
          .schema("ihc")
          .from("weekly_rankings")
          .select("week_end_date")
          .order("week_end_date", { ascending: false }),
        supabase
          .schema("ihc")
          .from("weekly_playlists")
          .select("week_end_date,spotify_embed_url,spotify_playlist_url"),
      ]);

      if (rankingsRes.error) {
        setStatus("error");
        setMessage(rankingsRes.error.message);
        return;
      }

      const rows = (rankingsRes.data ?? []) as ArchiveRow[];
      const uniqueDates = Array.from(
        new Set(rows.map((row) => extractDate(row)).filter((date): date is string => !!date))
      );
      setDates(uniqueDates);

      if (!playlistsRes.error) {
        const playlists = (playlistsRes.data ?? []) as PlaylistRow[];
        setPlaylistMap(new Map(playlists.map((row) => [row.week_end_date, row])));
      } else {
        setPlaylistMap(new Map());
      }

      setStatus("idle");
    };

    run().catch((err: unknown) => {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Unknown error");
    });
  }, []);

  const dateList = useMemo(() => dates, [dates]);

  return (
    <div className="min-h-screen bg-[var(--ui-page)] text-[var(--ui-text)]">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-16">
        <header className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--ui-link)]">
            IMAKITE WEEKLY ARCHIVE
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/imakite/archive"
              className="rounded-full border border-zinc-500 px-4 py-2 text-xs text-black hover:border-zinc-400"
            >
              Daily Archive
            </Link>
            <Link
              href="/imakite/weekly/archive"
              className="rounded-full border border-zinc-500 bg-zinc-100 px-4 py-2 text-xs font-semibold text-black"
            >
              Weekly Archive
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-mincho-jp text-3xl font-semibold text-zinc-900 sm:text-4xl">過去の週間ランキング</h1>
            <Link
              href="/imakite/weekly"
              className="rounded-full border border-zinc-500 px-4 py-2 text-xs text-zinc-800 hover:border-zinc-400"
            >
              最新週間ランキングへ →
            </Link>
          </div>
          <p className="text-sm text-zinc-700">
            日付を選択すると、その週のランキング詳細へ移動します。
          </p>
        </header>

        {status === "error" && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-100">
            アーカイブの取得に失敗しました: {message}
          </div>
        )}

        {status === "loading" && <p className="text-sm text-zinc-600">読み込み中...</p>}

        {status === "idle" && dateList.length === 0 && (
          <p className="text-sm text-zinc-600">アーカイブがありません。</p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {dateList.map((date) => {
            const playlist = playlistMap.get(date);
            const embedUrl = playlist ? toEmbedUrl(playlist) : null;

            return (
              <article
                key={date}
                className="rounded-2xl border border-zinc-400 bg-[var(--ui-panel)] p-4 text-sm text-[var(--ui-text)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/imakite/weekly/ranking/${date}`}
                    className="font-semibold hover:text-zinc-700"
                  >
                    {formatArchiveDateLabel(date)}
                  </Link>
                  <Link
                    href={`/imakite/weekly/ranking/${date}`}
                    className="text-xs text-[var(--ui-link)] hover:text-[var(--ui-link-hover)]"
                  >
                    ランキングを見る →
                  </Link>
                </div>

                {embedUrl ? (
                  <div className="mt-3 overflow-hidden rounded-xl border border-zinc-400 bg-[var(--ui-panel-soft)]">
                    <iframe
                      title={`Weekly Playlist ${date}`}
                      src={embedUrl}
                      width="100%"
                      height={152}
                      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-zinc-600">プレイリスト未登録</p>
                )}
              </article>
            );
          })}
        </div>
      </main>
    </div>
  );
}

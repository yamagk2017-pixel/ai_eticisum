"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DailyTopRow } from "../ranking-list";

type Status = "idle" | "loading" | "error" | "success";

export default function ImakiteAdminPage() {
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [latestDate, setLatestDate] = useState<string>("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");
  const [rows, setRows] = useState<DailyTopRow[]>([]);

  useEffect(() => {
    const run = async () => {
      setStatus("loading");
      const supabase = createClient();
      const { data, error } = await supabase
        .schema("ihc")
        .from("daily_top20")
        .select("snapshot_date")
        .order("snapshot_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        setStatus("error");
        setMessage(error.message);
        return;
      }

      const date = data?.snapshot_date ?? "";
      setLatestDate(date);
      setSelectedDate(date);
      setStatus("idle");
    };

    run().catch((err: unknown) => {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Unknown error");
    });
  }, []);

  const fetchRanking = async () => {
    if (!selectedDate) {
      setStatus("error");
      setMessage("日付が選択されていません。");
      return;
    }

    setStatus("loading");
    const supabase = createClient();
    const { data, error } = await supabase
      .schema("ihc")
      .from("daily_top20")
      .select(
        "snapshot_date,group_id,rank,artist_name,score,latest_track_name,latest_track_embed_link,artist_image_url"
      )
      .eq("snapshot_date", selectedDate)
      .order("rank", { ascending: true });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setRows((data ?? []) as DailyTopRow[]);
    setStatus("success");
    setMessage("");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-16">
        <header className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-400">
            IMAKITE ADMIN
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl font-semibold sm:text-4xl">ランキング取り込み</h1>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/imakite"
                className="rounded-full border border-zinc-700 px-4 py-2 text-xs text-zinc-200 hover:border-zinc-500"
              >
                最新ランキングへ →
              </Link>
              <Link
                href="/imakite/archive"
                className="rounded-full border border-zinc-700 px-4 py-2 text-xs text-zinc-200 hover:border-zinc-500"
              >
                アーカイブ一覧へ →
              </Link>
            </div>
          </div>
          <p className="text-sm text-zinc-300">
            `ihc.daily_top20` から選択日のランキングデータを取得します。
          </p>
        </header>

        {status === "error" && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-100">
            取得に失敗しました: {message}
          </div>
        )}

        <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-zinc-300" htmlFor="imakite-date">
                対象日
              </label>
              <input
                id="imakite-date"
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white"
              />
              {latestDate && (
                <p className="text-xs text-zinc-400">最新日: {latestDate}</p>
              )}
            </div>
            <button
              type="button"
              onClick={fetchRanking}
              className="rounded-full bg-amber-500 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={status === "loading"}
            >
              ランキングデータ取得
            </button>
          </div>

          {status === "loading" && (
            <p className="mt-4 text-sm text-zinc-300">取得中...</p>
          )}

          {status === "success" && (
            <div className="mt-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
              取得完了: {rows.length}件
            </div>
          )}

          {status === "success" && rows.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-zinc-400">プレビュー（Top5）</p>
              <ol className="mt-3 grid gap-2 sm:grid-cols-2">
                {rows.slice(0, 5).map((row) => (
                  <li
                    key={`${row.snapshot_date}-${row.rank}-${row.group_id}`}
                    className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-200"
                  >
                    {row.rank}位 {row.artist_name}
                  </li>
                ))}
              </ol>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/imakite"
                  className="rounded-full border border-amber-400/60 px-4 py-2 text-xs text-amber-200 hover:border-amber-300"
                >
                  最新ランキングを確認 →
                </Link>
                <Link
                  href={`/imakite/ranking/${selectedDate}`}
                  className="rounded-full border border-zinc-700 px-4 py-2 text-xs text-zinc-200 hover:border-zinc-500"
                >
                  指定日ランキングへ →
                </Link>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

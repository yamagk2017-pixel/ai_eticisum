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

function extractDate(row: ArchiveRow) {
  return row.week_end_date ?? row.snapshot_date ?? row.week_start_date ?? row.week_date ?? null;
}

export default function ImakiteWeeklyArchivePage() {
  const [dates, setDates] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    const run = async () => {
      setStatus("loading");
      const supabase = createClient();
      const dateColumns = ["week_end_date", "snapshot_date", "week_start_date", "week_date"];

      for (const column of dateColumns) {
        const { data, error } = await supabase
          .schema("ihc")
          .from("weekly_rankings")
          .select(column)
          .order(column, { ascending: false });

        if (error) {
          continue;
        }

        const rows = (data ?? []) as ArchiveRow[];
        const uniqueDates = Array.from(
          new Set(rows.map((row) => extractDate(row)).filter((date): date is string => !!date))
        );
        setDates(uniqueDates);
        setStatus("idle");
        return;
      }

      setStatus("error");
      setMessage("週次アーカイブの日付列を取得できませんでした。");
    };

    run().catch((err: unknown) => {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Unknown error");
    });
  }, []);

  const dateList = useMemo(() => dates, [dates]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-16">
        <header className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-400">
            IMAKITE WEEKLY ARCHIVE
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/imakite/archive"
              className="rounded-full border border-zinc-700 px-4 py-2 text-xs text-zinc-200 hover:border-zinc-500"
            >
              Daily Archive
            </Link>
            <Link
              href="/imakite/weekly/archive"
              className="rounded-full border border-amber-400/70 bg-amber-500/20 px-4 py-2 text-xs font-semibold text-amber-200"
            >
              Weekly Archive
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl font-semibold sm:text-4xl">過去の週間ランキング</h1>
            <Link
              href="/imakite/weekly"
              className="rounded-full border border-zinc-700 px-4 py-2 text-xs text-zinc-200 hover:border-zinc-500"
            >
              最新週間ランキングへ →
            </Link>
          </div>
          <p className="text-sm text-zinc-300">
            日付を選択すると、その週のランキング詳細へ移動します。
          </p>
        </header>

        {status === "error" && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-100">
            アーカイブの取得に失敗しました: {message}
          </div>
        )}

        {status === "loading" && <p className="text-sm text-zinc-400">読み込み中...</p>}

        {status === "idle" && dateList.length === 0 && (
          <p className="text-sm text-zinc-400">アーカイブがありません。</p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {dateList.map((date) => (
            <Link
              key={date}
              href={`/imakite/weekly/ranking/${date}`}
              className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-4 text-sm text-zinc-200 hover:border-amber-400/60 hover:text-white"
            >
              {formatArchiveDateLabel(date)}
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatArchiveDateLabel } from "../ranking-list";

type Status = "idle" | "loading" | "error";

type ArchiveRow = {
  snapshot_date: string;
};

export default function ImakiteArchivePage() {
  const [dates, setDates] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    const run = async () => {
      setStatus("loading");
      const supabase = createClient();
      const { data, error } = await supabase
        .schema("ihc")
        .from("daily_top20")
        .select("snapshot_date")
        .order("snapshot_date", { ascending: false });

      if (error) {
        setStatus("error");
        setMessage(error.message);
        return;
      }

      const rows = (data ?? []) as ArchiveRow[];
      const uniqueDates = Array.from(new Set(rows.map((row) => row.snapshot_date)));
      setDates(uniqueDates);
      setStatus("idle");
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
            IMAKITE ARCHIVE
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl font-semibold sm:text-4xl">過去のランキング</h1>
            <Link
              href="/imakite"
              className="rounded-full border border-zinc-700 px-4 py-2 text-xs text-zinc-200 hover:border-zinc-500"
            >
              最新ランキングへ →
            </Link>
          </div>
          <p className="text-sm text-zinc-300">
            日付を選択すると、その日のランキング詳細へ移動します。
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
              href={`/imakite/ranking/${date}`}
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

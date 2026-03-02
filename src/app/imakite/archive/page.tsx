"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatArchiveDateLabel } from "../ranking-list";

type Status = "idle" | "loading" | "error";

type ArchiveRow = {
  snapshot_date: string;
};

const PAGE_SIZE = 28;

function parsePage(value: string | null): number {
  if (!value) return 1;
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.trunc(n));
}

function buildArchiveHref(page: number): string {
  return page <= 1 ? "/imakite/archive" : `/imakite/archive?page=${page}`;
}

function ImakiteArchiveContent() {
  const [dates, setDates] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");
  const searchParams = useSearchParams();

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
  const currentPage = parsePage(searchParams.get("page"));
  const totalPages = Math.max(1, Math.ceil(dateList.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const pagedDates = dateList.slice(startIndex, startIndex + PAGE_SIZE);

  return (
    <div className="min-h-screen bg-[var(--ui-page)] text-[var(--ui-text)]">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-16">
        <header className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--ui-link)]">
            IMAKITE ARCHIVE
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/imakite/archive"
              className="rounded-full border border-zinc-500 bg-zinc-100 px-4 py-2 text-xs font-semibold text-black"
            >
              Daily Archive
            </Link>
            <Link
              href="/imakite/weekly/archive"
              className="rounded-full border border-zinc-500 px-4 py-2 text-xs text-black hover:border-zinc-400"
            >
              Weekly Archive
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-mincho-jp text-3xl font-semibold text-zinc-900 sm:text-4xl">過去のランキング</h1>
            <Link
              href="/imakite"
              className="rounded-full border border-zinc-500 px-4 py-2 text-xs text-zinc-800 hover:border-zinc-400"
            >
              最新ランキングへ →
            </Link>
          </div>
          <p className="text-sm text-zinc-700">
            日付を選択すると、その日のランキング詳細へ移動します。
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

        {status === "idle" && dateList.length > 0 && (
          <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
            {safePage > 1 ? (
              <Link
                href={buildArchiveHref(safePage - 1)}
                className="rounded-lg border border-zinc-400 px-3 py-2 text-zinc-800"
              >
                前へ
              </Link>
            ) : (
              <span className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-500">前へ</span>
            )}
            <span className="px-1 text-zinc-700">
              {safePage} / {totalPages}
            </span>
            {safePage < totalPages ? (
              <Link
                href={buildArchiveHref(safePage + 1)}
                className="rounded-lg border border-zinc-400 px-3 py-2 text-zinc-800"
              >
                次へ
              </Link>
            ) : (
              <span className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-500">次へ</span>
            )}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {pagedDates.map((date) => (
            <Link
              key={date}
              href={`/imakite/ranking/${date}`}
              className="rounded-2xl border border-zinc-400 bg-[var(--ui-panel)] px-4 py-4 text-sm text-[var(--ui-text)] hover:border-zinc-500"
            >
              {formatArchiveDateLabel(date)}
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}

export default function ImakiteArchivePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--ui-page)] text-[var(--ui-text)]">
          <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-16">
            <p className="text-sm text-zinc-600">読み込み中...</p>
          </main>
        </div>
      }
    >
      <ImakiteArchiveContent />
    </Suspense>
  );
}

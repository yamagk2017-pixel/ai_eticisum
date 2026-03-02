"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ImakiteRankingList } from "../../ranking-list";

export default function ImakiteRankingDatePage() {
  const params = useParams();
  const dateParam = typeof params?.date === "string" ? params.date : "";

  return (
    <div className="min-h-screen bg-[var(--ui-page)] text-[var(--ui-text)]">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16">
        <header className="flex flex-col gap-4">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--ui-link)]">
            IMAKITE RANKING
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/imakite"
              className="imakite-chip-active rounded-full border border-zinc-500 bg-zinc-100 px-4 py-2 text-xs font-semibold text-black"
            >
              Daily
            </Link>
            <Link
              href="/imakite/weekly"
              className="rounded-full border border-zinc-500 px-4 py-2 text-xs text-black hover:border-zinc-400"
            >
              Weekly
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-mincho-jp text-3xl font-semibold text-zinc-900 sm:text-4xl">日付別ランキング</h1>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/imakite/archive"
                className="rounded-full border border-zinc-500 px-4 py-2 text-xs text-zinc-800 hover:border-zinc-400"
              >
                アーカイブ一覧へ →
              </Link>
              <Link
                href="/imakite"
                className="rounded-full border border-zinc-500 px-4 py-2 text-xs text-zinc-800 hover:border-zinc-400"
              >
                最新ランキングへ →
              </Link>
            </div>
          </div>
        </header>

        <ImakiteRankingList date={dateParam} title="指定日のランキング" showArchiveLink={false} />
      </main>
    </div>
  );
}

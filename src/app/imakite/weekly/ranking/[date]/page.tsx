"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ImakiteRankingList } from "../../../ranking-list";

export default function ImakiteWeeklyRankingDatePage() {
  const params = useParams();
  const dateParam = typeof params?.date === "string" ? params.date : "";

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16">
        <header className="flex flex-col gap-4">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-400">
            IMAKITE WEEKLY RANKING
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/imakite"
              className="rounded-full border border-zinc-700 px-4 py-2 text-xs text-zinc-200 hover:border-zinc-500"
            >
              Daily
            </Link>
            <Link
              href="/imakite/weekly"
              className="rounded-full border border-amber-400/70 bg-amber-500/20 px-4 py-2 text-xs font-semibold text-amber-200"
            >
              Weekly
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl font-semibold sm:text-4xl">週次ランキング</h1>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/imakite/weekly/archive"
                className="rounded-full border border-zinc-700 px-4 py-2 text-xs text-zinc-200 hover:border-zinc-500"
              >
                週次アーカイブ一覧へ →
              </Link>
              <Link
                href="/imakite/weekly"
                className="rounded-full border border-zinc-700 px-4 py-2 text-xs text-zinc-200 hover:border-zinc-500"
              >
                最新週間ランキングへ →
              </Link>
            </div>
          </div>
        </header>

        <ImakiteRankingList
          source="weekly"
          date={dateParam}
          title="指定週のランキング"
          showArchiveLink={false}
        />
      </main>
    </div>
  );
}

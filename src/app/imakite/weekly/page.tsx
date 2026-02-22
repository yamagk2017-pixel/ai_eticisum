"use client";

import Link from "next/link";
import { ImakiteRankingList } from "../ranking-list";

export default function ImakiteWeeklyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16">
        <header className="flex flex-col gap-4">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-400">
            毎週火曜日発表！
          </p>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-3xl font-semibold leading-tight sm:text-5xl">
              イマキテ週間ランキング
            </h1>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/imakite/weekly/archive"
                className="rounded-full border border-zinc-700 px-4 py-2 text-xs text-zinc-200 hover:border-zinc-500"
              >
                過去の週間ランキングを見る →
              </Link>
            </div>
          </div>
          <p className="max-w-2xl text-base text-zinc-300 sm:text-lg">
            イマキテランキングの一週間のデータを集計。週間TOP20を発表します。
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
        </header>

        <ImakiteRankingList source="weekly" showArchiveLink />
      </main>
    </div>
  );
}

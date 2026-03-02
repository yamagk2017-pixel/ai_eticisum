"use client";

import Link from "next/link";
import { ImakiteRankingList } from "../ranking-list";

export default function ImakiteWeeklyPage() {
  return (
    <div className="min-h-screen bg-[var(--ui-page)] text-white">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-10 py-16 sm:px-12">
        <header className="flex flex-col gap-4">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-400">
            毎週火曜日発表！
          </p>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="font-serif text-3xl font-semibold leading-tight text-zinc-900 sm:text-5xl">
              イマキテ週間ランキング
            </h1>
          </div>
          <p className="max-w-2xl text-base text-zinc-700 sm:text-lg">
            イマキテランキングの一週間のデータを集計。週間TOP20を発表します。
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/imakite"
              className="rounded-full border border-zinc-500 px-4 py-2 text-xs text-black hover:border-zinc-400"
            >
              Daily
            </Link>
            <Link
              href="/imakite/weekly"
              className="imakite-chip-active rounded-full border border-zinc-500 bg-zinc-100 px-4 py-2 text-xs font-semibold text-black"
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

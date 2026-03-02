"use client";

import Link from "next/link";
import { ImakiteRankingList } from "./ranking-list";

export default function ImakitePage() {
  return (
    <div className="min-h-screen bg-[var(--ui-page)] text-white">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-10 py-16 sm:px-12">
        <header className="flex flex-col gap-4">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-400">
            毎日更新！
          </p>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="font-serif text-3xl font-semibold leading-tight text-zinc-900 sm:text-5xl">
              イマキテランキング
            </h1>
          </div>
          <p className="max-w-4xl text-base text-zinc-700 sm:text-lg">
            Spotifyのデータを毎日集計＆毎日発表。イマキテるアイドルTOP20がひと目で分かるランキング！
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/imakite"
              className="rounded-full border border-zinc-500 bg-zinc-100 px-4 py-2 text-xs font-semibold text-black"
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
        </header>

        <ImakiteRankingList showArchiveLink />
      </main>
    </div>
  );
}

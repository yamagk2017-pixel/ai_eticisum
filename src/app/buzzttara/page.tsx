import Link from "next/link";
import { BuzzList } from "./buzz-list";

export default function BuzzttaraPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16">
        <header className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-400">BUZZTTARA</p>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-3xl font-semibold leading-tight sm:text-5xl">
              アイドル界隈でバズった投稿を追う
            </h1>
            <Link
              href="/"
              className="rounded-full border border-zinc-700 px-4 py-2 text-xs text-zinc-200 hover:border-zinc-500"
            >
              ポータルへ戻る →
            </Link>
          </div>
          <p className="max-w-3xl text-base text-zinc-300 sm:text-lg">
            SNS上で話題化した投稿を集約し、注目トピックを素早く把握するためのタイムラインです。
          </p>
        </header>

        <BuzzList />
      </main>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { IMAKITE_PLAYLIST } from "@/lib/imakite-playlist";

export const metadata: Metadata = {
  title: `${IMAKITE_PLAYLIST.name} | IDOL CROSSING`,
  description: IMAKITE_PLAYLIST.description,
};

export default function ImakiteWeeklyPage() {
  return (
    <div className="min-h-screen bg-[var(--ui-page)] text-[var(--ui-text)]">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12 sm:px-12 sm:py-16">
        <header className="flex flex-col gap-4">
          <p className="text-xs font-semibold tracking-[0.15em] text-[var(--ui-link)]">
            毎週土曜更新 · 50曲
          </p>
          <h1 className="font-mincho-jp text-balance text-3xl font-semibold leading-tight sm:text-5xl">
            {IMAKITE_PLAYLIST.name}
          </h1>
          <p className="max-w-2xl text-base text-[var(--ui-text-muted)] sm:text-lg">
            {IMAKITE_PLAYLIST.description}
            {" "}
            <a
              href={IMAKITE_PLAYLIST.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[var(--ui-link)] underline underline-offset-2"
            >
              Spotifyで開く ↗
            </a>
          </p>
          <nav aria-label="イマキテ" className="flex flex-wrap gap-2">
            <Link
              href="/imakite"
              className="rounded-full border border-[var(--ui-border)] px-4 py-2 text-xs hover:text-[var(--ui-link)]"
            >
              Daily
            </Link>
            <Link
              href="/imakite/weekly"
              aria-current="page"
              className="imakite-chip-active rounded-full border border-[var(--ui-border)] px-4 py-2 text-xs font-semibold"
            >
              {IMAKITE_PLAYLIST.name}
            </Link>
          </nav>
        </header>

        <section aria-label="Spotifyプレイリスト" className="flex flex-col gap-4">
          <div className="overflow-hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-panel)]">
            <iframe
              title={IMAKITE_PLAYLIST.name}
              src={IMAKITE_PLAYLIST.embedUrl}
              width="100%"
              height={2900}
              className="block"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
            />
          </div>
        </section>

        <section aria-labelledby="weekly-archive-heading" className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-6">
          <h2 id="weekly-archive-heading" className="text-lg font-semibold">過去の週間ランキング</h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--ui-text-muted)]">
            旧週間ランキングの自動集計は休止しています。
            これまでの週間ランキングと当時のプレイリストは、アーカイブからご覧いただけます。
            日次ランキングは引き続き毎日更新しています。
          </p>
          <Link href="/imakite/weekly/archive" className="mt-4 inline-block text-sm font-semibold text-[var(--ui-link)] hover:underline">
            過去の週間ランキング・プレイリストを見る →
          </Link>
        </section>
      </main>
    </div>
  );
}

"use client";

import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-6xl space-y-5 px-6 py-16 text-[var(--ui-text)]"><h1 className="text-2xl font-semibold">追加曲の情報を取得できませんでした</h1><p>時間をおいて、もう一度お試しください。</p><button onClick={reset} className="rounded-lg border border-[var(--ui-border)] px-5 py-3">再読み込み</button><p><Link href="/relay-9147" className="text-[var(--ui-link)] underline">運用コンソールへ戻る</Link></p></main>;
}

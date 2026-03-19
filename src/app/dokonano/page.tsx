import type { Metadata } from "next";
import { DokonanoView } from "./dokonano-view";

export const metadata: Metadata = {
  title: "ドコナノ | IDOL CROSSING",
  description: "ハイプ・サイクルモデル（キャリア × 注目度）を可視化するページです。",
};

export default function DokonanoPage() {
  return (
    <div className="min-h-screen bg-[var(--ui-page)] text-[var(--ui-text)]">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-12 sm:px-10">
        <header className="space-y-2">
          <p className="text-xs font-semibold tracking-[0.08em] text-[var(--ui-text-subtle)]">IDOL CROSSING</p>
          <h1 className="font-mincho-jp text-3xl font-semibold sm:text-4xl">ドコナノ</h1>
          <p className="text-sm text-[var(--ui-text-muted)]">ハイプ・サイクルモデル（キャリア × 注目度）</p>
        </header>

        <DokonanoView />
      </main>
    </div>
  );
}

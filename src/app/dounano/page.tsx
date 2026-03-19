import type { Metadata } from "next";
import { DounanoView } from "./dounano-view";

export const metadata: Metadata = {
  title: "ドウナノ | IDOL CROSSING",
  description: "四象限モデル（音楽接触度 × ナラティブ密度）を可視化するページです。",
};

export default function DounanoPage() {
  return (
    <div className="min-h-screen bg-[var(--ui-page)] text-[var(--ui-text)]">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-12 sm:px-10">
        <header className="space-y-2">
          <p className="text-xs font-semibold tracking-[0.08em] text-[var(--ui-text-subtle)]">ウチのグループって…</p>
          <h1 className="font-mincho-jp text-3xl font-semibold sm:text-4xl">ドウナノ</h1>
          <p className="text-sm text-[var(--ui-text-muted)]">四象限モデル（音楽接触度 × ナラティブ密度）</p>
        </header>

        <DounanoView />
      </main>
    </div>
  );
}

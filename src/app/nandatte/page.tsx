import { GroupsList } from "./groups-list";
import { Rankings } from "./rankings";
import { ThemeToggle } from "@/components/theme-toggle";

export default function NandattePage() {
  return (
    <div className="min-h-screen bg-[var(--ui-page)] text-[var(--ui-text)]">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16">
        <header className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--ui-text-subtle)]">
              NANDATTE
            </p>
            <ThemeToggle />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-3xl font-semibold leading-tight sm:text-5xl">
              みんなに思われてるよ、を可視化する
            </h1>
            <a
              href="/nandatte/me"
              className="rounded-full border border-[var(--ui-border)] bg-[var(--ui-panel)] px-4 py-2 text-xs text-[var(--ui-text-muted)] hover:bg-[var(--ui-panel-soft)]"
            >
              マイ投票一覧 →
            </a>
          </div>
          <p className="max-w-2xl text-base text-[var(--ui-text-muted)] sm:text-lg">
            投票データから魅力のトップ5を見える化し、アイドルグループの文脈を記録していくランキング。
          </p>
        </header>

        <Rankings />

        <GroupsList />
      </main>
    </div>
  );
}

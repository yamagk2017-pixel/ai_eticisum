import { BuzzList } from "./buzz-list";

export default function BuzzttaraPage() {
  return (
    <div className="min-h-screen bg-[var(--ui-page)] text-[var(--ui-text)]">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-10 py-16 sm:px-12">
        <header className="flex flex-col gap-3">
          <p className="text-xs font-semibold tracking-[0.12em] text-[var(--ui-text-subtle)]">バズったアイドルがここに集結！</p>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="font-mincho-jp text-3xl font-semibold leading-tight sm:text-5xl">バズッタラ</h1>
          </div>
          <p className="max-w-3xl text-base text-[var(--ui-text-muted)] sm:text-lg">
            100万View以上を叩き出したアイドルのポストをアーカイブ！
          </p>
        </header>

        <BuzzList />
      </main>
    </div>
  );
}

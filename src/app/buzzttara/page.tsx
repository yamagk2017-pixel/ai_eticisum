import { BuzzList } from "./buzz-list";

export default function BuzzttaraPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16">
        <header className="flex flex-col gap-3">
          <p className="text-xs font-semibold tracking-[0.12em] text-zinc-400">バズったアイドルがここに集結！</p>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-3xl font-semibold leading-tight sm:text-5xl">バズッタラ</h1>
          </div>
          <p className="max-w-3xl text-base text-zinc-300 sm:text-lg">
            100万View以上を叩き出したアイドルのポストをアーカイブ！
          </p>
        </header>

        <BuzzList />
      </main>
    </div>
  );
}

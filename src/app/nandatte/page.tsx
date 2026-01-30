import { GroupsList } from "./groups-list";
import { Rankings } from "./rankings";

export default function NandattePage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16">
        <header className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-400">
            NANDATTE
          </p>
          <h1 className="text-3xl font-semibold leading-tight sm:text-5xl">
            みんなに思われてるよ、を可視化する
          </h1>
          <p className="max-w-2xl text-base text-zinc-300 sm:text-lg">
            投票データから魅力のトップ5を見える化し、アイドルグループの文脈を記録していくランキング。
          </p>
        </header>

        <Rankings />

        <GroupsList />
      </main>
    </div>
  );
}

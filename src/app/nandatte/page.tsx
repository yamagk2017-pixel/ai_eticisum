import { GroupsList } from "./groups-list";
import { Rankings } from "./rankings";

export default function NandattePage() {
  return (
    <div className="min-h-screen bg-[var(--ui-page)] text-[var(--ui-text)]">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16">
        <header className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold text-[var(--ui-text-subtle)]">
              あのグループって◯◯なんだって
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="text-3xl font-semibold leading-tight sm:text-5xl">ナンダッテ</h1>
          </div>
          <p className="max-w-4xl text-base text-[var(--ui-text-muted)] sm:text-lg">
            登録アイドル600組以上！ファンの投票で作っていくリアルなアイドルディクショナリー
          </p>
        </header>

        <GroupsList />

        <Rankings />
      </main>
    </div>
  );
}

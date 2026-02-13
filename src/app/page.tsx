import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16">
        <header className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-400">
            Musicite Portal
          </p>
          <h1 className="text-3xl font-semibold leading-tight sm:text-5xl">
            アイドル情報のハブになるポータル
          </h1>
          <p className="max-w-2xl text-base text-zinc-300 sm:text-lg">
            ナンダッテ、IHC、バズッタラ、ALT-IDOL Japan を統合し、
            ニュース・インタビュー・投票データを横断して届ける入口ページです。
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          <Link
            className="group rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 transition hover:border-zinc-500"
            href="/nandatte"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">ナンダッテ</h2>
              <span className="text-xs text-zinc-400">/nandatte</span>
            </div>
            <p className="mt-3 text-sm text-zinc-300">
              投票データから「みんなに思われてるよ」を可視化するランキング。
            </p>
            <p className="mt-4 text-xs text-zinc-500">
              近日: IHC・バズッタラ連動予定
            </p>
          </Link>
          <Link
            className="group rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 transition hover:border-zinc-500"
            href="/buzzttara"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">バズッタラ</h2>
              <span className="text-xs text-zinc-400">/buzzttara</span>
            </div>
            <p className="mt-3 text-sm text-zinc-300">
              アイドル界隈で話題化した投稿を収集し、バズの流れを時系列で確認できる一覧。
            </p>
            <p className="mt-4 text-xs text-zinc-500">v0既存アプリの移植版</p>
          </Link>
        </section>
      </main>
    </div>
  );
}

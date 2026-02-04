import Link from "next/link";
import { MyVotes } from "./votes";

export default function MyNandattePage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-16">
        <Link className="text-xs text-zinc-400 hover:text-white" href="/nandatte">
          ← ナンダッテ一覧に戻る
        </Link>
        <header className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-400">
            My NANDATTE
          </p>
          <h1 className="text-3xl font-semibold sm:text-4xl">投票したアーティスト</h1>
          <p className="text-sm text-zinc-300">
            あなたが投票したグループの一覧です。
          </p>
        </header>
        <MyVotes />
      </main>
    </div>
  );
}

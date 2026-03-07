import Link from "next/link";
import { Rankings } from "../rankings";

type PageProps = {
  searchParams?:
    | {
        focus?: string | string[];
      }
    | Promise<{
        focus?: string | string[];
      }>;
};

export default async function NandatteRankingPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const focusParam = Array.isArray(resolvedSearchParams?.focus)
    ? resolvedSearchParams.focus[0]
    : resolvedSearchParams?.focus;
  const prioritize = focusParam === "recent" ? "recent" : "vote";

  return (
    <div className="min-h-screen bg-[var(--ui-page)] text-[var(--ui-text)]">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-16 sm:px-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            className="text-xs text-[var(--ui-text-subtle)] hover:text-[var(--ui-text)]"
            href="/nandatte"
          >
            ← ナンダッテトップへ戻る
          </Link>
        </div>

        <header className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-[var(--ui-text-subtle)]">NANDATTE</p>
          <h1 className="font-mincho-jp text-3xl font-medium leading-tight sm:text-4xl">
            投票ランキング / 最新アップデート
          </h1>
        </header>

        <Rankings
          prioritize={prioritize}
          splitListColumns
          limit={10}
          loggedInLimit={20}
          layout="stacked"
        />
      </main>
    </div>
  );
}

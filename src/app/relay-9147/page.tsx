"use client";

import Link from "next/link";
import { useState } from "react";
import { ImakitePanel } from "./imakite-panel";
import { BuzzttaraPanel } from "./buzzttara-panel";

type Tab = "imakite" | "buzzttara";

export default function Relay9147Page() {
  const [tab, setTab] = useState<Tab>("imakite");

  return (
    <div className="min-h-screen bg-[var(--ui-page)] text-[var(--ui-text)]">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-16">
        <header className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--ui-text-subtle)]">Control Surface</p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl font-semibold sm:text-4xl">運用コンソール</h1>
            <Link
              href="/"
              className="rounded-full border border-[var(--ui-border)] px-4 py-2 text-xs text-[var(--ui-text)] hover:border-zinc-500"
            >
              ポータルへ戻る
            </Link>
          </div>
          <p className="text-sm text-[var(--ui-text-muted)]">IMAKITE と BUZZTTARA を単一画面で管理します。</p>
        </header>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab("imakite")}
              className={`rounded-full px-4 py-2 text-xs ${
                tab === "imakite"
                ? "bg-[var(--ui-accent)] text-[var(--ui-accent-contrast)]"
                : "border border-[var(--ui-border)] text-[var(--ui-text)] hover:border-zinc-500"
              }`}
            >
              IMAKITE
          </button>
          <button
            type="button"
            onClick={() => setTab("buzzttara")}
              className={`rounded-full px-4 py-2 text-xs ${
                tab === "buzzttara"
                ? "bg-[var(--ui-accent)] text-[var(--ui-accent-contrast)]"
                : "border border-[var(--ui-border)] text-[var(--ui-text)] hover:border-zinc-500"
              }`}
            >
              BUZZTTARA
          </button>
        </div>

        {tab === "imakite" && <ImakitePanel />}
        {tab === "buzzttara" && <BuzzttaraPanel />}
      </main>
    </div>
  );
}

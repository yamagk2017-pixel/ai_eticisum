import type { Metadata } from "next";
import { DokonanoView } from "./dokonano-view";
import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "ドコナノ | IDOL CROSSING",
  description: "ハイプ・サイクルモデル（キャリア × 注目度）を可視化するページです。",
};

type VoteSummaryRpcRow = {
  voter_count: number | string | null;
  group_count: number | string | null;
};

function toCount(value: number | string | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

async function getDokonanoCounts() {
  const supabase = createServerClient();

  const [summaryRes, totalGroupsRes] = await Promise.all([
    supabase.schema("nandatte").rpc("get_vote_summary"),
    supabase.schema("imd").from("groups").select("id", { count: "exact", head: true }),
  ]);

  const summaryRow = ((summaryRes.data ?? [])[0] ?? null) as VoteSummaryRpcRow | null;
  const postedGroups = toCount(summaryRow?.group_count);
  const totalGroups = toCount(totalGroupsRes.count);

  return { postedGroups, totalGroups };
}

export default function DokonanoPage() {
  const countsPromise = getDokonanoCounts().catch(() => ({ postedGroups: 0, totalGroups: 0 }));
  return <DokonanoPageContent countsPromise={countsPromise} />;
}

async function DokonanoPageContent({
  countsPromise,
}: {
  countsPromise: Promise<{ postedGroups: number; totalGroups: number }>;
}) {
  const counts = await countsPromise;

  return (
    <div className="min-h-screen bg-[var(--ui-page)] text-[var(--ui-text)]">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-12 sm:px-10">
        <header className="space-y-2">
          <p className="text-xs font-semibold tracking-[0.08em] text-[var(--ui-text-subtle)]">ウチのグループって…</p>
          <h1 className="font-mincho-jp text-3xl font-semibold sm:text-4xl">ドコナノ</h1>
          <p className="text-sm text-[var(--ui-text-muted)]">
            グループのキャリアと注目度（イマキテxナンダテ）で分かるグループの「ドコナノ」。現在{" "}
            {counts.postedGroups.toLocaleString("ja-JP")}/{counts.totalGroups.toLocaleString("ja-JP")} 組を表示。
          </p>
        </header>

        <DokonanoView />
      </main>
    </div>
  );
}

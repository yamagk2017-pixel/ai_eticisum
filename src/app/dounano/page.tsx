import type { Metadata } from "next";
import { DounanoView } from "./dounano-view";
import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "ドウナノ | IDOL CROSSING",
  description: "四象限モデル（音楽接触度 × ナラティブ密度）を可視化するページです。",
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

async function getDounanoCounts() {
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

export default function DounanoPage() {
  const countsPromise = getDounanoCounts().catch(() => ({ postedGroups: 0, totalGroups: 0 }));
  return <DounanoPageContent countsPromise={countsPromise} />;
}

async function DounanoPageContent({
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
          <h1 className="font-mincho-jp text-3xl font-semibold sm:text-4xl">ドウナノ</h1>
          <p className="text-sm text-[var(--ui-text-muted)]">
            イマキテランキング（楽曲接触）とナンダッテ（魅力投稿）。2つの指数で見えるグループの「ドウナノ」。現在{" "}
            {counts.postedGroups.toLocaleString("ja-JP")}/{counts.totalGroups.toLocaleString("ja-JP")} 組を表示。
          </p>
        </header>

        <DounanoView />
      </main>
    </div>
  );
}

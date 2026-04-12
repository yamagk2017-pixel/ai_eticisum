import { createServerClient } from "@/lib/supabase/server";
import { unstable_cache } from "next/cache";
import { GroupsList } from "./groups-list";
import { Rankings } from "./rankings";

export const revalidate = 60;

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

async function getNandatteVoteSummary() {
  const supabase = createServerClient();
  const { data, error } = await supabase.schema("nandatte").rpc("get_vote_summary");
  if (error) throw new Error(error.message);
  const row = ((data ?? [])[0] ?? null) as VoteSummaryRpcRow | null;

  return {
    voterCount: toCount(row?.voter_count),
    groupCount: toCount(row?.group_count),
  };
}

const getCachedNandatteVoteSummary = unstable_cache(getNandatteVoteSummary, ["nandatte-vote-summary-v1"], {
  revalidate,
});

export default async function NandattePage() {
  const summary = await getCachedNandatteVoteSummary().catch(() => ({
    voterCount: 0,
    groupCount: 0,
  }));

  return (
    <div className="min-h-screen bg-[var(--ui-page)] text-[var(--ui-text)]">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16 sm:px-12">
        <header className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold text-[var(--ui-text-subtle)]">
              あのグループって◯◯なんだって
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="font-mincho-jp text-3xl font-semibold leading-tight sm:text-5xl">ナンダッテ</h1>
          </div>
          <p className="max-w-4xl text-base text-[var(--ui-text-muted)] sm:text-lg">
            {summary.voterCount.toLocaleString("ja-JP")} 人のオタクが {summary.groupCount.toLocaleString("ja-JP")} 組のグループに投稿中！みんなで作るリアルなアイドルチャート
          </p>
        </header>

        <GroupsList />

        <Rankings showMoreLinks />
      </main>
    </div>
  );
}

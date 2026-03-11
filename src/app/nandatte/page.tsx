import { createServerClient } from "@/lib/supabase/server";
import { GroupsList } from "./groups-list";
import { Rankings } from "./rankings";

type VoteSummaryRow = {
  user_id: string | null;
};

async function getNandatteVoteSummary() {
  const supabase = createServerClient();
  const voterIds = new Set<string>();
  let voteCount = 0;
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .schema("nandatte")
      .from("votes")
      .select("user_id,group_id")
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as VoteSummaryRow[];
    for (const row of rows) {
      if (row.user_id) voterIds.add(row.user_id);
    }
    voteCount += rows.length;

    if (rows.length < pageSize) {
      break;
    }
    from += pageSize;
  }

  return {
    voterCount: voterIds.size,
    voteCount,
  };
}

export default async function NandattePage() {
  const summary = await getNandatteVoteSummary().catch(() => ({
    voterCount: 0,
    voteCount: 0,
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
            {summary.voterCount.toLocaleString("ja-JP")} 人のオタクが {summary.voteCount.toLocaleString("ja-JP")} 組のグループに投稿中！みんなで作るリアルなアイドルチャート
          </p>
        </header>

        <GroupsList />

        <Rankings showMoreLinks />
      </main>
    </div>
  );
}

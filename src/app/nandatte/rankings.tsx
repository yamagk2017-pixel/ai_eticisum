"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type RankingRow = {
  group_id: string;
  vote_count: number;
  last_vote_at: string | null;
};

type GroupRow = {
  id: string;
  name_ja: string | null;
  slug: string | null;
};

type RankItem = RankingRow & {
  name: string;
  slug: string | null;
};

export function Rankings() {
  const [voteTop, setVoteTop] = useState<RankItem[]>([]);
  const [recentTop, setRecentTop] = useState<RankItem[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    const run = async () => {
      setStatus("loading");
      const supabase = createClient();
      const [voteRes, recentRes] = await Promise.all([
        supabase.schema("nandatte").rpc("get_vote_top5"),
        supabase.schema("nandatte").rpc("get_recent_vote_top5"),
      ]);

      if (voteRes.error || recentRes.error) {
        setStatus("error");
        setMessage(voteRes.error?.message ?? recentRes.error?.message ?? "Unknown error");
        return;
      }

      const voteRows = (voteRes.data ?? []) as RankingRow[];
      const recentRows = (recentRes.data ?? []) as RankingRow[];
      const groupIds = Array.from(
        new Set([...voteRows, ...recentRows].map((row) => row.group_id))
      );

      let groups: GroupRow[] = [];
      if (groupIds.length > 0) {
        const { data } = await supabase
          .schema("imd")
          .from("groups")
          .select("id,name_ja,slug")
          .in("id", groupIds);
        groups = data ?? [];
      }

      const groupMap = new Map(groups.map((group) => [group.id, group]));

      const toRankItem = (row: RankingRow): RankItem => {
        const group = groupMap.get(row.group_id);
        return {
          ...row,
          name: group?.name_ja ?? row.group_id,
          slug: group?.slug ?? null,
        };
      };

      setVoteTop(voteRows.map(toRankItem));
      setRecentTop(recentRows.map(toRankItem));
      setStatus("idle");
    };

    run().catch((err: unknown) => {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Unknown error");
    });
  }, []);

  const voteList = useMemo(() => voteTop.slice(0, 5), [voteTop]);
  const recentList = useMemo(() => recentTop.slice(0, 5), [recentTop]);

  if (status === "error") {
    return (
      <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-100">
        ランキングの取得に失敗しました: {message}
      </div>
    );
  }

  return (
    <section className="grid gap-6 md:grid-cols-2">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">投票ランキング TOP5</h2>
          <span className="text-xs text-zinc-400">投票数ベース</span>
        </div>
        {status === "loading" && (
          <p className="mt-4 text-sm text-zinc-400">読み込み中...</p>
        )}
        {status === "idle" && voteList.length === 0 && (
          <p className="mt-4 text-sm text-zinc-400">まだ投票がありません。</p>
        )}
        <ol className="mt-4 flex flex-col gap-3 text-sm text-zinc-200">
          {voteList.map((item, index) => (
            <li key={`${item.group_id}-${index}`} className="rounded-xl border border-zinc-800 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {index + 1}.{" "}
                  {item.slug ? (
                    <Link className="hover:text-white" href={`/nandatte/${item.slug}`}>
                      {item.name}
                    </Link>
                  ) : (
                    item.name
                  )}
                </span>
                <span className="text-xs text-zinc-400">{item.vote_count}票</span>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">更新順 TOP5</h2>
          <span className="text-xs text-zinc-400">最新投票順</span>
        </div>
        {status === "loading" && (
          <p className="mt-4 text-sm text-zinc-400">読み込み中...</p>
        )}
        {status === "idle" && recentList.length === 0 && (
          <p className="mt-4 text-sm text-zinc-400">まだ更新がありません。</p>
        )}
        <ol className="mt-4 flex flex-col gap-3 text-sm text-zinc-200">
          {recentList.map((item, index) => (
            <li key={`${item.group_id}-${index}`} className="rounded-xl border border-zinc-800 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {index + 1}.{" "}
                  {item.slug ? (
                    <Link className="hover:text-white" href={`/nandatte/${item.slug}`}>
                      {item.name}
                    </Link>
                  ) : (
                    item.name
                  )}
                </span>
                <span className="text-xs text-zinc-400">
                  {item.last_vote_at
                    ? new Date(item.last_vote_at).toLocaleDateString("ja-JP")
                    : "-"}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

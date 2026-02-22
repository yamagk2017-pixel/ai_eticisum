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
  artist_image_url: string | null;
  image_url?: string | null;
};

type RankItem = RankingRow & {
  name: string;
  slug: string | null;
  imageUrl: string | null;
};

function formatShortDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ja-JP");
}

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
      const groupIds = Array.from(new Set([...voteRows, ...recentRows].map((row) => row.group_id)));

      let groups: GroupRow[] = [];
      if (groupIds.length > 0) {
        const groupsRes = await supabase
          .schema("imd")
          .from("groups")
          .select("id,name_ja,slug,artist_image_url")
          .in("id", groupIds);

        if (!groupsRes.error) {
          groups = (groupsRes.data ?? []) as GroupRow[];
        }
      }

      const groupMap = new Map(groups.map((group) => [group.id, group]));
      const toRankItem = (row: RankingRow): RankItem => {
        const group = groupMap.get(row.group_id);
        return {
          ...row,
          name: group?.name_ja ?? row.group_id,
          slug: group?.slug ?? null,
          imageUrl: group?.artist_image_url ?? null,
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
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">投票ランキング</h2>
        </div>
        {status === "loading" && (
          <p className="mt-4 text-sm text-zinc-400">読み込み中...</p>
        )}
        {status === "idle" && voteList.length === 0 && (
          <p className="mt-4 text-sm text-zinc-400">まだ投票がありません。</p>
        )}
        <ol className="mt-4 flex flex-col gap-1 text-base text-zinc-200">
          {voteList.map((item, index) => (
            <li key={`${item.group_id}-${index}`} className="p-0">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md border border-zinc-700 bg-zinc-800/60">
                    <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-zinc-700 to-zinc-800 text-[10px] text-zinc-300">
                      {item.name.slice(0, 1)}
                    </div>
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="relative h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : null}
                  </div>
                  <span className="min-w-0 truncate font-medium">
                    <span className="mr-2 text-sm text-zinc-400">{index + 1}.</span>
                    {item.slug ? (
                      <Link
                        className="underline decoration-zinc-500 underline-offset-2 hover:text-white"
                        href={`/nandatte/${item.slug}`}
                      >
                        {item.name}
                      </Link>
                    ) : (
                      item.name
                    )}
                  </span>
                </div>
                <span className="text-xs text-zinc-400">{item.vote_count}票</span>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">最新アップデート</h2>
        </div>
        {status === "loading" && (
          <p className="mt-4 text-sm text-zinc-400">読み込み中...</p>
        )}
        {status === "idle" && recentList.length === 0 && (
          <p className="mt-4 text-sm text-zinc-400">まだ更新がありません。</p>
        )}
        <ol className="mt-4 flex flex-col gap-1 text-base text-zinc-200">
          {recentList.map((item, index) => (
            <li key={`${item.group_id}-${index}`} className="p-0">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md border border-zinc-700 bg-zinc-800/60">
                    <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-zinc-700 to-zinc-800 text-[10px] text-zinc-300">
                      {item.name.slice(0, 1)}
                    </div>
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="relative h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : null}
                  </div>
                  <span className="min-w-0 truncate font-medium">
                    <span className="mr-2 text-sm text-zinc-400">{index + 1}.</span>
                    {item.slug ? (
                      <Link
                        className="underline decoration-zinc-500 underline-offset-2 hover:text-white"
                        href={`/nandatte/${item.slug}`}
                      >
                        {item.name}
                      </Link>
                    ) : (
                      item.name
                    )}
                  </span>
                </div>
                <span className="text-xs text-zinc-400">
                  {formatShortDate(item.last_vote_at)}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

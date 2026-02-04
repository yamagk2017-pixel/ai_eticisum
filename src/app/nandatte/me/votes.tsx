"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type VoteRow = {
  id: string;
  group_id: string;
  created_at: string;
  updated_at: string;
};

type GroupRow = {
  id: string;
  name_ja: string | null;
  slug: string | null;
};

type VoteItem = VoteRow & {
  name: string;
  slug: string | null;
};

export function MyVotes() {
  const [votes, setVotes] = useState<VoteItem[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    const run = async () => {
      setStatus("loading");
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getUser();

      if (!authData?.user) {
        setStatus("idle");
        setMessage("ログインすると投票履歴が表示されます。");
        return;
      }

      const { data: voteRows, error } = await supabase
        .schema("nandatte")
        .from("votes")
        .select("id,group_id,created_at,updated_at")
        .eq("user_id", authData.user.id)
        .order("updated_at", { ascending: false });

      if (error) {
        setStatus("error");
        setMessage(error.message);
        return;
      }

      if (!voteRows || voteRows.length === 0) {
        setVotes([]);
        setStatus("idle");
        setMessage("まだ投票がありません。");
        return;
      }

      const groupIds = voteRows.map((row) => row.group_id);
      const { data: groupsData, error: groupError } = await supabase
        .schema("imd")
        .from("groups")
        .select("id,name_ja,slug")
        .in("id", groupIds);

      if (groupError) {
        setStatus("error");
        setMessage(groupError.message);
        return;
      }

      const groupMap = new Map(
        (groupsData ?? []).map((row: GroupRow) => [row.id, row])
      );
      const items = voteRows.map((row) => {
        const group = groupMap.get(row.group_id);
        return {
          ...row,
          name: group?.name_ja ?? row.group_id,
          slug: group?.slug ?? null,
        };
      });

      setVotes(items);
      setStatus("idle");
    };

    run().catch((err: unknown) => {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Unknown error");
    });
  }, []);

  if (status === "loading") {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-sm text-zinc-300">
        読み込み中...
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-100">
        読み込みに失敗しました: {message}
      </div>
    );
  }

  if (votes.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-sm text-zinc-300">
        {message}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
      <ul className="grid gap-3 text-sm text-zinc-200 sm:grid-cols-2">
        {votes.map((vote) => (
          <li key={vote.id} className="rounded-xl border border-zinc-800 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                {vote.slug ? (
                  <Link className="text-base font-semibold hover:text-white" href={`/nandatte/${vote.slug}`}>
                    {vote.name}
                  </Link>
                ) : (
                  <span className="text-base font-semibold">{vote.name}</span>
                )}
                <p className="mt-1 text-xs text-zinc-500">
                  最終投票: {new Date(vote.updated_at).toLocaleDateString("ja-JP")}
                </p>
              </div>
              {vote.slug && (
                <Link className="text-xs text-zinc-400 hover:text-white" href={`/nandatte/${vote.slug}`}>
                  詳細へ →
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

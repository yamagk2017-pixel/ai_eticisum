"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type GroupRow = {
  id: string | number;
  name_ja: string | null;
  slug: string | null;
};

export function GroupsList() {
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    const run = async () => {
      setStatus("loading");
      const supabase = createClient();
      const { data, error } = await supabase
        .schema("imd")
        .from("groups")
        .select("id,name_ja,slug")
        .order("name_ja", { ascending: true })
        .limit(50);

      if (error) {
        setStatus("error");
        setMessage(error.message);
        return;
      }

      setGroups(data ?? []);
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
        グループ一覧を読み込み中...
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

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
      <h2 className="text-xl font-semibold">グループ一覧</h2>
      <p className="mt-2 text-xs text-zinc-400">imd.groups から50件を表示</p>
      <ul className="mt-4 grid gap-2 text-sm text-zinc-200 sm:grid-cols-2">
        {groups.map((group) => (
          <li key={group.id} className="rounded-lg border border-zinc-800/60 p-3">
            {group.slug ? (
              <Link className="hover:text-white" href={`/nandatte/${group.slug}`}>
                {group.name_ja ?? group.slug}
              </Link>
            ) : (
              <span className="text-zinc-400">{group.name_ja ?? "No slug"}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

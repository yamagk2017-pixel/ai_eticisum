"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type GroupRow = {
  id: string | number;
  name_ja: string | null;
  slug: string | null;
};

type Props = {
  slug: string;
};

export function GroupDetail({ slug }: Props) {
  const [group, setGroup] = useState<GroupRow | null>(null);
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
        .eq("slug", slug)
        .maybeSingle();

      if (error) {
        setStatus("error");
        setMessage(error.message);
        return;
      }

      setGroup(data);
      setStatus("idle");
    };

    run().catch((err: unknown) => {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Unknown error");
    });
  }, [slug]);

  if (status === "loading") {
    return <p className="text-sm text-zinc-400">読み込み中...</p>;
  }

  if (status === "error") {
    return (
      <p className="text-sm text-red-200">読み込みに失敗しました: {message}</p>
    );
  }

  if (!group) {
    return <p className="text-sm text-zinc-400">該当グループがありません。</p>;
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
      <h1 className="text-2xl font-semibold">{group.name_ja ?? group.slug}</h1>
      <p className="mt-2 text-xs text-zinc-400">slug: {group.slug}</p>
    </div>
  );
}

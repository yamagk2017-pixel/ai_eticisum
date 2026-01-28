"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SupabaseCheck() {
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [message, setMessage] = useState<string>("未チェック");

  useEffect(() => {
    const run = async () => {
      const supabase = createClient();
      const { error } = await supabase
        .schema("imd")
        .from("groups")
        .select("id")
        .limit(1);
      if (error) {
        setStatus("error");
        setMessage(error.message);
        return;
      }
      setStatus("ok");
      setMessage("接続OK");
    };

    run().catch((err: unknown) => {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Unknown error");
    });
  }, []);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-white">
      <p className="font-semibold">Supabase 接続チェック</p>
      <p className="mt-2 text-zinc-300">
        ステータス: <span className="font-medium">{status}</span>
      </p>
      <p className="mt-1 text-zinc-400">{message}</p>
    </div>
  );
}

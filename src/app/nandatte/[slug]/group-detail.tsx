"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type GroupRow = {
  id: string;
  name_ja: string | null;
  slug: string | null;
};

type MetricRow = {
  id: string;
  label: string;
  type: "fixed" | "free" | string;
};

type MetricCountRow = {
  label: string;
  count: number;
  kind: "fixed" | "freeword" | string;
  metric_id: string | null;
  freeword_id: string | null;
};

type SelectedItem = {
  kind: "fixed" | "freeword";
  id: string;
  label: string;
};

type Props = {
  slug: string;
};

export function GroupDetail({ slug }: Props) {
  const [group, setGroup] = useState<GroupRow | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  const [fixedMetrics, setFixedMetrics] = useState<MetricRow[]>([]);
  const [freeMetricId, setFreeMetricId] = useState<string | null>(null);
  const [metricCounts, setMetricCounts] = useState<MetricCountRow[]>([]);
  const [totalVotes, setTotalVotes] = useState<number | null>(null);
  const [rank, setRank] = useState<number | null>(null);

  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [newFreeword, setNewFreeword] = useState<string>("");
  const [voteStatus, setVoteStatus] = useState<"idle" | "saving" | "error" | "success">(
    "idle"
  );
  const [voteMessage, setVoteMessage] = useState<string>("");

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

  useEffect(() => {
    if (!group?.id) {
      return;
    }

    const run = async () => {
      const supabase = createClient();

      const [metricsResponse, freeMetricResponse, metricCountsResponse, totalVotesResponse] =
        await Promise.all([
          supabase
            .schema("nandatte")
            .from("metrics")
            .select("id,label,type")
            .eq("type", "fixed")
            .order("label", { ascending: true }),
          supabase
            .schema("nandatte")
            .from("metrics")
            .select("id")
            .eq("type", "free")
            .limit(1)
            .maybeSingle(),
          supabase
            .schema("nandatte")
            .rpc("get_group_metric_counts", { p_group_id: group.id }),
          supabase
            .schema("nandatte")
            .rpc("get_group_vote_total", { p_group_id: group.id }),
        ]);

      if (metricsResponse.error) {
        setVoteStatus("error");
        setVoteMessage(metricsResponse.error.message);
        return;
      }

      setFixedMetrics(metricsResponse.data ?? []);
      setFreeMetricId(freeMetricResponse.data?.id ?? null);

      if (metricCountsResponse.error) {
        setVoteStatus("error");
        setVoteMessage(metricCountsResponse.error.message);
        return;
      }

      const counts = (metricCountsResponse.data ?? []).map((row: any) => ({
        label: row.label as string,
        count: Number(row.count ?? 0),
        kind: row.kind as string,
        metric_id: row.metric_id as string | null,
        freeword_id: row.freeword_id as string | null,
      }));

      setMetricCounts(counts);

      if (totalVotesResponse.error) {
        setVoteStatus("error");
        setVoteMessage(totalVotesResponse.error.message);
      } else {
        setTotalVotes(Number(totalVotesResponse.data ?? 0));
      }

      const { data: snapshotRow, error: snapshotError } = await supabase
        .schema("ihc")
        .from("daily_rankings")
        .select("snapshot_date")
        .order("snapshot_date", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!snapshotError && snapshotRow?.snapshot_date) {
        const { data: rankRow, error: rankError } = await supabase
          .schema("ihc")
          .from("daily_rankings")
          .select("rank")
          .eq("group_id", group.id)
          .eq("snapshot_date", snapshotRow.snapshot_date)
          .maybeSingle();

        if (!rankError) {
          setRank(rankRow?.rank ?? null);
        }
      }
    };

    run().catch((err: unknown) => {
      setVoteStatus("error");
      setVoteMessage(err instanceof Error ? err.message : "Unknown error");
    });
  }, [group?.id]);

  const sortedCounts = useMemo(() => {
    return [...metricCounts].sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.label.localeCompare(b.label, "ja");
    });
  }, [metricCounts]);

  const maxCount = sortedCounts[0]?.count ?? 0;

  const freewordCounts = useMemo(() => {
    return sortedCounts
      .filter((row) => row.kind === "freeword" && row.freeword_id)
      .map((row) => ({
        id: row.freeword_id as string,
        text: row.label,
        count: row.count,
      }));
  }, [sortedCounts]);

  const selectedCount = selectedItems.length + (newFreeword.trim() ? 1 : 0);

  const toggleSelection = (item: SelectedItem) => {
    setVoteMessage("");
    const exists = selectedItems.some(
      (selected) => selected.kind === item.kind && selected.id === item.id
    );

    if (exists) {
      setSelectedItems((prev) =>
        prev.filter(
          (selected) =>
            !(selected.kind === item.kind && selected.id === item.id)
        )
      );
      return;
    }

    if (selectedItems.length >= 5) {
      setVoteMessage("選択は最大5件までです。");
      return;
    }

    setSelectedItems((prev) => [...prev, item]);
  };

  const handleVoteSubmit = async () => {
    if (!group?.id) {
      return;
    }

    setVoteStatus("saving");
    setVoteMessage("");

    const supabase = createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData?.user) {
      setVoteStatus("error");
      setVoteMessage("投票にはログインが必要です。");
      return;
    }

    const trimmedFreeword = newFreeword.trim();
    const pendingItems: SelectedItem[] = [...selectedItems];

    if (trimmedFreeword) {
      if (trimmedFreeword.length > 10) {
        setVoteStatus("error");
        setVoteMessage("フリーワードは10文字以内にしてください。");
        return;
      }

      if (pendingItems.length >= 5) {
        setVoteStatus("error");
        setVoteMessage("フリーワードを追加する場合、選択は4件以下にしてください。");
        return;
      }

      const { data: existingFreeword } = await supabase
        .schema("nandatte")
        .from("metric_freewords")
        .select("id,text")
        .eq("normalized_text", trimmedFreeword)
        .maybeSingle();

      let freewordId = existingFreeword?.id ?? null;
      let freewordLabel = existingFreeword?.text ?? trimmedFreeword;

      if (!freewordId) {
        const { data: insertedFreeword, error: insertError } = await supabase
          .schema("nandatte")
          .from("metric_freewords")
          .insert({
            text: trimmedFreeword,
            normalized_text: trimmedFreeword,
            created_by: authData.user.id,
          })
          .select("id,text")
          .single();

        if (insertError) {
          setVoteStatus("error");
          setVoteMessage(insertError.message);
          return;
        }

        freewordId = insertedFreeword.id;
        freewordLabel = insertedFreeword.text;
      }

      pendingItems.push({
        kind: "freeword",
        id: freewordId,
        label: freewordLabel,
      });
    }

    if (pendingItems.length === 0) {
      setVoteStatus("error");
      setVoteMessage("少なくとも1つ選択してください。");
      return;
    }

    if (pendingItems.length > 5) {
      setVoteStatus("error");
      setVoteMessage("選択は最大5件までです。");
      return;
    }

    if (!freeMetricId) {
      setVoteStatus("error");
      setVoteMessage("フリーワード用のメトリクスが未設定です。");
      return;
    }

    const { data: voteRow, error: voteError } = await supabase
      .schema("nandatte")
      .from("votes")
      .upsert(
        {
          user_id: authData.user.id,
          group_id: group.id,
        },
        { onConflict: "user_id,group_id" }
      )
      .select("id")
      .single();

    if (voteError || !voteRow) {
      setVoteStatus("error");
      setVoteMessage(voteError?.message ?? "投票の保存に失敗しました。");
      return;
    }

    const voteId = voteRow.id as string;

    const { error: deleteError } = await supabase
      .schema("nandatte")
      .from("vote_items")
      .delete()
      .eq("vote_id", voteId);

    if (deleteError) {
      setVoteStatus("error");
      setVoteMessage(deleteError.message);
      return;
    }

    const payload = pendingItems.map((item) =>
      item.kind === "fixed"
        ? {
            vote_id: voteId,
            metric_id: item.id,
            freeword_id: null,
          }
        : {
            vote_id: voteId,
            metric_id: freeMetricId,
            freeword_id: item.id,
          }
    );

    const { error: insertItemsError } = await supabase
      .schema("nandatte")
      .from("vote_items")
      .insert(payload);

    if (insertItemsError) {
      setVoteStatus("error");
      setVoteMessage(insertItemsError.message);
      return;
    }

    setVoteStatus("success");
    setVoteMessage("投票を保存しました。");
  };

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
    <div className="flex flex-col gap-8">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Group</p>
        <div className="mt-3 flex flex-wrap items-end gap-6">
          <h1 className="text-3xl font-semibold">
            {group.name_ja ?? group.slug}
          </h1>
          <div className="text-sm text-zinc-300">
            <p>総合順位: {rank ?? "-"}</p>
            <p>総得票数: {totalVotes ?? 0}</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-zinc-500">slug: {group.slug}</p>
      </header>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">魅力ランキング</h2>
          <span className="text-xs text-zinc-400">
            上位5件をハイライト / 6位以下も表示
          </span>
        </div>
        <div className="mt-6 flex flex-col gap-4">
          {sortedCounts.length === 0 && (
            <p className="text-sm text-zinc-400">まだ投票がありません。</p>
          )}
          {sortedCounts.map((item, index) => {
            const width = maxCount ? Math.round((item.count / maxCount) * 100) : 0;
            const isTopFive = index < 5;
            return (
              <div
                key={`${item.label}-${index}`}
                className={`rounded-xl border px-4 py-3 ${
                  isTopFive
                    ? "border-zinc-500 bg-zinc-800/60"
                    : "border-zinc-800 bg-zinc-900/40"
                }`}
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    {index + 1}. {item.label}
                  </span>
                  <span className="text-zinc-300">{item.count}</span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-zinc-800">
                  <div
                    className={`h-2 rounded-full ${
                      isTopFive ? "bg-amber-400" : "bg-zinc-600"
                    }`}
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">投票する</h2>
          <span className="text-xs text-zinc-400">最大5件まで選択</span>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-zinc-200">固定の魅力候補</h3>
            <div className="mt-3 grid gap-2">
              {fixedMetrics.map((metric) => {
                const selected = selectedItems.some(
                  (item) => item.kind === "fixed" && item.id === metric.id
                );
                return (
                  <button
                    key={metric.id}
                    type="button"
                    className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                      selected
                        ? "border-amber-400 bg-amber-400/10 text-amber-100"
                        : "border-zinc-800 bg-zinc-950 text-zinc-200 hover:border-zinc-600"
                    }`}
                    onClick={() =>
                      toggleSelection({
                        kind: "fixed",
                        id: metric.id,
                        label: metric.label,
                      })
                    }
                  >
                    {metric.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-zinc-200">
              このグループで使われているフリーワード
            </h3>
            <div className="mt-3 grid gap-2">
              {freewordCounts.length === 0 && (
                <p className="text-xs text-zinc-500">まだフリーワードがありません。</p>
              )}
              {freewordCounts.map((freeword) => {
                const selected = selectedItems.some(
                  (item) => item.kind === "freeword" && item.id === freeword.id
                );
                return (
                  <button
                    key={freeword.id}
                    type="button"
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                      selected
                        ? "border-amber-400 bg-amber-400/10 text-amber-100"
                        : "border-zinc-800 bg-zinc-950 text-zinc-200 hover:border-zinc-600"
                    }`}
                    onClick={() =>
                      toggleSelection({
                        kind: "freeword",
                        id: freeword.id,
                        label: freeword.text,
                      })
                    }
                  >
                    <span>{freeword.text}</span>
                    <span className="text-xs text-zinc-500">{freeword.count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <label className="text-sm font-semibold text-zinc-200" htmlFor="freeword">
            新規フリーワード（10文字以内）
          </label>
          <input
            id="freeword"
            value={newFreeword}
            onChange={(event) => setNewFreeword(event.target.value)}
            maxLength={10}
            className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-amber-400 focus:outline-none"
            placeholder="例: 世界観が良い"
          />
          <p className="mt-2 text-xs text-zinc-500">
            新規フリーワードは投票時に1件としてカウントされます。
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={handleVoteSubmit}
            className="rounded-full bg-amber-400 px-6 py-2 text-sm font-semibold text-black hover:bg-amber-300"
            disabled={voteStatus === "saving"}
          >
            {voteStatus === "saving" ? "保存中..." : "投票する"}
          </button>
          <span className="text-xs text-zinc-400">
            選択数: {selectedCount} / 5
          </span>
          {voteMessage && (
            <span
              className={`text-xs ${
                voteStatus === "success" ? "text-emerald-300" : "text-red-200"
              }`}
            >
              {voteMessage}
            </span>
          )}
        </div>
      </section>
    </div>
  );
}

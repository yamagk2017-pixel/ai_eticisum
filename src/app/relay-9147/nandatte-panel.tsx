"use client";

import { useEffect, useState } from "react";

type CopyStatus = "idle" | "success" | "error";
type Status = "idle" | "loading" | "error" | "success";

type RankingItem = {
  group_id: string;
  name?: string | null;
};

function formatMMDD(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}/${day}`;
}

function fillLines(items: RankingItem[], prefix: "最新アップデート" | "ランキング") {
  return Array.from({ length: 5 }, (_, index) =>
    prefix === "ランキング" ? `${String(index + 1).padStart(2, "0")}. [ランキング ${index + 1}]` : `・[最新アップデート ${index + 1}]`
  ).map((fallback, index) => {
      const name = items[index]?.name?.trim();
      if (!name || name.length === 0) return fallback;
      return prefix === "ランキング" ? `${String(index + 1).padStart(2, "0")}. ${name}` : `・${name}`;
    })
    .join("\n");
}

function buildTexts(voteTop: RankingItem[], recentTop: RankingItem[]) {
  const dateLabel = formatMMDD();
  const updatesLines = fillLines(recentTop, "最新アップデート");
  const rankingLines = fillLines(voteTop, "ランキング");

  return {
    updates: `📕 オタクが作るリアルアイドルチャート「ナンダッテ」
${dateLabel}付の最新アップデートは…

${updatesLines}

なんだって！詳細は以下のページから
https://www.musicite.net/nandatte`,
    ranking: `🏆 オタクが作るリアルアイドルチャート「ナンダッテ」
${dateLabel}付の投票ランキングは…

${rankingLines}

なんだって！詳細は以下のページから
https://www.musicite.net/nandatte`,
  };
}

export function NandattePanel() {
  const [updatesText, setUpdatesText] = useState("");
  const [rankingText, setRankingText] = useState("");
  const [copyStatus, setCopyStatus] = useState<Record<"updates" | "ranking", CopyStatus>>({
    updates: "idle",
    ranking: "idle",
  });
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  const fetchLatestTexts = async (successMessage: string) => {
    setStatus("loading");
    setMessage("");
    try {
      const response = await fetch("/api/nandatte/rankings?limit=5", {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        voteTop?: RankingItem[];
        recentTop?: RankingItem[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "NANDATTEデータの取得に失敗しました。");
      }

      const texts = buildTexts(payload.voteTop ?? [], payload.recentTop ?? []);
      setUpdatesText(texts.updates);
      setRankingText(texts.ranking);
      setStatus("success");
      setMessage(successMessage);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unknown error");
    }
  };

  useEffect(() => {
    fetchLatestTexts("最新データで告知文を生成しました。").catch(() => undefined);
  }, []);

  const regenerate = () => {
    fetchLatestTexts("最新データで告知文を再生成しました。").catch(() => undefined);
  };

  const copyText = async (key: "updates" | "ranking", text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus((prev) => ({ ...prev, [key]: "success" }));
      window.setTimeout(() => {
        setCopyStatus((prev) => ({ ...prev, [key]: "idle" }));
      }, 1500);
    } catch {
      setCopyStatus((prev) => ({ ...prev, [key]: "error" }));
      window.setTimeout(() => {
        setCopyStatus((prev) => ({ ...prev, [key]: "idle" }));
      }, 1500);
    }
  };

  return (
    <section className="rounded-3xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[var(--ui-text)]">NANDATTE 管理</h2>
          <p className="mt-1 text-xs text-[var(--ui-text-subtle)]">
            X告知用のテンプレート文を確認し、必要に応じてコピーできます。
          </p>
        </div>
        <button
          type="button"
          onClick={regenerate}
          className="rounded-full border border-[var(--ui-border)] px-5 py-3 text-sm font-semibold text-[var(--ui-text)] hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={status === "loading"}
        >
          {status === "loading" ? "再生成中..." : "再生成する"}
        </button>
      </div>

      {status === "success" && message && (
        <div className="mt-4 rounded-xl border border-emerald-600/40 bg-emerald-100 p-4 text-sm text-emerald-900">
          {message}
        </div>
      )}

      {status === "error" && message && (
        <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
          NANDATTEデータの取得に失敗しました: {message}
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <article className="p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[var(--ui-text)]">最新アップデート</p>
            <button
              type="button"
              onClick={() => copyText("updates", updatesText)}
              className="rounded-full border border-[var(--ui-border)] px-3 py-1 text-xs text-[var(--ui-text)] hover:border-zinc-500"
            >
              {copyStatus.updates === "success"
                ? "コピー完了"
                : copyStatus.updates === "error"
                  ? "コピー失敗"
                  : "本文をコピー"}
            </button>
          </div>
          <textarea
            className="mt-3 min-h-[260px] w-full resize-y rounded-lg border border-[var(--ui-border)] bg-transparent p-3 text-sm text-[var(--ui-text)]"
            value={updatesText}
            onChange={(event) => setUpdatesText(event.target.value)}
          />
        </article>

        <article className="p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[var(--ui-text)]">投票ランキング</p>
            <button
              type="button"
              onClick={() => copyText("ranking", rankingText)}
              className="rounded-full border border-[var(--ui-border)] px-3 py-1 text-xs text-[var(--ui-text)] hover:border-zinc-500"
            >
              {copyStatus.ranking === "success"
                ? "コピー完了"
                : copyStatus.ranking === "error"
                  ? "コピー失敗"
                  : "本文をコピー"}
            </button>
          </div>
          <textarea
            className="mt-3 min-h-[260px] w-full resize-y rounded-lg border border-[var(--ui-border)] bg-transparent p-3 text-sm text-[var(--ui-text)]"
            value={rankingText}
            onChange={(event) => setRankingText(event.target.value)}
          />
        </article>
      </div>
    </section>
  );
}

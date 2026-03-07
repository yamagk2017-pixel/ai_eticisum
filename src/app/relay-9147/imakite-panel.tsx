"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DailyTopRow } from "../imakite/ranking-list";

type Status = "idle" | "loading" | "error" | "success";
type CopyStatus = "idle" | "success" | "error";

function toOneDecimal(score: number | string) {
  const num = typeof score === "number" ? score : Number(score);
  return Number.isFinite(num) ? num.toFixed(1) : "0.0";
}

function formatPostDateMMDD(baseDate: string) {
  if (!baseDate) return "";
  const date = new Date(`${baseDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + 1);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${mm}/${dd}`;
}

function buildTop10Lines(rows: DailyTopRow[]) {
  return rows
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 10)
    .map((row) => `${String(row.rank).padStart(2, "0")}. ${row.artist_name}（${toOneDecimal(row.score)}pt）`)
    .join("\n");
}

export function ImakitePanel() {
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [latestDate, setLatestDate] = useState<string>("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [rows, setRows] = useState<DailyTopRow[]>([]);
  const [copyStatus, setCopyStatus] = useState<Record<"post1" | "post2" | "post3", CopyStatus>>({
    post1: "idle",
    post2: "idle",
    post3: "idle",
  });

  const postTexts = useMemo(() => {
    const topRows = rows.slice().sort((a, b) => a.rank - b.rank);
    const top1 = topRows[0];
    const baseDate = top1?.snapshot_date ?? selectedDate;
    const postDate = formatPostDateMMDD(baseDate);
    const groupName = top1?.artist_name ?? "";
    const point = top1 ? toOneDecimal(top1.score) : "";
    const trackName = top1?.latest_track_name ?? "";
    const top10Lines = buildTop10Lines(topRows);

    const post1 = `🏆 ${postDate}付 #イマキテランキング 第1位は…

${groupName}（${point}pt）‼️
💿 最新曲「${trackName}」が #Spotify で配信中！

#

🧠イマキテランキングは、Spotify公式データに基づいて「人気度」や「フォロワー数」などを毎日集計。リアルタイムな勢いに注目した「イマキテる」アイドルを可視化するチャートです。
👇その他の順位はリプへ`;

    const post2 = `📊 ${postDate}付 #イマキテランキング TOP20

${top10Lines}

🎧 以下、20位までのアイドルの最新曲が試聴できます👇
https://www.musicite.net/imakite`;

    const post3 = `🧐あなたが思う「${groupName}が1位になった理由」は？

・最近のライブ／イベント
・新曲／新MVのリリース
・メディア露出／SNS拡散
・謎
💬具体的なリプも大歓迎！
#

👀 #イマキテランキング TOP20の試聴はこちらから🎧
https://www.musicite.net/imakite`;

    return { post1, post2, post3 };
  }, [rows, selectedDate]);

  const copyText = async (key: "post1" | "post2" | "post3", text: string) => {
    if (!text) {
      setCopyStatus((prev) => ({ ...prev, [key]: "error" }));
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus((prev) => ({ ...prev, [key]: "success" }));
      setTimeout(() => {
        setCopyStatus((prev) => ({ ...prev, [key]: "idle" }));
      }, 1500);
    } catch {
      setCopyStatus((prev) => ({ ...prev, [key]: "error" }));
      setTimeout(() => {
        setCopyStatus((prev) => ({ ...prev, [key]: "idle" }));
      }, 1500);
    }
  };

  const fetchRankingByDate = async (targetDate: string, okMessage: string) => {
    if (!targetDate) {
      setStatus("error");
      setMessage("日付が選択されていません。");
      setSuccessMessage("");
      return;
    }

    setStatus("loading");
    const supabase = createClient();
    const { data, error } = await supabase
      .schema("ihc")
      .from("daily_top20")
      .select(
        "snapshot_date,group_id,rank,artist_name,score,latest_track_name,latest_track_embed_link,artist_image_url"
      )
      .eq("snapshot_date", targetDate)
      .order("rank", { ascending: true });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      setSuccessMessage("");
      return;
    }

    setRows((data ?? []) as DailyTopRow[]);
    setStatus("success");
    setMessage("");
    setSuccessMessage(okMessage);
  };

  useEffect(() => {
    const run = async () => {
      setStatus("loading");
      const supabase = createClient();
      const { data, error } = await supabase
        .schema("ihc")
        .from("daily_top20")
        .select("snapshot_date")
        .order("snapshot_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        setStatus("error");
        setMessage(error.message);
        setSuccessMessage("");
        return;
      }

      const date = data?.snapshot_date ?? "";
      setLatestDate(date);
      setSelectedDate(date);

      if (!date) {
        setStatus("error");
        setMessage("最新日データが見つかりません。");
        setSuccessMessage("");
        return;
      }

      await fetchRankingByDate(date, "最新データの告知文を自動生成しました。");
    };

    run().catch((err: unknown) => {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Unknown error");
      setSuccessMessage("");
    });
  }, []);

  const fetchRanking = async () => {
    await fetchRankingByDate(selectedDate, "選択日のデータを再取得しました。");
  };

  const regeneratePosts = async () => {
    await fetchRankingByDate(selectedDate, "選択日の告知文を再生成しました。");
  };

  return (
    <section className="rounded-3xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[var(--ui-text)]">IMAKITE 管理</h2>
          <p className="mt-1 text-xs text-[var(--ui-text-subtle)]">
            この画面は既存の集計データ参照用です（集計生成は別ジョブ）。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/imakite"
            className="rounded-full border border-[var(--ui-border)] px-3 py-1 text-xs text-[var(--ui-text)] hover:border-zinc-500"
          >
            /imakite
          </Link>
          <Link
            href="/imakite/archive"
            className="rounded-full border border-[var(--ui-border)] px-3 py-1 text-xs text-[var(--ui-text)] hover:border-zinc-500"
          >
            /imakite/archive
          </Link>
        </div>
      </div>

      {status === "error" && (
        <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
          取得に失敗しました: {message}
        </div>
      )}

      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <label className="text-sm text-[var(--ui-text-muted)]" htmlFor="relay-imakite-date">
            対象日
          </label>
          <input
            id="relay-imakite-date"
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-panel-soft)] px-4 py-3 text-sm text-[var(--ui-text)]"
          />
          {latestDate && <p className="text-xs text-[var(--ui-text-subtle)]">最新日: {latestDate}</p>}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={regeneratePosts}
            className="rounded-full border border-[var(--ui-border)] px-5 py-3 text-sm font-semibold text-[var(--ui-text)] hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={status === "loading"}
          >
            告知文を再生成する
          </button>
          <button
            type="button"
            onClick={fetchRanking}
            className="rounded-full bg-[var(--ui-accent)] px-6 py-3 text-sm font-semibold text-[var(--ui-accent-contrast)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={status === "loading"}
          >
            選択日のデータを再取得
          </button>
        </div>
      </div>

      {status === "loading" && <p className="mt-4 text-sm text-[var(--ui-text-muted)]">取得中...</p>}

      {status === "success" && (
        <div className="mt-4 rounded-xl border border-emerald-600/40 bg-emerald-100 p-4 text-sm text-emerald-900">
          {successMessage || `取得完了: ${rows.length}件`}
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="mt-6">
            <h3 className="text-base font-semibold text-[var(--ui-text)]">X投稿文（テンプレート生成）</h3>

            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <article className="p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[var(--ui-text)]">1ツイート目（1位発表）</p>
                <button
                  type="button"
                  onClick={() => copyText("post1", postTexts.post1)}
                  className="rounded-full border border-[var(--ui-border)] px-3 py-1 text-xs text-[var(--ui-text)] hover:border-zinc-500"
                >
                  {copyStatus.post1 === "success"
                    ? "コピー完了"
                    : copyStatus.post1 === "error"
                      ? "コピー失敗"
                      : "本文をコピー"}
                </button>
              </div>
              <pre className="mt-3 whitespace-pre-wrap break-words rounded-lg border border-[var(--ui-border)] p-3 text-sm text-[var(--ui-text)]">
                {postTexts.post1}
              </pre>
              </article>

              <article className="p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[var(--ui-text)]">2ツイート目（TOP10一覧）</p>
                <button
                  type="button"
                  onClick={() => copyText("post2", postTexts.post2)}
                  className="rounded-full border border-[var(--ui-border)] px-3 py-1 text-xs text-[var(--ui-text)] hover:border-zinc-500"
                >
                  {copyStatus.post2 === "success"
                    ? "コピー完了"
                    : copyStatus.post2 === "error"
                      ? "コピー失敗"
                      : "本文をコピー"}
                </button>
              </div>
              <pre className="mt-3 whitespace-pre-wrap break-words rounded-lg border border-[var(--ui-border)] p-3 text-sm text-[var(--ui-text)]">
                {postTexts.post2}
              </pre>
              </article>

              <article className="p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[var(--ui-text)]">3ツイート目（投票）</p>
                <button
                  type="button"
                  onClick={() => copyText("post3", postTexts.post3)}
                  className="rounded-full border border-[var(--ui-border)] px-3 py-1 text-xs text-[var(--ui-text)] hover:border-zinc-500"
                >
                  {copyStatus.post3 === "success"
                    ? "コピー完了"
                    : copyStatus.post3 === "error"
                      ? "コピー失敗"
                      : "本文をコピー"}
                </button>
              </div>
              <pre className="mt-3 whitespace-pre-wrap break-words rounded-lg border border-[var(--ui-border)] p-3 text-sm text-[var(--ui-text)]">
                {postTexts.post3}
              </pre>
              </article>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

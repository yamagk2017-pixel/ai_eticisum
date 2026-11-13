"use client";

import { useEffect, useState } from "react";
import type { PlaylistAnnouncement } from "@/lib/imakite-playlist-announcement";

async function fetchAnnouncement(signal?: AbortSignal) {
  const response = await fetch("/relay-9147/imakite-playlist-announcement", {
    cache: "no-store", signal,
  });
  const body = await response.json() as { announcement?: PlaylistAnnouncement | null; error?: string };
  if (!response.ok) throw new Error(body.error || "告知文の取得に失敗しました。");
  return body.announcement ?? null;
}

export function ImakitePlaylistPost() {
  const [announcement, setAnnouncement] = useState<PlaylistAnnouncement | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState<"idle" | "success" | "error">("idle");

  function generate(signal?: AbortSignal) {
    return fetchAnnouncement(signal).then((result) => {
      if (signal?.aborted) return;
      setAnnouncement(result);
      setDraft(result?.text ?? "");
    }).catch((err: unknown) => {
      if (!signal?.aborted) setError(err instanceof Error ? err.message : "告知文の取得に失敗しました。");
    }).finally(() => {
      if (!signal?.aborted) setLoading(false);
    });
  }

  useEffect(() => {
    const controller = new AbortController();
    void generate(controller.signal);
    return () => controller.abort();
  }, []);

  function regenerate() {
    setLoading(true);
    setError("");
    setCopyStatus("idle");
    setAnnouncement(null);
    setDraft("");
    void generate();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopyStatus("success");
    } catch {
      setCopyStatus("error");
    }
  }

  return (
    <section aria-labelledby="playlist-post-heading" className="mt-6 border-t border-[var(--ui-border)] pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="playlist-post-heading" className="text-base font-semibold text-[var(--ui-text)]">
            イマキテアイドル：ジャパン X告知文
          </h3>
          <p className="mt-1 text-xs text-[var(--ui-text-subtle)]">
            最新の公開済み更新から自動生成します。本文は編集できます。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={regenerate}
            disabled={loading}
            className="rounded-full border border-[var(--ui-border)] px-4 py-2 text-xs text-[var(--ui-text)] hover:border-zinc-500 disabled:opacity-60"
          >
            {loading ? "生成中..." : "最新データで再生成"}
          </button>
          <button
            type="button"
            onClick={() => void copy()}
            disabled={loading || !draft.trim()}
            className="rounded-full bg-[var(--ui-accent)] px-4 py-2 text-xs font-semibold text-[var(--ui-accent-contrast)] hover:opacity-90 disabled:opacity-60"
          >
            本文をコピー
          </button>
        </div>
      </div>
      <div aria-live="polite" className="mt-3 text-sm text-[var(--ui-text-muted)]">
        {loading && <p>プレイリストの告知文を生成中...</p>}
        {error && <p role="alert">{error}</p>}
        {!loading && !error && !announcement && <p>公開済みのプレイリスト更新がまだありません。</p>}
        {!loading && announcement && (
          <p>更新日: {announcement.updatedDate}（日本時間）／ カバー: {announcement.coverName} ／ 今回リストイン: {announcement.groupNames.length}組</p>
        )}
        {copyStatus === "success" && <p>コピー完了</p>}
        {copyStatus === "error" && <p>コピーに失敗しました。本文を選択してコピーしてください。</p>}
      </div>
      {!loading && announcement && (
        <textarea
          aria-label="イマキテアイドル：ジャパンのX告知文"
          value={draft}
          onChange={(event) => { setDraft(event.target.value); setCopyStatus("idle"); }}
          rows={18}
          className="mt-3 w-full resize-y rounded-xl border border-[var(--ui-border)] bg-transparent p-4 text-sm leading-relaxed text-[var(--ui-text)]"
        />
      )}
    </section>
  );
}

"use client";

import { useState } from "react";
import type { PublicTrack, ReleaseTrack } from "@/lib/imakite-releases-data";

export function TrackLink({ track }: { track: PublicTrack }) {
  return track.spotifyUrl ? <a href={track.spotifyUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--ui-link)] underline decoration-current/30 underline-offset-4 hover:decoration-current">{track.name} ↗</a> : <span>{track.name}</span>;
}

const points = (value: number | null) => value === null ? "記録なし" : value.toFixed(3);

export function ReleaseTracks({ tracks }: { tracks: ReleaseTrack[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase("ja");
  const visible = tracks.filter((track) => normalize(`${track.group} ${track.name}`).includes(normalize(search.trim())) &&
    (filter === "all" || filter === "news" && (track.news ?? 0) > 0 ||
      filter === "youtube" && (track.youtube ?? 0) > 0 || filter === "wildcard" && track.wildcard));
  return (
    <section aria-labelledby="added-heading" className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="added-heading" className="text-xl font-semibold">今回の追加・入れ替え曲</h2>
        <p className="text-xs text-[var(--ui-text-muted)]">番号はプレイリストの掲載順</p>
      </div>
      <div className="my-5 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 text-xs font-semibold">グループ名・曲名で検索
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="曲名やグループ名を入力" className="mt-2 block w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-panel)] px-4 py-3 text-base font-normal" />
        </label>
        <label className="text-xs font-semibold">選曲条件で絞り込み
          <select value={filter} onChange={(event) => setFilter(event.target.value)} className="mt-2 block w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-panel)] px-3 py-3 text-base font-normal sm:w-64">
            <option value="all">すべての追加曲</option>
            <option value="news">ニュース加点あり</option>
            <option value="youtube">YouTube加点あり</option>
            <option value="wildcard">活動実績枠（人気度10未満）</option>
          </select>
        </label>
      </div>
      <p role="status" className="mb-3 text-xs text-[var(--ui-text-muted)]">{tracks.length}曲中 {visible.length}曲を表示</p>
      <div className="flex flex-col gap-3">
        {visible.map((track) => (
          <article key={track.position} aria-label={`掲載順${track.position} ${track.group} ${track.name}`} className="min-w-0 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-4 sm:p-5">
            <div className="flex items-start gap-3 sm:gap-5">
              <span className="w-8 shrink-0 pt-1 font-mono text-lg text-[var(--ui-text-subtle)]" aria-label={`掲載順 ${track.position}`}>{String(track.position).padStart(2, "0")}</span>
              <div className="min-w-0 flex-1">
                <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_6rem] lg:gap-6">
                  <div><h3 className="break-words text-sm font-semibold sm:text-base">{track.group}</h3>
                    {track.wildcard && <span className="mt-2 inline-block rounded border border-[var(--ui-border)] px-2 py-1 text-xs text-[var(--ui-link)]">活動実績枠</span>}
                  </div>
                  <div className="min-w-0 break-words text-sm font-semibold sm:text-base"><TrackLink track={track} />
                    <p className="mt-2 text-xs font-normal text-[var(--ui-text-muted)]">発売日：{track.releaseDate ?? "記録なし"}</p>
                  </div>
                  <p className="text-sm lg:text-right"><span className="mr-2 text-xs text-[var(--ui-text-muted)] lg:mr-0 lg:block">合計点</span><strong className="font-mono text-xl text-[var(--ui-link)]">{points(track.total)}</strong></p>
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-[var(--ui-border)] pt-3 text-xs sm:flex sm:gap-6">
                  {[["IHC点", track.ihc], ["ニュース点", track.news], ["YouTube点", track.youtube]].map(([label, value]) => <div key={label as string}><dt className="text-[var(--ui-text-muted)]">{label}</dt><dd className="mt-1 font-mono text-sm">{points(value as number | null)}</dd></div>)}
                </dl>
                <details className="mt-4 text-sm">
                  <summary className="w-fit cursor-pointer text-[var(--ui-link)]">選曲根拠・動画・変更内容</summary>
                  <div className="mt-3 space-y-2 leading-relaxed text-[var(--ui-text-muted)]">
                    <p>IHC週合計 {points(track.rawIhc)}点 ／ ニュース実績 {track.newsCount ?? "記録なし"}件 ／ 条件適合動画 {track.videoCount ?? "記録なし"}本 ／ Spotify人気度 {track.popularity ?? "記録なし"}（0〜100）</p>
                    {track.rawIhc !== null && track.rawIhc < 0 && <p>IHC週合計がマイナスのため、IHC点は0点として保存されています。</p>}
                    {track.wildcard && <p>人気度10未満でもニュース・動画の活動実績が確認された活動実績枠です。</p>}
                    {track.videos.length > 0 && <div><p>加点の根拠となった条件適合動画（最大2本分を加点）</p><div className="mt-1 flex flex-wrap gap-x-5 gap-y-2">{track.videos.map((url, index) => <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="py-1 text-[var(--ui-link)] underline underline-offset-4">動画{index + 1} ↗</a>)}</div></div>}
                    {track.replaced.length > 0 ? track.replaced.map((old, index) => <p key={index}>同グループの旧曲「<TrackLink track={old} />」から「{track.name}」へ変更。</p>) : <p>同グループの旧掲載曲からの入れ替えはありません。</p>}
                  </div>
                </details>
              </div>
            </div>
          </article>
        ))}
        {visible.length === 0 && <p className="rounded-xl border border-[var(--ui-border)] p-8 text-center text-sm text-[var(--ui-text-muted)]">該当する追加曲はありません。検索や絞り込み条件を変更してください。</p>}
      </div>
    </section>
  );
}

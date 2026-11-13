import Link from "next/link";
import { notFound } from "next/navigation";
import { IMAKITE_PLAYLIST } from "@/lib/imakite-playlist";
import { getRelease, getReleaseDates } from "@/lib/imakite-releases";
import { ReleaseTracks, TrackLink } from "./release-tracks";

const dateLabel = (date: string) => new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "long" }).format(new Date(date));
const linkClass = "text-sm font-semibold text-[var(--ui-link)] underline underline-offset-4";

export async function ReleasePage({ date }: { date?: string }) {
  const [release, dates] = await Promise.all([getRelease(date), getReleaseDates()]);
  if (!release && date) notFound();
  return (
    <div className="min-h-screen bg-[var(--ui-page)] text-[var(--ui-text)]">
      <main className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-8 px-4 py-10 sm:px-12 sm:py-16">
        <header className="space-y-4">
          <p className="text-xs font-semibold tracking-[0.18em] text-[var(--ui-text-subtle)]">運用コンソール · WEEKLY UPDATE</p>
          <h1 className="font-mincho-jp text-2xl font-semibold leading-relaxed sm:text-4xl">{IMAKITE_PLAYLIST.name}<br />{release ? `${dateLabel(release.date)}分の追加曲` : "追加曲の詳細"}</h1>
          <p className="max-w-3xl text-sm leading-relaxed text-[var(--ui-text-muted)]">毎週の追加曲と、その選曲根拠・入れ替え内容をお届けします。掲載順はSpotifyプレイリスト上の順番で、全50曲の人気ランキングではありません。</p>
          <nav aria-label="イマキテ" className="flex flex-wrap gap-x-5 gap-y-3 pt-2">
            <Link href="/relay-9147" className={linkClass}>運用コンソールへ戻る</Link>
            <Link href="/imakite/weekly" className={linkClass}>プレイリスト・アイドル紹介</Link>
            <Link href="/imakite" className={linkClass}>日次ランキング</Link>
            <Link href="/imakite/weekly/archive" className={linkClass}>過去の週間ランキング</Link>
          </nav>
        </header>

        {release ? <>
          <section aria-label="更新の概要" className="space-y-5 border-y border-[var(--ui-border)] py-6">
            <div className="space-y-2 text-sm text-[var(--ui-text-muted)]">
              <p>対象期間：{dateLabel(release.periodStart)}〜{dateLabel(release.periodEnd)}</p>
              <p>集計締切：{dateLabel(release.date)} 00:00:00（日本時間）</p>
              <p>更新完了：<time dateTime={release.committedAt}>{new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "long", timeStyle: "medium", hour12: false }).format(new Date(release.committedAt))}</time>（日本時間）</p>
              {release.initial && <p>初回公開分の記録です。通常の週次入れ替えとは追加曲数が異なります。</p>}
            </div>
            <dl className="grid grid-cols-3 gap-3">
              {[["追加・入れ替え", release.added], ["前回から継続", release.retained], ["更新後の全曲", release.total]].map(([label, count]) => <div key={label} className="border-l-2 border-[var(--ui-border)] pl-3 sm:pl-5"><dd className="font-mono text-3xl font-semibold sm:text-4xl">{count}<span className="ml-1 text-sm font-normal">曲</span></dd><dt className="mt-2 text-xs text-[var(--ui-text-muted)]">{label}</dt></div>)}
            </dl>
            <a href={IMAKITE_PLAYLIST.url} target="_blank" rel="noopener noreferrer" className={linkClass}>Spotifyでプレイリストを開く ↗</a>
            <p className="text-xs text-[var(--ui-text-muted)]">Spotifyのリンク先は現在のプレイリストです。このページは更新完了時点の記録を表示しています。</p>
          </section>

          <section aria-label="選曲と点数について" className="space-y-3 text-sm leading-relaxed">
            <p className="font-semibold">合計点 ＝ max(0, IHCの7日合計) ＋ ニュース10点 ＋ YouTube 3点 × 最大2本</p>
            <p className="text-[var(--ui-text-muted)]">追加曲を先頭に並べ、継続曲は前回の順序を保って後ろに配置しています。点数は保存済みの値を小数第3位まで表示しています。</p>
            <p className="text-[var(--ui-text-muted)]">ニュース加点 {release.tracks.filter((track) => (track.news ?? 0) > 0).length}組 ／ YouTube加点 {release.tracks.filter((track) => (track.youtube ?? 0) > 0).length}組 ／ 活動実績枠 {release.tracks.filter((track) => track.wildcard).length}組（重複あり）</p>
            <details className="text-[var(--ui-text-muted)]"><summary className="w-fit cursor-pointer text-[var(--ui-link)]">選曲条件・点数の読み方</summary><div className="mt-3 space-y-2"><p>登録アイドルの対象期間内の最新作品から先頭曲を選び、通常は毎週最大25曲を追加します。ライブ音源やソロ名義を含む作品も対象になる場合があります。</p><p>ニュースは締切以前の全期間、YouTubeは対象7日間の条件適合動画を照合しています。ニュースは実績があれば10点、動画は1本3点・最大6点です。人気度10未満でも、ニュース・動画の実績が確認された曲は活動実績枠で採用されます。</p><p>動画0点は条件適合動画を確認できなかったことを示します。チャンネル未登録の場合も含み、動画活動がなかったという意味ではありません。グループ名・曲名は保存時の表記です。</p></div></details>
          </section>

          <ReleaseTracks tracks={release.tracks} />

          <section aria-labelledby="removed-heading" className="border-t border-[var(--ui-border)] pt-6">
            <h2 id="removed-heading" className="text-xl font-semibold">今回外れた曲</h2>
            <p className="mt-2 text-sm text-[var(--ui-text-muted)]">{release.removed.length}曲（同グループの曲へ変更 {release.removed.filter((track) => track.replacement).length}曲）</p>
            <details className="mt-4"><summary className="w-fit cursor-pointer text-sm text-[var(--ui-link)]">外れた{release.removed.length}曲の一覧を見る</summary><ul className="mt-4 divide-y divide-[var(--ui-border)]">{release.removed.map((track, index) => <li key={index} className="space-y-2 py-4 text-sm"><p className="font-semibold">{track.group}</p><p><TrackLink track={track} /></p><p className="text-xs text-[var(--ui-text-muted)]">{track.replacement ? <>同グループの「<TrackLink track={track.replacement} />」へ変更</> : "新曲追加に伴い掲載対象外"}</p></li>)}</ul>{release.removed.length === 0 && <p className="mt-3 text-sm">今回外れた曲はありません。</p>}</details>
          </section>
        </> : <p className="py-8">確定済みの追加曲はまだありません。</p>}

        <section aria-labelledby="release-archive-heading" className="border-t border-[var(--ui-border)] pt-6">
          <h2 id="release-archive-heading" className="text-xl font-semibold">日付別の追加曲</h2>
          <Link href="/relay-9147/imakite/releases" className={`${linkClass} mt-4 inline-block`}>最新の確定済み週を見る →</Link>
          <ul className="mt-4 flex flex-wrap gap-3">{dates.map((item) => <li key={item}><Link href={`/relay-9147/imakite/releases/${item}`} aria-current={item === release?.date ? "page" : undefined} className={`block rounded-full border border-[var(--ui-border)] px-4 py-3 text-sm ${item === release?.date ? "bg-[var(--ui-accent)] font-semibold text-[var(--ui-accent-contrast)]" : "hover:text-[var(--ui-link)]"}`}>{dateLabel(item)}分</Link></li>)}</ul>
        </section>
      </main>
    </div>
  );
}

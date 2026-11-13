# 運用コンソール：毎週の追加曲詳細

- 最新の確定済み週：`/relay-9147/imakite/releases`
- 日付別：`/relay-9147/imakite/releases/YYYY-MM-DD`（日付は集計締切 `cutoff`）
- 運用コンソールの IMAKITE 管理から開く。全ページとRSCリクエストに既存の `/relay-9147/:path*` のBasic認証が適用される。検索エンジン向けにはnoindex/nofollowを設定する。
- 一般向けの日次ランキング、プレイリスト紹介、旧週間ランキング・アーカイブは変更しない。

## データと更新

サーバー専用の `src/lib/imakite-releases.ts` が既存のサーバークライアントを使用する。環境変数は既存の `NEXT_PUBLIC_SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`。認証は既存の `RELAY9147_BASIC_AUTH_USER`、`RELAY9147_BASIC_AUTH_PASS`。

`ihc.release_playlist_runs` の `project_slug = imakite-idol-japan`、`status = committed`、`committed_at IS NOT NULL` の行だけを読む。最新は `committed_at DESC, cutoff DESC`。日付別はさらに `cutoff` で絞り、同日の再確定があれば最後の確定結果を表示する。

詳細の取得列は `cutoff,committed_at,mode,added_tracks,target_tracks,before_tracks`。`evidence` 全体は取得しない。アーカイブは `cutoff,committed_at` のみを500件ずつ取得し、同じ締切日はまとめる。APIの既定上限を超える過去週も失わない。

`connection()` と全読み取りの `cache: no-store` で、次回ページ読み込みから新しい確定週が表示される。Reactの `cache` は同一リクエスト内の重複取得だけを抑える。再ビルド、Webhook、Spotify再取得は不要。DB書き込み、集計、Spotify更新処理は行わない。

## 公開する表示項目

`imakite-releases-data.ts` で明示的な表示用オブジェクトに変換する。内部のrun/group UUID、ニュースID、アルバムID、SpotifyアーティストID、activity全体や根拠データは渡さない。Spotify曲IDは検証して曲URLに変換し、YouTube動画IDは形式を確認して動画URLにする。

- 対象期間は締切の7日前〜前日、締切は当日00:00:00（日本時間）。更新完了は `committed_at` を日本時間で秒まで表示する。
- 追加曲は `added_tracks` のスコア・根拠を使い、番号と並び順は `target_tracks` の実際の位置に従う。全50曲の人気ランキングとして表示しない。
- 継続数は更新前後の曲IDの一致、外れた曲は更新前にあり更新後にない曲。同グループの変更はサーバー内でグループIDを照合する。
- 点数は再計算せず保存値を小数第3位まで表示する。IHCの元の週合計と、0点に丸めた後のIHC点を区別する。欠損は「記録なし」で表示する。
- 条件適合動画は保存されたリンクをすべて示し、加点は最大2本分と説明する。
- 検索はグループ名・曲名の部分一致。NFKC正規化と大文字小文字の同一視を行う。ニュース、YouTube、活動実績枠の各絞り込みと併用できる。
- Spotifyプレイリストリンクは現在のプレイリストであり、過去の並び順の再生URLではないことを明記する。

不正・未確定・存在しない日付は404。DB障害は空の履歴に置き換えず、再読み込みを案内するエラー画面を表示する。

## 検証

```sh
node --experimental-strip-types --test tests/imakite-releases.test.mjs tests/imakite-weekly-feature.test.mjs tests/imakite-playlist-announcement.test.mjs
npm run check
```

2026年11月14日分の保存データ：対象期間11月7日〜13日、更新完了11月14日00:35:52 JST、追加21曲・継続29曲・全50曲。先頭はドラマチックレコード「未明論」、合計33.076点（IHC30.076・ニュース0・YouTube3）。ニュース加点5組、YouTube加点5組、活動実績枠2組。同グループ変更はLOOPARADE「たなごころ」→「JUMP!!」。外れた曲は21曲。この値は確認記録で、表示コードには固定しない。

公開前の確認結果：新規・既存あわせて17件のテスト、Lint、型チェック、Next.jsの本番ビルドに合格。本番ビルドをローカル起動し1440px・390px・360pxで横はみ出しなし。検索・3種類のフィルター、全21曲の掲載順・点数・発売日・動画URLの保存値との一致、同グループ変更・外れた21曲、初回50曲の過去分、運用コンソールからの導線を確認。認証なしのHTML/RSCアクセスは401、不正日付・未登録日付は404。レスポンスはprivate/no-storeで、HTMLに秘密キーや内部UUIDがなく、ブラウザから管理テーブルへの問い合わせもない。日次ランキング・既存の週間ページと各アーカイブは200。既存のキャプチャAPIの動的ファイルパスに関するTurbopack警告が1件ある。

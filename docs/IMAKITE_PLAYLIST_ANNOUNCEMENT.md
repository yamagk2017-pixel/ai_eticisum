# イマキテアイドル：ジャパンのX告知文

運用コンソール `/relay-9147` のIMAKITEタブで、ランキングのX告知文の下にプレイリスト専用の告知文を表示する。画面を開くと自動生成し、本文の編集・全文コピー・最新データでの再生成ができる。ランキングの対象日とは独立して、直近の公開済み更新を使用する。

## データ

- 固定のSpotifyプレイリストIDから `ihc.release_playlist_projects` の企画slugを解決する。
- `ihc.release_playlist_runs` の対象企画、`status = committed`、`committed_at IS NOT NULL` を条件に、公開確定日時降順・同時刻はcutoff降順の先頭1件を使う。未確定の更新は採用しない。
- 告知の日付は `committed_at` の日本時間での月日。選曲の締切日や画面を開いた日とは異なる。
- カバー名は確定runの `cover.artist_name`。
- 今回リストインしたグループは `added_tracks` の `group_id` で重複を除き、最初の追加曲の順序と `group_name` を使う。継続掲載分を含む `target_tracks` は使わない。
- 組数はその実数。通常更新の25組に固定せず、初回公開分が50組なら50組を掲載する。
- 日時・カバー・追加曲・グループ名などが不正・未登録なら生成を失敗させる。公開済みデータがなければ空状態を表示する。

## 取得と認証

`GET /relay-9147/imakite-playlist-announcement` はサーバー側でのみサービスロールを使用し、告知用の日時・カバー名・グループ名・文面のみを返す。DBアクセスとレスポンスは `no-store`。再生成時に編集済み文面を置き換える。

コンソールと取得先は `src/proxy.ts` のBasic認証で保護する。既存のルート直下の `middleware.ts` は `src/app` 構成では検出されていなかったため、同梱のNext.jsガイドに沿って `src/proxy.ts` に移動した。`RELAY9147_BASIC_AUTH_USER` と `RELAY9147_BASIC_AUTH_PASS` が未設定の場合は401を返す。ローカル・本番の各環境で設定する。

## 検証

```sh
node --experimental-strip-types --test tests/imakite-playlist-announcement.test.mjs tests/imakite-weekly-feature.test.mjs
npm run check
```

PC・モバイルで自動生成、本文編集後のコピー、再生成、データ未公開・取得失敗・コピー失敗時の表示を確認する。認証なし・不正な認証で取得先が401を返すことも確認する。

2026-11-14の確認結果:

- 新規6件と既存週次紹介6件の計12テスト、Lint、型チェックが通過。
- 1440px・390pxで実データとの全文一致、本文編集と全文コピー、再生成、横はみ出しなしを確認。
- 未公開・取得失敗・再試行成功・コピー失敗時の表示を確認。コンソールと取得先の認証なし、および取得先の不正認証は401、正しい認証での取得は200・`no-store`。
- 実データは11/11公開、カバーは可憐なアイボリー、追加50組。DBへの書き込み・Spotifyの更新は行わない。
- 標準のTurbopackビルドはサンドボックス外でもコンパイルが進まなかったため停止。`npm run build -- --webpack` は終了コード0で完了し、新しい取得先が動的ルート、Proxyが有効であることを確認。
- ローカルのBasic認証用環境変数は未設定のため、画面検証にはプロセス限定のテスト用認証を使用し、終了後に検証サーバーを停止した。`.env.local` の変更は行わない。

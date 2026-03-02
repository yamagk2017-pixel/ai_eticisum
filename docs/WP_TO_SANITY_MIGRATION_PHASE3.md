# WP→Sanity移行 フェーズ3（画像アセット移行 / DNS切替準備）

## 目的

フェーズ2で移行した `wpImportedArticle`（全件）を対象に、WP外部参照の画像をSanity資産へ段階移行し、最終的なDNS切替に備える。

進捗表記:
- `[ ]` 未着手 / 未確定
- `[◯]` 完了 / 確定

---

## 現在進捗（2026-03-02）

- [◯] フェーズ3ドキュメント作成・更新
- [◯] フェーズ2完了後の前提へ更新（全件移行済み）
- [◯] FooGallery表示崩れの暫定対処は反映済み（`data-src-fg` 補完 + 横並び調整）
- [◯] 参照先ホスト置換スクリプト実装（`musicite.net` → `musicite.sub.jp`）
- [◯] 置換 dry-run 実行（`musicite.net` → `musicite.sub.jp`）
- [◯] 置換 apply 実行（`musicite.net` → `musicite.sub.jp`）
- [◯] HTTPS化に伴う再置換 apply 実行（`http://musicite.sub.jp` → `https://musicite.sub.jp`）
- [◯] 代表記事で画像表示確認（ヒーロー/本文/FooGallery）
- [ ] DNS切替前チェックリスト運用

状態:
- フェーズ2（全件移行）は完了。
- フェーズ3は **実装進行中（DNS切替準備フェーズ）**。

---

## 前提（フェーズ2から引継ぎ）

- `wpImportedArticle` の全件移行は完了（`page=35` が最終）
- 画像は現在 `heroImageExternalUrl` / 本文HTML内URL をWP参照
- issues統合CSVで `featuredImage_api_denied` / `featuredImage_missing` を追跡中
- 新規WP投稿は単体インポート（`--include-only --include-ids=`）で継続運用可能

---

## フェーズ3タスク

### 1) 画像アセット移行設計

- [ ] 対象定義
  - [ ] ヒーロー画像（`heroImageExternalUrl`）
  - [ ] 本文内画像（`legacyBodyHtml` の `img[src]` / `source[srcset]`）
  - [ ] ギャラリー系（FooGallery shortcode記事）の扱い方針
- [ ] 変換ルール定義
  - [ ] WP URL → Sanity Asset URL 対応表
  - [ ] 同一画像の重複アップロード回避ルール（URLハッシュ等）
  - [ ] 置換失敗時の記録方式

### 2) 画像移行スクリプト実装

- [◯] スクリプト実装
  - [◯] `scripts/replace-wp-image-host-in-sanity.mjs`
  - [◯] npm script 追加
    - [◯] `replace:wp-image-host:dry-run`
    - [◯] `replace:wp-image-host:apply`
- [◯] dry-run
  - [◯] 対象抽出のみ
  - [◯] 置換予定件数レポート
- [◯] apply（URL置換）
  - [◯] `heroImageExternalUrl` の置換
  - [◯] `legacyBodyHtml` 内URLの置換
  - [◯] 実行結果レポート
- [ ] 再実行
  - [ ] 失敗記事IDのみ再実行
  - [ ] 途中中断からの再開

### 3) 画像品質確認

- [◯] サンプル記事で表示確認（PC/スマホ）
- [◯] 画像欠落/リンク切れの検出
- [◯] FooGallery記事の代表ケース確認

### 4) DNS切替準備

- [ ] Vercel運用ルール確定（Preview/Production）
- [ ] canonical切替手順確定（旧WP → self）
- [ ] noindex / robots方針確定（切替前後）
- [ ] ロールバック手順確定

### 5) DNS切替前の必須対応（旧WP参照URLの切替）

前提:
- DNS切替後、旧WPは `musicite.net` ではなく `musicite.sub.jp` 側で継続稼働する想定。
- 現在の移行済み記事は `https://www.musicite.net/...` を画像参照に含むため、DNS切替後に画像404化するリスクがある。

対応方針:
- `WP_API_BASE_URL` の変更だけでは不十分（新規インポート分のみ反映）。
- 既存のSanity記事に保存済みURLも一括で置換する。

実施手順:
1. **到達性確認**
   - `http://musicite.sub.jp/wp-json/wp/v2/posts` が応答すること
   - `http://musicite.sub.jp/...` の画像URLが直接表示できること
2. **新規インポート取得元の切替**
   - `.env.local` / Vercel 環境変数の `WP_API_BASE_URL` を `http://musicite.sub.jp` に変更
3. **既存Sanity記事URLの一括置換（dry-run）**
   - 対象:
     - `wpImportedArticle.heroImageExternalUrl`
     - `wpImportedArticle.legacyBodyHtml` 内の `https://www.musicite.net/`
   - 置換先: `http://musicite.sub.jp/`
   - 置換件数・対象IDをレポート出力
4. **一括置換（apply）**
   - dry-run結果を確認後に実行
   - 実行ログ（成功/失敗/対象ID）を `reports/` に保存
5. **表示確認**
   - 代表記事（通常記事 / ギャラリー記事 / 引用記事）で画像表示確認（PC/スマホ）
6. **DNS切替実施**
   - 切替後に同一サンプルで再確認
   - 問題時はロールバック手順に従う

実績ログ（2026-03-02）:
- dry-run:
  - `reports/wp-image-host-replace-dry-run-20260302-175622.json`
  - `reports/wp-image-host-replace-dry-run-20260302-175622.csv`
  - summary: `scannedDocs=1062`, `affectedDocs=1062`, `docsWithHeroReplacement=1062`, `docsWithBodyReplacement=714`
- apply（1回目）:
  - `reports/wp-image-host-replace-apply-20260302-183836.json`
  - `reports/wp-image-host-replace-apply-20260302-183836.csv`
  - summary: `from=https://www.musicite.net`, `to=http://musicite.sub.jp`, `appliedUpdatedDocs=1062`, `applyFailedDocs=0`
- apply（2回目 / HTTPS再置換）:
  - `reports/wp-image-host-replace-apply-20260302-184943.json`
  - `reports/wp-image-host-replace-apply-20260302-184943.csv`
  - summary: `from=http://musicite.sub.jp`, `to=https://musicite.sub.jp`, `appliedUpdatedDocs=1062`, `applyFailedDocs=0`

---

## レポート運用（フェーズ3）

- [ ] 画像移行対象件数の集計
- [ ] 移行成功/失敗CSVの出力
- [ ] 未解決課題を要修正リストへ集約

推奨レポートファイル:
- `image-migration-targets-*.csv`
- `image-migration-apply-*.json`
- `image-migration-failed-*.csv`
- `image-migration-retry-queue-*.csv`

---

## 完了条件

- [ ] 外部画像参照が許容範囲まで削減されている
- [ ] 重要記事の画像表示が安定している
- [ ] DNS切替手順とロールバック手順が文書化されている
- [ ] フェーズ4（リニューアル切替実施）へ進める状態

---

## 注記

- `featuredImage_api_denied` 記事はフェーズ2の統合issues CSVを入力に優先対応する。
- FooGalleryは記事ごとの差が大きいため、全自動置換だけに依存しない段階対応を許容する。
- DNS切替前に「`musicite.net` → `musicite.sub.jp` 参照先切替」を実施しないと、移行済み記事の外部参照画像が欠落する可能性がある。
- この実行環境では Sanity API の名前解決エラー（`ENOTFOUND <projectId>.api.sanity.io`）が発生したが、ローカル環境で dry-run/apply 実行済み。

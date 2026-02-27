# WP→Sanity移行 フェーズ2（全件バッチ移行）

## 目的

PoCで確立した移行手順を使い、WP既存記事（約3,500件）を `wpImportedArticle` として段階的に移行する。

進捗表記:
- `[ ]` 未着手 / 未確定
- `[◯]` 完了 / 確定

---

## 前提（フェーズ1から継続）

- タクソノミ同期（`newsCategory` / `newsTag`）は実施済み
- PoC 10件の移行と表示確認は完了
- 画像は当面WP外部URL参照（画像アセット移行は後フェーズ）
- canonicalは当面旧WPを正本として運用

---

## フェーズ2タスク

### 1) バッチ実行計画

- [◯] 1バッチ件数を確定（例: 100件）
- [◯] 実行順を確定（公開日時降順）
- [◯] 1日の実行回数/上限を確定
- [◯] 中断/再開ルールを確定

確定ルール:
- 1バッチ: `100件`
- 1日の上限: `3バッチ`（最大 `300件`）
- バッチ間隔: `10〜15分`
- 停止条件:
  - `applyFailed > 0`
  - `postsWithBlockers > 0`
  - `.issues.csv` の要確認件数が急増（目安: 5件超）

### 2) 実行（dry-run → apply）

- [◯] 各バッチで dry-run 実行
- [◯] dry-run の summary を確認（blocker / warnings / missing refs）
- [◯] apply 実行
- [◯] 実行ログを `reports/` に保存

基本コマンド（例）:
- dry-run: `npm run poc:wp-to-sanity:dry-run -- --limit=100 --page=1`
- apply: `npm run poc:wp-to-sanity:apply -- --limit=100 --page=1`

実行ログ（2026-02-27）:
- dry-run: `reports/wp-to-sanity-poc-dry-run-20260227-135408.json`
  - `checkedPosts=100`, `wouldCreate=90`, `wouldUpdate=10`
  - `postsWithBlockers=0`, `postsWithWarnings=1`, `postsMissingFeaturedImage=1`
- apply: `reports/wp-to-sanity-poc-apply-20260227-135551.json`
  - `appliedCreates=90`, `appliedUpdates=10`, `applyFailed=0`
- issues CSV: `reports/wp-to-sanity-poc-dry-run-20260227-145346.issues.csv`
  - 要確認記事: 1件（`wpPostId=21277`, `featuredImage_api_denied`）

### 3) 品質確認（各バッチ）

- [◯] 件数が予定どおりか
- [◯] 代表3記事の表示確認（タイトル/日時/本文/導線）
- [◯] 画像表示の致命的不具合がないか
- [◯] カテゴリ/タグリンクが機能するか
- [◯] relatedGroups の明らかな誤紐付けがないか

### 4) 例外管理

- [◯] `要修正リスト` を更新（0件運用開始）
- [◯] `relatedGroups` 想定外ケースを記録
- [◯] 移行不能/要手修正記事を記録
- [◯] 再実行対象IDを管理（将来 `--only-ids` 検証用）

現時点の記録:
- 要修正リスト: 1件（`wpPostId=21277`）
- 理由: `featuredImage_api_denied`（WP API経由でアイキャッチ取得不可）
- 対応方針: 記事移行は継続（hero image空を許容）、画像移行フェーズで再対応

---

## レポート運用

- [◯] バッチごとに実行ログファイル名を記録
- [◯] 失敗件数 / 警告件数の推移を記録
- [◯] 未解決課題を `要修正リスト` に集約

推奨記録項目:
- 実行日時
- 対象ページ/件数（`page`, `limit`）
- `checkedPosts`, `postsWithBlockers`, `postsWithWarnings`
- `appliedCreates`, `appliedUpdates`, `applyFailed`

---

## フェーズ2完了条件

- [ ] 全対象記事の移行完了（重複なし）
- [◯] バッチ実行ログが揃っている
- [◯] 重大不具合が収束している
- [◯] `要修正リスト` が処理方針付きで管理されている
- [ ] フェーズ3（画像アセット移行 / DNS切替準備）に進める状態

---

## 注記

- `--only-ids` は本番移行中に失敗記事再実行で実地検証する。
- FooGallery等のプラグイン依存要素は、必要に応じて後続フェーズで個別対応する。
- DNS切替前のVercel運用ルールは切替タイミングで確定する。
- Studioで `Draft` の Publish操作が出ない場合は `Cmd+K` でコマンドパレットを開くと復帰することがある。

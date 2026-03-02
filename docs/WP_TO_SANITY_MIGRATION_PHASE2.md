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

## 現在進捗（2026-02-27）

- 移行済み: **3,411件 / 約3,500件（WP API上の最終ページまで完了）**
  - `page=1`〜`page=34`（各100件）apply 完了
  - `page=35`（11件）apply 完了
  - `page=36` は `400 Bad Request`（範囲外）で、`page=35` が最終ページ
- 既知の要確認:
  - `featuredImage_api_denied` / `featuredImage_missing`（累計 issues CSV で追跡）
- 状態:
  - フェーズ2（全件バッチ移行）は **完了**
  - フェーズ3（画像アセット移行 / DNS切替準備）へ移行可能

追記（2026-02-28）:
- 全件移行完了後の新規WP投稿をID指定で単体インポート可能な運用に移行。
  - `wpPostId=22061` インポート完了
  - `wpPostId=22141` インポート完了

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
- dry-run: `reports/wp-to-sanity-poc-dry-run-20260227-150805.json`
  - `checkedPosts=100`, `wouldCreate=100`, `wouldUpdate=0`
  - `postsWithBlockers=0`, `postsWithWarnings=1`, `postsMissingFeaturedImage=1`
- apply: `reports/wp-to-sanity-poc-apply-20260227-150846.json`
  - `appliedCreates=100`, `appliedUpdates=0`, `applyFailed=0`
- dry-run: `reports/wp-to-sanity-poc-dry-run-20260227-151342.json`
  - `checkedPosts=100`, `wouldCreate=100`, `wouldUpdate=0`
  - `postsWithBlockers=0`, `postsWithWarnings=4`, `postsMissingFeaturedImage=4`
- apply: `reports/wp-to-sanity-poc-apply-20260227-151426.json`
  - `appliedCreates=100`, `appliedUpdates=0`, `applyFailed=0`
- issues CSV（単回）:
  - `reports/wp-to-sanity-poc-dry-run-20260227-145346.issues.csv`
  - `reports/wp-to-sanity-poc-dry-run-20260227-150805.issues.csv`
  - `reports/wp-to-sanity-poc-dry-run-20260227-151342.issues.csv`
- issues CSV（統合）:
  - `reports/wp-to-sanity-poc-issues-merged-*.csv`（`npm run report:wp-poc-issues:merge`）

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
- 要修正リスト: 個別手修正は現時点 `0件`（致命的不具合なし）
- ただし警告系（`featuredImage_api_denied` / `featuredImage_missing`）は多数発生
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

- [◯] 全対象記事の移行完了（重複なし）
- [◯] バッチ実行ログが揃っている
- [◯] 重大不具合が収束している
- [◯] `要修正リスト` が処理方針付きで管理されている
- [◯] フェーズ3（画像アセット移行 / DNS切替準備）に進める状態

最終実行ログ（末尾）:
- `reports/wp-to-sanity-poc-apply-20260227-201541.json`（page=33）
- `reports/wp-to-sanity-poc-apply-20260227-201639.json`（page=34）
- `reports/wp-to-sanity-poc-apply-20260227-201720.json`（page=35）
- `reports/wp-to-sanity-poc-issues-merged-20260227-202336.csv`（issues統合）
- `reports/wp-to-sanity-poc-apply-20260227-212854.json`（single id: 22061）
- `reports/wp-to-sanity-poc-apply-20260228-000734.json`（single id: 22141）

---

## 注記

- `--only-ids` は本番移行中に失敗記事再実行で実地検証する。
- FooGallery等のプラグイン依存要素は、表示崩れ回避のため詳細画面UIで暫定対応を実施済み（`img[data-src-fg]` の `src` 補完、サムネイル横並び）。画像資産の恒久対応はフェーズ3で継続する。
- DNS切替前のVercel運用ルールは切替タイミングで確定する。
- Studioで `Draft` の Publish操作が出ない場合は `Cmd+K` でコマンドパレットを開くと復帰することがある。

# WP→Sanity移行 フェーズ1（実装開始）

## 目的

フェーズ0で確定したルールを実装に落とし、`wpImportedArticle` の本移行に入る前提を整える。

進捗表記:
- `[ ]` 未着手 / 未確定
- `[◯]` 完了 / 確定

---

## フェーズ1タスク

### 1) タクソノミ同期（カテゴリ/タグ）

- [◯] WP→Sanity タクソノミ同期スクリプトを追加
- [◯] dry-run 実行して件数確認
- [ ] apply 実行して Sanity `newsCategory` / `newsTag` を upsert
- [ ] 再度 PoC dry-run を実行し `totalMissingTagSlugRefs` の改善を確認

実装:
- `scripts/wp-sync-taxonomies-to-sanity.mjs`
- `npm run sync:wp-taxonomies:dry-run`
- `npm run sync:wp-taxonomies:apply`

dry-runログ（2026-02-27）:
- `reports/wp-taxonomy-sync-dry-run-20260227-105250.json`
- category: `sourceCount=10, creates=2, noops=8`
- tag: `sourceCount=1243, creates=1241, noops=2`

前提環境変数:
- `WP_API_BASE_URL`
- `NEXT_PUBLIC_SANITY_PROJECT_ID`
- `NEXT_PUBLIC_SANITY_DATASET`
- `NEXT_PUBLIC_SANITY_API_VERSION`
- `SANITY_API_READ_TOKEN`（dry-run時。`SANITY_API_TOKEN`でも可）
- `SANITY_API_WRITE_TOKEN`（apply時）

### 2) 記事移行スクリプト（保存あり）

- [◯] `wpImportedArticle` への create/update 実装（`--apply`）
- [ ] 失敗記事のみ再実行オプション（`--only-ids` など）
- [ ] 実行ログ（成功/失敗/スキップ）を `reports/` に出力

実行コマンド:
- dry-run: `npm run poc:wp-to-sanity:dry-run`
- apply: `npm run poc:wp-to-sanity:apply`

### 3) 品質確認（PoC 10件）

- [ ] 10件の移行実保存を実施
- [ ] 表示確認（タイトル/日時/本文/導線）
- [ ] `relatedGroups` の一致/不一致を確認
- [ ] 問題記事を `要修正リスト` に記録

例外検証（任意追加）:
- `poc:wp-to-sanity:dry-run` は `--include-ids=` で追加記事を検証できる
- 例: `node scripts/wp-to-sanity-poc-dry-run.mjs --limit=10 --page=1 --include-ids=21277`
- 用途: 最新10件に含まれない `FooGallery` 記事などの個別検証

---

## 現在の注記

- `totalMissingTagSlugRefs` は、主に Sanity `newsTag` マスタ未整備による検出値。
- まずタクソノミ同期を通し、その後に記事移行を実行する順序を採用する。
- `wpImportedArticle.heroImage` は移行実行性を優先して必須解除（API取得不可記事を移行停止にしない）。
- ヒーロー画像は本文画像フォールバックで補完しない。取得不可は `warnings` としてレポート化する。
- `legacyBodyHtml` 取得不可は blocker にせず、プレースホルダ本文で移行継続する（`warnings` に `legacyBodyHtml_missing` を記録）。

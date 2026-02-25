# Related Groups Custom Input Plan (Sanity Studio)

目的:
- `relatedGroups` 入力を `Group Name (JA)` ベースのサジェストUIにする
- 候補選択時に `imdGroupId` を自動保存する（手入力不要）

## 想定UX

1. 入力欄に日本語グループ名を入力
2. `imd.groups.name_ja` から候補検索
3. 候補を一覧表示（Autocomplete / Typeahead）
4. 選択で以下をセット
   - `groupNameJa`
   - `imdGroupId`

## 必要なもの

- Sanity Studio custom input component
- 候補取得API（Next.js route で `imd.groups` を検索）
- デバウンス（200-300ms）
- エラーハンドリング（API失敗時に手入力継続可能）

## 暫定運用との整合

- 現在は `imdGroupId` を hidden + optional にしている
- custom input 完了後に `imdGroupId` を再び内部必須に戻すことを検討

## 実装メモ（次フェーズ）

- まずは `relatedGroups` の array item 内 `groupNameJa` フィールド単体の custom input として着手
- 後で array item 全体の入力UIに拡張してもよい


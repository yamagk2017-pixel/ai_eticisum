# 改善案・将来実装ハブ（データ/移行計画は除外）

このファイルを、機能改善と将来実装の一次集約先（Single Source of Truth）にする。

## 1. 運用ルール
- 対象: 機能改善、UX改善、性能改善、新機能案、将来実装案。
- 非対象: データ/移行計画（`WP_TO_SANITY_*` や `*_MIGRATION_*` は従来通り個別管理）。
- フラッシュアイデアは、まず [FLASH_IDEAS_INBOX.md](/Users/yamada2/バイブコーディング/musicite_ai/docs/FLASH_IDEAS_INBOX.md) に追記する。
- 実装候補に育ったら、このファイルの Backlog に移動する。

## 2. 現在の優先テーマ（Now / Next / Later）
### Now（直近）
- ホーム表示体験の軽量化（初期表示と体感速度の改善）
  - 詳細: [HOMEPAGE_PERFORMANCE_PLAN.md](/Users/yamada2/バイブコーディング/musicite_ai/docs/HOMEPAGE_PERFORMANCE_PLAN.md)

### Next（次に着手）
- ナンダッテのUX改善・拡張（投票促進、履歴、連動機能）
  - 詳細: [NANDATTE_REQUIREMENTS.md](/Users/yamada2/バイブコーディング/musicite_ai/docs/NANDATTE_REQUIREMENTS.md)
- カイワイの実装計画具体化
  - 詳細: [KAIWAI_REQUIREMENTS.md](/Users/yamada2/バイブコーディング/musicite_ai/docs/KAIWAI_REQUIREMENTS.md)
- イマキテの拡張実装
  - 詳細: [IMAKITE_REQUIREMENTS.md](/Users/yamada2/バイブコーディング/musicite_ai/docs/IMAKITE_REQUIREMENTS.md)

### Later（中長期）
- サイト全体の再設計トラック（現行改善と分離して検証）
  - 詳細: [PROJECT_REDESIGN_FROM_SCRATCH.md](/Users/yamada2/バイブコーディング/musicite_ai/docs/PROJECT_REDESIGN_FROM_SCRATCH.md)

## 3. 統合バックログ
以下フォーマットで追記する。

```md
- [ ] タイトル
  - 種別: feature / ux / perf / content / ops
  - 対象: home / nandatte / imakite / kaiwai / cross
  - 期待効果: （例: 回遊率向上、LCP改善、投票率向上）
  - 概算工数: S / M / L
  - 参照: 関連ドキュメント or Issue
  - メモ:
```

### Backlog Items
- [ ] ホームの Above-the-fold 最適化を段階描画で実装
  - 種別: perf
  - 対象: home
  - 期待効果: 初期表示の体感速度改善
  - 概算工数: M
  - 参照: [HOMEPAGE_PERFORMANCE_PLAN.md](/Users/yamada2/バイブコーディング/musicite_ai/docs/HOMEPAGE_PERFORMANCE_PLAN.md)
  - メモ: 重いカードの後段表示を標準化する

- [ ] ナンダッテの改善リクエスト導線を仕様化
  - 種別: feature
  - 対象: nandatte
  - 期待効果: ユーザーニーズ収集の速度向上
  - 概算工数: S
  - 参照: [NANDATTE_REQUIREMENTS.md](/Users/yamada2/バイブコーディング/musicite_ai/docs/NANDATTE_REQUIREMENTS.md)
  - メモ: 要件10.4を具体化する

- [ ] 横断検索の改善案を現行トラックで小さく試作
  - 種別: ux
  - 対象: cross
  - 期待効果: 回遊率と発見性の向上
  - 概算工数: M
  - 参照: [PROJECT_REDESIGN_FROM_SCRATCH.md](/Users/yamada2/バイブコーディング/musicite_ai/docs/PROJECT_REDESIGN_FROM_SCRATCH.md)
  - メモ: 再設計案から現行に逆輸入可能な最小単位で切り出す

- [ ] 第四会議室のメインビジュアルを刷新
  - 種別: content
  - 対象: home
  - 期待効果: 初回訪問時の印象改善と導線強化
  - 概算工数: M
  - 参照: [FLASH_IDEAS_INBOX.md](/Users/yamada2/バイブコーディング/musicite_ai/docs/FLASH_IDEAS_INBOX.md)
  - メモ: トップヒーローとのトーン統一を含めて検討

- [ ] グッズ購入導線とナンダッテ特典導線を連携
  - 種別: feature
  - 対象: nandatte
  - 期待効果: 収益化と参加率の同時向上
  - 概算工数: L
  - 参照: [FLASH_IDEAS_INBOX.md](/Users/yamada2/バイブコーディング/musicite_ai/docs/FLASH_IDEAS_INBOX.md)
  - メモ: 更新権付与の条件と不正対策を先に定義する

- [ ] 「一押しアイドル」ティッカー枠を仕様検討
  - 種別: ops
  - 対象: cross
  - 期待効果: 露出枠の商品化とトップの更新価値向上
  - 概算工数: M
  - 参照: [FLASH_IDEAS_INBOX.md](/Users/yamada2/バイブコーディング/musicite_ai/docs/FLASH_IDEAS_INBOX.md)
  - メモ: スポンサー表記と選定透明性のポリシーをセットで設計

- [ ] favicon を制作し全ページ反映
  - 種別: content
  - 対象: cross
  - 期待効果: ブランディングとタブ視認性の向上
  - 概算工数: S
  - 参照: [FLASH_IDEAS_INBOX.md](/Users/yamada2/バイブコーディング/musicite_ai/docs/FLASH_IDEAS_INBOX.md)
  - メモ: OG画像・PWAアイコンとの整合も確認

- [ ] トップページに最新YouTubeセクションを追加
  - 種別: feature
  - 対象: home
  - 期待効果: リアルタイム性向上と滞在時間増加
  - 概算工数: M
  - 参照: [FLASH_IDEAS_INBOX.md](/Users/yamada2/バイブコーディング/musicite_ai/docs/FLASH_IDEAS_INBOX.md)
  - メモ: 初期表示を重くしない遅延ロード設計が前提

- [ ] ナンダッテのスタンプ/リワード機能を検証
  - 種別: feature
  - 対象: nandatte
  - 期待効果: ログイン継続率と投票継続率の向上
  - 概算工数: M
  - 参照: [FLASH_IDEAS_INBOX.md](/Users/yamada2/バイブコーディング/musicite_ai/docs/FLASH_IDEAS_INBOX.md)
  - メモ: 付与条件の単純化とゲーミング耐性の両立を検討

- [ ] ログインユーザー向けのしおり機能を実装（NANDATTE以外ページ含む）
  - 種別: feature
  - 対象: cross
  - 期待効果: 再訪率と回遊率の向上
  - 概算工数: M
  - 参照: [NANDATTE_REQUIREMENTS.md](/Users/yamada2/バイブコーディング/musicite_ai/docs/NANDATTE_REQUIREMENTS.md)
  - メモ: 保存先のUI導線（一覧・解除・並び替え）まで含めて定義する

- [ ] `user_bookmarks` テーブル設計を確定
  - 種別: ops
  - 対象: cross
  - 期待効果: しおり機能の実装基盤確立
  - 概算工数: S
  - 参照: [NANDATTE_REQUIREMENTS.md](/Users/yamada2/バイブコーディング/musicite_ai/docs/NANDATTE_REQUIREMENTS.md)
  - メモ: 想定列 `user_id, page_type, page_id, title, url, created_at`

- [ ] トレンドウォッチ機能（管理者登録ワードの関連集約）を検証
  - 種別: feature
  - 対象: cross
  - 期待効果: 編集運用の効率化と注目トピック導線の強化
  - 概算工数: M
  - 参照: [NANDATTE_REQUIREMENTS.md](/Users/yamada2/バイブコーディング/musicite_ai/docs/NANDATTE_REQUIREMENTS.md)
  - メモ: 管理画面の最小運用フローを先に決める

- [ ] アップデートリクエスト機能（ログインユーザー通知）を全体設計で定義
  - 種別: feature
  - 対象: cross
  - 期待効果: 情報鮮度の維持と運用負荷の平準化
  - 概算工数: M
  - 参照: [NANDATTE_REQUIREMENTS.md](/Users/yamada2/バイブコーディング/musicite_ai/docs/NANDATTE_REQUIREMENTS.md)
  - メモ: 既存の「改善リクエスト導線」案と統合して仕様を一本化する

- [ ] 「Webで天下一ボブ道会」企画を実験機能として要件化
  - 種別: content
  - 対象: cross
  - 期待効果: 企画コンテンツによる流入と話題化
  - 概算工数: L
  - 参照: [NANDATTE_REQUIREMENTS.md](/Users/yamada2/バイブコーディング/musicite_ai/docs/NANDATTE_REQUIREMENTS.md)
  - メモ: 小規模PoCで需要検証してから本実装判断

- [ ] ニュース受付フォームからAI記事化までの運用フローを実装
  - 種別: ops
  - 対象: cross
  - 期待効果: 記事投入リードタイム短縮と運用負荷の軽減
  - 概算工数: L
  - 参照: [FLASH_IDEAS_INBOX.md](/Users/yamada2/バイブコーディング/musicite_ai/docs/FLASH_IDEAS_INBOX.md)
  - メモ: フォーム投稿 -> AI整形 -> Sanity下書き -> プレビュー確認 -> 公開。整形不能時の再投稿依頼ルールを定義する

## 4. 参照ドキュメント（改善案・将来実装）
- [HOMEPAGE_PERFORMANCE_PLAN.md](/Users/yamada2/バイブコーディング/musicite_ai/docs/HOMEPAGE_PERFORMANCE_PLAN.md)
- [NANDATTE_REQUIREMENTS.md](/Users/yamada2/バイブコーディング/musicite_ai/docs/NANDATTE_REQUIREMENTS.md)
- [KAIWAI_REQUIREMENTS.md](/Users/yamada2/バイブコーディング/musicite_ai/docs/KAIWAI_REQUIREMENTS.md)
- [IMAKITE_REQUIREMENTS.md](/Users/yamada2/バイブコーディング/musicite_ai/docs/IMAKITE_REQUIREMENTS.md)
- [PROJECT_REDESIGN_FROM_SCRATCH.md](/Users/yamada2/バイブコーディング/musicite_ai/docs/PROJECT_REDESIGN_FROM_SCRATCH.md)
- [SITE_APP_INTRO_FOR_FANS.md](/Users/yamada2/バイブコーディング/musicite_ai/docs/SITE_APP_INTRO_FOR_FANS.md)

# IDOL ACTIVITY MONITOR 要件定義 v1.0（MVP確定版）

## 1. 概要

本システムは、IMDB に登録されたアイドルグループの外部情報を定点観測し、直近の活動状況を収集・整理し、週刊ニュースとして扱いやすい形に整形するためのユーザー専用編集支援サービスである。

本システムの目的は、AI に完全自動で最終ニュース選定をさせることではなく、以下を実現することである。

- 毎週の注目対象グループを自動抽出する
- 各グループの直近活動シグナルを収集する
- 複数ソースの更新を「出来事」に整形する
- 重要候補を根拠付きで並べる
- 月曜生配信「週刊アイドルニュース」の素材を作る

---

## 2. 背景と問題意識

アイドルシーン情報は、公式サイト、X、YouTube、ニュース媒体などに分散しており、更新粒度や外部ID整備状況に偏りがある。重要ニュースは発表日が古くても現在有効な文脈を持つ場合がある。

このため本システムは「完全自動ニュース判定機」ではなく、「候補収集・整形・比較を支援するシステム」として設計する。

---

## 3. システムの位置づけ

- 本体: アイドルグループ活動状況収集アプリ
- AI の役割: 要約、分類、重複統合、候補整理、下書き生成
- 目的: ユーザー専用の週刊ニュース編集支援

基本構造:

1. IMDB を監視対象管理台帳として利用
2. external_ids を起点に一次ソースを定点観測
3. 必要時のみ Web 検索・外部媒体で補完
4. AI が出来事に整形し候補化

---

## 4. MVPの目的

### 4.1 MVP目的
IHC 週刊ランキング上位およびナンダッテ更新ランキング上位グループを対象に、IMDB の external_ids から活動シグナルを収集し、週刊ニュース候補を自動整理する。

### 4.2 MVPで達成したい状態

- 毎週の監視対象が自動で決まる
- 活動シグナルを一定精度で収集できる
- 更新羅列ではなく「出来事」として整理できる
- 重要候補が理由付きで一覧化される
- 配信準備時間を短縮できる

---

## 5. 非目標（MVPでやらないこと）

- 全 IMDB 登録グループの常時完全監視
- 全ソース同一精度追跡
- X 主軸の高度リアルタイム監視
- 完全自動の最終ニュース選定
- ファン感情の深層自動解釈
- 汎用AIエージェントとしての業務代行
- 高度学習モデル最適化
- 一般公開前提の高度UI/権限設計

---

## 6. 用語定義

### 6.1 活動シグナル
グループ活動を示す観測可能更新。例: 新曲配信、MV公開、ライブ発表、メンバー加入/卒業、掲載情報。

### 6.2 raw update
外部ソースから取得した生更新情報。

### 6.3 normalized event
複数 raw update を統合して作る「出来事」。

### 6.4 observability
活動量と観測しやすさを区別するための観測可能性概念。

---

## 7. 監視対象選定要件

### 7.1 基本集合
- IHC 週刊ランキング TOP20
- ナンダッテ更新ランキング TOP20
- 週次対象は上記和集合

### 7.2 件数
- 最小20件（完全一致）
- 最大40件（重複なし）

### 7.3 ナンダッテ投票ランキング
主集合には含めない。文脈補助として参照。

### 7.4 優先度
1. IHC とナンダッテ更新の両方に含まれる
2. IHC のみ
3. ナンダッテ更新のみ

### 7.5 週キー定義（確定）
`week_key` は `Asia/Tokyo` 基準の週開始日（月曜日）を `YYYY-MM-DD` 形式で保持する。

例: 2026年4月第2週は `2026-04-06`。

---

## 8. 情報源要件

### 8.1 基本方針
情報収集は IMDB の external_ids 起点。足りない場合のみ外部補完。

### 8.2 一次ソース（primary）
- 公式サイト
- 公式お知らせページ
- 公式YouTube
- 公式カレンダー
- 公式導線で確認できる配信情報

### 8.3 準一次ソース（semi_primary）
- 所属事務所公式ページ
- 主催者公式ページ
- レーベル公式ページ

### 8.4 二次ソース（secondary）
- ニュース媒体
- インタビュー記事
- 外部イベント記事

### 8.5 原則
- 事実確認は一次優先
- 二次は意味づけ補完
- メディア掲載のみを重要度の唯一基準にしない

---

## 9. 情報偏りへの対応

- 全グループ同一精度完全観測は目指さない
- 観測できた活動シグナルを体系的に扱う
- 「静かだった」と「見えづらかった」を区別する

### 9.1 observability 管理項目
- external_ids 件数
- source_type 種類数
- 直近30日で更新観測できたソース数
- 主要媒体
- 観測モード

### 9.2 観測モード
- official_rich
- official_basic
- sns_heavy
- low_observable

---

## 10. 時間軸要件

### 10.1 直近更新窓
原則直近7日。
ただし、MVPでは厳密な「前週一週間」時間窓は固定せず、月曜未明バッチ実行時点で取得可能な情報を反映対象とする。

運用上の扱い（確定）:
- 進行中の週キー（例: 当日が `2026-04-20` の週）について、`normalized_events` や `weekly_digest_candidates` が0件でも異常扱いしない。
- 週次データの評価・成否判定は、次回週次実行時点（例: `2026-04-27` 実行時）で対象週が揃っているかを基準に行う。

### 10.2 重要ニュース保持
7日超でも、ワンマン/ツアー/新体制/メンバー変動/大型タイアップ等は保持。

### 10.3 継続中トピック
「発表日」ではなく「現在有効か」で扱う。

### 10.4 出力構造
- 今週の更新
- 継続中の重要トピック

---

## 11. 機能要件

### 11.1 週次監視対象作成
- IHC TOP20取得
- ナンダッテ更新TOP20取得
- 和集合作成
- 対象理由保持

出力例: `group_id`, `group_name`, `target_reason`, `priority`, `week_key`

### 11.2 external_ids取得
- IMDBから取得
- 有効ソース抽出
- 監視対象列挙

### 11.3 raw update収集
- ソース更新取得
- 取得日時/公開日時保存
- raw text / raw json 保持
- MVP実装済みソース: YouTube（通常動画/ショート/ライブ関連）・Spotify（週内リリース）

### 11.4 event整形
- raw update束ね
- event化
- event_type付与
- 初期重要度判定

### 11.5 補完検索
一次情報不足時のみ外部検索で補完。

### 11.6 候補評価
各eventに仮スコア付与し並び替え。
- MVP実装では `weekly_digest_candidates` 生成時に簡易スコアリングを適用する。

### 11.7 週刊ニュース候補出力
候補順位、見出し、要約、根拠、参照リンク、confidence を出力。

### 11.8 グループ単位最近活動出力
今週更新、継続トピック、ランキング接続、現状整理を返却。

### 11.9 配信用下書き生成（Phase 4以降の任意機能）
現時点ではMVP対象外とし、Phase 4以降で導入する。

---

## 12. データ要件

### 12.1 既存テーブル
- `groups`
- `external_ids`

データ保存方針（確定）:
- IAMで収集・整形・評価した週次データは、Supabase上の永続テーブルにアーカイブ保存する
- `/relay-9147` 配下画面は当該アーカイブデータを参照して表示する

### 12.2 新規テーブル
- `weekly_targets`
- `raw_updates`
- `normalized_events`
- `event_sources`
- `weekly_digest_candidates`
- `weekly_group_complements`
- `group_observability_profiles`

### 12.3 冪等性・一意制約（確定）

- `weekly_targets`: 一意制約 `(week_key, group_id)`
- `raw_updates`: 外部ID優先で一意化
  - 外部IDあり: `(group_id, source_type, source_url, external_item_id)`
  - 外部IDなし: `(group_id, source_url, published_at, title_hash)`
- `normalized_events`: 一意制約 `(group_id, dedupe_key)`
- `weekly_group_complements`: 一意制約 `(week_key, group_id)`
- 再実行時は全対象で `upsert` を使用

---

## 13. dedupe_key生成ルール（確定）

`dedupe_key = group_id | event_type | normalized_headline | event_date_bucket`

### 13.1 normalized_headline
- 文字種・大小文字正規化
- 記号/URL/余分空白除去
- 同義語統一（例: 開催決定→開催発表）
- 長文はハッシュ化（例: sha1先頭12桁）

### 13.2 event_date_bucket
- `music_release`, `mv_release`, `member_change`, `live_announcement`: `YYYY-MM-DD`
- `tour_announcement`, `media_coverage`, `event_update`: `YYYY-MM`
- 日付不明: `unknown`

### 13.3 運用
- 同一入力で同一キーを生成
- 仕様更新に備え `dedupe_version` を保持

---

## 14. 判定ルール（確定）

### 14.1 is_major
以下のいずれかで `true`:

- `event_type` が `member_change` または `tour_announcement`
- `live_announcement` かつ大規模キーワードあり
- `primary` 確認済み かつ `importance_score >= 70`
- 手動指定

### 14.2 is_ongoing
`is_major=true` のうち、開催・効力が現在継続中なら `true`。
終了条件到来、終了確認取得、手動解除で `false`。

### 14.3 手動上書き
`is_major` / `is_ongoing` は手動上書きを許可し、手動値を優先。

---

## 15. 候補スコア（確定）

`candidate_score` は 0-100 の加点方式。

- 公式一次確認（primaryあり）: +25
- 準一次のみ（semi_primaryのみ）: +15
- 二次のみ（secondaryのみ）: +5
- 複数ソース確認（異なるURL2件以上）: +15
- event_type重大度: +20
- 直近性: +15
- 継続中重要トピック: +10
- IHC該当: +10
- ナンダッテ更新該当: +5

### 15.1 event_type重大度（20点満点）
- `member_change`, `tour_announcement`: 20
- `live_announcement`, `music_release`, `mv_release`: 15
- `media_coverage`, `event_update`: 8
- `other`: 5

### 15.2 直近性（15点満点）
- 0-2日: 15
- 3-4日: 10
- 5-7日: 6
- 8日以上（ongoing）: 3
- それ以外: 0

### 15.3 ルール
スコアは候補整理用であり最終採否の自動決定に使わない。`score_version` で管理し調整可能とする。

---

## 16. 収集失敗時の扱い（確定）

基本方針: 収集失敗は深追いしない。

- 失敗したソースは記録してスキップ
- 再試行は原則なし（必要時でも最大1回）
- バッチは継続し、全体は `partial_success` を標準許容
- 週次出力に未取得ソース数を表示

失敗記録の最低項目:
- `group_id`, `source_url`, `source_type`, `fetched_at`, `error_type`, `error_message`

---

## 17. AIの役割

### 17.1 AIに任せる
- 要約
- 分類
- 束ね
- 補完結果整理
- 候補説明文生成

### 17.2 AIに任せすぎない
- 最終採用判断
- 本質的意味づけの確定
- ファン心理深層解釈
- ユーザー編集観の代替

### 17.3 利用技術
情報収集・整理の一部で OpenAI Responses API の利用を許容する。

### 17.4 補完検索の運用ルール（実装反映）
- 補完対象は `weekly_digest_candidates` に含まれる `group_id` のユニーク集合
- 同一週・同一グループの重複検索は行わない（`week_key + group_id` で一意管理）
- 補完結果は `weekly_group_complements` に保存し、`/relay-9147/iam/candidates` に「AI補足」として表示する
- 料金ガード:
  - 日次上限: `$2.5`
  - 月次上限: `$10`
  - 上限到達時は補完結果として `利用限度（料金）の上限に達しました` を表示する

---

## 18. 手動介入点（確定）

MVPの手動介入は以下の3点に限定。

1. 候補採否: `adopt` / `hold` / `drop`
2. `is_major` 手動上書き
3. `headline` / `summary` 手動修正

監査項目:
- `edited_by`
- `edited_at`
- `edit_reason`（任意）
- `auto_value` と `manual_value`

---

## 19. 出力要件

MVP最低出力:

1. 監視対象一覧
- 今週対象
- 対象理由
- 優先度
- external_ids 状態

2. 整形済みイベント一覧
- 何が起きたか
- いつ起きたか
- 根拠ソース
- 重要度
- 継続中フラグ

3. 週刊ニュース候補一覧
- 候補順位
- 見出し
- 要約
- 候補理由
- 参照元
- confidence
- AI補足（補完結果 / 料金上限到達メッセージ）

表示要件（確定）:
- 上記MVP出力は、サイト内の `/relay-9147` 配下ページで閲覧できることを必須とする
- 初期運用では外部配布用出力よりも、`/relay-9147` 上での確認性を優先する

---

## 20. 画面要件（MVP）

画面配置方針（確定）:
- IAMのMVP画面はすべて `/relay-9147` 配下に配置する
- 例: `/relay-9147/iam/targets`, `/relay-9147/iam/activities`, `/relay-9147/iam/candidates`

1. 今週対象一覧画面
- グループ名
- 対象理由
- observability mode
- 更新件数
- 最終収集時刻

2. 週間アクティビティ一覧画面
- 箇条書きに近い時系列表示
- グループ名
- event見出し
- event要約
- event日時
- 根拠ソースリンク
- is_major / is_ongoing

3. 週刊ニュース候補画面
- 順位
- 見出し
- 要約
- ランキング該当状況
- ソースリンク
- AI補足情報（補完要約、補足ポイント、参照URL数）

4. 配信用出力画面（Phase 4以降の任意機能）
- 冒頭総括
- 個別トピック叩き台
- コピーしやすい表示

---

## 21. 実行タイミング

### 21.1 週次処理
月曜未明〜早朝に実行:

- `run-weekly` 実行（単一エンドポイント）
- IHC週刊ランキング取得
- ナンダッテ更新ランキング取得
- weekly_targets作成
- raw_updates作成（YouTube・Spotify）
- normalized_events作成
- weekly_digest_candidates作成
- weekly_group_complements作成（OpenAI Responses API 補完 + 料金ガード）

実行エンドポイント（実装済み）:
- `GET /api/cron/iam/run-weekly`（Bearer `CRON_SECRET`）

暫定運用基準:
- 月曜 06:00（Asia/Tokyo）までの処理完了を目標とする
- 実測処理時間に基づき、完了時刻は再検討する

### 21.2 任意実行
- 特定グループ再収集
- 特定週候補再生成
- event再整形
- 下書き再生成（Phase 4以降）

### 21.3 週次整合の判定ルール（確定）
- 「揃う」の定義は、件数一致ではなく、同一 `week_key` で
  `weekly_targets -> raw_updates -> normalized_events -> weekly_digest_candidates -> weekly_group_complements`
  の処理チェーンが成立していること。
- 進行中週は未確定データとして扱い、0件/少数件は許容する。
- 欠損・障害判定は次回週次実行タイミングで行う（中間時点の0件は原則調査対象にしない）。

---

## 22. 優先度付き実装ステップ

### Phase 1
- weekly_targets作成
- external_ids取得
- raw_updates保存
- 状況: 実装済み（YouTube・Spotify）

### Phase 2
- normalized_events作成
- event_sources作成
- is_major/is_ongoing付与
- 状況: 前半実装済み（normalized_events/event_sources）。is_major/is_ongoingの本格ルールは未実装

### Phase 3
- 補完検索
- 仮スコア付け
- weekly_digest_candidates生成
- 状況: 実装済み（補完検索、仮スコア付け、weekly_digest_candidates生成）

### Phase 4
- 配信用下書き生成
- グループ単位サマリー
- 管理画面整備
- 状況: 未着手

---

## 23. 法務・運用境界（確定）

- 無茶な手段、公序良俗に反する手段は用いない
- 公開情報のみ対象（認証・会員限定領域は対象外）
- 利用規約・robots等を尊重
- 保存は要約・メタデータ中心の最小限
- `source_url` と `fetched_at` を必須保持

---

## 24. リスクと制約

- 情報偏りにより観測差が出る
- external_ids整備度に依存
- 一次ソースだけでは意味づけ不足のケースあり
- AI出力に揺れがある
- 週次窓と重要トピック保持の両立が必要

---

## 25. 成功条件（KPI確定）

### 25.1 主KPI
月曜配信準備時間:
- 導入前4週平均と導入後4週平均を比較
- 30%以上短縮

### 25.2 副KPI
上位10候補採用率:
- `adopt数 / 10`
- 50%以上

### 25.3 運用KPI
根拠URL付与率:
- 90%以上

### 25.4 参考KPI
対象グループのうち1件以上 raw update 取得できた割合:
- 70%以上
- 失敗深追いしない方針のため参考指標

---

## 26. まとめ

本システムは、IMDB を監視台帳とし external_ids を背骨に活動シグナルを収集・整形し、週刊ニュース候補化するユーザー専用編集支援サービスである。MVPでは完全自動化ではなく、候補収集・出来事整形・候補提示の実用性を優先し、人間の最終編集判断を中心に据える。

---

## 27. 実装状況（2026-04-19時点）

### 27.1 実装済み
- IAM画面（`/relay-9147/iam/targets`, `/relay-9147/iam/activities`, `/relay-9147/iam/candidates`）
- 週次統合Cron API（`/api/cron/iam/run-weekly`）
- `weekly_targets` 自動生成（IHC週次TOP20 + ナンダッテ更新TOP20の和集合）
- `raw_updates` 自動収集
  - YouTube: 通常動画/ショート/ライブ関連（upcoming/live/completed）を週内複数件取得
  - Spotify: 週内リリース（album/single）取得
- `normalized_events` 最小整形（YouTube + Spotify）
- `weekly_digest_candidates` 最小生成（仮スコア/順位ヒント）
- `weekly_group_complements` 生成（OpenAI Responses API + Web検索補完）
  - 対象: `weekly_digest_candidates` 内のユニーク `group_id`
  - 重複防止: `week_key + group_id` 一意
  - 料金ガード: 日次 `$2.5` / 月次 `$10`
  - 上限時の表示文言: `利用限度（料金）の上限に達しました`
  - 表示先: `/relay-9147/iam/candidates` の「AI補足」

### 27.2 未実装・今後対応
- `is_major` / `is_ongoing` の本格ルール適用
- 候補採否（adopt/hold/drop）と見出し・要約の編集UI
- 配信用下書き生成（Phase 4）

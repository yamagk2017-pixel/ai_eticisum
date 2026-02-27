# WP→Sanity移行 フェーズ0（移行ルール確定）

## 目的

WP記事（約3,500件）を Sanity に段階移行する前に、移行ルール・品質基準・運用前提を固定する。

このフェーズのゴール:
- 移行スクリプト実装に必要なルールが揃っている
- 「PoC（10件試験移行）」に着手できる
- 後戻りしやすい判断ポイントが先に明文化されている

進捗表記:
- `[ ]` 未着手 / 未確定
- `[◯]` 完了 / 確定

---

## 前提（合意済み）

- 新規記事は Sanity で投稿する
- 既存WP記事は段階的に Sanity へ移行する
- 最終的な本番ドメインは `musicite.net` を継続利用する
- WP→Sanity移行完了後に DNS切替を行い、サイトリニューアルとする
- 旧WPは移行期間中の正本（canonical）として扱う
- `WP記事詳細`: `/news/wp/[id]`
- `Sanity記事詳細`: `/news/[slug]`
- Sanityのドキュメントタイプは分離運用
  - `newsArticle`（新規 / Portable Text）
  - `wpImportedArticle`（移行 / legacy HTML）

---

## フェーズ0で決める項目（チェックリスト）

### 1. 移行対象の優先順位

- [◯] 移行対象の開始範囲（全件開始 / 優先カテゴリ開始）
- [◯] 1バッチあたりの件数（例: 10件PoC → 50件 → 100件）
- [◯] 優先順位ルール
  - [◯] PV上位（採用しない）
  - [◯] evergreen記事（採用しない）
  - [◯] グループ導線価値が高い記事（採用しない）
  - [◯] その他（検証完了後に全件対象で移行。実行はX件バッチで分割）

### 2. フィールド対応（WP → Sanity）

- [◯] `wpPostId` を `wpImportedArticle` に保存（必須）
- [◯] `originalWpUrl` を保存（必須）
- [◯] `publishedAt` は WP公開日時を引き継ぐ
- [◯] `title` を引き継ぐ
- [◯] `legacyBodyHtml` に本文HTMLを保存
- [ ] `heroImage` の扱い（当面）
  - [◯] WP画像URL参照
  - [ ] Sanity Assetsへ移行
- [◯] `categories` / `tags` の保存方針
- [◯] `relatedGroups` の初期値方針（slug完全一致のみ / 不一致は空）

### 3. 本文品質の基準（移行完了の定義）

各記事で「移行完了」とみなす最低条件を定義する。

- [◯] タイトル表示OK
- [◯] 公開日時OK
- [◯] 本文表示OK（致命的崩れなし）
- [◯] アイキャッチ表示OK
- [◯] カテゴリ/タグ導線OK
- [◯] Related Groups（必要記事のみ）OK

補足:
- 完全再現は目指さない（Sanity移植までの暫定表示を許容）
- 例外的な崩れは `要修正リスト` に積んで後対応

### 4. 画像方針（移行期間）

- [◯] PoC時点では WP画像参照のままで進めるか
- [◯] 画像移行をどのフェーズで着手するか
- [ ] 画像URL置換の対象/方法（将来）

推奨（現時点）:
- PoC〜初期移行は `WP画像参照`
- 画像移行は後フェーズで分離して実施
- 画像URL置換の具体方式（対象範囲/変換ルール/失敗時再実行）は **WP閉鎖前のフェーズで決定** する

### 5. SEO / 公開運用（移行期間）

- [◯] `wpImportedArticle` を作ってもすぐ公開しない前提でよいか
- [◯] canonical は当面旧WPを正本に固定
- [◯] DNS切替後に self canonical へ切替
- [ ] DNS切替前の検証URL（Vercel）運用ルール

注記:
- Vercel運用ルール（preview/productionの使い分け、index制御、切替判定、ロールバック）は **DNS切替実施タイミングで確定** する。

### 6. 再実行安全性（移行スクリプト要件）

移行件数が多いため、再実行前提にする。

- [◯] 同じWP記事を重複作成しない（`wpPostId` で判定）
- [◯] dry-run モードを用意する（保存せず変換確認）
- [◯] 成功/失敗ログを残す
- [ ] 失敗記事だけ再実行できる

注記:
- `失敗記事だけ再実行` の動作確認は、本番移行時の失敗ケース発生タイミングで実施する。

### 7. 例外ルールの扱い

既にヘッドレス表示で確認済みのWP本文クラスや例外を、移行時にも踏襲する。

- [◯] `well3`
- [◯] `alignright`
- [◯] `wp-caption`
- [◯] `wp-caption-text`
- [ ] ギャラリー系（プラグイン依存）

参照:
- `docs/WP_BODY_CLASS_SUPPORT.md`

---

## フェーズ0の成果物（この段階で揃えるもの）

### A. 移行マッピング表（最小）

| WP | Sanity (`wpImportedArticle`) | 備考 |
|---|---|---|
| `id` | `wpPostId` | 重複防止キー（必須） |
| `link` | `originalWpUrl` | canonical/検証用 |
| `date` | `publishedAt` | 公開日時 |
| `title.rendered` | `title` | HTML除去可否は要判断 |
| `content.rendered` | `legacyBodyHtml` | まずHTMLのまま |
| `featured media` | `heroImage` | 当面URL参照可 |
| `categories[]` | `categories[]` | slug揃え前提 |
| `tags[]` | `tags[]` | slug揃え前提 |

### B. 移行品質基準（チェック項目）

各バッチ終了後に確認する最低限:

- [◯] 件数（予定件数どおり）
- [◯] 代表記事3件の表示確認
- [◯] 画像切れなし（最低限）
- [◯] カテゴリ/タグリンクが機能
- [◯] 重大な本文崩れなし

### C. PoC対象記事リスト（10件）

選定ルール（確定）:
- `公開日時の降順（新しい順）` で上位10件を PoC 対象にする
- 抽出時点のスナップショットを固定し、PoC中は対象を入れ替えない

- [◯] 最新10件の `wpPostId` / タイトル / 公開日時の一覧を確定
- [◯] 変換難易度の偏り確認（必要なら別途「例外検証セット」を追加）

PoC対象10件（`publishedAt` 降順で固定）:

| # | wpPostId | publishedAt | title | originalWpUrl |
|---|---:|---|---|---|
| 1 | 22065 | 2026-02-24T00:06:27 | アイドル第四会議室 vol.204 – 早春と花粉のフリートーク大会 – | https://www.musicite.net/i4c/22065.php |
| 2 | 22052 | 2026-02-20T18:01:55 | SOMOSOMOが新メンバーオーディション開催！最終審査はオーディション合宿！ | https://www.musicite.net/article/22052.php |
| 3 | 22042 | 2026-02-16T13:33:54 | アイドル第四会議室 vol.203 – ハロプロ弱者のハロプロ特集 – | https://www.musicite.net/i4c/22042.php |
| 4 | 22035 | 2026-02-07T19:52:01 | アイドル第四会議室 vol.202 – ゲスト：LiVS – | https://www.musicite.net/i4c/22035.php |
| 5 | 22024 | 2026-02-05T23:40:30 | Palette Parade B3リーグ第18節 東京ユナイテッドBC VS 新潟アルビレックスBB戦 ゲスト出演で盛り上げに貢献！ | https://www.musicite.net/article/22024.php |
| 6 | 22019 | 2026-02-05T23:14:51 | SOMOSOMO アンダーグラフ制作の新曲「僕らのままで」を2月6日のZepp Shinjukuワンマンで初披露！ | https://www.musicite.net/article/rel/22019.php |
| 7 | 22015 | 2026-02-03T13:44:07 | アイドル第四会議室 vol.201 – アイドル楽曲無形文化財 – | https://www.musicite.net/i4c/22015.php |
| 8 | 22001 | 2026-01-31T12:28:43 | リーズナブルなアイドルフェス「リズフェス」が若手の登竜門イベントになる理由 | https://www.musicite.net/i4c/col/22001.php |
| 9 | 21993 | 2026-01-26T12:36:38 | アイドル第四会議室 vol.200 – 冬と雪のアイドル楽曲リクエスト大会 – | https://www.musicite.net/i4c/21993.php |
| 10 | 21986 | 2026-01-25T23:47:30 | RAY 新プロジェクト「#MOD_IDOLRemix」始動。Remix EP2作品リリース＆連動Remixイベント開催 | https://www.musicite.net/article/rel/21986.php |

実行ログ（2026-02-27）:

- 不一致CSV（1回目）: `reports/wp-related-groups-unmatched-20260227-095756.csv`
  - checked: 10
  - unmatched: 4（`no_imd_slug_exact_match` 3, `no_wp_tag_slug` 1）
- 不一致CSV（2回目・タグ修正後）: `reports/wp-related-groups-unmatched-20260227-100602.csv`
  - checked: 10
  - unmatched: 4（`no_imd_slug_exact_match` 4, `no_wp_tag_slug` 0）
- PoC dry-run: `reports/wp-to-sanity-poc-dry-run-20260227-102039.json`
  - checkedPosts: 10
  - wouldCreate: 10 / wouldUpdate: 0
  - postsWithBlockers: 0
  - postsWithRelatedGroups: 6
  - totalMissingCategorySlugRefs: 0
  - totalMissingTagSlugRefs: 34
  - 注記: `missingTagSlugRefs` 多数は、Sanity `newsTag` マスタ未整備が主因

---

## 未決定事項（フェーズ0で詰める）

### 1. `wpImportedArticle` の公開タイミング

- [◯] 方針確定
採用方針（ハイブリッド）:
- 初期は `B`（検証済みバッチから順次公開）
- 作業品質に信頼が置ける段階で `まとめて公開` へ移行
- 期間中は `wpPostId` ベースの重複排除を必須にする

### 2. `heroImage` のPoC実装方式

- [◯] 方針確定
採用方針:
- まとめて公開を終えるまでは `外部URL参照` で進める
- 画像移行は別フェーズで設計・実施する
- PoC〜段階移行中は表示安定性と移行速度を優先し、画像同時移行は行わない
- 対象は `heroImage` だけでなく、本文内画像（フォトギャラリー / 記事途中挿入画像）も含む

### 3. `relatedGroups` の初期投入方針

- [◯] 方針確定
採用方針:
- 自動補完は `slug完全一致` のみ採用する
- 完全一致しない記事は `relatedGroups` を空のまま移行する（誤紐付けを避ける）
- 推定補完に失敗した記事は、移行ログに `記事タイトル / wpPostId / URL` を必ず出力し、後補完対象として管理する
- 不一致（`relatedGroups` 空）記事は CSV レポートを出力する（大量発生を前提）
  - 例: `reports/wp-related-groups-unmatched-YYYYMMDD.csv`
  - 推奨カラム: `wpPostId,title,originalWpUrl,publishedAt,wpTagSlugs,wpTagNames,reason`
  - 実行コマンド（雛形）:
    - `npm run report:wp-unmatched-related-groups`
    - `node scripts/wp-unmatched-related-groups-report.mjs --limit=10 --page=1 --dry-run`

---

## 推奨するフェーズ0の進め方（実務）

1. このメモの未決定項目を埋める
2. `PoC対象10件` を選ぶ
3. `WP→Sanityフィールド対応` を最終確認
4. フェーズ1（PoCスクリプト実装）へ進む

---

## フェーズ1への引き継ぎ条件（完了条件）

- [◯] `wpImportedArticle` に入れる必須フィールドが確定
- [◯] PoC対象記事10件が選定済み
- [◯] 画像方針（PoC時点）が確定
- [◯] 再実行安全性（`wpPostId`）の方針が確定
- [◯] 移行品質基準が定義済み

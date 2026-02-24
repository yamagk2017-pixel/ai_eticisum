# Sanity News Model Plan（先行設計）

## 目的

Sanity導入時に、`新規記事` と `WP移行記事` を運用しやすく分けつつ、アプリ側（Next.js）では `/news` 一覧で統合表示できるようにするための設計メモ。

## 前提（合意済み）

- `/news` 一覧には `新旧両方の記事` を並べる
- `WP記事` と `Sanity記事` は別物として扱う
- Sanityでは `スキーマ（document type）を2種類` に分ける
- 2スキーマを将来的に統合する前提ではない
- ただし `WP系 / Sanity系の共通項目名は揃える`
- `WP記事詳細`: `/news/wp/[id]`
- `Sanity記事詳細`: `/news/[slug]`
- `Sanity新規記事本文`: Portable Text
- `SanityのWP移行記事本文`: legacy HTML（暫定）

## Sanityのドキュメントタイプ方針

### 1. `newsArticle`（新規記事用）

- 想定用途:
  - 今後新しく投稿する記事
- 本文形式:
  - Portable Text
- URL:
  - `/news/[slug]`

### 2. `wpImportedArticle`（WP移行記事用）

- 想定用途:
  - WPからSanityへ移行した過去記事
- 本文形式:
  - legacy HTML（初期）
- URL:
  - 将来的なSanity側公開ルートは要検討（当面はWP側 `/news/wp/[id]` を維持してもよい）
- 備考:
  - 移行作業の管理情報（WP ID, 元URL等）を持つ

## なぜ2スキーマに分けるか（採用理由）

- 運用上、旧記事と新記事を見分けやすい
- 入力フォーム/必須項目を用途別に最適化できる
- Portable Text と legacy HTML の混在を無理に1フォームへ押し込まなくてよい
- 移行作業時のミスが減る

## 重要ルール（共通項目名）

アプリ側で `/news` に統合表示しやすくするため、`newsArticle` / `wpImportedArticle` で共通の意味を持つ項目は同じ名前で揃える。

例（推奨）:

- `title`
- `slug`（`wpImportedArticle` では将来使わない場合でも設計判断が必要）
- `publishedAt`
- `heroImage`
- `categories`
- `tags`
- `seoTitle`
- `seoDescription`
- `ogImage`

## 各スキーマの項目案（初版）

### `newsArticle`（新規記事）

#### 必須（想定）

- `title`（string）
- `slug`（slug）
- `publishedAt`（datetime）
- `heroImage`（image）
- `body`（Portable Text）

#### 任意（推奨）

- `categories`（references[]）
- `tags`（references[]）
- `excerpt`（text）
- `seoTitle`（string）
- `seoDescription`（text）
- `ogImage`（image, 未指定なら `heroImage` を使用）
- `isPublished` / `status`（必要なら）

### `wpImportedArticle`（WP移行記事）

#### 必須（想定）

- `title`（string）
- `publishedAt`（datetime）※ WP公開日時を引き継ぐ
- `heroImage`（image）※ 移行時の画像方針次第
- `legacyBodyHtml`（text / long text）
- `wpPostId`（number）
- `originalWpUrl`（url）

#### 任意（推奨）

- `categories`（references[]）
- `tags`（references[]）
- `excerpt`（text）
- `seoTitle`（string）
- `seoDescription`（text）
- `ogImage`（image, 未指定なら `heroImage`）
- `importedAt`（datetime）
- `migrationNotes`（text）
- `bodyMigrationStatus`（enum: `legacy_html` / `partial_pt` / `portable_text_done` など）

## 本文の扱い（重要）

### `newsArticle`

- 本文は Portable Text を採用
- Sanityの標準的な運用に寄せる

### `wpImportedArticle`

- 初期は `legacyBodyHtml` で保持
- `WP HTML -> Portable Text` の完全変換は最初から全件やらない
- 必要な記事から段階的に変換していく

## アプリ側（Next.js）の共通表示モデル方針

Sanityの2スキーマ + WP直読み記事を、アプリでは共通表示型にマッピングして扱う。

### 一覧用の共通型（`NewsListItem`）

`/news` 一覧では、データソースごとの差をUI側へ持ち込まないため、一覧表示に必要な最小項目だけを共通型として揃える。

- `title`
- `publishedAt`
- `path`
- `heroImageUrl`
- `categories`
- `tags`
- `source`

補足:
- これは「CMSのスキーマの共通化」ではなく、`一覧UIに渡すための整形済み表示型（View Model）` の扱い

### 詳細用の型（方針）

詳細ページは本文形式の差が大きいため、一覧のように無理に1つへ共通化しない。

最低でも以下の2系統で考える:

1. `Sanity新規記事（Portable Text）`
2. `Legacy HTML記事`
   - ヘッドレスWP記事
   - Sanity移行記事（legacy HTML）
   - ※ この2つは可能な限りスキーマ/表示要件を揃える

もし `2` が揃えにくい場合は、次の3系統に分ける:

1. `Sanity新規記事（Portable Text）`
2. `ヘッドレスWP記事（HTML）`
3. `Sanity移行記事（legacy HTML）`

推奨整理軸:
- データソース単位ではなく、`本文レンダリング形式（PT / HTML）` を優先して詳細表示の型・コンポーネントを分ける

### 共通表示型（概念 / 将来拡張）

- `source`: `"wp" | "sanity" | "sanity_wp_import"`
- `routeType`: `"wp-id" | "sanity-slug"`
- `id`（内部一意キー）
- `titleHtml` または `title`
- `publishedAt`
- `heroImageUrl`
- `categories`
- `tags`
- `seo` 情報
- `body`
  - `kind: "html" | "portableText"`
  - `html` or `portableText`

## `/news` 一覧統合ルール（初期案）

- 並び順:
  - `publishedAt` 降順
- 同一日時の優先順位:
  - 当面は未定義でOK（Sanity運用開始後はWPに新規追加しない前提のため、実質発生しない想定）
- 表示項目（最小）:
  - タイトル
  - 公開日時
  - カテゴリ / タグ
  - メインビジュアル
  - URL（`path`）

## URLルール（採用済み）

- `WP記事`: `/news/wp/[id]`
- `Sanity記事（新規）`: `/news/[slug]`

補足:
- ルートを分けることで、`id` と `slug` の衝突を回避する

## SEO / OGP 方針（Sanity導入時の前提）

### 共通

- OGP画像は `メインビジュアル` を基本に使う
- Twitter Card は `summary_large_image`
- テキストは `タイトル + サイト名`（サイト名は後で確定）
- 公開日時を載せる
- `og:type` は `article`

### canonical（現時点の方針）

- `WP記事` は当面 `旧WP URL を正本`
- `Sanity新規記事` は `新サイトURL（self canonical）`
- `Sanity移行記事` は移行タイミングに応じて判断（要運用ルール化）

## 移行作業フロー（想定）

### 新規記事（今後）

1. `newsArticle` で投稿
2. Portable Textで本文作成
3. `/news/[slug]` で公開

### WP移行記事（過去記事）

1. `wpImportedArticle` で作成
2. `wpPostId`, `originalWpUrl`, `legacyBodyHtml` を投入
3. 必要に応じて画像/カテゴリ/タグを移行
4. 段階的に Portable Text化する場合は別途作業

## 実装前に決めるべき残件（Sanity導入時）

1. `categories/tags` を Sanityでどう管理するか
- 共通 taxonomy ドキュメント化するか
- WP由来とSanity由来を統合するか

2. `heroImage` の保存先方針
- Sanity Assets に寄せるか
- 移行期間中は外部URL参照を許容するか

3. `wpImportedArticle` の公開戦略
- Sanityに入れてもすぐ `/news/[slug]` で公開するのか
- 当面はWPルート継続か

4. `legacyBodyHtml` の表示コンポーネント
- `WpArticleBody` 互換をそのまま使うか
- Sanity移行記事向けに別名ラッパーを作るか

## 次にやると良いこと（設計→実装）

1. `src/lib/news/types.ts` に将来拡張前提の本文unionを入れる
2. `Sanityスキーマの草案` をコード化（まだ接続しなくてOK）
3. `/news` 一覧の共通表示型に `source` / `routeType` を追加する下準備

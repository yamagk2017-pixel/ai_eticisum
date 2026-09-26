# Sanity関連実装 移植指示書

## 目的

このドキュメントは、このプロジェクトで実装した Sanity 関連機能を別の Next.js プロジェクトへ移植するための指示書です。

対象機能:

- WordPress から Sanity への記事インポート
- Sanity Studio からのプレビュー表示
- 予約投稿

このプロジェクトの実装は、Sanity を記事CMSとして使いながら、旧 WordPress 記事を段階移行する構成です。新規記事とWP移行記事は Sanity の document type を分け、公開サイト側では `/news` 一覧で統合表示します。

## 全体方針

移植先でも、まず次の構成にするのが安全です。

1. Sanity Studio を Next.js アプリ内の `/studio` に同居させる
2. 新規記事用の `newsArticle` と、WP移行記事用の `wpImportedArticle` を分ける
3. WP記事本文は初期移行では Portable Text に変換せず、`legacyBodyHtml` として保持する
4. インポートは必ず `dry-run -> レポート確認 -> apply` の順で実行する
5. 公開サイトでは `publishedAt <= now()` と draft 除外で公開可否を制御する
6. Preview では Next.js `draftMode` と Sanity `previewDrafts` perspective を使う

重要: このプロジェクトの「予約投稿」は Sanity のスケジューラーではなく、公開済みドキュメントの `publishedAt` を未来日時にして、表示側のクエリで公開時刻まで隠す方式です。Sanity の下書きを指定時刻に自動Publishする仕組みは、このリポジトリには実装していません。

## 主要ファイル対応表

### Sanity基盤

| 役割 | ファイル |
|---|---|
| Studio設定、Preview URL、document action登録 | `sanity.config.ts` |
| Sanity CLI設定 | `sanity.cli.ts` |
| Sanity環境変数読み取り | `src/sanity/env.ts` |
| Studioページ | `src/app/studio/[[...tool]]/page.tsx` |
| NextStudio client component | `src/app/studio/[[...tool]]/studio-client.tsx` |
| Sanity API client | `src/lib/sanity/client.ts` |
| Sanity画像URL builder | `src/lib/sanity/image.ts` |
| Studioのメニュー構成 | `src/sanity/desk-structure.tsx` |

### スキーマ

| 役割 | ファイル |
|---|---|
| schema export | `src/sanity/schemaTypes/index.ts` |
| 新規記事 | `src/sanity/schemaTypes/newsArticleType.ts` |
| WP移行記事 | `src/sanity/schemaTypes/wpImportedArticleType.ts` |
| カテゴリ | `src/sanity/schemaTypes/newsCategoryType.ts` |
| タグ | `src/sanity/schemaTypes/newsTagType.ts` |
| 共通フィールド | `src/sanity/schemaTypes/shared.ts` |
| イベント告知 | `src/sanity/schemaTypes/eventAnnouncementType.ts` |
| ラジオ告知 | `src/sanity/schemaTypes/radioAnnouncementType.ts` |

移植先で記事だけ必要な場合は、まず `newsArticle`, `wpImportedArticle`, `newsCategory`, `newsTag`, `shared` だけを移してください。`eventAnnouncement` と `radioAnnouncement` はこのサイト固有の告知タイプです。

### WordPressインポート

| 役割 | ファイル |
|---|---|
| WPカテゴリ/タグを Sanity へ同期 | `scripts/wp-sync-taxonomies-to-sanity.mjs` |
| WP記事を `wpImportedArticle` へ変換・保存 | `scripts/wp-to-sanity-poc-dry-run.mjs` |
| インポートissue CSV統合 | `scripts/merge-wp-poc-issues.mjs` |
| WP画像ホスト一括置換 | `scripts/replace-wp-image-host-in-sanity.mjs` |
| WP直読みclient | `src/lib/wp/client.ts` |
| WP記事を表示モデルへ変換 | `src/lib/news/wp.ts` |

### Preview

| 役割 | ファイル |
|---|---|
| document type からプレビュー先pathを解決 | `src/sanity/preview-path.ts` |
| draftMode有効化 | `src/app/api/draft/enable/route.ts` |
| draftMode無効化 | `src/app/api/draft/disable/route.ts` |
| 署名付き共有URL API | `src/app/api/draft/share-link/route.ts` |
| 共有URL署名/検証 | `src/lib/preview/share-link.ts` |
| Studioの「共有URLをコピー」action | `src/sanity/document-actions/copy-preview-share-link-action.tsx` |
| CLIから共有URL生成 | `scripts/generate-preview-share-link.mjs` |

### 公開表示・予約投稿

| 役割 | ファイル |
|---|---|
| Sanity記事取得、公開条件、Preview条件 | `src/lib/news/sanity.ts` |
| Sanity + WP 統合一覧 | `src/lib/news/index.ts` |
| `/news` 一覧 | `src/app/news/page.tsx` |
| Sanity新規記事詳細 | `src/app/news/[slug]/page.tsx` |
| WP互換記事詳細 | `src/app/news/wp/[id]/page.tsx` |
| ISR再検証API | `src/app/api/revalidate/news/route.ts` |
| ISR/Webhook運用メモ | `docs/NEWS_ISR_RUNBOOK.md` |

## 必要パッケージ

移植先で最低限必要です。

```bash
npm install sanity next-sanity @sanity/client @sanity/image-url @portabletext/react
```

このプロジェクトでは関連機能のために次も使っています。

```bash
npm install @supabase/supabase-js
```

ただし Supabase は `relatedGroups` 自動補完用のプロジェクト固有依存です。別プロジェクトで不要なら、`wp-to-sanity-poc-dry-run.mjs` から `fetchImdGroups` と `relatedGroups` 生成を外してください。

## 環境変数

移植先の `.env.local` と本番環境に設定します。

```bash
NEXT_PUBLIC_SANITY_PROJECT_ID=your_sanity_project_id
NEXT_PUBLIC_SANITY_DATASET=production
NEXT_PUBLIC_SANITY_API_VERSION=2026-02-24

SANITY_API_READ_TOKEN=your_read_token
SANITY_API_WRITE_TOKEN=your_write_token
SANITY_API_TOKEN=optional_fallback_token

WP_API_BASE_URL=https://your-wordpress.example.com
WP_IMAGE_CDN_BASE_URL=https://your-image-cdn.example.com

NEWS_REVALIDATE_TOKEN=long_random_string

SANITY_STUDIO_PREVIEW_ORIGIN=https://your-site.example.com
NEXT_PUBLIC_SITE_ORIGIN=https://your-site.example.com
PREVIEW_LINK_SECRET=long_random_signing_secret
PREVIEW_SHARE_SECRET=long_random_share_api_secret
PREVIEW_SHARE_ORIGIN=https://your-site.example.com
```

用途:

- `SANITY_API_READ_TOKEN`: Previewでdraftを読むために必要
- `SANITY_API_WRITE_TOKEN`: インポート apply や一括置換に必要
- `WP_API_BASE_URL`: WordPress REST API のベースURL
- `WP_IMAGE_CDN_BASE_URL`: WP画像URLを書き換える場合に使う
- `NEWS_REVALIDATE_TOKEN`: Sanity webhook / 手動 revalidate API の認証
- `PREVIEW_LINK_SECRET`: Preview共有URLのHMAC署名
- `PREVIEW_SHARE_SECRET`: 共有URL生成APIの認証

## スキーマ移植手順

### 1. Sanity設定を追加

次を移植先へ追加します。

- `sanity.config.ts`
- `sanity.cli.ts`
- `src/sanity/env.ts`
- `src/app/studio/[[...tool]]/page.tsx`
- `src/app/studio/[[...tool]]/studio-client.tsx`

`sanity.config.ts` では次を確認してください。

- `basePath: "/studio"` にする
- `schema.types` に移植先の schema types を渡す
- `document.productionUrl` で `/api/draft/enable?path=...` を返す
- `document.actions` に `CopyPreviewShareLinkAction` を追加する

### 2. schema typesを追加

最小構成:

- `newsArticle`: 新規記事。本文は Portable Text
- `wpImportedArticle`: WP移行記事。本文は `legacyBodyHtml`
- `newsCategory`: カテゴリ
- `newsTag`: タグ

WP移行記事の主要フィールド:

| Sanity field | 内容 |
|---|---|
| `title` | WPタイトル |
| `publishedAt` | WP公開日時 |
| `heroImage` | Sanity asset画像。任意 |
| `heroImageExternalUrl` | WP由来の外部画像URL |
| `legacyBodyHtml` | WP本文HTML |
| `wpPostId` | WP記事ID。重複防止キー |
| `originalWpUrl` | 元WP URL |
| `categories` | `newsCategory` refs |
| `tags` | `newsTag` refs |
| `importedAt` | インポート日時 |
| `migrationNotes` | 警告や移行メモ |
| `bodyMigrationStatus` | `legacy_html` など |

`wpImportedArticle.heroImage` は必須にしないでください。WP APIでアイキャッチを取れない記事があるため、必須にすると移行が止まります。

### 3. 表示側の型へマッピング

公開サイト側では、Sanity document を直接UIへ渡さず、一覧・詳細の表示モデルに変換します。

このプロジェクトでは `src/lib/news/sanity.ts` が担当しています。

- `newsArticle` / `eventAnnouncement` / `radioAnnouncement` は `/news/[slug]`
- `wpImportedArticle` は `/news/wp/[wpPostId]`
- 一覧では `publishedAt desc` で並べる
- WP直読み記事と Sanity移行済み記事が重複する場合は `sanity_wp_import` を優先する

移植先で旧WP直読み期間が不要なら、`src/lib/news/index.ts` の WP 統合部分は省略できます。

## WordPressからのインポート手順

### 1. 先にカテゴリ/タグを同期する

記事インポート前に、WPの categories/tags を Sanity の `newsCategory` / `newsTag` へ同期します。

```bash
npm run sync:wp-taxonomies:dry-run
npm run sync:wp-taxonomies:apply
```

実体:

```bash
node scripts/wp-sync-taxonomies-to-sanity.mjs --dry-run
node scripts/wp-sync-taxonomies-to-sanity.mjs --apply
```

このスクリプトは WP REST API の `/wp-json/wp/v2/categories` と `/wp-json/wp/v2/tags` を全ページ取得し、slug一致で既存Sanity documentを探して upsert します。

Sanity ID 例:

- `newsCategory.wp.{wpTermId}`
- `newsTag.wp.{wpTermId}`

### 2. 記事インポートをdry-runする

まず保存せずに変換結果と警告を確認します。

```bash
npm run poc:wp-to-sanity:dry-run -- --limit=100 --page=1
```

出力:

- `reports/wp-to-sanity-poc-dry-run-*.json`
- `reports/wp-to-sanity-poc-dry-run-*.issues.csv`

確認する値:

- `postsWithBlockers` が `0`
- `applyFailed` は dry-run では出ない
- `totalMissingCategorySlugRefs` / `totalMissingTagSlugRefs` が許容範囲
- `featuredImage_api_denied` / `featuredImage_missing` が許容範囲
- `legacyBodyHtml_missing` が許容範囲

### 3. 問題なければapplyする

```bash
npm run poc:wp-to-sanity:apply -- --limit=100 --page=1
```

スクリプトは `wpPostId` で既存 `wpImportedArticle` を探し、既存があれば update、なければ create します。新規作成時の Sanity ID は次の形式です。

```text
wpImportedArticle.wp.{wpPostId}
```

### 4. 単体記事を再インポートする

更新漏れや失敗記事の再実行には `--include-only --include-ids=` を使います。

```bash
node scripts/wp-to-sanity-poc-dry-run.mjs --include-only --include-ids=12345
node scripts/wp-to-sanity-poc-dry-run.mjs --include-only --include-ids=12345 --apply
```

複数指定:

```bash
node scripts/wp-to-sanity-poc-dry-run.mjs --include-only --include-ids=12345,12346,12347
```

### 5. バッチ運用ルール

推奨:

- 1バッチ `100件`
- 各バッチで必ず `dry-run -> apply`
- バッチごとに `reports/` のJSONとCSVを保存
- `applyFailed > 0` または `postsWithBlockers > 0` で停止
- 警告件数が急増した場合も停止して原因確認

このプロジェクトでは、PoC 10件の後に `limit=100` のバッチで全件移行しました。

### 6. WP画像ホストを一括置換する

DNS切替やWP移転で、保存済みHTML内の画像URLを書き換える必要がある場合に使います。

```bash
npm run replace:wp-image-host:dry-run
npm run replace:wp-image-host:apply
```

実体:

```bash
node scripts/replace-wp-image-host-in-sanity.mjs --from=https://old.example.com --to=https://new.example.com
node scripts/replace-wp-image-host-in-sanity.mjs --from=https://old.example.com --to=https://new.example.com --apply
```

対象:

- `wpImportedArticle.heroImageExternalUrl`
- `wpImportedArticle.legacyBodyHtml`

必ず dry-run の `affectedDocs`, `totalHeroReplacements`, `totalBodyReplacements` を確認してから apply してください。

## Preview表示の移植手順

### 1. Preview path resolverを用意する

`src/sanity/preview-path.ts` で document type から公開URLを解決します。

このプロジェクトのルール:

- `newsArticle` -> `/news/{slug}`
- `eventAnnouncement` -> `/news/{slug}`
- `radioAnnouncement` -> `/news/{slug}`
- `wpImportedArticle` -> `/news/wp/{wpPostId}`
- `newsCategory` -> `/news?category={slug}`
- `newsTag` -> `/news?tag={slug}`

移植先のURL設計に合わせてここを変更します。

### 2. Sanity StudioのPreview URLを設定する

`sanity.config.ts` の `document.productionUrl` で、次のURLを返します。

```text
{SANITY_STUDIO_PREVIEW_ORIGIN}/api/draft/enable?path={encodedPath}
```

Sanity Studio の `Open preview` 相当の操作から、このURLが開かれます。

### 3. Next.js draftMode APIを追加する

移植するファイル:

- `src/app/api/draft/enable/route.ts`
- `src/app/api/draft/disable/route.ts`

`enable` は `path` を検証してから `draftMode().enable()` し、そのpathへredirectします。

現在の実装では、署名パラメータ `exp` と `sig` が付いている場合だけ署名検証します。Sanity Studio からの通常Preview URLは署名なしでも有効です。

本番でより厳密にしたい場合:

- `SANITY_STUDIO_PREVIEW_SECRET` を追加する
- `productionUrl` に `secret` を付ける
- `/api/draft/enable` 側で secret 必須にする

### 4. Preview用Sanity clientを使う

`src/lib/sanity/client.ts` のように通常clientとPreview clientを分けます。

通常:

- `useCdn: false`
- tokenは任意

Preview:

- `useCdn: false`
- `perspective: "previewDrafts"`
- read token必須

```ts
export function getSanityClient(options?: {preview?: boolean}) {
  if (options?.preview && serverToken) return sanityPreviewClient;
  return sanityClient;
}
```

### 5. ページ側でdraftModeを見る

詳細ページでは `draftMode()` を読み、Preview時だけ preview query を使います。

```ts
const {isEnabled} = await draftMode();
const article = isEnabled
  ? await getSanityNewsBySlug(slug, {preview: true})
  : await getCachedSanityNewsBySlug(slug);
```

Preview query では次の制限を外します。

- `publishedAt <= now()`
- draft除外

これにより、下書きと未来日時の記事を確認できます。

### 6. 共有Preview URLを使う

編集者以外にPreviewを共有するため、署名付きURLを発行します。

移植するファイル:

- `src/lib/preview/share-link.ts`
- `src/app/api/draft/share-link/route.ts`
- `src/sanity/document-actions/copy-preview-share-link-action.tsx`
- `scripts/generate-preview-share-link.mjs`

仕組み:

1. `/api/draft/share-link` は `PREVIEW_SHARE_SECRET` で認証する
2. `path` と `exp` を `PREVIEW_LINK_SECRET` でHMAC署名する
3. `/api/draft/enable?path=...&exp=...&sig=...` を返す
4. `/api/draft/enable` は期限と署名を検証して draftMode を有効にする

CLI例:

```bash
npm run preview:share-link -- --path=/news/example-slug --ttlMinutes=7200
```

## 予約投稿の実装

### このプロジェクトの方式

予約投稿は `publishedAt` を未来日時に設定し、公開側の GROQ で未来記事を除外する方式です。

公開クエリには必ず次を入れます。

```groq
defined(publishedAt) &&
publishedAt <= now() &&
!(_id in path("drafts.**")) &&
!defined(*[_id == ("drafts." + ^._id)][0]._id)
```

意味:

- `defined(publishedAt)`: 公開日時がある記事だけ出す
- `publishedAt <= now()`: 未来日時の記事を隠す
- `!(_id in path("drafts.**"))`: draft document を隠す
- `!defined(*[_id == ("drafts." + ^._id)][0]._id)`: 公開済みdocumentに未公開draftが重なっている場合、一覧では公開済み版を隠す

Preview query ではこの制限を外します。未来日時の記事もPreviewで確認できる必要があるためです。

### 運用フロー

1. Sanity Studioで記事を作成する
2. `publishedAt` に公開したい未来日時を入れる
3. Previewで確認する
4. 公開ボタンで Sanity document を publish する
5. 公開時刻まではサイトに表示されない
6. `publishedAt <= now()` になった後、ISRの再生成タイミングで表示される

注意:

- Sanityの「draftを未来時刻に自動Publish」はこの実装にはありません
- 未来日時の記事を下書きのままにしておくと、公開時刻になっても本番には出ません
- 時刻ぴったりの表示保証が必要なら、公開時刻付近に `/api/revalidate/news` を叩く cron を追加してください

### ISRと予約投稿

このプロジェクトでは `/news` と詳細ページに `revalidate = 60` を設定しています。つまり、公開時刻後の次回リクエスト以降、最大おおむね60秒単位で再生成されます。

より確実にしたい場合:

- `revalidate` を短くする
- Vercel Cron で `/api/revalidate/news` を毎分叩く
- Sanity webhook に加えて、予約時刻用の外部スケジューラーを使う

Sanity webhook は create/update/delete では発火しますが、`publishedAt` が未来から現在になった瞬間には自動発火しません。予約投稿だけで即時反映したい場合は、cronか外部スケジューラーが必要です。

### true scheduled publish が必要な場合

下書きを指定時刻に自動Publishしたい場合は、このリポジトリの実装だけでは不足です。追加で次のどちらかを実装してください。

- SanityのScheduling系機能/プラグインを導入する
- 外部cronで Sanity API を呼び、条件に合うdraftを publish してから `/api/revalidate/news` を呼ぶ

この場合でも、公開サイト側の `publishedAt <= now()` 条件は残してください。誤って早く publish された記事の露出を防げます。

## Revalidate APIとSanity webhook

公開/更新後にISRを明示的に再生成するため、次を移植します。

- `src/app/api/revalidate/news/route.ts`
- `docs/NEWS_ISR_RUNBOOK.md`

API:

```text
POST /api/revalidate/news
Header: x-revalidate-token: {NEWS_REVALIDATE_TOKEN}
```

Payload例:

```json
{}
```

```json
{"slug":"your-news-slug"}
```

```json
{"wpPostId":12345}
```

Sanity webhook 推奨設定:

- URL: `https://your-site.example.com/api/revalidate/news`
- Method: `POST`
- Trigger: `create`, `update`, `delete`
- Filter: `_type in ["newsArticle","eventAnnouncement","radioAnnouncement","wpImportedArticle"]`
- Header: `x-revalidate-token: <NEWS_REVALIDATE_TOKEN>`
- Payload:

```json
{
  "slug": slug.current,
  "wpPostId": wpPostId
}
```

移植先で `eventAnnouncement` / `radioAnnouncement` を使わない場合は filter から外してください。

## Next.js設定

`next.config.ts` では次を設定します。

```ts
const nextConfig = {
  transpilePackages: ["next-sanity", "sanity"],
  images: {
    remotePatterns: [
      {protocol: "https", hostname: "cdn.sanity.io"},
      {protocol: "https", hostname: "your-wordpress.example.com"},
    ],
  },
};
```

WP画像を外部URLのまま表示する場合、WP画像ホストを `images.remotePatterns` に追加してください。`WP_IMAGE_CDN_BASE_URL` を使う場合は、そのCDNホストも追加します。

## プロジェクト固有の差し替えポイント

このプロジェクト固有なので、別プロジェクトではそのまま使わない可能性が高い部分です。

| 項目 | 現行実装 | 移植先での扱い |
|---|---|---|
| `relatedGroups` | Supabase `imd.groups` と連携 | 不要ならフィールドと自動補完を削除 |
| `eventAnnouncement` | アイドルイベント告知用 | 不要なら削除 |
| `radioAnnouncement` | ラジオ告知用 | 不要なら削除 |
| `DocxPressReleaseImportTool` | 原稿インポート用 | Sanity基盤には不要 |
| WP画像URL | `musicite.sub.jp` / `musicite.net` 前提 | 移植先のWPホストへ変更 |
| redirect設定 | 旧MUSICITE URLを `/news/wp/[id]` へ | 移植先の旧URLに合わせて変更 |
| `WP_IMAGE_CDN_BASE_URL` 書き換え | `/inm/wp-content/uploads/` 固定 | 移植先の uploads path に変更 |

特に `scripts/wp-to-sanity-poc-dry-run.mjs` は `relatedGroups` 生成のため Supabase を読んでいます。別プロジェクトで同等のマスタがない場合は、次のように簡略化してください。

- `@supabase/supabase-js` import を削除
- `fetchImdGroups` を削除
- `imdGroupBySlug` を空の `Map()` にする
- `relatedGroups` 生成部分を削除、または常に空配列にする

## 移植後の確認チェックリスト

### Sanity Studio

- `/studio` が開く
- `newsArticle` を作成できる
- `wpImportedArticle` を作成できる
- `newsCategory` / `newsTag` を作成できる
- 画像アップロードができる

### WordPressインポート

- `sync:wp-taxonomies:dry-run` が成功する
- `sync:wp-taxonomies:apply` 後、Sanityにカテゴリ/タグが作成される
- `poc:wp-to-sanity:dry-run` の `postsWithBlockers` が `0`
- `poc:wp-to-sanity:apply` の `applyFailed` が `0`
- `/news/wp/{id}` で移行済み記事が表示される
- WP本文HTMLの画像が表示される

### Preview

- StudioのPreviewから `/api/draft/enable` 経由で記事詳細へ遷移する
- 下書き記事がPreviewで見える
- 未来の `publishedAt` の記事がPreviewで見える
- `/api/draft/disable?path=/news/...` でPreviewを解除できる
- 共有URLが期限内だけ有効

### 予約投稿

- 未来の `publishedAt` を持つ公開済み記事が `/news` に出ない
- 未来の `publishedAt` を持つ公開済み記事が詳細URLでも通常表示されない
- Previewでは同じ記事が表示される
- 公開時刻後に `/news` に表示される
- 必要なら `/api/revalidate/news` で即時反映できる

### Revalidate

- `POST /api/revalidate/news` が token なしで `401`
- 正しい token で `ok: true`
- `slug` 指定で `/news` と `/news/{slug}` が revalidate される
- `wpPostId` 指定で `/news` と `/news/wp/{id}` が revalidate される
- Sanity webhook から同じAPIが呼ばれる

## 実装順序

推奨順:

1. Sanity基盤とStudioを移植
2. schema typesを移植
3. `newsArticle` の表示を実装
4. Preview APIとPreview queryを実装
5. `publishedAt <= now()` による予約投稿制御を実装
6. Revalidate APIを実装
7. WPタクソノミ同期を実装
8. WP記事インポートを dry-run で検証
9. 少数記事を apply して表示確認
10. バッチ移行へ進む

Previewと予約投稿は WP インポートより先に動作確認してください。インポート後にプレビューできないと、移行記事の品質確認が遅くなります。

## 最小移植セット

記事CMSとして最短で使う場合の最小セットです。

```text
sanity.config.ts
sanity.cli.ts
src/sanity/env.ts
src/sanity/preview-path.ts
src/sanity/schemaTypes/index.ts
src/sanity/schemaTypes/shared.ts
src/sanity/schemaTypes/newsArticleType.ts
src/sanity/schemaTypes/wpImportedArticleType.ts
src/sanity/schemaTypes/newsCategoryType.ts
src/sanity/schemaTypes/newsTagType.ts
src/lib/sanity/client.ts
src/lib/sanity/image.ts
src/lib/preview/share-link.ts
src/app/studio/[[...tool]]/page.tsx
src/app/studio/[[...tool]]/studio-client.tsx
src/app/api/draft/enable/route.ts
src/app/api/draft/disable/route.ts
src/app/api/draft/share-link/route.ts
src/app/api/revalidate/news/route.ts
scripts/wp-sync-taxonomies-to-sanity.mjs
scripts/wp-to-sanity-poc-dry-run.mjs
scripts/merge-wp-poc-issues.mjs
scripts/generate-preview-share-link.mjs
```

表示側は移植先のルーティングに合わせて実装してください。このプロジェクトでは `src/lib/news/sanity.ts`, `src/lib/news/index.ts`, `src/app/news/*` が該当します。

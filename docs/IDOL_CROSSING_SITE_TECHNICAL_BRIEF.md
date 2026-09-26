# IDOL CROSSING サイト技術ブリーフ

確認日: 2026-07-02

この資料では、外部向けの名称として **IDOL CROSSING Registry** または **Registry** を使う。実装上の内部名として必要な場合のみ、Supabase の `imd` スキーマ名を注記する。同様に、`ihc` スキーマは **イマキテランキング** の内部実装名として扱う。

## 1. この資料の目的

この資料は、`musicite_ai` リポジトリにある IDOL CROSSING 本体サイトの現行実装を、編集者や外部AIへ説明するための技術ブリーフである。

目的はコード変更ではなく、以下を把握できるようにすること。

- IDOL CROSSING 本体サイトが何を担っているか
- どのページ、UI、データ連携、管理機能が実装済みか
- Registry、イマキテランキング、アイドルDeep Research、記事、イベント、SNS話題がどう接続される想定か
- 現在動いている部分、未完成な部分、触ると壊れやすい部分はどこか
- 今後、外部AIや編集者が仕様提案・記事企画・改善案を考えるときに守るべき思想は何か

このリポジトリ内では `PROJECT.md v0.2` と翻訳辞書本体は確認できなかった。そのため、4層モデルの厳密な文言は未確認である。ただし、添付指示の前提から、本資料では次の整理で扱う。

- Registry: アイドルグループ情報の正本
- イマキテランキング: Spotify 上の変化を観測するランキング企画
- アイドルDeep Research: 観測された動きの理由を読み解く分析アウトプット
- IDOL CROSSING 本体サイト: それらを読者へ届ける「表現・接続」のレイヤー

## 2. 要約

IDOL CROSSING は、アイドルニュース、イマキテランキング、ナンダッテ、バズッタラ、分析可視化、イベント、編集支援を 1 つの Next.js アプリに集約した外部向け母艦である。

現行サイトは、単なるニュースサイトではない。Registry の `group_id` と `slug` を背骨にして、記事、ランキング、プロフィール、Spotify/YouTube/SNSリンク、イベント、ファン投票、SNS話題をグループ単位で接続しようとしている。

実装済みの主要機能は以下。

- トップページで、ニュース、イマキテ、ナンダッテ、バズッタラ、イベントを更新順にカード表示
- Sanity と旧WordPressを統合した記事一覧・記事詳細
- Sanity Studio `/studio` による記事・イベント・ラジオ告知・WP移行記事の編集
- イマキテランキングの日次/週次 Top20、アーカイブ、Spotify埋め込み、週間プレイリスト
- ナンダッテのグループ検索、プロフィールページ、投票、投票ランキング、マイ投票
- バズッタラの話題ポスト一覧、投稿詳細、タグ/いいね反応
- ドウナノ/ドコナノ/カイワイの分析・可視化プロトタイプ
- 運用コンソール `/relay-9147` と IAM 系の内部編集支援画面

一方で、Deep Research 専用のページ種別やルートはまだ確認できない。現時点では、Sanity の記事、カテゴリ、タグ、関連グループ、引用関係を使って Deep Research を表現する余地がある段階である。

## 3. サイトの役割

IDOL CROSSING 本体サイトは、活動全体の「表現・接続」の母艦である。

Registry は裏側の正本であり、グループ名、slug、外部ID、プロフィール、活動開始時期などを保持する。イマキテランキングは Spotify 由来の変化を観測する。ナンダッテはファンが見出した魅力語彙を投票として集める。バズッタラはSNS上の反響を保存する。記事は編集者が文脈化したアウトプットである。

本体サイトの役割は、これらを読者の体験に変換すること。

- 初心者には、ニュースや検索から具体的なグループへ入れる導線を作る
- 濃いファンには、ランキング、投票、SNS話題、分析を横断して追える場所を作る
- 編集者には、記事とグループ、イベント、引用、関連データを接続して運用できる編集面を作る
- 外部AIには、各データの性質を混同せず、企画や記事を考えられる前提情報を渡す

PROJECT.md 上の4層モデルの正確な定義は未確認だが、添付指示の文脈では、IDOL CROSSING 本体サイトは最上位の読者接点であり、Registry、イマキテランキング、Deep Research を外部へ接続するプレゼンテーション層として扱うのが妥当である。

## 4. 技術スタック

### 基本構成

- フレームワーク: Next.js `16.1.6` App Router
- UI: React `19.2.3`
- 言語: TypeScript `^5`
- スタイル: Tailwind CSS `^4`、`src/app/globals.css` のCSS変数
- パッケージ管理: npm（`package-lock.json` あり）
- 可視化: ECharts / `echarts-for-react`
- 3D/ゲーム: Three.js
- 画像キャプチャ: `html-to-image`、Playwright
- CMS: Sanity `^5.11.0`、`next-sanity`
- DB/BaaS: Supabase PostgreSQL、`@supabase/supabase-js`、`@supabase/ssr`
- 分析: `@vercel/analytics`、`@vercel/speed-insights`
- 埋め込み: Spotify iframe、Spotify iframe API、`react-tweet`

### 開発・ビルドコマンド

`package.json` で確認できる主なコマンド。

- `npm run dev`: `next dev --webpack`
- `npm run build`: `next build`
- `npm run start`: `next start`
- `npm run lint`: ESLint
- `npm run typecheck`: `tsc --noEmit`
- `npm run check`: lint + typecheck + build
- `npm run sanity`: Sanity CLI
- `npm run sanity:deploy`: Sanity Studio deploy
- `npm run capture:imakite`: イマキテ画像キャプチャ
- `npm run poc:wp-to-sanity:*`: WPからSanityへの移行スクリプト
- `npm run sync:wp-taxonomies:*`: WP分類のSanity同期

### デプロイ

Vercel 想定の実装がある。

- `vercel.json` に Cron 設定あり: `/api/cron/update-events` を毎日 `0 22 * * *`
- `@vercel/analytics` と `@vercel/speed-insights` を `src/app/layout.tsx` で読み込み
- README も Vercel デプロイ前提のテンプレート

実際の本番Vercelプロジェクト設定、ドメイン設定、環境変数の本番値はリポジトリ内では未確認。

### CMS・DB接続

- Sanity: 記事、イベント告知、ラジオ告知、WP移行記事、カテゴリ、タグを管理
- Supabase: Registry、イマキテ、ナンダッテ、バズッタラ、イベント、IAM系データを参照・更新
- WordPress: 旧記事のREST API参照とSanity移行元として利用

### 外部API・外部サービス

- WordPress REST API: 旧記事取得
- Sanity API: 記事取得、プレビュー、移行
- Supabase API: DB参照・更新・認証
- YouTube Data API: 関連グループの最新動画表示、IAM収集
- Spotify API: IAM収集、イマキテ/ゲームでは埋め込みURL表示
- Spotify iframe / iframe API: ランキング、関連グループ、ゲームBGM
- X/Twitter: `react-tweet` による投稿埋め込み
- TicketDive: イベント取得スクレイピング
- OpenAI API: IAM の週次補足調査

### 画像・OGP・SEO

- 画像ホスト許可は `next.config.ts` の `remotePatterns` で管理
- 許可済み: `cdn.sanity.io`、`musicite.sub.jp`、`*.wp.com`、任意の `WP_IMAGE_CDN_BASE_URL`
- サイト共通メタは `src/app/layout.tsx`
- 記事詳細は `src/lib/news/seo.ts` で title/description/OG/Twitter metadata を生成
- OGP画像は基本的に記事のアイキャッチ画像依存
- 動的OG画像、ランキング専用OG、プロフィール専用OG、sitemap、robots は実装ファイルを確認できなかった
- `/studio` は `robots: { index: false, follow: false }`

### 認証・管理画面

- Supabase Auth: Googleログイン。グローバルヘッダー、ナンダッテ投票、マイ投票で利用
- Basic認証: `/relay-9147/:path*` を `middleware.ts` で保護
- Sanity Studio: `/studio` に同居。Sanity側のログイン/権限はSanityの仕組みに依存
- Cron API: `CRON_SECRET` の Bearer 認証
- Preview share API: `PREVIEW_SHARE_SECRET` と署名付きURL

### 環境変数・Secrets

`.env.example` にあるもの。

- `WP_API_BASE_URL`
- `WP_IMAGE_CDN_BASE_URL`
- `NEWS_REVALIDATE_TOKEN`
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `OPENAI_API_KEY`
- `IAM_OPENAI_MODEL`
- `IAM_OPENAI_BUDGET_*`
- `IAM_OPENAI_WEB_SEARCH_*`
- `NEXT_PUBLIC_SANITY_PROJECT_ID`
- `NEXT_PUBLIC_SANITY_DATASET`
- `NEXT_PUBLIC_SANITY_API_VERSION`
- `RELAY9147_BASIC_AUTH_USER`
- `RELAY9147_BASIC_AUTH_PASS`

コード上で必要だが `.env.example` に載っていない、または載っているか未確認の重要変数。

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `YOUTUBE_API_KEY`
- `CRON_SECRET`
- `SANITY_API_READ_TOKEN`
- `SANITY_API_WRITE_TOKEN`
- `SANITY_API_TOKEN`
- `SANITY_STUDIO_PREVIEW_ORIGIN`
- `PREVIEW_LINK_SECRET`
- `PREVIEW_SHARE_SECRET`
- `PREVIEW_SHARE_ORIGIN`
- `NEXT_PUBLIC_SITE_ORIGIN`
- `IMAKITE_CAPTURE_URL`
- `IMAKITE_CAPTURE_OUT_DIR`
- `IMAKITE_CAPTURE_WAIT_MS`

## 5. リポジトリ構成

主要なディレクトリと、触ると何が変わるか。

### `src/app`

Next.js App Router のページ、レイアウト、APIルート。

- `src/app/layout.tsx`: 共通メタ、フォント、グローバルヘッダー、フッター、Vercel Analytics/Speed Insights
- `src/app/page.tsx`: トップページ。ニュース、イマキテ、ナンダッテ、バズッタラ、イベントのサマリーを集約
- `src/app/globals.css`: テーマCSS変数、Pop/Darkテーマ、記事本文・Tweet埋め込み・ロゴ表示の調整
- `src/app/news/*`: 記事一覧、Sanity記事詳細、WP互換記事詳細
- `src/app/imakite/*`: イマキテランキングの日次/週次/アーカイブ
- `src/app/nandatte/*`: ナンダッテ検索、投票、グループ詳細、投票履歴
- `src/app/buzzttara/*`: SNS話題投稿一覧・詳細
- `src/app/search/page.tsx`: 横断検索
- `src/app/dounano/*`, `src/app/dokonano/*`, `src/app/kaiwai/*`: 分析・可視化プロトタイプ
- `src/app/relay-9147/*`: Basic認証下の運用コンソール
- `src/app/studio/[[...tool]]/*`: Sanity Studio埋め込み
- `src/app/api/*`: データAPI、Cron、Sanity補助、YouTube、Tweet、Draft Previewなど

### `src/components`

共通UIコンポーネント。

- `src/components/global-header.tsx`: ナビゲーション、ログイン/ログアウト、検索、テーマ切替
- `src/components/news/*`: 記事本文、Sanityギャラリー、関連グループサイドバー、引用表示、ナンダッテ関連チャート
- `src/components/speed-insights.tsx`: Vercel Speed Insights のフィルタ付き読み込み

### `src/lib`

データ取得・ユーティリティ・ドメイン処理。

- `src/lib/supabase/*`: Browser/Server Supabase Client
- `src/lib/news/*`: Sanity/WP統合ニュース取得、SEO、関連グループ補完
- `src/lib/wp/client.ts`: 旧WordPress REST APIクライアント、HTML整形、画像URL書き換え
- `src/lib/sanity/*`: Sanityクライアント、画像、プレスリリースPDF/DOCX解析
- `src/lib/iam/*`: 週次監視対象生成、YouTube/Spotify収集、イベント正規化、候補生成、OpenAI補足調査
- `src/lib/buzzttara/*`: TicketDiveイベント取得
- `src/lib/preview/share-link.ts`: プレビュー共有リンク署名
- `src/lib/theme/mode.ts`: テーマモード処理

### `src/sanity`

Sanity Studio とスキーマ。

- `src/sanity/schemaTypes/*`: `newsArticle`、`eventAnnouncement`、`radioAnnouncement`、`wpImportedArticle`、カテゴリ、タグ
- `src/sanity/schemaTypes/shared.ts`: `relatedGroups`、SEO、カテゴリ/タグ参照、引用元記事の共通フィールド
- `src/sanity/components/related-groups-input/*`: Registryグループ検索入力
- `src/sanity/components/docx-press-release-import-tool.tsx`: 原稿インポート
- `src/sanity/desk-structure.tsx`: Studioのメニュー構成
- `src/sanity/preview-path.ts`: プレビューURL解決

### `supabase/migrations`

このリポジトリにあるDBマイグレーション。初期スキーマ全体ではなく、追加機能用の断片が中心。

- ナンダッテ Top10/Top20 RPC
- ナンダッテ投票サマリーRPC
- Registryグループの活動開始年月カラム
- IAM MVPテーブル
- IAM週次補完テーブル

Registry全体、イマキテ全体、ナンダッテ全体、バズッタラ全体の初期DDLはこのリポジトリだけでは再現できない可能性が高い。

### `scripts`

運用・移行スクリプト。

- WP記事のSanity移行 dry-run/apply
- WPタクソノミー同期
- WP画像ホスト置換
- WP関連グループ未一致レポート
- イマキテ画像キャプチャ
- プレビュー共有リンク生成

### `public`

ロゴ、favicon、PWA manifest、SNS/公式リンク用アイコン。

- `svg_logo_bk.svg`, `svg_logo_wh.svg`
- `idol-crossing-logo.png`
- `ic_*` アイコン
- `site.webmanifest`
- `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `favicon-32x32.png`

## 6. ページ・画面構成

### `/`

目的: IDOL CROSSING 全体の最新入口。

表示情報:

- イマキテ日次ランキング上位
- イマキテ週間プレイリスト
- ナンダッテ投票ランキング/最新アップデート
- バズッタラ最新投稿
- ニュースカテゴリ別の最新記事
- 関連イベント

使用データ:

- Supabase `ihc.daily_top20`, `ihc.weekly_playlists`
- Supabase `nandatte` RPC
- Supabase `public.tweets`
- Sanity/WP記事
- Sanityイベント
- Registry `imd.groups`

関連ファイル:

- `src/app/page.tsx`
- `src/app/nandatte/home-realtime-cards.tsx`
- `src/app/buzzttara/safe-tweet-embed.tsx`
- `src/lib/news/*`

注意点:

- トップは複数データソースを集約しており重くなりやすい
- ISR `revalidate=300` と `unstable_cache` を使う
- Buzzったら埋め込みや画像が体感速度に影響しやすい

### `/news`

目的: 記事一覧。

URL構造:

- `/news`
- `/news?page=2`
- `/news?category=i4c`
- `/news?tag=...`

表示情報:

- Sanity新規記事
- Sanity移行済みWP記事
- 旧WordPress直読み記事
- 公開日、カテゴリ、タグ、アイキャッチ

関連ファイル:

- `src/app/news/page.tsx`
- `src/lib/news/index.ts`
- `src/lib/news/sanity.ts`
- `src/lib/news/wp.ts`

注意点:

- SanityとWPを並行取得してパス重複を除外する
- 移行済み記事を優先する
- exactな全体件数はWP/Sanity重複のため概算寄り

### `/news/[slug]`

目的: Sanity新規記事、イベント告知、ラジオ告知の詳細。

表示情報:

- タイトル、公開日、カテゴリ、タグ、ヒーロー画像
- Portable Text本文
- ギャラリー
- イベント/ラジオ情報
- 関連グループサイドバー
- ナンダッテ関連チャート
- 引用元/引用先記事
- 本文改ページ

関連ファイル:

- `src/app/news/[slug]/page.tsx`
- `src/components/news/sanity-article-body.tsx`
- `src/components/news/related-groups-sidebar.tsx`
- `src/components/news/nandatte-related-chart.tsx`
- `src/components/news/article-citations.tsx`

注意点:

- `relatedGroups.imdGroupId` がないと、公式リンクやチャート連携が弱くなる
- イベント出演者と関連グループを重複排除して表示するロジックがある
- プレビュー時は draftMode を使う

### `/news/wp/[id]`

目的: 旧WordPress記事の互換表示、またはSanity移行済みWP記事の表示。

表示情報:

- WP由来の本文HTML
- アイキャッチ、カテゴリ、タグ
- Sanity移行済みの場合は関連グループ、ナンダッテチャート、引用情報

関連ファイル:

- `src/app/news/wp/[id]/page.tsx`
- `src/components/news/wp-article-body.tsx`
- `src/lib/wp/client.ts`
- `src/lib/news/sanity.ts`

注意点:

- `dynamic = "force-dynamic"`
- canonical は原則 source URL を使う
- WP HTMLは完全再現ではなく、スタイル除去・画像URL書き換えを行う

### `/imakite`

目的: イマキテランキング日次Top20。

表示情報:

- 最新日の日次Top20
- 順位、グループ名、スコア、最新曲名、画像、Spotify埋め込み
- 1位大型、2-3位中型、4位以降カード
- Daily/Weeklyタブ

使用データ:

- Supabase `ihc.daily_top20`
- Registry `imd.groups` の `slug`, `artist_image_url`

関連ファイル:

- `src/app/imakite/page.tsx`
- `src/app/imakite/ranking-list.tsx`

注意点:

- Client Component から Supabase publishable key で直接参照
- 指標の説明はあるが、「人気の絶対評価ではない」注意書きはまだ弱い
- 日次カード末尾に固定ADカードがある

### `/imakite/archive` と `/imakite/ranking/[date]`

目的: 日次ランキングの過去閲覧。

使用データ:

- `ihc.daily_top20.snapshot_date`

関連ファイル:

- `src/app/imakite/archive/page.tsx`
- `src/app/imakite/ranking/[date]/page.tsx`

注意点:

- アーカイブは日付一覧をクライアント取得
- URLの日付バリデーションは強くない

### `/imakite/weekly`

目的: イマキテ週間ランキングTop20。

表示情報:

- 週間Top20
- 週間プレイリスト埋め込み
- Daily/Weeklyタブ

使用データ:

- `ihc.weekly_rankings`
- `ihc.weekly_playlists`
- Registry `imd.groups`

関連ファイル:

- `src/app/imakite/weekly/page.tsx`
- `src/app/imakite/ranking-list.tsx`

注意点:

- 週次は日次と同じリストコンポーネントを `source="weekly"` で流用
- テーブル名/カラム名の揺れをある程度吸収している

### `/imakite/weekly/archive` と `/imakite/weekly/ranking/[date]`

目的: 週間ランキングのアーカイブ。

使用データ:

- `ihc.weekly_rankings.week_end_date`
- `ihc.weekly_playlists`

関連ファイル:

- `src/app/imakite/weekly/archive/page.tsx`
- `src/app/imakite/weekly/ranking/[date]/page.tsx`

### `/imakite/admin`

現状は `notFound()` で404。旧管理ページの名残と見られる。

### `/nandatte`

目的: ナンダッテの入口、グループ検索、投票ランキング。

表示情報:

- 投票者数、投稿対象グループ数
- グループ名検索
- 頭文字フィルタ
- 投票ランキング
- 最新アップデート

使用データ:

- Registry `imd.groups`
- `nandatte.get_vote_summary`
- `/api/nandatte/rankings`

関連ファイル:

- `src/app/nandatte/page.tsx`
- `src/app/nandatte/groups-list.tsx`
- `src/app/nandatte/rankings.tsx`

注意点:

- 初期状態では検索結果を出さず、検索または頭文字選択で表示
- Registryの `name_ja` と `slug` に強く依存

### `/nandatte/[slug]`

目的: 現行のグループ/アイドルプロフィールページに近い役割。ナンダッテ投票画面でもある。

表示情報:

- グループ名、画像、プロフィール、メンバー、活動拠点、事務所
- 総投票数、投票ランキング、イマキテ最新順位
- ナンダッテ上位ワード棒グラフ
- 最大5件の投票、フリーワード投票
- 公式リンク、スケジュール、X、Instagram、TikTok、YouTube、Spotify
- 直近イベント
- チャートキャプチャ

使用データ:

- Registry `imd.groups`
- Registry `imd.group_profiles`
- Registry `imd.group_attributes`
- Registry `imd.external_ids`
- `public.events`
- `nandatte.metrics`, `nandatte.votes`, `nandatte.vote_items`, `nandatte.metric_freewords`
- `nandatte` RPC
- `ihc.daily_rankings`

関連ファイル:

- `src/app/nandatte/[slug]/page.tsx`
- `src/app/nandatte/[slug]/group-detail.tsx`
- `src/app/api/nandatte/group-detail/route.ts`
- `src/components/news/related-groups-sidebar.tsx`

注意点:

- APIは `requireServiceRole: true` を使う
- 投票は Googleログイン必須
- 1ユーザー1グループの投票を upsert し、投票アイテムは差し替え
- フリーワードは10文字以内、NFKC正規化、孤立フリーワード削除あり
- メタタイトルの suffix に `DOL CROSSING` と見える表記があり、誤字の可能性がある

### `/nandatte/ranking`

目的: 投票ランキング/最新アップデートの詳細版。

関連ファイル:

- `src/app/nandatte/ranking/page.tsx`
- `src/app/nandatte/rankings.tsx`
- `src/app/api/nandatte/rankings/route.ts`

注意点:

- ログイン時は表示件数を増やす設計
- RPC名の候補を複数試す互換処理がある

### `/nandatte/me`

目的: ログインユーザーの投票履歴。

関連ファイル:

- `src/app/nandatte/me/page.tsx`
- `src/app/nandatte/me/votes.tsx`

注意点:

- Supabase Auth のユーザーIDで `nandatte.votes` を参照
- 未ログイン時は案内表示

### `/buzzttara`

目的: 100万View以上の話題投稿アーカイブ。

表示情報:

- 投稿者/アイドル名
- 紐づくグループ
- view数、いいね数、タグ
- X投稿埋め込み

使用データ:

- `public.tweets`
- `public.tweet_tags`
- `public.tags`
- Registry `imd.groups`

関連ファイル:

- `src/app/buzzttara/page.tsx`
- `src/app/buzzttara/buzz-list.tsx`
- `src/app/buzzttara/safe-tweet-embed.tsx`

注意点:

- `SEXY` と `Wow` タグは一部UIで非表示
- X埋め込みは失敗時に「Xで開く」フォールバック

### `/buzzttara/tweet/[id]`

目的: 話題投稿の詳細ページ。

表示情報:

- 投稿詳細
- グループへの導線
- 公式リンク/Spotify/YouTube/直近イベント
- 投稿いいね、タグいいね
- 管理コメント

関連ファイル:

- `src/app/buzzttara/tweet/[id]/page.tsx`
- `src/app/api/buzzttara/reactions/route.ts`

注意点:

- 閲覧時に `view_count` をクライアントから更新
- リアクションは `buzzttara_user_key` Cookie で重複抑制

### `/search`

目的: 横断検索。

検索対象:

- Registryグループ名
- バズッタラのアイドル名/グループ
- ニュースのタグslug

関連ファイル:

- `src/app/search/page.tsx`

注意点:

- ニュース全文検索ではなく、現状は主にタグslug検索
- 旧名、別名、略称には弱い

### `/dounano`

目的: 四象限モデル。イマキテ由来の音楽接触とナンダッテ由来のナラティブ密度を可視化。

使用データ:

- `nandatte.votes`
- `nandatte.get_group_metric_counts`
- `nandatte.get_group_vote_total`
- `ihc.daily_ranking` または `ihc.daily_rankings`
- Registry `imd.groups`

関連ファイル:

- `src/app/dounano/page.tsx`
- `src/app/dounano/dounano-view.tsx`
- `src/app/api/dounano/scatter/route.ts`

注意点:

- no-storeで最新取得
- ECharts Client Component
- グローバルナビには未掲載

### `/dokonano`

目的: ハイプ・サイクルモデル。活動期間と注目度を可視化。

使用データ:

- `imd.groups.activity_started_month`
- `ihc.daily_ranking` または `ihc.daily_rankings`
- `nandatte.votes`

関連ファイル:

- `src/app/dokonano/page.tsx`
- `src/app/dokonano/dokonano-view.tsx`
- `src/app/api/dokonano/scatter/route.ts`

注意点:

- 注目度は Spotify重み0.8、投票重み0.2 のMVP式
- 活動開始年月が欠損すると0扱い
- グローバルナビには未掲載

### `/kaiwai`

目的: ナンダッテ投票共起による「近いグループ」表示。

関連ファイル:

- `src/app/kaiwai/page.tsx`
- `src/app/api/kaiwai/related/route.ts`

注意点:

- Service Role が必要
- Prototype / unlisted扱い

### `/relay-9147`

目的: 運用コンソール。

表示・機能:

- イマキテ告知文生成、キャプチャ生成
- ナンダッテ告知文生成
- バズッタラ投稿管理
- IAM Consoleへのリンク

関連ファイル:

- `src/app/relay-9147/page.tsx`
- `src/app/relay-9147/imakite-panel.tsx`
- `src/app/relay-9147/nandatte-panel.tsx`
- `src/app/relay-9147/buzzttara-panel.tsx`
- `middleware.ts`

注意点:

- Basic認証で保護
- Buzzったら管理はクライアントからSupabaseを直接更新する
- 細かい権限ロールはコード上では確認できない

### `/relay-9147/iam`

目的: IAM の週次ニュース候補確認。

関連ファイル:

- `src/app/relay-9147/iam/page.tsx`
- `src/app/relay-9147/iam/targets/page.tsx`
- `src/app/relay-9147/iam/activities/page.tsx`
- `src/lib/iam/*`

注意点:

- `requireServiceRole: true`
- 候補採否UIは完全な編集フローというより、閲覧・確認画面寄り
- OpenAI補足のJSON復元処理がある

### `/studio`

目的: Sanity Studio。

管理対象:

- 新規記事
- イベント告知
- ラジオ告知
- WP移行記事
- カテゴリ
- タグ
- 原稿インポート

関連ファイル:

- `src/app/studio/[[...tool]]/page.tsx`
- `sanity.config.ts`
- `src/sanity/schemaTypes/*`

注意点:

- グローバルヘッダーは `/studio` で非表示
- `robots` は noindex
- Sanity環境変数未設定時はセットアップ案内

### その他

- `/wp-mvp`: WordPress直読み確認用のMVPページ。公開導線の主役ではない
- `/games`: Three.jsのゲーム。`/api/imakite/daily-top10` からイマキテ上位曲をBGMに使う
- `/voxel-escape`: `/games` へリダイレクト

## 7. UI・デザインシステム

### 全体方針

現行UIは、黒/白の硬いメディアUIではなく、PopテーマとDarkテーマを持つ。デフォルトは `pop`。

主な特徴:

- 日本語見出しに `Shippori Mincho` を使用
- 本文/操作UIは Geist 系フォント
- CSS変数で `--ui-page`, `--ui-panel`, `--ui-text`, `--ui-accent` などを定義
- Popテーマは赤系アクセント、淡い背景、ピンク系ボーダー
- Darkテーマは黒/亜鉛系
- ダークモード時の既存Tailwindクラス補正が `globals.css` にある

### レイアウト

- 共通最大幅は概ね `max-w-6xl`
- トップは masonry 的な `columns` レイアウト
- 記事詳細はメイン本文 + 関連グループサイドバー
- イマキテ日次はランキング順位に応じたカードサイズ
- 週次/ナンダッテ/バズッタラはカードやリストで構成

### ヘッダー/ナビゲーション

`src/components/global-header.tsx` が担当。

ナビゲーション:

- ホーム
- アイドルニュース
- イマキテランキング
- イマキテWEEKLY
- ナンダッテ
- バズッタラ

機能:

- Supabase Auth のGoogleログイン/ログアウト
- ログイン時メニュー: マイ投票、ドウナノ、ドコナノ
- 検索フォーム
- モバイルメニュー
- モバイルでスクロール時にヘッダーを隠す
- 開発環境ではテーマ切替を追加表示

### フッター

`src/app/layout.tsx` に実装。

- IDOL CROSSING / musicite表記
- Xリンク
- YouTubeリンク

### カードUI

- トップの各機能サマリー
- イマキテランキングカード
- バズッタラ投稿カード
- ナンダッテランキングリスト
- 週次アーカイブカード

課題:

- `rounded-xl` / `rounded-2xl` / `rounded-3xl` が混在
- Pop/Dark対応のため、個別に色補正している箇所が多い
- 一部テキスト色が `zinc-*` 固定で、テーマ変数と混在

### 記事一覧UI

- アイキャッチ左、タイトル右のリスト
- カテゴリ/タグはテキストリンクまたはピル
- ページネーションあり

### ランキング表示UI

- 日次イマキテは画像背景 + Spotify埋め込み
- 週次イマキテは横型カード中心
- ナンダッテは小さなサムネイル付きリスト
- ランキングが「人気の絶対評価ではない」ことをUI上で常時伝える文言はまだ不足

### プロフィール表示UI

- `/nandatte/[slug]` が現行プロフィール画面の中心
- グループ名を大きく表示
- プロフィール本文、属性、画像、ナンダッテチャート、投票フォーム、関連サイドバーを統合

### レスポンシブ対応

- Tailwindの `sm`, `md`, `lg` を利用
- ヘッダーはモバイルメニュー対応
- グラフ系はモバイルで検索中心の導線
- イマキテ/トップ/記事詳細はおおむねレスポンシブだが、埋め込みや大きなカードは表示確認が必要

### IDOL CROSSINGらしさ

現行UIで出ているらしさ:

- 「ニュースだけではなく、ランキング・投票・SNS話題・イベントが同じ場にある」構成
- Mincho系見出しによるメディア感
- Popテーマによる親しみやすさ
- グループ詳細に公式リンク、Spotify、YouTube、イベント、投票を集約する設計

今後強めるべきらしさ:

- 各ページで「観測データの性質」を明示する
- ランキング、投票、バズ、記事を単一の人気順に見せない
- グループページを「このグループの現在地」へ発展させる
- Deep Researchを通常記事と区別し、方法論の透明性を持たせる

## 8. 独自機能

### トップ集約

何をするか:

- サイト全体の最新動向を1ページに集める

実装:

- `src/app/page.tsx`

データ:

- Registry、イマキテ、ナンダッテ、バズッタラ、Sanity/WP記事

できていること:

- 複数データソースの最新カード表示
- 更新日時に近い順でカードを並べる

未完成/壊れやすい点:

- データソースが多く、表示速度と障害影響が大きい
- どのカードを第一表示にするかの情報設計は改善余地あり

### 記事表示

実装:

- `src/app/news/page.tsx`
- `src/app/news/[slug]/page.tsx`
- `src/app/news/wp/[id]/page.tsx`
- `src/lib/news/*`

データ:

- Sanity `newsArticle`, `eventAnnouncement`, `radioAnnouncement`, `wpImportedArticle`
- WordPress REST API

できていること:

- 新旧記事の統合一覧
- Sanity記事のPortable Text表示
- WP HTML記事の互換表示
- 関連グループ、イベント、引用表示

未完成:

- 構造化データやサイトマップ未確認
- Deep Research専用種別は未確認

### 関連グループサイドバー

実装:

- `src/components/news/related-groups-sidebar.tsx`
- `src/lib/news/related-groups.ts`

データ:

- Sanity `relatedGroups`
- Registry `imd.groups`, `imd.external_ids`
- `public.events`
- YouTube API

できていること:

- 公式リンク、SNS、Spotify、YouTube、直近イベント、最新ニュースリンク

壊れやすい点:

- `relatedGroups.imdGroupId`
- `external_ids.service` の文字列
- `YOUTUBE_API_KEY`

### イマキテランキング表示

実装:

- `src/app/imakite/ranking-list.tsx`

データ:

- `ihc.daily_top20`
- `ihc.weekly_rankings`
- `ihc.weekly_playlists`
- Registry `imd.groups`

できていること:

- Daily/Weekly Top20
- Spotify埋め込み
- アーカイブ
- グループ詳細への導線

未完成:

- 順位変動、急上昇フラグ、累積ランキングは未確認
- 指標の誤解防止UIが弱い

### ナンダッテ投票

実装:

- `src/app/nandatte/[slug]/group-detail.tsx`
- `src/app/api/nandatte/group-detail/route.ts`

データ:

- `nandatte.votes`
- `nandatte.vote_items`
- `nandatte.metrics`
- `nandatte.metric_freewords`

できていること:

- Googleログイン投票
- 1ユーザー1グループ upsert
- 最大5件選択
- 10文字以内フリーワード
- 孤立フリーワード削除
- 投票後の再取得

未完成:

- 匿名仮投票は要件にはあるが現行実装では未確認
- NGワード、同義語統合、モデレーションは未確認

### ナンダッテチャートキャプチャ

実装:

- `html-to-image` を `group-detail.tsx` で使用

できていること:

- ログインまたはlocalhostでチャートをPNG保存/モバイル共有

注意点:

- ブラウザ依存
- 外部画像やフォント読み込みで失敗する可能性

### バズッタラ投稿表示・反応

実装:

- `src/app/buzzttara/*`
- `src/app/api/buzzttara/reactions/route.ts`
- `src/app/api/tweet/[id]/route.ts`

データ:

- `public.tweets`
- `public.tweet_tags`
- `public.tags`
- `public.tweet_reactions`

できていること:

- 投稿一覧/詳細
- X埋め込み
- 投稿いいね、タグいいね
- Cookieベース重複抑制

未完成/注意:

- 認証なしCookieのため強い不正対策ではない
- X側の埋め込み可否に依存

### 横断検索

実装:

- `src/app/search/page.tsx`

できていること:

- グループ名、バズ投稿、ニュースタグを横断表示

未完成:

- 記事本文検索、同義語、旧名、略称対応は未実装

### 可視化

実装:

- `src/app/dounano/*`
- `src/app/dokonano/*`
- `src/app/kaiwai/*`

できていること:

- ECharts散布図
- グループ検索
- ナンダッテ/イマキテ指標の重ね合わせ
- 投票共起

未完成:

- 公式ナビ導線
- 指標説明の磨き込み
- 欠損データの見せ方

### IAM編集支援

実装:

- `src/lib/iam/*`
- `src/app/api/cron/iam/*`
- `src/app/relay-9147/iam/*`

できていること:

- 週次対象生成
- YouTube/Spotify raw updates収集
- normalized events生成
- weekly digest candidates生成
- OpenAI補足調査
- 内部確認画面

未完成:

- 最終記事化/採否/編集ワークフローはまだ限定的
- ログ・監視・通知は弱い

## 9. Registryとの関係

Registry は IDOL CROSSING 全体の正本であり、現行コードでは Supabase の `imd` スキーマとして参照される。

### 現在使っているデータ

- `imd.groups`
  - `id`
  - `name_ja`
  - `slug`
  - `artist_image_url`
  - `activity_started_month`
- `imd.external_ids`
  - `website`
  - `schedule`
  - `x` / `twitter`
  - `instagram`
  - `tiktok`
  - `spotify`
  - `youtube_channel`
  - `ticketdive`
- `imd.group_profiles`
  - `locale = ja`
  - `body`
- `imd.group_attributes`
  - `members`
  - `location`
  - `agency`
- `imd.weekly_targets`, `imd.raw_updates`, `imd.normalized_events`, `imd.weekly_digest_candidates`, `imd.weekly_group_complements`

### 現在すでに接続している箇所

- ナンダッテのグループ検索・個別ページ
- イマキテランキングからグループ詳細への導線
- バズッタラ投稿とグループ
- 記事の関連グループサイドバー
- Sanityの関連グループ入力
- ドウナノ/ドコナノ/カイワイ
- IAM週次対象/活動収集
- TicketDiveイベント取得

### group_id / slug / 表示名

- `group_id`: 各機能の接続キー。最重要
- `slug`: URLと記事/検索導線に使う
- `name_ja`: 表示名と検索に使う

注意:

- `group_id` を変えると広範囲が壊れる
- `slug` を変えるとURL、ランキング導線、記事導線が切れる
- 旧名/別名/略称の正規管理は未確認

### 外部リンク

`external_ids.service` の文字列をコード側で直接見ている。表記変更は壊れやすい。

表示用途:

- 公式サイト
- スケジュール
- X
- Instagram
- TikTok
- Spotify
- YouTube

収集用途:

- YouTube最新動画
- Spotify更新
- TicketDiveイベント
- IAM補足調査

### 重複管理を減らす方向

現在は、プロフィール、外部リンク、イベント、記事関連グループを Registry へ寄せる流れができている。将来的には、記事側やバズッタラ側で持つグループ名のスナップショットだけでなく、できる限り `group_id` を正とするべき。

### 現在重複している可能性

- Sanity `relatedGroups.groupNameJa`
- バズッタラ `idol_name`
- イマキテ `artist_name`
- WPタグ/カテゴリ
- ナンダッテの表示名補完

これらは表示や移行には必要だが、正本はRegistryに寄せるべきである。

## 10. イマキテランキングとの関係

イマキテランキングは、Spotify上の変化を観測するランキング企画である。現行コードでは Supabase `ihc` スキーマを使う。

### 表示場所

- トップページ
- `/imakite`
- `/imakite/archive`
- `/imakite/ranking/[date]`
- `/imakite/weekly`
- `/imakite/weekly/archive`
- `/imakite/weekly/ranking/[date]`
- `/nandatte/[slug]` のイマキテ最新順位
- `/dounano`, `/dokonano`
- `/games`
- `/relay-9147`

### 扱っているデータ

- `ihc.daily_top20`
  - `snapshot_date`
  - `group_id`
  - `rank`
  - `artist_name`
  - `score`
  - `latest_track_name`
  - `latest_track_embed_link`
  - `artist_image_url`
- `ihc.weekly_rankings`
  - `week_end_date`
  - `rank`
  - `group_id`
  - score系カラム
- `ihc.weekly_playlists`
  - `spotify_embed_url`
  - `spotify_playlist_url`
- `ihc.daily_ranking` / `ihc.daily_rankings`
  - 可視化で `artist_popularity` を参照

### 現在できていること

- 日次Top20表示
- 週次Top20表示
- 日次/週次アーカイブ
- Spotify埋め込み
- 週間プレイリスト
- ランキングからナンダッテ詳細への導線
- トップページへの最新表示
- ゲームBGMへの流用

### 未実装または要設計

- 急上昇フラグ
- 順位変動
- 累積ランキング
- 日次/週次/Top20/累積の意味整理
- Deep Researchや記事への明確な導線
- 「人気の絶対評価ではなく観測装置」という注意書きの共通表示
- 指標定義の常設ページ

### 誤解させないUI上の工夫

必要な方針:

- 「人気ランキング」ではなく「Spotify上の接触・変化を観測する指標」と説明する
- スコアの意味を短く補足する
- ランキングカードから、関連記事・Deep Research・プロフィールへ自然に遷移させる
- グループページでは「最新順位」だけでなく、観測日と指標の性質を表示する

## 11. Deep Researchとの関係

現行コードで「アイドルDeep Research」専用のルート、Sanity document type、UI部品は確認できなかった。

したがって、現時点の扱いは **未実装または要設計** と見るのが安全である。

### 現行機能で受けられる形

Deep Researchを現行サイトに載せる場合、最短ではSanityの `newsArticle` として扱える。

使える要素:

- `categories`
- `tags`
- `relatedGroups`
- `citationSourceArticle`
- `citedByArticles`
- Portable Text本文
- 関連グループサイドバー
- ナンダッテ関連チャート

### 通常記事との違いとして設計すべきもの

- 記事種別またはカテゴリ: `Deep Research`
- 方法論ブロック
- 観測データの出典
- イマキテランキングとの関係
- Registry情報への還流候補
- 何が事実で、何が分析/仮説かの区別
- 引用元記事/関連調査の構造化

### 導線案

- イマキテランキング上位や急変グループからDeep Researchへ
- Deep Research記事からグループページへ
- グループページから関連Deep Research一覧へ
- Deep Research内でRegistry修正候補を明示

### 現在の課題

- 専用テンプレートがない
- シリーズ管理がカテゴリ/タグ頼み
- Research結果をRegistryへ戻す運用が未設計
- 通常ニュースと分析記事の見え方が同じになりやすい

## 12. 記事・コンテンツ管理

### 保存場所

現行は3系統。

1. Sanity新規記事
2. Sanity移行済みWP記事
3. 旧WordPress REST API直読み記事

### Sanity document type

- `newsArticle`: 新規記事。Portable Text本文
- `eventAnnouncement`: イベント告知。イベント情報を構造化
- `radioAnnouncement`: ラジオ告知
- `wpImportedArticle`: WP移行記事。legacy HTML本文
- `newsCategory`
- `newsTag`

### 主なフィールド

- title
- slug
- publishedAt
- heroImage / heroImageExternalUrl
- body / legacyBodyHtml
- categories
- tags
- relatedGroups
- excerpt
- seoTitle
- seoDescription
- ogImage
- citationSourceArticle
- citedByArticles

### 記事とグループの紐づけ

Sanityの `relatedGroups` で紐づける。

保存値:

- `groupNameJa`
- `imdGroupId`
- `displayOrder`

Studioでは `RelatedGroupObjectInput` が `/api/sanity/imd-groups-search` を呼び、Registryの日本語グループ名から候補を出す。

### 下書き・公開状態

- Sanity側の draftMode/previewDrafts を利用
- 本番公開条件は `publishedAt <= now()` と draft除外
- `newsArticle`, `eventAnnouncement`, `radioAnnouncement` は slug 必須
- `wpImportedArticle` は `wpPostId` 必須

### 記事一覧・詳細生成

- `/news`: SanityとWPを統合
- `/news/[slug]`: Sanity新規/イベント/ラジオ
- `/news/wp/[id]`: Sanity移行済みWP記事を優先し、なければWP API

### OGP/SEO

- 記事詳細は `buildArticleMetadata`
- title/description/canonical/openGraph/twitterを生成
- Sanity新規記事は self canonical
- WP互換記事は source-url canonical

注意:

- Sanityの `seoTitle`, `seoDescription`, `ogImage` フィールドはスキーマにあるが、現行の `buildArticleMetadata` で優先利用されている実装は確認できない
- 構造化データは未確認

### 将来的な接続

- Deep Researchを専用カテゴリ/種別化
- relatedGroups未設定記事のレビュー導線
- グループページに関連記事/Deep Research/イベントを統合表示
- Research結果からRegistry更新候補を起票

## 13. データ取得・外部連携

### Supabase

用途:

- Registry
- イマキテランキング
- ナンダッテ
- バズッタラ
- イベント
- IAM
- 認証

実装:

- `src/lib/supabase/client.ts`
- `src/lib/supabase/server.ts`

注意:

- Client Componentからpublishable keyで直接読む箇所が多い
- Service Role必須のAPI/ページがある
- RLSポリシーはリポジトリ内だけでは確認できない

### Sanity

用途:

- 記事CMS
- イベント/ラジオ告知
- WP移行記事
- プレビュー
- 原稿インポート

実装:

- `sanity.config.ts`
- `src/lib/sanity/client.ts`
- `src/sanity/schemaTypes/*`
- `/studio`

### WordPress

用途:

- 旧記事取得
- 移行元
- WP画像参照

実装:

- `src/lib/wp/client.ts`
- `scripts/wp-to-sanity-poc-dry-run.mjs`
- `scripts/wp-sync-taxonomies-to-sanity.mjs`
- `scripts/replace-wp-image-host-in-sanity.mjs`

### Spotify

用途:

- イマキテランキングの曲埋め込み
- 週次プレイリスト埋め込み
- 関連グループサイドバー
- IAM Spotify更新収集
- ゲームBGM

環境変数:

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`

### YouTube

用途:

- 関連グループサイドバーの最新動画
- IAM YouTube更新収集

実装:

- `src/app/api/youtube/route.ts`
- `src/lib/iam/raw-updates-youtube.ts`

環境変数:

- `YOUTUBE_API_KEY`

### X/Twitter

用途:

- バズッタラ埋め込み
- IAM/関連リンクでのX URL表示

実装:

- `react-tweet`
- `src/app/api/tweet/[id]/route.ts`
- `src/app/buzzttara/safe-tweet-embed.tsx`

### TicketDive

用途:

- Registryの `external_ids.service = ticketdive` から直近イベント取得

実装:

- `src/lib/buzzttara/ticketdive-scraper.ts`
- `src/lib/buzzttara/event-updater.ts`
- `/api/cron/update-events`

注意:

- HTMLスクレイピングのため壊れやすい
- Cronは `CRON_SECRET` 必須

### OpenAI

用途:

- IAMの週次補足調査

実装:

- `src/lib/iam/weekly-group-complements.ts`

環境変数:

- `OPENAI_API_KEY`
- `IAM_OPENAI_MODEL`
- `IAM_OPENAI_BUDGET_DAILY_USD`
- `IAM_OPENAI_BUDGET_MONTHLY_USD`
- `IAM_OPENAI_PER_CALL_RESERVE_USD`
- `IAM_OPENAI_WEB_SEARCH_CONTEXT_SIZE`
- `IAM_OPENAI_WEB_SEARCH_COMMON_ALLOWED_DOMAINS`

注意:

- AIは候補整理・補足調査であり、最終判断者ではない

### フォーム・広告・支援導線

一般公開ユーザー向けの問い合わせフォーム、広告管理、支援導線の実装は確認できない。

## 14. SEO・OGP・SNS共有

### 現在できていること

- サイト共通 title/description
- PWA manifest
- favicon/icon設定
- 記事詳細ごとの title/description
- 記事詳細のOGP/Twitter metadata
- 記事 canonical
- `/studio` noindex
- 旧URLから `/news/wp/[id]` への redirects

### redirects

`next.config.ts` で旧WP系URLを `/news/wp/:id` へ恒久リダイレクト。

- `/i4c/:id.php`
- `/i4c/col/:id.php`
- `/article/:section/:id.php`
- `/gk/sp/:id.php`
- `/inm/wp-content/uploads/:path*` は `musicite.sub.jp` へ

### 未確認/未実装

- `sitemap.ts`
- `robots.ts`
- 動的OG画像生成
- グループページごとのOG画像
- ランキングページ専用OG画像
- 構造化データ
- X共有文生成の公開UI

### 改善候補

- `/news`, `/imakite`, `/nandatte`, `/buzzttara`, `/dounano`, `/dokonano` のdescription強化
- `/nandatte/[slug]` のtitle誤字疑い修正
- グループプロフィールページのOGP画像
- イマキテTop3のSNSカード生成
- Deep Research用のArticle structured data
- サイトマップとrobotsの明示実装

## 15. 管理・運用フロー

### 記事を追加する流れ

1. `/studio` で `newsArticle` を作成
2. title, slug, publishedAt, heroImage, body を入力
3. categories/tags を設定
4. `relatedGroups` でRegistryグループを検索・選択
5. 必要に応じて引用元記事を設定
6. Sanity Previewで確認
7. 公開後、必要なら `/api/revalidate/news` で再検証

非エンジニアが触れる範囲:

- Sanity Studioの記事・イベント・タグ・カテゴリ
- 原稿インポート
- relatedGroups入力

触るべきでない範囲:

- SupabaseのService Roleキー
- DBスキーマ/RPC
- `scripts/*` の apply 系
- Cron API

### グループ情報を更新する流れ

現行ではSanityではなくSupabase/Registry側を更新する必要がある。

対象:

- `imd.groups`
- `imd.external_ids`
- `imd.group_profiles`
- `imd.group_attributes`

非エンジニア用のRegistry管理画面は確認できない。

### ランキングを反映する流れ

- サイトは既存の `ihc` データを読む
- 集計生成ジョブ本体はこのリポジトリでは一部未確認
- `/relay-9147` は既存ランキングを取得し、告知文や画像キャプチャを補助する

### 画像や埋め込みを追加する流れ

- 記事画像: Sanity `heroImage` や本文画像
- WP移行画像: `heroImageExternalUrl` / `legacyBodyHtml`
- Spotify: イマキテDBまたはRegistry external_ids
- YouTube: Registry external_ids
- X投稿: バズッタラ管理画面

### イベント情報を追加する流れ

2系統ある。

- Sanity `eventAnnouncement`: 記事/告知として管理
- `public.events`: TicketDive取得や関連サイドバーの直近イベント表示

この2つは統合されたイベント正本としてはまだ整理途上。

### 公開前確認

- Sanity preview
- `/news/[slug]`
- `/news`
- 関連グループサイドバー
- OGP metadata
- スマホ表示

### 本番反映

- Vercelデプロイ想定
- Sanity公開
- 必要に応じて revalidate

### ロールバック

コードのロールバック手順はリポジトリ内で明確には確認できない。VercelのDeployment rollbackを使う想定と思われるが未確認。

### 壊れた時の確認ポイント

- 環境変数
- Supabase接続
- Sanity環境変数/トークン
- WP API到達性
- RLS/Service Role
- YouTube/Spotify APIキー
- `external_ids.service`
- `slug`
- Sanity `relatedGroups`
- Cron secret
- Vercel function logs

## 16. 現在できていること

- IDOL CROSSINGトップページ
- グローバルナビ
- Googleログイン
- Pop/Darkテーマ切替
- Sanity Studio同居
- Sanity新規記事
- イベント告知
- ラジオ告知
- WP移行記事
- 旧WP記事互換表示
- 記事一覧のカテゴリ/タグ絞り込み
- 記事詳細の関連グループ表示
- 記事詳細のナンダッテ関連チャート
- 記事詳細のSpotify/YouTube/公式リンク表示
- イマキテ日次ランキングTop20
- イマキテ週次ランキングTop20
- イマキテ日次/週次アーカイブ
- 週次Spotifyプレイリスト表示
- ナンダッテグループ検索
- ナンダッテグループ詳細
- ナンダッテ投票
- ナンダッテ投票ランキング
- ナンダッテ最新アップデート
- マイ投票
- バズッタラ一覧
- バズッタラ詳細
- X投稿埋め込み
- バズッタラ反応
- 横断検索
- ドウナノ可視化
- ドコナノ可視化
- カイワイ共起表示
- IAM週次パイプライン
- IAM内部確認画面
- TicketDiveイベント取得Cron
- イマキテ画像キャプチャ
- ゲームでイマキテ曲利用

## 17. まだ不安定なこと

### データ連携

- Supabase初期DDLがリポジトリ内だけでは完結していない
- `ihc` テーブル名に揺れがある
- `external_ids` の品質に強く依存
- TicketDiveスクレイピングは外部HTML変更に弱い
- WordPress API到達性に依存する部分が残る

### UI

- テーマ変数と固定Tailwind色が混在
- ランキング指標の説明が不足
- グラフ系のモバイル体験は改善余地あり
- カード角丸/余白/色設計に統一余地あり

### 記事管理

- WP移行記事のlegacy HTMLが残る
- Sanity SEOフィールドの表示側利用が未確認
- relatedGroups未設定記事の検出/修正UIが未整備

### Registry連携

- 旧名/略称/改名履歴が未整備
- メンバーは文字列属性で、履歴管理されていない
- 活動状態や再始動の履歴管理は弱い
- 非エンジニア向けのRegistry編集画面が未確認

### イマキテランキング連携

- 急上昇、順位変動、累積ランキングは未確認
- スコアの定義説明がページ内で弱い
- Deep Researchへの導線が未設計

### SEO/OGP

- sitemap/robots未確認
- 動的OG未実装
- グループ/ランキング専用OG未実装
- 構造化データ未確認

### 管理画面

- `/relay-9147` はBasic認証のみ
- 細かいロール/権限管理は未確認
- Supabase直編集に近い箇所がある

### 認証・権限

- Supabase Authは投票中心
- RLS設計はリポジトリから確認できない
- Service Roleを使うAPIが多い

### デプロイ

- Vercel想定だが本番設定は未確認
- ロールバック手順は未文書化

### 手動運用

- Registry更新
- イマキテ集計投入
- Deep Research公開フロー
- relatedGroups補完
- WP移行記事の確認

## 18. 触ると壊れやすい部分

- `imd.groups.id`: 全接続の主キー
- `imd.groups.slug`: URLと導線
- `imd.external_ids.service`: 文字列参照が多い
- `ihc.daily_top20`, `ihc.weekly_rankings`, `ihc.weekly_playlists`
- `ihc.daily_ranking` / `daily_rankings`
- `nandatte` RPCの戻り値
- `nandatte.votes` と `vote_items`
- Sanity `relatedGroups.imdGroupId`
- WordPress画像URL書き換え
- `next.config.ts` のredirectsとimage remotePatterns
- `middleware.ts` のBasic認証
- `createServerClient({ requireServiceRole: true })` を使うAPI
- Cron secret
- YouTube/Spotify/OpenAI APIキー
- X埋め込みAPI
- TicketDive HTMLパーサ
- `src/app/page.tsx` のホーム集約

## 19. 今後の改善候補

### 短期

- `.env.example` にSupabase、YOUTUBE、CRON、Sanity token、Preview系の不足変数を追記
- `/nandatte/[slug]` のメタタイトル誤字疑いを修正
- イマキテ各ページに「人気の絶対評価ではなく観測装置」の注記を追加
- sitemap/robotsを実装
- グループページのmetadata/OGPを強化
- `/imakite/admin` の404方針を明記または導線削除
- relatedGroups未設定記事のレポートを運用化
- トップページの重いカードを遅延/軽量化
- TicketDive CronとIAM Cronの失敗時通知を整備

### 中期

- Registry管理画面を用意
- グループ別の統合プロフィールページをナンダッテから独立/発展
- Deep Research専用カテゴリ/テンプレート/導線を設計
- イマキテ順位変動、急上昇、比較UIを追加
- 記事からランキング/プロフィール/Deep Researchへの導線を強化
- グループページに関連記事、Deep Research、ランキング履歴、バズ、イベントを統合
- 横断検索を全文検索/同義語/旧名対応へ拡張
- Sanity SEOフィールドを表示側で優先利用
- RLS/権限設計の文書化

### 長期

- Group Hub / Group Timeline OS 化
- `group_events` read model導入
- 改名、旧名、活動終了、再始動、メンバー変動の履歴管理
- 海外向けページ
- 広告・支援導線
- 自治体・運営向けページ
- API公開
- メディアキット化
- フォロー/通知/My Page
- Deep ResearchからRegistryへのレビュー/更新ワークフロー

## 20. 技術的な課題

### アーキテクチャ

現在は1つのNext.jsアプリに、公開サイト、CMS Studio、内部コンソール、Cron、ゲーム、分析、移行補助が同居している。小規模では速いが、権限、保守、テスト、障害切り分けが複雑になりやすい。

### データ設計

Registryを軸にする思想は明確だが、初期DDLや完全なスキーマがリポジトリ内にない。別名、改名、活動状態、メンバー履歴、外部ID品質などの正規化が今後必要。

### 型安全性

Supabaseの戻り値を `Record<string, unknown>` や手動型で受ける箇所が多い。DB型生成が導入されていないため、カラム変更に弱い。

### パフォーマンス

トップ、関連サイドバー、グラフ、X埋め込みは重くなりやすい。ISR/キャッシュはあるが、外部依存が多い。

### SEO

記事SEOはあるが、サイトマップ、robots、構造化データ、動的OG、グループページSEOは強化余地が大きい。

### 保守性

`src/app/page.tsx` や `group-detail.tsx` の責務が大きい。トップ集約、データ整形、UIを分けると改善できる。

### テスト

テストコードは確認できない。最低限、データ変換、APIレスポンス、記事SEO、投票処理、ランキング表示のテストが必要。

### セキュリティ

Service Roleを使うAPIが多い。Basic認証、Cron secret、Preview secret、Supabase RLSの設計を文書化し、公開APIとの境界を明確にする必要がある。

### デプロイ/運用

Vercel想定だが、Production/Preview/Studio/Secrets/ロールバック手順がリポジトリからは追い切れない。

### ログ・監視

console.error はあるが、外部監視、通知、ジョブ失敗アラートは未確認。

### エラー処理

多くの箇所でフォールバックはあるが、ユーザー向け説明や編集者向け復旧手順は不足している。

### 将来拡張性

機能が増えるほど、グループ単位で集約する read model が必要になる。長期的には `Group` と `Event` に寄せる設計が有力。

## 21. 仕様として維持すべき思想

- IDOL CROSSINGは活動全体の外部向け母艦である
- Registryは裏側の正本であり、サイトはその情報を読者に届く表現へ変換する
- イマキテランキングは人気の絶対評価ではなく、Spotify上の接触や変化を観測する装置である
- ナンダッテは人気投票だけではなく、ファンがグループの魅力語彙を育てる場である
- バズッタラはSNS反響の記録であり、単なる煽りではなく文脈化の材料である
- Deep Researchは観測された動きを文脈化する分析アウトプットである
- 記事、ランキング、プロフィール、イベント、SNS話題をバラバラに見せず、グループ単位で接続する
- 速報競争だけでなく、記録可能性と文脈化を重視する
- 初心者には具体から、濃いファンには方法論の透明性から、運営には実利と懸念から入る
- 内部名を外部向けの本文では前面に出さない
- 実績数字やランキングの意味を創作しない
- AIは補助者であり、最終的な採用判断、意味づけ、公開判断は編集者が担う
- 誤ったグループ紐付けは信頼を壊すため、推測で自動接続しない
- 読者への誠実さ、事実性、独立性を損なわない

## Claude Fable 5 / ChatGPTへ渡す際の要点まとめ

1. IDOL CROSSING本体サイトは、Registry、イマキテランキング、ナンダッテ、バズッタラ、記事、イベント、IAMを読者へ接続する外部向け母艦である。
2. Registryが正本であり、実装上はSupabase `imd` スキーマの `groups.id` と `slug` が全体の背骨になっている。
3. イマキテランキングは人気の絶対評価ではなく、Spotify上の接触や変化を観測する装置である。実装上は `ihc` スキーマを使う。
4. 現行のグループプロフィールは `/nandatte/[slug]` が担っており、プロフィール、外部リンク、Spotify、YouTube、イベント、投票、イマキテ順位を集約している。
5. 記事はSanityへ移行中で、Sanity新規記事、Sanity移行済みWP記事、旧WordPress直読み記事が併存している。
6. Deep Research専用実装はまだ確認できず、現時点ではSanity記事、カテゴリ/タグ、relatedGroups、引用関係で受ける設計が必要。
7. 公開サイト、Sanity Studio、内部運用コンソール、Cron、分析プロトタイプが1つのNext.jsアプリに同居しているため、権限と運用境界に注意が必要。
8. 壊れやすいのは `group_id`、`slug`、`external_ids.service`、ナンダッテRPC、イマキテテーブル、Sanity `relatedGroups`、環境変数である。
9. 短期改善は、環境変数ドキュメント、SEO/OGP、イマキテ注意書き、グループページmetadata、トップページ軽量化から始めるのが現実的である。
10. 長期的には、すべての情報をグループ単位のタイムライン/Hubへ集約する Group Timeline OS 的な設計が有力である。

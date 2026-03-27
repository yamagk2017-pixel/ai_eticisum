# フラッシュアイデア Inbox

思いつきを最速で置くためのメモ。整理前の一次置き場。

## ルール
- 1行でもよいので即記録する。
- 毎週1回、[PRODUCT_IMPROVEMENT_HUB.md](/Users/yamada2/バイブコーディング/musicite_ai/docs/PRODUCT_IMPROVEMENT_HUB.md) の Backlog へ昇格判定する。
- データ/移行計画のアイデアはこのファイルではなく、既存の移行計画ドキュメントへ直接追記する。

## 2026-03-27
- アイデア: 【セキュリティ対策】DBに一部公開データがあるので公開範囲を再設計する
  - ねらい: 意図しないデータ露出リスクの低減と信頼性確保
  - 対象: cross / infra / security
  - 参考: Supabase RLS・権限分離・公開用ビュー設計
  - メモ:
    - まず「公開してよい列/公開禁止列」をテーブル単位で棚卸しする
    - 直参照ではなく公開用ビューまたはRPC経由の取得へ寄せる
    - サービスロール利用箇所とクライアント公開キー利用箇所を分離して監査する
- アイデア: ユーザーからニュースにしてほしい情報を受け付ける
  - ねらい: 投稿起点のニュース収集速度を上げる
  - 対象: cross / ops
  - 参考: 利用者向け「ニュース化リクエスト」フォーム、編集部の情報収集代行フロー
  - メモ:
    - 2026-03-13の運営向けニュースリリース受付とは別目的で運用する

## テンプレート
```md
## YYYY-MM-DD
- アイデア:
- ねらい:
- 対象:
- 参考:
```

## 2026-03-13
- アイデア: ニュース受付フォームを作る（アイドル運営のニュースリリース投稿を起点に記事化）
  - ねらい: ニュース掲載フローの簡素化と公開スピード向上
  - 対象: cross / ops
  - 参考: 運営向け専用フォーム、Googleフォームまたは独自フォーム、Sanity下書き連携
  - メモ:
    - 投稿者はアイドル運営（公式素材提供者）を想定する
    - 元ネタ精度は低めでも受け付け、AIで記事体に整形する
    - 想定フロー: フォーム登録 -> 記事生成 -> Sanity下書き登録 -> プレビュー確認 -> 公開
    - トラブルケース: 元ネタ精度が低すぎて整形不能な場合は、スキップまたは再投稿依頼
- アイデア: アイドル第四会議室のメインビジュアルを強化する
  - ねらい: 第一印象改善と回遊導線の強化
  - 対象: content / home
  - 参考:
- アイデア: グッズ販売とナンダッテ連携（購入者向け特典導線）
  - ねらい: 収益導線と参加導線の接続
  - 対象: nandatte / ops
  - 参考:
- アイデア: 貢献グループの露出強化（「一押し」ティッカー枠）
  - ねらい: マネタイズと露出機会の設計
  - 対象: home / cross
  - 参考:
- アイデア: favicon開発
  - ねらい: ブランド認知の改善
  - 対象: cross
  - 参考:
- アイデア: トップページに最新YouTube表示
  - ねらい: リアルタイム性と滞在時間の向上
  - 対象: home
  - 参考:
- アイデア: ナンダッテのスタンプ化（行動で得になる仕組み）
  - ねらい: ログイン継続率・投票継続率の向上
  - 対象: nandatte
  - 参考:

## 2026-03-15
- アイデア: WP画像のグローバルCDN化（CloudFront）を実施する
  - ねらい: US/desktop のLCP改善、WP画像配信のTTFB短縮、オリジン負荷軽減
  - 対象: news / infra / performance
  - 参考: CloudFront + ACM + `img.musicite.net` + `WP_IMAGE_CDN_BASE_URL`
  - 作業メモ（別作業で実施）:
    - `img.musicite.net` を画像配信用サブドメインとして決める
    - ACM（us-east-1）で `img.musicite.net` 証明書を発行
    - CloudFront Distribution 作成（origin: `musicite.sub.jp`）
    - Alternate domain に `img.musicite.net` を設定し証明書紐付け
    - DNSで `img.musicite.net -> *.cloudfront.net` のCNAME追加
    - `https://img.musicite.net/inm/wp-content/uploads/...` が200で返るか確認
    - Vercel env に `WP_IMAGE_CDN_BASE_URL=https://img.musicite.net` を設定
    - 再デプロイ後に LCP（US/desktop）と `x-cache` ヘッダを確認

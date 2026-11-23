# IAM：非公開のイマキテ週間集計による対象選定

2026-11-23。新プレイリスト由来の50組から、従来の週間ランキング上位20組へ戻す。

## 定期実行と集計

既存のGitHub Actions `IAM Weekly Targets`（月曜03:00 JST）を使用する。
対象選定の直前に、継続保存されている `ihc.daily_rankings` をDB内で集計する。
別の集計ジョブを待たず、IAMの実行時に必要な週を計算・保存する。

- 旧Python集計 `imakite_supabase/scripts/ihc_weekly_ranking_job.py` のv1と同じく、7日間の `base_score` 合計。古い行は `score`、両方NULLなら0を使う。
- 日次がv2でも、`conversion_momentum`は加算しない。同点はグループUUID昇順で決定する。
- 集計期間は従来の火曜〜月曜。月曜に動くIAMが従来参照していたのは、監視週初日の月曜を終了日とするランキング。
- 例：11/23（月）の実行は `week_key=2026-11-16`、出来事は11/16〜22日、週間ランキングは11/10〜16日を使用する。11/17〜23日を使わない。
- 明示的な `week_key` でも同じ対応を使い、最新週への置き換えはしない。
- 対象7日が揃わない、または20組に満たない場合は既存対象の削除前に停止する。

`imd.compute_iam_weekly_ranking` は `security invoker` のRPC。
通常実行は `p_persist=true` で `imd.iam_weekly_rankings` に1週1行の上位20組・期間・元データ件数を保存する。
保存先はRLS有効、`service_role`専用。公開の `ihc.weekly_rankings`、旧Spotifyプレイリスト、
「イマキテアイドル：ジャパン」は更新しない。旧公開ランキングの自動集計は休止を継続する。

## 対象と加点

- 週間ランキング上位20組とNANDATTE直近上位20組を統合し、グループUUIDで重複を除く。最大40組。
- 選定理由は `ihc_top20`（画面表示：イマキテ週間ランキング上位20）と `nandatte_recent_top20`。
- 加点は週間ランキング10点、NANDATTE5点、両方なら15点。
- 優先度は両方が1、週間ランキングのみが2、NANDATTEのみが3。
- 過去の `imakite_idol_japan` は表示・加点互換を保持する。過去の対象履歴を一括変更しない。
- YouTube収集・Spotify収集・イベント整理・候補生成の構成は従来のまま。

## 確認用API

認証済みPOST `/api/cron/iam/weekly-targets?week_key=YYYY-MM-DD` は読取専用。
`p_persist=false` で集計し、週間集計の保存も `weekly_targets` の削除・保存も行わない。
データ不足はHTTP 409・`weekly_ranking_not_ready`・`rankingWeekEndDate`を返す。

成功時は `rankingWeekEndDate`、`rankingAlgorithmVersion`、`ihcCount`、`nandatteRecentCount`、
`unionCount`、`targets` を返す。以前のプレイリスト由来フィールドは使用しない。

## 検証

```bash
node --experimental-strip-types --test tests/iam-weekly-targets.test.mjs
node --import tsx --test tests/iam-weekly-targets-integration.test.mjs
```

DB検証は `tests/iam-weekly-ranking.sql` を使用する。読取専用プレビュー、保存、
欠損日、過去の公開集計との上位20組一致、一般ロールへの非公開を確認してロールバックする。

## 障害復旧

まずPOSTで対象週の7日分と20組・統合件数を確認する。
日次データ不足があれば日次処理を復旧してから、GitHub Actions `IAM Weekly Targets` を手動実行する。
通常APIは前週を処理する。別週の復旧では各工程の週指定対応を確認して実行する。
週間集計の保存が成功しても、ニュース候補の作成まで完了したかはActions結果と
`imd.weekly_digest_candidates` で確認する。

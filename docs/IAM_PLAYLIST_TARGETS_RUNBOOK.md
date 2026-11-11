# IAM：イマキテアイドル：ジャパンによる対象選定

2026-11-11。IHC週間ランキング集計の休止に合わせ、IAMのIHC由来対象を新プレイリストへ切り替える。

## 対象と加点

- 企画slugは`imakite-idol-japan`。
- `ihc.release_playlist_runs`の`status=committed`の`target_tracks`を読む。Spotify APIから曲順を取り直さず、正常公開された更新時点の50曲を使う。
- 先頭20曲への限定はしない。全50曲から`imd.groups.id`の重複を除き、NANDATTE直近上位20組と統合する。最大70組（重複があれば減る）。追加曲だけでなく継続曲のグループも対象。
- 新しい選定理由は`imakite_idol_japan`。管理画面では「イマキテアイドル：ジャパン掲載」と表示する。
- IAM候補の加点は掲載グループ10点、NANDATTE由来5点。両方なら15点。過去の`ihc_top20`も10点として読めるようにし、新旧理由が両方付いていても二重加点しない。
- 優先度は従来どおり、両方の対象が1、プレイリストのみが2、NANDATTEのみが3。

## 対象週の固定

IAMの自動実行は従来の**月曜03:00 JST**、出来事の収集期間は月曜〜日曜のまま。

`week_key`は月曜日の日付。参照するプレイリストの`cutoff`は、その週の土曜日（`week_key+5日`）に固定する。例えば2026-11-16（月）03:00の実行では、`week_key=2026-11-09`・`cutoff=2026-11-14`の更新を参照する。過去週の再実行でも、その週に対応する土曜履歴を読む。

対象の土曜更新が未確定・未公開の場合、古い週や未来週のプレイリスト、旧IHC週間ランキングへ代替しない。対象の50曲・曲ID一意性・グループUUIDを検証し、異常なら既存の`weekly_targets`を変更する前に停止する。

初期プレイリストの`cutoff=2026-11-10`は火曜の承認済みシミュレーションに基づく初期化であり、11/7や11/14の土曜更新の代わりには使わない。初回の定期利用は11/14更新の完了後、11/16（月）03:00を予定する。

## 確認用API

認証済みPOST `/api/cron/iam/weekly-targets?week_key=YYYY-MM-DD`は、選定だけを行いDBへの削除・保存を行わない確認用API。通常の実行と同じ土曜履歴の確認を行う。履歴がまだなければHTTP 409・`playlist_snapshot_not_ready`・`expectedCutoff`を返す。POSTに未対応の旧デプロイでは405になるため、切替確認で誤って更新用GETを実行することもない。

成功時の結果には`playlistGroupCount`、`playlistTrackCount`、`playlistCutoff`、`playlistRunId`、`targets`が含まれる。旧`ihcCount`は既存のAPI利用者向けの互換aliasで、今後は`playlistGroupCount`を使う。通常実行の結果に対象一覧は追加せず、従来の集計件数と新しい出典メタデータを返す。

## 検証

```bash
node --experimental-strip-types --test tests/iam-weekly-targets.test.mjs
node --import tsx --test tests/iam-weekly-targets-integration.test.mjs
```

日付・全50曲・グループ重複除去・不正/未完了履歴・NANDATTE統合・最大70組・加点互換の8件と、実際のSupabaseクライアントを模擬HTTPへ接続した読み書き順序の4件を検証する。外部APIや本番データへの書き込みは行わない。

## 再実行

土曜更新が失敗した場合、先にプレイリストの未完了更新を復旧して`committed`を確認し、その後にIAM Weekly Targetsを手動実行する。IHC週間ランキングの再開や、既存の対象履歴の削除による回避は不要。

# GTN LP BigQuery Analytics SQL Assets

Phase5.1〜Phase5.2.1 で構築した BigQuery 分析基盤の DDL / Scheduled Query SQL を集約したディレクトリ。

リポジトリにバージョン管理することで：
- BQ Console 上で誤って SQL を上書きした場合の復元元
- 新しい derived 列を追加する際の git diff レビュー
- Phase5.3 以降の Looker / 追加 SQL 開発のベース

として機能する。

---

## BigQuery 構成

| 項目 | 値 |
|---|---|
| GCP Project | `gtn-lp-analytics` |
| GA4 Property ID | `531281503` |
| RAW dataset (GA4自動) | `analytics_531281503` |
| DERIVED dataset (自前) | `gtn_analytics` |
| Location | **US** |
| Export 種別 | Daily export ON / Streaming OFF |

### RAW dataset (READ ONLY)
`gtn-lp-analytics.analytics_531281503.events_YYYYMMDD`

GA4 Free Tier の Daily Export で**翌日生成**（最大72h遅延）。
ユーザー側からは絶対に変更しない。Schedule Query もすべて SELECT のみ。

### DERIVED dataset
`gtn-lp-analytics.gtn_analytics.*` に以下を配置：

| オブジェクト | 種類 | Partition | Clustering | 用途 |
|---|---|---|---|---|
| `events_normalized` | VIEW | (events_* に依存) | - | event_params 展開した正規化レイヤ |
| `sessions` | TABLE | `session_date` | `first_source, device_category` | 1行=1セッション |
| `cta_attribution` | TABLE | `lead_date` | `last_cta_location, source` | 1行=1 lead_captured + last-click CTA |
| `cta_attribution_daily` | TABLE | `date` | `cta_location, source` | CTA × source × industry の日次集計 |
| `cta_funnel_daily` | TABLE | `date` | `cta_location, step` | CTA別ファネル各ステップのセッション数 |

---

## SQL ファイル一覧

| # | ファイル | 役割 |
|---|---|---|
| 1 | `00_view_events_normalized.sql` | events_normalized VIEW（CREATE OR REPLACE） |
| 2 | `01_table_sessions.sql` | sessions TABLE 定義（CREATE IF NOT EXISTS） |
| 3 | `02_table_cta_attribution.sql` | cta_attribution TABLE 定義 |
| 4 | `03_table_cta_attribution_daily.sql` | cta_attribution_daily TABLE 定義 |
| 5 | `04_table_cta_funnel_daily.sql` | cta_funnel_daily TABLE 定義 |
| 6 | `10_sq_sessions_v2.sql` | Scheduled Query: sessions（Phase5.2.1 適用済） |
| 7 | `11_sq_cta_attribution.sql` | Scheduled Query: cta_attribution |
| 8 | `12_sq_cta_attribution_daily.sql` | Scheduled Query: cta_attribution_daily |
| 9 | `13_sq_cta_funnel_daily.sql` | Scheduled Query: cta_funnel_daily |

00〜04 はテーブル定義（初回のみ手動実行）。
10〜13 は Scheduled Query 本体（BQ UI の「スケジュール済みクエリ」に登録）。

---

## Scheduled Query 一覧

| # | 名前 | 実行時刻 (JST) | 実行時刻 (UTC) | 宛先テーブル | Write Disposition |
|---|---|---|---|---|---|
| 1 | `gtn_build_sessions_daily` | 04:30 | 19:30 (前日) | `sessions${run_date\|"%Y%m%d"}` | WRITE_TRUNCATE |
| 2 | `gtn_build_cta_attribution_daily` | 05:00 | 20:00 (前日) | `cta_attribution${run_date\|"%Y%m%d"}` | WRITE_TRUNCATE |
| 3 | `gtn_build_cta_attribution_summary_daily` | 05:15 | 20:15 (前日) | `cta_attribution_daily${run_date\|"%Y%m%d"}` | WRITE_TRUNCATE |
| 4 | `gtn_build_cta_funnel_daily` | 05:30 | 20:30 (前日) | `cta_funnel_daily${run_date\|"%Y%m%d"}` | WRITE_TRUNCATE |

### 依存関係（実行順序が重要）

```
04:30  sessions_daily        ← events_normalized のみ
05:00  cta_attribution_daily ← events_normalized のみ
05:15  cta_attribution_summary_daily ← events_normalized + cta_attribution（≥05:00 完了が必要）
05:30  cta_funnel_daily      ← events_normalized + sessions（≥04:30 完了が必要）
```

各 30 分インターバルで十分なマージン。

### 冪等性（同日再実行可）

すべての Scheduled Query は **destination partition decorator `${run_date|"%Y%m%d"}` + WRITE_TRUNCATE** により、当該 partition のみ atomic 置換。同じ `@run_date` で何度実行しても結果同一。**DELETE / UPDATE 文を一切使用していない**。

---

## 手動再実行方法

### A. BQ Console UI から「今すぐ実行」

```
1. BigQuery Console (https://console.cloud.google.com/bigquery)
2. プロジェクト: gtn-lp-analytics
3. 左メニュー「スケジュール済みクエリ」
4. 対象のジョブをクリック
5. 「今すぐ実行をスケジュール」ボタン
6. 任意の日付 (= @run_date) を指定して実行
```

### B. BQ Console UI から過去日を一括バックフィル

```
1. スケジュール済みクエリのジョブを開く
2. 「過去の実行をスケジュール」
3. 開始日 / 終了日を指定（最大365日）
4. 確認 → 実行
   → 範囲内の各日付について @run_date を変えて順次実行される
```

### C. bq CLI から特定パーティションを上書き再生成

```bash
# 例: sessions の 2026-05-15 partition を再生成
bq query --use_legacy_sql=false --project_id=gtn-lp-analytics \
  --destination_table='gtn-lp-analytics:gtn_analytics.sessions$20260515' \
  --replace=true \
  --parameter=run_date:DATE:2026-05-15 \
  "$(cat gas/bq_sql/10_sq_sessions_v2.sql)"
```

`--parameter=run_date:DATE:YYYY-MM-DD` で `@run_date` を渡す。

---

## トラブルシューティング

| 症状 | 原因 | 対処 |
|---|---|---|
| `Unknown parameter @run_date` | Scheduled Query 以外で `@run_date` を使った | パラメータ無しで実行する場合は SQL の `@run_date` を `DATE '2026-05-15'` 等のリテラルに置換、または `--parameter` フラグを使う |
| destination が `sessions${run_date\|"%Y%m%d"}` リテラルになる | UI の「宛先テーブル ID」ではなく SQL 内に書いてしまった | UI 側の宛先テーブルフィールドに入れる。SQL 本体は SELECT のみ |
| 「Source dataset … not found」 | RAW dataset 名 (`analytics_531281503`) が変わった | GA4 Property ID 変更時は SQL 内の dataset 名を一括置換 |
| `first_source = 'flair-staff.co.jp'` 等の referrer host | Phase5.2.1 修正未適用の旧 SQL を使っている | `10_sq_sessions_v2.sql` を再貼り付け → 該当 partition を「今すぐ実行」で再生成 |
| 「処理を行うロケーションが異なる」 | Scheduled Query の location が US 以外 | UI 上で location = US を明示 |
| `events_<YYYYMMDD>` が見つからない | GA4 Daily Export 遅延 (24-72h) | 実行ログで確認。前日テーブルが無ければ ~12h 待つ |
| 認証期限切れ | 所有者の OAuth トークン失効 | `gcloud auth login` で再認証、または UI で「サービスアカウントを使用」設定 |

---

## `@run_date` パラメータ注意点

- `@run_date` は BigQuery Data Transfer Service の予約パラメータで、**DATE型**
- Scheduled Query 実行時、自動的に「該当実行の対象日」がセットされる
- 通常実行: その日 UTC 0:00 が `@run_date` になる
- バックフィル実行: 指定範囲内の各日付が順に `@run_date` になる
- SQL 内で `@run_date` を参照、destination 名で `${run_date|"%Y%m%d"}` 形式で参照

### 重要：UTC と JST の対応

GA4 Export テーブルは **UTC 基準** で `events_YYYYMMDD` を生成。
Scheduled Query を 04:30 JST に設定 = 19:30 UTC（前日扱い）。

このとき `@run_date` がどう設定されるかは Scheduled Query 作成時の Timezone 設定による：
- Timezone = Asia/Tokyo: `@run_date` = 実行日の JST 日付
- Timezone = UTC (デフォルト): `@run_date` = 実行日の UTC 日付

**推奨**: UI で **Timezone = Asia/Tokyo** に設定 → `@run_date` = 04:30 実行時刻の JST 日付。GA4 export は UTC ベースだが、04:30 JST 時点で前日 UTC 分の export は概ね完了している。

実運用で `events_<YYYYMMDD>` 不在エラーが続く場合は実行時刻を遅らせる（例: 07:00 JST）か、Timezone と target date の関係を見直す。

---

## source 衝突修正の説明 (Phase5.2.1)

### 問題

GA4 自動イベント（`session_start`, `first_visit`, `page_view`）の `event_params.source` は **referrer host**（例: `flair-staff.co.jp`）を含む。

一方、GTN カスタム実装の `trackEvent('lp_view', { source: 'direct' })` 等で attach した `source` は同じキー名で別の値（流入元コード: `direct`/`bni`/`linkedin` 等）を持つ。

events テーブル上は同じ `source` キーで両者が混在するため、ARRAY_AGG で「セッション内最初の source」を取ると GA4 自動イベントの referrer host が拾われやすい。

### 修正

`10_sq_sessions_v2.sql` の `first_source` 抽出で、GTN カスタムイベント12種に絞ってから値を取る：

```sql
ARRAY_AGG(
  IF(event_name IN (
    'lp_view','cta_click','page_view_lp','page_view_check','industry_selected',
    'result_viewed','form_start','form_submit','lead_captured','consult_click',
    'external_link_click','scroll_depth'
  ), source, NULL)
  IGNORE NULLS ORDER BY event_ts ASC LIMIT 1
)[SAFE_OFFSET(0)] AS first_source
```

これにより `first_source` には常に `direct`/`bni`/`linkedin` 等の GTN 流入元コードのみが入る。

### 影響範囲

- `sessions.first_source` のみ影響（修正対象）
- `cta_attribution.source` は `lead_captured` イベント直接参照のため影響なし
- `cta_attribution_daily.source` は `cta_click` イベント直接参照のため影響なし

---

## Looker Studio 接続先

### 推奨プライマリ接続

```
データソース: BigQuery
プロジェクト:   gtn-lp-analytics
データセット:   gtn_analytics
テーブル:       cta_attribution_daily
```

### 推奨ダッシュボード構成（Phase5.3）

| ページ | データソース | グラフ案 |
|---|---|---|
| CTA真CVR | `cta_attribution_daily` | 棒: cta_location × true_cvr_session<br>散布: clicks × true_cvr_session |
| Source × CTA | `cta_attribution_daily` | ヒートマップ |
| Industry × CTA | `cta_attribution_daily` | 積み上げ棒 |
| CTAファネル | `cta_funnel_daily` | ファネル |
| 個別リード追跡 | `cta_attribution` | テーブル |

### キャッシュ戦略

**「Extract Data」を必ず ON**（毎時更新推奨）→ 閲覧毎の BigQuery 課金を実質ゼロ化。

---

## 既知の制約 / Phase5.3 以降の改善候補

| # | 制約 | Phase候補 |
|---|---|---|
| 1 | `question_started` は `question_viewed[question_num=1]` の近似（カスタムディメンション `question_num` 未登録時は全 question_viewed が混入する点に注意） | カスタムディメンション登録確認、または最小値検出に変更 |
| 2 | Last-click in same session のみ。クロスセッション attribution 未対応 | Phase6: user_pseudo_id ベース 30日 window |
| 3 | Multi-touch attribution 未対応（Linear, Time-decay 等） | Phase6 |
| 4 | LTV ベース評価未対応（CRM データ連携が必要） | Phase6 |

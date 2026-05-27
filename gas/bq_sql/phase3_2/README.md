# GTN LP — Phase3.2 BigQuery 分析 SQL

Phase3.2（Google広告計測・コンバージョン最適化）用の BigQuery 分析資産。
Phase3.2 で追加した4種カスタムイベント（`click_cta` / `start_diagnosis` / `complete_diagnosis` / `submit_lead_form`）と新規パラメータ（`gclid` / `medium` / `campaign` / `session_id` / `diagnosis_result_type` / `debug_mode`）を集計する。

> Phase5 系（`cta_attribution` 等）とは **完全独立**。GA4 BigQuery Daily Export のみに依存。

---

## ファイル一覧

| # | ファイル | 種別 | 役割 |
|---|---|---|---|
| 1 | `00_view_events_phase3_2.sql` | VIEW | events_* から Phase3.2 イベント・パラメータを抽出した正規化レイヤ |
| 2 | `10_funnel_daily.sql` | Scheduled Query | 日次ファネル（LP流入→各ステップ）と遷移率 |
| 3 | `20_source_medium_cvr.sql` | Scheduled Query | source × medium × campaign 別 CV率 |
| 4 | `30_gclid_cv.sql` | Scheduled Query | gclid 別 CV 履歴（Google Ads Offline Conversion 連携用） |
| 5 | `40_cpa_estimate.sql` | Scheduled Query | Google Ads コスト × CV ユーザー数 → CPA |

---

## BigQuery 構成（前提）

| 項目 | 値 |
|---|---|
| GCP Project | `gtn-lp-analytics` |
| GA4 Property ID | `531281503` |
| RAW dataset (GA4自動) | `analytics_531281503` |
| DERIVED dataset (自前) | `gtn_analytics` |
| Location | **US** |

---

## 初期セットアップ

### Step 1: VIEW を作成（手動・初回のみ）

```bash
bq query --use_legacy_sql=false --project_id=gtn-lp-analytics \
  "$(cat gas/bq_sql/phase3_2/00_view_events_phase3_2.sql)"
```

または BQ Console から `00_view_events_phase3_2.sql` を貼り付けて実行。

### Step 2: Scheduled Query を登録

各 SQL を BQ Console「スケジュール済みクエリ」に登録：

| SQL | スケジュール名（例） | 宛先テーブル | 実行時刻 (JST) | Timezone | パラメータ |
|---|---|---|---|---|---|
| `10_funnel_daily.sql` | `gtn_p32_funnel_daily` | `gtn_analytics.funnel_daily_p32${run_date\|"%Y%m%d"}` | 06:00 | Asia/Tokyo | `@run_date` 自動 |
| `20_source_medium_cvr.sql` | `gtn_p32_source_medium_cvr` | `gtn_analytics.source_medium_cvr_p32${run_date\|"%Y%m%d"}` | 06:10 | Asia/Tokyo | `@run_date` 自動 |
| `30_gclid_cv.sql` | `gtn_p32_gclid_cv` | `gtn_analytics.gclid_cv_p32${run_date\|"%Y%m%d"}` | 06:20 | Asia/Tokyo | `@run_date` 自動 |
| `40_cpa_estimate.sql` | `gtn_p32_cpa_estimate` | `gtn_analytics.cpa_estimate_p32${run_date\|"%Y%m%d"}` | 06:30 | Asia/Tokyo | `@run_date` 自動 |

Write Disposition: 全て **WRITE_TRUNCATE**。
`${run_date|"%Y%m%d"}` partition decorator で当該日のみ atomic 置換。

### Step 3: （CPAのみ）Google Ads コストデータ取込

`40_cpa_estimate.sql` を使うには Google Ads → BigQuery Data Transfer Service の有効化が必要：

1. https://cloud.google.com/bigquery/docs/google-ads-transfer に従って Transfer 作成
2. Data Source: Google Ads
3. Destination dataset: `google_ads`（無ければ作成、location=US）
4. Customer IDs: 該当の Ads アカウントID
5. スケジュール: Daily（04:00 JST 推奨）
6. SQL 内 `customer_id` 定数を該当IDで書き換え（任意 — NULL なら全アカウント合算）

---

## 手動再実行（バックフィル）

```bash
# 例: funnel_daily の 2026-05-20 partition を再生成
bq query --use_legacy_sql=false --project_id=gtn-lp-analytics \
  --destination_table='gtn-lp-analytics:gtn_analytics.funnel_daily_p32$20260520' \
  --replace=true \
  --parameter=run_date:DATE:2026-05-20 \
  "$(cat gas/bq_sql/phase3_2/10_funnel_daily.sql)"
```

`--parameter=run_date:DATE:YYYY-MM-DD` で `@run_date` を渡す。

---

## 重要な前提

### debug_mode フィルタ
全 SQL は `debug_mode_int IS NULL OR debug_mode_int = 0` で **QA トラフィックを除外**。
本番計測のみ集計される。

### user_pseudo_id ベース DISTINCT
ファネル各ステップは「該当イベントを発火したユニークユーザー数」で集計。
`complete_diagnosis` の **fallback 重複**（check.html の主発火 + result.html の保険発火）は
DISTINCT で自動的に合算1件扱いになるため、二重計上は発生しない。

### click_cta はファネル分母にしない
`click_cta` は LP 入口に限らず result 画面のスクロールCTAや consult リンクでも発火する。
funnel 分母は **`lp_view`（GA4自動 page_view）** または **`start_diagnosis`** を使用。

### attribution 優先順位
`source` / `medium` / `campaign` は `trackNewEvent` 由来（`ep.*`）を優先し、
無ければ GA4 自動収集（`traffic_source.*`）にフォールバック。

---

## Looker Studio 接続例

| ページ | データソース | グラフ案 |
|---|---|---|
| ファネル概観 | `funnel_daily_p32` | ファネル: lp_view → start → complete → submit |
| 流入別CVR | `source_medium_cvr_p32` | 棒: source × cv_rate / ヒートマップ |
| gclid CV履歴 | `gclid_cv_p32` | テーブル（did_submit_lead_form フィルタ） |
| CPA 推移 | `cpa_estimate_p32` | 折れ線: date × cpa_submit × campaign |

「Extract Data」**ON 推奨**（毎時更新）→ 閲覧毎の BigQuery 課金を実質ゼロ化。

---

## 既知の制約 / 改善候補

| # | 制約 | 影響 |
|---|---|---|
| 1 | gclid 取得は **trackNewEvent 経由イベントのみ**（GA4自動 page_view には付かない） | gclid 別ファネル分母が小さくなる場合あり |
| 2 | Phase3.2 イベントは Phase3.2 デプロイ後のみ存在（過去日バックフィル時は 0 件） | 計測開始日以降のみ有効 |
| 3 | CPA は Ads Data Transfer 有効化が必要 | 未有効時は `cpa_*` 列が NULL |
| 4 | クロスデバイス attribution 未対応 | 同一ユーザー別端末は別 user_pseudo_id |

---

## トラブルシューティング

| 症状 | 原因 | 対処 |
|---|---|---|
| `events_phase3_2` not found | VIEW 未作成 | Step 1 を実行 |
| 全列 0 件 | Phase3.2 デプロイ前の日付 | 計測開始日以降の `@run_date` を指定 |
| `submit_users` 過大 | debug_mode フィルタ未適用 | SQL 内の `debug_mode_int` 条件を確認 |
| `cost_jpy` が NULL | Ads Data Transfer 未有効 | Step 3 を実施、または `40_cpa_estimate.sql` をスキップ |

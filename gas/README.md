# GTN LP - GA4 Funnel Aggregator (Phase3.1)

GA4 Data API から日次でイベントを取得し、Google Sheets に蓄積する Apps Script。
Looker Studio から直接 Spreadsheet を参照できる形で出力する。

## 構成

| 項目 | 値 |
|---|---|
| ファイル | `gas/ga4-aggregator.gs` |
| 実行環境 | Google Apps Script（Spreadsheet 紐付け） |
| 依存サービス | **Google Analytics Data API**（Advanced Service） |
| 出力先 | 紐付け先 Spreadsheet 5シート |
| 実行頻度 | 日次 04:00 JST（自動） |

## セットアップ

### 1. Spreadsheet 作成
Google Drive で新規スプレッドシートを作成。シートのIDは後でメモ。

### 2. Apps Script プロジェクト紐付け
作成した Spreadsheet → 拡張機能 → Apps Script を開く。

### 3. コード貼り付け
本リポジトリの `gas/ga4-aggregator.gs` の内容をコピペ。

### 4. GA4 プロパティID を設定
GA4 管理画面 → プロパティ設定 → 「プロパティID」（数値、9〜10桁）をコピー。
スクリプト先頭の：

```javascript
const GA4_PROPERTY_ID = '';  // ← ここに貼る（例: '123456789'）
```

### 5. Advanced Service の有効化
Apps Script エディタ左メニュー → 「サービス」（＋）→
「**Google Analytics Data API**」を選択 → 追加。

> 識別子は `AnalyticsData` のままでOK。

### 6. GA4 のカスタムディメンション登録（必須）
GA4 管理画面 → 管理 → カスタム定義 → カスタムディメンション で以下を登録（**全てスコープ=イベント**）：

| ディメンション名 | パラメータ名 | 用途 |
|---|---|---|
| source | `source` | 流入元 |
| ref | `ref` | 紹介者コード |
| page_id | `page_id` | top_lp / diag_lp / diag_result |
| cta_location | `cta_location` | CTA位置 |
| destination | `destination` | CTAの遷移先 |
| location | `location` | consult_click 位置 |
| url | `url` | external_link_click URL |
| position | `position` | note記事順位 |
| percent | `percent` | scroll_depth |
| rating | `rating` | 診断ランク |
| industry | `industry` | 選択業種 |
| field | `field` | フォーム失敗フィールド |
| reason | `reason` | 失敗理由 |
| question_num | `question_num` | 質問番号（質問開始の判定に使用） |

> **重要**: 未登録のカスタムディメンションは GA4 が遡及配信しないため、ローンチ前の登録を強く推奨。

### 7. 動作確認（手動実行）
1. 関数選択 `ensureHeaders` → 実行 → 権限承認 → 5シートが作られる
2. 関数選択 `runGA4DailyReport` → 実行 → 前日データが入る
3. （任意）`backfillRange` を編集して過去N日分を埋める

### 8. トリガー設定
関数選択 `setupGA4Trigger` → 実行。
これで日次 04:00 JST に `runGA4DailyReport` が自動実行される。

## シート構成

| シート名 | 内容 | 主キー |
|---|---|---|
| `raw_events` | 日次 × source × 各イベント count（縦持ち） | (date, source) |
| `funnel_cvr` | raw_events から派生した8つのCVR | (date, source) |
| `cta_analysis` | CTA位置別 click + downstream（pro-rata推計） | (date, cta_location) |
| `form_error_breakdown` | フォームエラーの field × reason 別件数 | (date, field, reason) |
| `dashboard_summary` | 経営者向けKPIサマリ（key/value形式） | – |

### raw_events 列一覧
```
date, source,
lp_view, cta_click, diag_lp_view,
industry_selected, question_started, diagnosis_complete, result_view,
form_start, form_submit, lead_captured,
consult_click, external_link_click,
scroll_25, scroll_50, scroll_75, scroll_100
```

### funnel_cvr の算出式（参考）
| 列 | 分子 | 分母 |
|---|---|---|
| LP_to_diag_rate       | diag_lp_view        | lp_view |
| diag_to_question_rate | industry_selected   | diag_lp_view |
| question_complete_rate| diagnosis_complete  | question_started |
| result_to_form_rate   | form_start          | result_view |
| form_submit_rate      | lead_captured       | form_start |
| consult_rate          | consult_click       | result_view |
| total_cvr             | lead_captured       | lp_view |

## 重複日上書き

同じ日付に対して `runGA4DailyReport` を再実行すると、既存行は削除されてから再書き込みされる（idempotent）。

## エラー時の挙動

- **API失敗**：`Logger.log` にエラー記録 → throw（トリガー実行履歴で確認可）
- **シート欠損**：`ensureHeaders` が自動再生成
- **ヘッダ欠損**：`setHeadersIfMissing_` が補修
- **未登録のカスタムディメンション**：そのディメンションを使う行は値が拾えないが処理は止まらない

## Looker Studio 接続

1. https://lookerstudio.google.com → データソース作成
2. 「Google スプレッドシート」コネクタを選択
3. 本シートを選択 → タブを選択（例: `raw_events`）
4. レポートにグラフ追加
   - 折れ線：日付ディメンション × `lead_captured` メトリクス × source 内訳
   - 棒：`cta_location` × `clicks`
   - ファネル：`funnel_cvr` を直接表示
5. （任意）`dashboard_summary` をスコアカードに

## 既知の制約 / Phase3.2 で対応予定

- `cta_analysis.downstream_leads` / `downstream_consults` は **pro-rata 推計**（その日のリード/相談総数 × CTAクリックシェア）。真の attribution には BigQuery エクスポートまたは GA4 セッション結合が必要。
- `question_started` は `question_viewed` の `question_num=1` で代用（カスタムディメンション `question_num` 未登録時は全 `question_viewed` がカウントされ過大評価になる）。
- 流入元の合体（utm_source と source のマージなど）は未対応。GA4 のチャネルグルーピングと併用推奨。

## 関数一覧

| 関数 | 呼び出し方 | 用途 |
|---|---|---|
| `setupGA4Trigger` | 初回手動 | 日次トリガー設置 |
| `runGA4DailyReport` | トリガー / 手動 | 前日分の全シート更新 |
| `backfillRange(days)` | 手動 | 過去N日分を一括取得・上書き |
| `ensureHeaders` | 手動 / 自動 | 5シートのヘッダ自己修復 |
| `updateDashboardSummary` | 手動 / 自動 | サマリ再計算 |
| `fetchGA4Report` | 内部 | GA4 Data API 共通ラッパー |

## トラブルシューティング

| 症状 | 原因と対処 |
|---|---|
| `GA4_PROPERTY_ID が未設定です` | 冒頭の定数に GA4 プロパティID（数値）を設定 |
| 全イベントが 0 | カスタムディメンションが未登録 / source パラメータが計測されていない |
| `AnalyticsData is not defined` | サービス追加忘れ → 「サービス」から Google Analytics Data API を追加 |
| 同じ日の行が2回入る | `deleteRowsForDate_` が動かない（date列がない）→ ヘッダ確認 |
| 権限承認画面が出続ける | OAuth スコープが追加された → 再承認 |

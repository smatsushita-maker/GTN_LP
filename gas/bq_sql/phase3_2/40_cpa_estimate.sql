-- ============================================================
-- Phase3.2: cpa_estimate — CPA（顧客獲得単価）推計
-- ------------------------------------------------------------
-- 出したい指標:
--   - キャンペーン別 cost / submit_lead_form_users = CPA
--
-- 前提:
--   Google Ads コストデータが BQ に取込まれていること。
--   取込み方法は以下のいずれか:
--     A. GA4 で「コストデータインポート」→ GA4 → BQ Export で events_* に乗る
--     B. Google Ads → BigQuery Data Transfer Service（無料、推奨）
--        → データセット例: `gtn-lp-analytics.google_ads.p_ads_CampaignBasicStats_<CID>`
--     C. CSV を手動アップロード → `gtn-lp-analytics.ads_cost.daily_cost` 等
--
-- 本SQLは方式B（Ads Data Transfer）の標準スキーマを想定。
-- 別方式の場合は ad_cost CTE の SELECT を差し替えてください。
--
-- ※ Google Ads Data Transfer の有効化:
--    https://cloud.google.com/bigquery/docs/google-ads-transfer
--    customer_id 入力後、Daily で 04:00 頃にコストデータが届く
-- ============================================================

DECLARE customer_id INT64 DEFAULT NULL;  -- ← Google Ads アカウントID（例: 1234567890）を設定

WITH
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- (1) Phase3.2 CV ユーザー × campaign
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  cv AS (
    SELECT
      event_date_jst AS date,
      COALESCE(NULLIF(campaign, ''), ga4_traffic_campaign, '(none)') AS campaign,
      COUNT(DISTINCT IF(event_name = 'submit_lead_form', user_pseudo_id, NULL)) AS submit_users,
      COUNT(DISTINCT IF(event_name = 'complete_diagnosis', user_pseudo_id, NULL)) AS complete_users,
      COUNT(DISTINCT IF(event_name = 'start_diagnosis', user_pseudo_id, NULL)) AS start_users
    FROM `gtn-lp-analytics.gtn_analytics.events_phase3_2`
    WHERE event_date_jst BETWEEN DATE_SUB(@run_date, INTERVAL 6 DAY) AND @run_date
      AND (debug_mode_int IS NULL OR debug_mode_int = 0)
    GROUP BY date, campaign
  ),

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- (2) Google Ads コスト（方式B: Data Transfer）
  --     ※ テーブル名が異なる場合はここを書き換える
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ad_cost AS (
    SELECT
      DATE(campaign._DATA_DATE)                    AS date,
      campaign.campaign_name                       AS campaign,
      SUM(campaign.metrics_cost_micros) / 1000000  AS cost_jpy,
      SUM(campaign.metrics_impressions)            AS impressions,
      SUM(campaign.metrics_clicks)                 AS clicks
    FROM `gtn-lp-analytics.google_ads.p_ads_CampaignBasicStats_*` AS campaign
    WHERE campaign._DATA_DATE BETWEEN DATE_SUB(@run_date, INTERVAL 6 DAY) AND @run_date
      AND (customer_id IS NULL OR campaign.customer_id = customer_id)
    GROUP BY date, campaign
  )

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- (3) CPA 算出
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SELECT
  COALESCE(cv.date, ad_cost.date)            AS date,
  COALESCE(cv.campaign, ad_cost.campaign)    AS campaign,
  ad_cost.impressions,
  ad_cost.clicks,
  ad_cost.cost_jpy,
  cv.start_users,
  cv.complete_users,
  cv.submit_users,

  -- CPA 各種
  SAFE_DIVIDE(ad_cost.cost_jpy, cv.submit_users)   AS cpa_submit,        -- 主CPA（フォーム送信ベース）
  SAFE_DIVIDE(ad_cost.cost_jpy, cv.complete_users) AS cpa_complete,      -- 補助CPA（診断完了ベース）
  SAFE_DIVIDE(ad_cost.cost_jpy, cv.start_users)    AS cpa_start,         -- 上流CPA（診断開始ベース）

  -- 比率
  SAFE_DIVIDE(cv.submit_users, ad_cost.clicks)     AS cv_per_click,
  SAFE_DIVIDE(ad_cost.cost_jpy, ad_cost.clicks)    AS cpc
FROM cv
FULL OUTER JOIN ad_cost
  ON cv.date = ad_cost.date AND cv.campaign = ad_cost.campaign
ORDER BY date DESC, cost_jpy DESC
;

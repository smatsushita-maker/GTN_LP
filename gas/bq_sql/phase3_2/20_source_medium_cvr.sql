-- ============================================================
-- Phase3.2: source_medium_cvr — 流入元別CV率
-- ------------------------------------------------------------
-- 集計軸: date × source × medium × campaign
-- 値:
--   - users:                  該当流入元のユニークユーザー数
--   - start_diagnosis_users:  診断開始ユーザー数
--   - complete_diagnosis_users
--   - submit_lead_form_users
--   - cv_rate                = submit_lead_form_users / users
--
-- source/medium/campaign の取得元優先順位:
--   1. trackNewEvent が送る ep.source / ep.medium / ep.campaign（最優先）
--   2. GA4 自動収集 traffic_source.{source,medium,name}（フォールバック）
--
-- Phase3.2 で trackNewEvent を踏んだイベントには必ず①が乗るため、
--   優先①  → フォールバック② で COALESCE
-- ============================================================

WITH
  src AS (
    SELECT
      event_date_jst AS date,
      user_pseudo_id,
      event_name,
      COALESCE(NULLIF(source, ''),   ga4_traffic_source,   '(none)') AS source,
      COALESCE(NULLIF(medium, ''),   ga4_traffic_medium,   '(none)') AS medium,
      COALESCE(NULLIF(campaign, ''), ga4_traffic_campaign, '(none)') AS campaign
    FROM `gtn-lp-analytics.gtn_analytics.events_phase3_2`
    WHERE event_date_jst = @run_date
      AND (debug_mode_int IS NULL OR debug_mode_int = 0)
  ),
  user_first_attr AS (
    -- ユーザー1人につき最初に観測した source/medium/campaign を採用
    SELECT
      date,
      user_pseudo_id,
      ARRAY_AGG(source   ORDER BY event_name LIMIT 1)[OFFSET(0)] AS first_source,
      ARRAY_AGG(medium   ORDER BY event_name LIMIT 1)[OFFSET(0)] AS first_medium,
      ARRAY_AGG(campaign ORDER BY event_name LIMIT 1)[OFFSET(0)] AS first_campaign
    FROM src
    GROUP BY date, user_pseudo_id
  ),
  user_steps AS (
    SELECT
      date,
      user_pseudo_id,
      COUNTIF(event_name = 'start_diagnosis')    > 0 AS did_start,
      COUNTIF(event_name = 'complete_diagnosis') > 0 AS did_complete,
      COUNTIF(event_name = 'submit_lead_form')   > 0 AS did_submit
    FROM src
    GROUP BY date, user_pseudo_id
  )
SELECT
  a.date,
  a.first_source   AS source,
  a.first_medium   AS medium,
  a.first_campaign AS campaign,
  COUNT(DISTINCT a.user_pseudo_id)                              AS users,
  COUNTIF(s.did_start)                                          AS start_diagnosis_users,
  COUNTIF(s.did_complete)                                       AS complete_diagnosis_users,
  COUNTIF(s.did_submit)                                         AS submit_lead_form_users,
  SAFE_DIVIDE(COUNTIF(s.did_start),    COUNT(DISTINCT a.user_pseudo_id)) AS start_rate,
  SAFE_DIVIDE(COUNTIF(s.did_complete), COUNTIF(s.did_start))             AS complete_rate,
  SAFE_DIVIDE(COUNTIF(s.did_submit),   COUNTIF(s.did_complete))          AS submit_rate,
  SAFE_DIVIDE(COUNTIF(s.did_submit),   COUNT(DISTINCT a.user_pseudo_id)) AS cv_rate
FROM user_first_attr a
LEFT JOIN user_steps s
  ON a.date = s.date AND a.user_pseudo_id = s.user_pseudo_id
GROUP BY a.date, a.first_source, a.first_medium, a.first_campaign
ORDER BY a.date DESC, users DESC
;

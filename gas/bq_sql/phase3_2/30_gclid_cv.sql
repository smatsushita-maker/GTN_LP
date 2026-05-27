-- ============================================================
-- Phase3.2: gclid_cv — Google Ads クリックID別CV分析
-- ------------------------------------------------------------
-- 集計軸: date × gclid
-- 値:
--   - first_seen_ts:           初回イベント時刻
--   - last_seen_ts:            最終イベント時刻
--   - source / medium / campaign （イベントペイロードから取得）
--   - did_start_diagnosis:     1=診断開始済 / 0=未
--   - did_complete_diagnosis:  1=診断完了済 / 0=未
--   - did_submit_lead_form:    1=フォーム送信済 / 0=未  ← Google Ads コンバージョン基準
--
-- 想定用途:
--   - Google Ads 側で「未CV gclid」と突き合わせて Enhanced Conversions の
--     Offline Conversion Import に流す
--   - キャンペーン×CV件数の正確な合算（GA4 のサンプリングを回避）
--   - 同一 gclid が複数日にまたがる場合は MIN/MAX で識別
--
-- 集計期間: @run_date 単日（バックフィル時は範囲指定）
-- ============================================================

WITH
  base AS (
    SELECT
      event_date_jst AS date,
      event_ts,
      user_pseudo_id,
      gclid,
      event_name,
      COALESCE(NULLIF(source, ''),   ga4_traffic_source,   '(none)') AS source,
      COALESCE(NULLIF(medium, ''),   ga4_traffic_medium,   '(none)') AS medium,
      COALESCE(NULLIF(campaign, ''), ga4_traffic_campaign, '(none)') AS campaign
    FROM `gtn-lp-analytics.gtn_analytics.events_phase3_2`
    WHERE event_date_jst = @run_date
      AND gclid IS NOT NULL
      AND gclid != ''
      AND (debug_mode_int IS NULL OR debug_mode_int = 0)
  )
SELECT
  date,
  gclid,
  ANY_VALUE(user_pseudo_id)                                    AS user_pseudo_id,
  MIN(event_ts)                                                AS first_seen_ts,
  MAX(event_ts)                                                AS last_seen_ts,
  ARRAY_AGG(source   ORDER BY event_ts LIMIT 1)[OFFSET(0)]     AS source,
  ARRAY_AGG(medium   ORDER BY event_ts LIMIT 1)[OFFSET(0)]     AS medium,
  ARRAY_AGG(campaign ORDER BY event_ts LIMIT 1)[OFFSET(0)]     AS campaign,
  COUNTIF(event_name = 'click_cta')          > 0               AS did_click_cta,
  COUNTIF(event_name = 'start_diagnosis')    > 0               AS did_start_diagnosis,
  COUNTIF(event_name = 'complete_diagnosis') > 0               AS did_complete_diagnosis,
  COUNTIF(event_name = 'submit_lead_form')   > 0               AS did_submit_lead_form,
  COUNT(*)                                                     AS total_events
FROM base
GROUP BY date, gclid
ORDER BY date DESC, did_submit_lead_form DESC, total_events DESC
;

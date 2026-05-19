-- =====================================================================
-- 10_sq_sessions_v2.sql
-- ---------------------------------------------------------------------
-- Phase5.2 + Phase5.2.1 適用済
--
-- Scheduled Query: gtn_build_sessions_daily
--   Schedule:           Every day 04:30 JST (= 19:30 UTC previous day)
--   Destination:        gtn-lp-analytics:gtn_analytics.sessions${run_date|"%Y%m%d"}
--   Write disposition:  WRITE_TRUNCATE (該当 partition のみ atomic 置換)
--   Location:           US
--
-- Phase5.2.1 fix:
--   GA4 自動 source (session_start/first_visit の referrer host) を除外し、
--   GTN カスタムイベント12種の source 値のみから先頭値を抽出する。
-- =====================================================================

WITH
events AS (
  SELECT e.*
  FROM `gtn-lp-analytics.gtn_analytics.events_normalized` e
  WHERE e.event_date = FORMAT_DATE('%Y%m%d', @run_date)
    AND e.user_pseudo_id IS NOT NULL
    AND e.ga_session_id  IS NOT NULL
)
SELECT
  @run_date                                                                                          AS session_date,
  user_pseudo_id,
  ga_session_id,
  MIN(event_ts)                                                                                      AS session_start_ts,
  MAX(event_ts)                                                                                      AS session_end_ts,

  -- Phase5.2.1: GA4 auto-traffic source (referrer host on session_start/first_visit) を除外し、
  --             GTN カスタムイベントの source のみから最先頭値を抽出
  ARRAY_AGG(
    IF(event_name IN (
      'lp_view','cta_click','page_view_lp','page_view_check','industry_selected',
      'result_viewed','form_start','form_submit','lead_captured','consult_click',
      'external_link_click','scroll_depth'
    ), source, NULL)
    IGNORE NULLS ORDER BY event_ts ASC LIMIT 1
  )[SAFE_OFFSET(0)]                                                                                  AS first_source,

  ARRAY_AGG(ref     IGNORE NULLS ORDER BY event_ts ASC LIMIT 1)[SAFE_OFFSET(0)]                      AS first_ref,
  ARRAY_AGG(page_id IGNORE NULLS ORDER BY event_ts ASC LIMIT 1)[SAFE_OFFSET(0)]                      AS first_page_id,
  ANY_VALUE(device_category)                                                                         AS device_category,
  ANY_VALUE(device_os)                                                                               AS device_os,
  ANY_VALUE(country)                                                                                 AS country,
  ANY_VALUE(region)                                                                                  AS region,

  LOGICAL_OR(event_name='lp_view')                                                                   AS had_lp_view,
  LOGICAL_OR(event_name='cta_click' AND cta_location IS NOT NULL)                                    AS had_cta_click,
  LOGICAL_OR(event_name='page_view_lp')                                                              AS had_diag_lp_view,
  LOGICAL_OR(event_name='industry_selected')                                                         AS had_industry_selected,
  LOGICAL_OR(event_name='question_viewed' AND COALESCE(question_num,'1')='1')                        AS had_question_started,
  LOGICAL_OR(event_name='diagnosis_complete')                                                        AS had_diagnosis_complete,
  LOGICAL_OR(event_name='result_viewed')                                                             AS had_result_view,
  LOGICAL_OR(event_name='form_start')                                                                AS had_form_start,
  LOGICAL_OR(event_name='form_submit')                                                               AS had_form_submit,
  LOGICAL_OR(event_name='lead_captured')                                                             AS had_lead_captured,
  LOGICAL_OR(event_name='consult_click')                                                             AS had_consult_click,

  ANY_VALUE(IF(industry IS NOT NULL, industry, NULL))                                                AS industry,
  ANY_VALUE(IF(rating   IS NOT NULL, rating,   NULL))                                                AS rating,
  COUNT(*)                                                                                           AS event_count
FROM events
GROUP BY user_pseudo_id, ga_session_id

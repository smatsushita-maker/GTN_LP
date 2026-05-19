-- =====================================================================
-- 13_sq_cta_funnel_daily.sql
-- ---------------------------------------------------------------------
-- Scheduled Query: gtn_build_cta_funnel_daily
--   Schedule:           Every day 05:30 JST (= 20:30 UTC previous day)
--   Destination:        gtn-lp-analytics:gtn_analytics.cta_funnel_daily${run_date|"%Y%m%d"}
--   Write disposition:  WRITE_TRUNCATE
--   Location:           US
--
-- Depends on:
--   - events_normalized (for last_cta_location per session)
--   - sessions          (must be built first via gtn_build_sessions_daily at 04:30)
--
-- Funnel steps (step_order):
--   1. cta_click
--   2. industry_selected
--   3. question_started
--   4. diagnosis_complete
--   5. result_view
--   6. form_start
--   7. lead_captured
--   8. consult_click
-- =====================================================================

WITH
events AS (
  SELECT e.*
  FROM `gtn-lp-analytics.gtn_analytics.events_normalized` e
  WHERE e.event_date = FORMAT_DATE('%Y%m%d', @run_date)
),
session_last_cta AS (
  SELECT
    user_pseudo_id,
    ga_session_id,
    ARRAY_AGG(cta_location ORDER BY event_ts DESC LIMIT 1)[SAFE_OFFSET(0)] AS last_cta_location
  FROM events
  WHERE event_name = 'cta_click' AND cta_location IS NOT NULL
  GROUP BY 1, 2
),
attributed_sessions AS (
  SELECT
    s.user_pseudo_id,
    s.ga_session_id,
    slc.last_cta_location,
    s.had_cta_click,          s.had_industry_selected, s.had_question_started,
    s.had_diagnosis_complete, s.had_result_view,
    s.had_form_start,         s.had_lead_captured,     s.had_consult_click
  FROM `gtn-lp-analytics.gtn_analytics.sessions` s
  INNER JOIN session_last_cta slc
    ON s.user_pseudo_id = slc.user_pseudo_id
   AND s.ga_session_id  = slc.ga_session_id
  WHERE s.session_date = @run_date
    AND slc.last_cta_location IS NOT NULL
),
unpivoted AS (
  SELECT last_cta_location, 'cta_click'          AS step, 1 AS step_order, COUNTIF(had_cta_click)          AS sessions FROM attributed_sessions GROUP BY 1
  UNION ALL
  SELECT last_cta_location, 'industry_selected',         2,                COUNTIF(had_industry_selected)         FROM attributed_sessions GROUP BY 1
  UNION ALL
  SELECT last_cta_location, 'question_started',          3,                COUNTIF(had_question_started)          FROM attributed_sessions GROUP BY 1
  UNION ALL
  SELECT last_cta_location, 'diagnosis_complete',        4,                COUNTIF(had_diagnosis_complete)        FROM attributed_sessions GROUP BY 1
  UNION ALL
  SELECT last_cta_location, 'result_view',               5,                COUNTIF(had_result_view)               FROM attributed_sessions GROUP BY 1
  UNION ALL
  SELECT last_cta_location, 'form_start',                6,                COUNTIF(had_form_start)                FROM attributed_sessions GROUP BY 1
  UNION ALL
  SELECT last_cta_location, 'lead_captured',             7,                COUNTIF(had_lead_captured)             FROM attributed_sessions GROUP BY 1
  UNION ALL
  SELECT last_cta_location, 'consult_click',             8,                COUNTIF(had_consult_click)             FROM attributed_sessions GROUP BY 1
)
SELECT
  @run_date                                                                                                       AS date,
  last_cta_location                                                                                               AS cta_location,
  step,
  step_order,
  sessions,
  SAFE_DIVIDE(sessions, LAG(sessions) OVER (PARTITION BY last_cta_location ORDER BY step_order))                  AS conversion_rate_from_previous,
  SAFE_DIVIDE(sessions, FIRST_VALUE(sessions) OVER (PARTITION BY last_cta_location ORDER BY step_order))          AS conversion_rate_from_cta_click
FROM unpivoted

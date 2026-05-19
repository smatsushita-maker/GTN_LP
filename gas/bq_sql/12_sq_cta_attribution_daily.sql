-- =====================================================================
-- 12_sq_cta_attribution_daily.sql
-- ---------------------------------------------------------------------
-- Scheduled Query: gtn_build_cta_attribution_summary_daily
--   Schedule:           Every day 05:15 JST (= 20:15 UTC previous day)
--   Destination:        gtn-lp-analytics:gtn_analytics.cta_attribution_daily${run_date|"%Y%m%d"}
--   Write disposition:  WRITE_TRUNCATE
--   Location:           US
--
-- Depends on:
--   - events_normalized (for cta_click counts)
--   - cta_attribution   (must be built first via gtn_build_cta_attribution_daily at 05:00)
--
-- Used by:
--   - Looker Studio (primary data source)
-- =====================================================================

WITH
events AS (
  SELECT e.*
  FROM `gtn-lp-analytics.gtn_analytics.events_normalized` e
  WHERE e.event_date = FORMAT_DATE('%Y%m%d', @run_date)
),
cta_clicks_agg AS (
  SELECT
    cta_location,
    source,
    COUNT(*)                                                                          AS clicks,
    COUNT(DISTINCT CONCAT(user_pseudo_id, '|', CAST(ga_session_id AS STRING)))        AS sessions_with_click
  FROM events
  WHERE event_name = 'cta_click' AND cta_location IS NOT NULL
  GROUP BY 1, 2
),
attributed AS (
  SELECT
    last_cta_location                                                                 AS cta_location,
    source,
    industry,
    COUNT(*)                                                                          AS attributed_leads,
    COUNTIF(consult_clicked_same_session)                                             AS attributed_consults
  FROM `gtn-lp-analytics.gtn_analytics.cta_attribution`
  WHERE lead_date = @run_date
    AND last_cta_location IS NOT NULL
  GROUP BY 1, 2, 3
)
SELECT
  @run_date                                                                           AS date,
  COALESCE(c.cta_location, a.cta_location)                                            AS cta_location,
  COALESCE(c.source,       a.source)                                                  AS source,
  a.industry                                                                          AS industry,
  IFNULL(c.clicks,              0)                                                    AS clicks,
  IFNULL(c.sessions_with_click, 0)                                                    AS sessions_with_click,
  IFNULL(a.attributed_leads,    0)                                                    AS attributed_leads,
  IFNULL(a.attributed_consults, 0)                                                    AS attributed_consults,
  SAFE_DIVIDE(a.attributed_leads, c.sessions_with_click)                              AS true_cvr_session,
  SAFE_DIVIDE(a.attributed_leads, c.clicks)                                           AS true_cvr_click
FROM cta_clicks_agg c
FULL OUTER JOIN attributed a USING (cta_location, source)

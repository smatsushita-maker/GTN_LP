-- =====================================================================
-- 11_sq_cta_attribution.sql
-- ---------------------------------------------------------------------
-- Scheduled Query: gtn_build_cta_attribution_daily
--   Schedule:           Every day 05:00 JST (= 20:00 UTC previous day)
--   Destination:        gtn-lp-analytics:gtn_analytics.cta_attribution${run_date|"%Y%m%d"}
--   Write disposition:  WRITE_TRUNCATE
--   Location:           US
--
-- Attribution model:
--   Last-click in same ga_session_id, with cta_location IS NOT NULL
--   (旧 schema diagnosis-LP cta_click は cta_location NULL のため除外される)
-- =====================================================================

WITH
events AS (
  SELECT e.*
  FROM `gtn-lp-analytics.gtn_analytics.events_normalized` e
  WHERE e.event_date = FORMAT_DATE('%Y%m%d', @run_date)
),
ctas AS (
  SELECT user_pseudo_id, ga_session_id, event_ts, cta_location
  FROM events
  WHERE event_name = 'cta_click' AND cta_location IS NOT NULL
),
leads AS (
  SELECT user_pseudo_id, ga_session_id, event_ts AS lead_ts, source, ref, rating
  FROM events
  WHERE event_name = 'lead_captured'
),
industry_per_session AS (
  SELECT user_pseudo_id, ga_session_id, ANY_VALUE(industry) AS industry
  FROM events
  WHERE industry IS NOT NULL
  GROUP BY 1, 2
),
consults AS (
  SELECT user_pseudo_id, ga_session_id, MIN(event_ts) AS consult_ts
  FROM events
  WHERE event_name = 'consult_click'
  GROUP BY 1, 2
),
ctas_agg AS (
  SELECT
    user_pseudo_id, ga_session_id,
    ARRAY_AGG(STRUCT(event_ts, cta_location) ORDER BY event_ts) AS arr,
    COUNT(*)                                                    AS cnt
  FROM ctas
  GROUP BY 1, 2
)
SELECT
  @run_date                                                                                            AS lead_date,
  l.user_pseudo_id,
  l.ga_session_id,
  l.lead_ts,
  (SELECT c.cta_location FROM UNNEST(ca.arr) c
     WHERE c.event_ts <= l.lead_ts
     ORDER BY c.event_ts DESC LIMIT 1)                                                                 AS last_cta_location,
  (SELECT c.event_ts FROM UNNEST(ca.arr) c
     WHERE c.event_ts <= l.lead_ts
     ORDER BY c.event_ts DESC LIMIT 1)                                                                 AS last_cta_ts,
  (SELECT c.cta_location FROM UNNEST(ca.arr) c
     ORDER BY c.event_ts ASC LIMIT 1)                                                                  AS first_cta_location,
  IFNULL(ca.cnt, 0)                                                                                    AS cta_click_count,
  l.source,
  l.ref,
  ip.industry,
  l.rating,
  cs.user_pseudo_id IS NOT NULL                                                                        AS consult_clicked_same_session,
  cs.consult_ts
FROM leads l
LEFT JOIN ctas_agg             ca USING (user_pseudo_id, ga_session_id)
LEFT JOIN industry_per_session ip USING (user_pseudo_id, ga_session_id)
LEFT JOIN consults             cs USING (user_pseudo_id, ga_session_id)

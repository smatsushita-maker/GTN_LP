-- =====================================================================
-- 03_table_cta_attribution_daily.sql
-- ---------------------------------------------------------------------
-- Phase5.2: cta_attribution_daily TABLE
--           (CTA × source × industry × date の集計、Looker Studio 主データソース)
--
-- Partition:  date (DAY)
-- Clustering: cta_location, source
-- =====================================================================

CREATE TABLE IF NOT EXISTS `gtn-lp-analytics.gtn_analytics.cta_attribution_daily`
(
  date                  DATE    NOT NULL,
  cta_location          STRING,
  source                STRING,
  industry              STRING,
  clicks                INT64,
  sessions_with_click   INT64,
  attributed_leads      INT64,
  attributed_consults   INT64,
  true_cvr_session      FLOAT64,
  true_cvr_click        FLOAT64
)
PARTITION BY date
CLUSTER BY cta_location, source
OPTIONS (
  description = "Daily aggregation of CTA performance. Phase5.2. Looker Studio primary source."
)

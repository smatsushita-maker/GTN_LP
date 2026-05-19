-- =====================================================================
-- 02_table_cta_attribution.sql
-- ---------------------------------------------------------------------
-- Phase5.2: cta_attribution TABLE (1 row = 1 lead_captured event)
--
-- Partition:  lead_date (DAY)
-- Clustering: last_cta_location, source
-- ---------------------------------------------------------------------
-- 各 lead_captured イベントに対し、同一 ga_session_id 内で時系列的に直前の
-- cta_click (cta_location IS NOT NULL) を last-click attribution で紐付ける。
-- =====================================================================

CREATE TABLE IF NOT EXISTS `gtn-lp-analytics.gtn_analytics.cta_attribution`
(
  lead_date                       DATE      NOT NULL,
  user_pseudo_id                  STRING    NOT NULL,
  ga_session_id                   INT64     NOT NULL,
  lead_ts                         TIMESTAMP NOT NULL,
  last_cta_location               STRING,
  last_cta_ts                     TIMESTAMP,
  first_cta_location              STRING,
  cta_click_count                 INT64,
  source                          STRING,
  ref                             STRING,
  industry                        STRING,
  rating                          STRING,
  consult_clicked_same_session    BOOL,
  consult_ts                      TIMESTAMP
)
PARTITION BY lead_date
CLUSTER BY last_cta_location, source
OPTIONS (
  description = "1 row = 1 lead_captured event with last-click CTA attribution. Phase5.2."
)

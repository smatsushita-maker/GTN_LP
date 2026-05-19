-- =====================================================================
-- 04_table_cta_funnel_daily.sql
-- ---------------------------------------------------------------------
-- Phase5.2: cta_funnel_daily TABLE
--           (CTA別ファネル各ステップのセッション数)
--
-- Partition:  date (DAY)
-- Clustering: cta_location, step
-- ---------------------------------------------------------------------
-- step:
--   1. cta_click
--   2. industry_selected
--   3. question_started
--   4. diagnosis_complete
--   5. result_view
--   6. form_start
--   7. lead_captured
--   8. consult_click
-- =====================================================================

CREATE TABLE IF NOT EXISTS `gtn-lp-analytics.gtn_analytics.cta_funnel_daily`
(
  date                            DATE    NOT NULL,
  cta_location                    STRING  NOT NULL,
  step                            STRING  NOT NULL,
  step_order                      INT64,
  sessions                        INT64,
  conversion_rate_from_previous   FLOAT64,
  conversion_rate_from_cta_click  FLOAT64
)
PARTITION BY date
CLUSTER BY cta_location, step
OPTIONS (
  description = "Per-CTA funnel step session counts. Phase5.2. step: cta_click->industry_selected->question_started->diagnosis_complete->result_view->form_start->lead_captured->consult_click"
)

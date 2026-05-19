-- =====================================================================
-- 01_table_sessions.sql
-- ---------------------------------------------------------------------
-- Phase5.2: sessions TABLE (1 row = 1 ga_session_id)
--
-- Partition:  session_date (DAY)
-- Clustering: first_source, device_category
-- ---------------------------------------------------------------------
-- 安全のため CREATE TABLE IF NOT EXISTS。既存テーブルへの DROP/REPLACE は行わない。
-- =====================================================================

CREATE TABLE IF NOT EXISTS `gtn-lp-analytics.gtn_analytics.sessions`
(
  session_date           DATE      NOT NULL,
  user_pseudo_id         STRING    NOT NULL,
  ga_session_id          INT64     NOT NULL,
  session_start_ts       TIMESTAMP,
  session_end_ts         TIMESTAMP,
  first_source           STRING,
  first_ref              STRING,
  first_page_id          STRING,
  device_category        STRING,
  device_os              STRING,
  country                STRING,
  region                 STRING,
  had_lp_view            BOOL,
  had_cta_click          BOOL,
  had_diag_lp_view       BOOL,
  had_industry_selected  BOOL,
  had_question_started   BOOL,
  had_diagnosis_complete BOOL,
  had_result_view        BOOL,
  had_form_start         BOOL,
  had_form_submit        BOOL,
  had_lead_captured      BOOL,
  had_consult_click      BOOL,
  industry               STRING,
  rating                 STRING,
  event_count            INT64
)
PARTITION BY session_date
CLUSTER BY first_source, device_category
OPTIONS (
  description = "1 row = 1 ga_session_id. Built daily from events_normalized. Phase5.2."
)

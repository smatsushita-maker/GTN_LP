-- ============================================================
-- Phase3.2: events_phase3_2 VIEW
-- ------------------------------------------------------------
-- GA4 BigQuery Export の raw events_* から、Phase3.2 で追加した
-- 4種カスタムイベントと共通パラメータ（gclid / utm_* / session_id /
-- diagnosis_result_type / debug_mode）を抽出した normalized VIEW。
--
-- 既存の Phase5 系 events_normalized とは独立。
-- Phase3.2 専用集計（funnel_daily / source_medium_cvr / gclid_cv / cpa）
-- が共通で参照する。
--
-- 配置: gtn-lp-analytics.gtn_analytics.events_phase3_2
-- 種別: CREATE OR REPLACE VIEW（差し替え時の影響は依存テーブルの再生成のみ）
-- 依存: gtn-lp-analytics.analytics_531281503.events_* （GA4 Daily Export）
-- ============================================================

CREATE OR REPLACE VIEW `gtn-lp-analytics.gtn_analytics.events_phase3_2` AS
SELECT
  -- 時刻系
  TIMESTAMP_MICROS(event_timestamp)                                          AS event_ts,
  DATE(TIMESTAMP_MICROS(event_timestamp), 'Asia/Tokyo')                      AS event_date_jst,
  PARSE_DATE('%Y%m%d', event_date)                                           AS event_date_utc,

  -- 識別子
  user_pseudo_id,
  (SELECT value.int_value
     FROM UNNEST(event_params)
     WHERE key = 'ga_session_id')                                            AS ga_session_id,
  event_name,

  -- Phase3.2 共通パラメータ（trackNewEvent 経由のイベントに付与）
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_path')             AS page_path,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'source')                AS source,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'medium')                AS medium,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'campaign')              AS campaign,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'gclid')                 AS gclid,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'session_id')            AS app_session_id,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'diagnosis_result_type') AS diagnosis_result_type,

  -- イベント固有パラメータ
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'cta_location')          AS cta_location,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'destination')           AS destination,
  (SELECT value.int_value    FROM UNNEST(event_params) WHERE key = 'score')                 AS score,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'fallback')              AS fallback_str,
  (SELECT value.int_value    FROM UNNEST(event_params) WHERE key = 'debug_mode')            AS debug_mode_int,

  -- GA4 自動収集（attribution 比較用）
  traffic_source.source                                                     AS ga4_traffic_source,
  traffic_source.medium                                                     AS ga4_traffic_medium,
  traffic_source.name                                                       AS ga4_traffic_campaign,

  -- デバイス
  device.category                                                           AS device_category,
  geo.country                                                               AS country
FROM
  `gtn-lp-analytics.analytics_531281503.events_*`
WHERE
  -- intraday も含めるなら events_intraday_* を別途 UNION ALL する
  _TABLE_SUFFIX BETWEEN
    FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE('Asia/Tokyo'), INTERVAL 90 DAY))
    AND FORMAT_DATE('%Y%m%d', CURRENT_DATE('Asia/Tokyo'))
;

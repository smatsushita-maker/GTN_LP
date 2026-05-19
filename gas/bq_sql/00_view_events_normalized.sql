-- =====================================================================
-- 00_view_events_normalized.sql
-- ---------------------------------------------------------------------
-- Phase5.2: events_normalized VIEW
--
-- Purpose:
--   GA4 events_* テーブルから event_params を展開した正規化レイヤ。
--   後続の sessions / cta_attribution / cta_attribution_daily /
--   cta_funnel_daily の Scheduled Query すべての基礎になる。
--
-- Cost safety:
--   _TABLE_SUFFIX で rolling 90日に制限。CURRENT_DATE('Asia/Tokyo') 起点。
--   VIEW を参照するクエリ側で event_date を絞ればさらに 1 日分にプルーン可。
--
-- Custom dimensions:
--   GA4 admin で event-scoped カスタムディメンションとして以下を登録済前提:
--     source, ref, page_id, cta_location, destination, location,
--     url, position, percent, rating, industry, field, reason,
--     question_num, ga_session_id, ga_session_number
-- =====================================================================

CREATE OR REPLACE VIEW `gtn-lp-analytics.gtn_analytics.events_normalized` AS
SELECT
  event_date,
  TIMESTAMP_MICROS(event_timestamp)                                                 AS event_ts,
  event_name,
  user_pseudo_id,
  (SELECT value.int_value    FROM UNNEST(event_params) WHERE key='ga_session_id')   AS ga_session_id,
  (SELECT value.int_value    FROM UNNEST(event_params) WHERE key='ga_session_number')AS ga_session_number,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key='source')          AS source,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key='ref')             AS ref,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key='page_id')         AS page_id,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key='cta_location')    AS cta_location,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key='destination')     AS destination,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key='location')        AS consult_location,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key='url')             AS link_url,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key='position')        AS position,
  (SELECT value.int_value    FROM UNNEST(event_params) WHERE key='percent')         AS percent,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key='rating')          AS rating,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key='industry')        AS industry,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key='field')           AS form_error_field,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key='reason')          AS form_error_reason,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key='question_num')    AS question_num,
  device.category                                                                   AS device_category,
  device.operating_system                                                           AS device_os,
  geo.country                                                                       AS country,
  geo.region                                                                        AS region
FROM `gtn-lp-analytics.analytics_531281503.events_*`
WHERE _TABLE_SUFFIX BETWEEN
  FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE('Asia/Tokyo'), INTERVAL 90 DAY))
  AND FORMAT_DATE('%Y%m%d', CURRENT_DATE('Asia/Tokyo'))

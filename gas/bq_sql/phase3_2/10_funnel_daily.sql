-- ============================================================
-- Phase3.2: funnel_daily — 日次ユーザーファネル
-- ------------------------------------------------------------
-- 出したい指標:
--   - LP流入数
--   - 診断開始率 = start_diagnosis / lp_view
--   - 診断完了率 = complete_diagnosis / start_diagnosis
--   - フォーム送信率 = submit_lead_form / complete_diagnosis
--   - 総合CVR = submit_lead_form / lp_view
--
-- 集計単位: 1日 × 1 user_pseudo_id（同一ユーザーの重複発火は除外）
-- complete_diagnosis の fallback 重複（check.html と result.html 両方発火）
--   は user_pseudo_id ベースで DISTINCT するため自動的に合算1件扱い
--
-- 期待される件数順序:
--   lp_view ≥ click_cta ≥ start_diagnosis ≥ complete_diagnosis ≥ submit_lead_form
--
-- ※ click_cta は LP のみではなく結果ページCTA等も含むため、
--   入口ファネルとしては start_diagnosis を起点に解釈推奨
--
-- 配置例:
--   - Scheduled Query 宛先: gtn_analytics.funnel_daily_phase3_2${run_date|"%Y%m%d"}
--   - Write Disposition:   WRITE_TRUNCATE
--   - パラメータ:           @run_date DATE （デフォルトは前日）
-- ============================================================

WITH
  -- 当該日のイベント抽出
  src AS (
    SELECT
      event_date_jst AS date,
      user_pseudo_id,
      event_name
    FROM `gtn-lp-analytics.gtn_analytics.events_phase3_2`
    WHERE event_date_jst = @run_date
      -- debug_mode 付きのイベントは本番計測から除外（QA トラフィック）
      AND (debug_mode_int IS NULL OR debug_mode_int = 0)
  ),
  -- ユーザー × イベント種別ベースで一意化
  user_events AS (
    SELECT
      date,
      user_pseudo_id,
      COUNTIF(event_name = 'page_view') > 0      AS did_page_view,
      COUNTIF(event_name = 'click_cta') > 0      AS did_click_cta,
      COUNTIF(event_name = 'start_diagnosis') > 0   AS did_start_diagnosis,
      COUNTIF(event_name = 'complete_diagnosis') > 0 AS did_complete_diagnosis,
      COUNTIF(event_name = 'submit_lead_form') > 0   AS did_submit_lead_form
    FROM src
    GROUP BY date, user_pseudo_id
  )
SELECT
  date,
  COUNTIF(did_page_view)          AS lp_view_users,
  COUNTIF(did_click_cta)          AS click_cta_users,
  COUNTIF(did_start_diagnosis)    AS start_diagnosis_users,
  COUNTIF(did_complete_diagnosis) AS complete_diagnosis_users,
  COUNTIF(did_submit_lead_form)   AS submit_lead_form_users,

  -- ステップ間遷移率
  SAFE_DIVIDE(COUNTIF(did_click_cta),          COUNTIF(did_page_view))          AS lp_to_cta_rate,
  SAFE_DIVIDE(COUNTIF(did_start_diagnosis),    COUNTIF(did_page_view))          AS lp_to_start_rate,
  SAFE_DIVIDE(COUNTIF(did_complete_diagnosis), COUNTIF(did_start_diagnosis))    AS start_to_complete_rate,
  SAFE_DIVIDE(COUNTIF(did_submit_lead_form),   COUNTIF(did_complete_diagnosis)) AS complete_to_submit_rate,

  -- 主CV率（LP流入→フォーム送信）
  SAFE_DIVIDE(COUNTIF(did_submit_lead_form),   COUNTIF(did_page_view))          AS overall_cv_rate
FROM user_events
GROUP BY date
ORDER BY date DESC
;

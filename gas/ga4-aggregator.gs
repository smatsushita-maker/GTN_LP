/**
 * GTN LP - GA4 Funnel Aggregator (Phase3.1)
 * ============================================================
 * GA4 Data API から日次でイベントを取得し、Google Sheets に蓄積。
 * Looker Studio から直接接続できる構造で出力する。
 *
 * セットアップ手順:
 *   1) GA4_PROPERTY_ID を設定（GA4管理画面 → プロパティ設定 → プロパティID 数値）
 *   2) Apps Script エディタ → サービス（＋）→ "Google Analytics Data API" を追加
 *   3) このスクリプトを Spreadsheet に紐付け（Spreadsheet → 拡張機能 → Apps Script）
 *   4) setupGA4Trigger() を一度実行 → 日次 04:00 JST に runGA4DailyReport が走る
 *   5) 動作確認: runGA4DailyReport() を手動実行
 *
 * 注意:
 *   - GA4 のカスタムディメンション（source, cta_location, percent, field, reason 等）が
 *     GA4 管理画面で「イベントスコープ」で登録されていること
 *   - 未登録の customEvent:* は空配列を返すため処理は止まらないが値が拾えない
 * ============================================================
 */

/* =========================================================
   定数: 環境設定
   ========================================================= */
const GA4_PROPERTY_ID = '';   // ← GA4 プロパティID（数値）を設定
const SPREADSHEET_ID  = '';   // 空欄なら getActiveSpreadsheet() を使用

/* =========================================================
   定数: シート / イベント / CTA
   ========================================================= */
const SHEET = {
  RAW:        'raw_events',
  CVR:        'funnel_cvr',
  CTA:        'cta_analysis',
  FORM_ERR:   'form_error_breakdown',
  DASHBOARD:  'dashboard_summary',
};

// raw_events 列順（順序はヘッダ生成に使用）
const RAW_COLUMNS = [
  'date', 'source',
  'lp_view', 'cta_click', 'diag_lp_view',
  'industry_selected', 'question_started', 'diagnosis_complete', 'result_view',
  'form_start', 'form_submit', 'lead_captured',
  'consult_click', 'external_link_click',
  'scroll_25', 'scroll_50', 'scroll_75', 'scroll_100',
];

// GA4 のイベント名 → raw_events 列名の対応
const EVENT_TO_COL = {
  lp_view:             'lp_view',
  cta_click:           'cta_click',
  page_view_lp:        'diag_lp_view',     // 診断LP到達
  industry_selected:   'industry_selected',
  question_viewed:     'question_started', // q1 だけを別途絞る
  diagnosis_complete:  'diagnosis_complete',
  result_viewed:       'result_view',
  form_start:          'form_start',
  form_submit:         'form_submit',
  lead_captured:       'lead_captured',
  consult_click:       'consult_click',
  external_link_click: 'external_link_click',
};

const SCROLL_THRESHOLDS = [25, 50, 75, 100];

// CTA 位置（cta_analysis シートの初期セット用。新規CTAは自動で追加される）
const KNOWN_CTA_LOCATIONS = ['header', 'hero', 'hero_sp', 'risk', 'middle', 'reason', 'final'];

const FUNNEL_CVR_COLUMNS = [
  'date', 'source',
  'LP_to_diag_rate', 'diag_to_question_rate', 'question_complete_rate',
  'result_to_form_rate', 'form_submit_rate', 'consult_rate',
  'total_cvr',
];

const CTA_COLUMNS = [
  'date', 'cta_location', 'clicks',
  'downstream_leads', 'downstream_consults', 'lead_cvr',
];

const FORM_ERR_COLUMNS = ['date', 'field', 'reason', 'count'];

const TIMEZONE = 'Asia/Tokyo';

/* =========================================================
   PUBLIC: エントリポイント
   ========================================================= */

/**
 * 日次バッチ本体。Trigger から呼ばれる。
 * 手動実行も可（Apps Script エディタ → 関数選択 → 実行）。
 */
function runGA4DailyReport() {
  const dateStr = yesterdayStr_();
  try {
    Logger.log('[GA4Agg] start: ' + dateStr);
    ensureHeaders();

    writeRawEvents_(dateStr);
    writeFunnelCvr_(dateStr);
    writeCtaAnalysis_(dateStr);
    writeFormErrorBreakdown_(dateStr);
    updateDashboardSummary();

    // Phase3.2: 異常検知 → Slack 通知（失敗してもバッチ全体は止めない）
    checkAnomaliesAndNotify();

    Logger.log('[GA4Agg] done: ' + dateStr);
  } catch (err) {
    Logger.log('[GA4Agg] ERROR: ' + err + '\n' + (err && err.stack));
    throw err;
  }
}

/**
 * 過去N日分を一括バックフィル（初回構築や欠損補完用）。
 *   backfillRange(30) で過去30日分を再取得・上書き。
 */
function backfillRange(days) {
  ensureHeaders();
  const n = Number(days) || 7;
  for (let i = n; i >= 1; i--) {
    const dateStr = dateStrDaysAgo_(i);
    try {
      Logger.log('[GA4Agg] backfill ' + dateStr);
      writeRawEvents_(dateStr);
      writeFunnelCvr_(dateStr);
      writeCtaAnalysis_(dateStr);
      writeFormErrorBreakdown_(dateStr);
    } catch (err) {
      Logger.log('[GA4Agg] backfill ERROR ' + dateStr + ': ' + err);
    }
  }
  updateDashboardSummary();
}

/**
 * 日次 04:00 JST トリガーを設置する。多重設置を防ぐため既存のものは削除。
 */
function setupGA4Trigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach((t) => {
    if (t.getHandlerFunction() === 'runGA4DailyReport') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('runGA4DailyReport')
    .timeBased()
    .everyDays(1)
    .atHour(4)
    .inTimezone(TIMEZONE)
    .create();
  Logger.log('[GA4Agg] daily trigger installed at 04:00 ' + TIMEZONE);
}

/**
 * 全シートのヘッダ存在を保証（欠損なら自動補修）。
 * 毎回 runGA4DailyReport から呼ばれるが、単独でも実行可。
 */
function ensureHeaders() {
  const ss = getSpreadsheet_();
  setHeadersIfMissing_(ss, SHEET.RAW,      RAW_COLUMNS);
  setHeadersIfMissing_(ss, SHEET.CVR,      FUNNEL_CVR_COLUMNS);
  setHeadersIfMissing_(ss, SHEET.CTA,      CTA_COLUMNS);
  setHeadersIfMissing_(ss, SHEET.FORM_ERR, FORM_ERR_COLUMNS);
  // dashboard_summary はラベル/値の2列構造（updateDashboardSummary で都度書き換え）
  getOrCreateSheet_(ss, SHEET.DASHBOARD);
}

/* =========================================================
   GA4 Data API 呼び出し（共通ラッパー）
   ========================================================= */

/**
 * GA4 Data API runReport の薄いラッパー。
 *
 * @param {Object} body  リクエストボディ（dimensions / metrics / dateRanges / dimensionFilter 等）
 * @returns {Object[]}   各行を { dimensions:[], metrics:[] } に整形した配列
 */
function fetchGA4Report(body) {
  if (!GA4_PROPERTY_ID) {
    throw new Error('GA4_PROPERTY_ID が未設定です');
  }
  const res = AnalyticsData.Properties.runReport(body, 'properties/' + GA4_PROPERTY_ID);
  if (!res || !res.rows) return [];
  return res.rows.map((r) => ({
    dimensions: (r.dimensionValues || []).map((d) => d.value),
    metrics:    (r.metricValues    || []).map((m) => Number(m.value || 0)),
  }));
}

/* =========================================================
   Sheet1: raw_events
   ========================================================= */

function writeRawEvents_(dateStr) {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(SHEET.RAW);
  deleteRowsForDate_(sheet, 'date', dateStr);

  // ① イベント × source の縦持ち取得
  const eventRows = fetchGA4Report({
    dateRanges: [{ startDate: dateStr, endDate: dateStr }],
    dimensions: [
      { name: 'eventName' },
      { name: 'customEvent:source' },
    ],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: {
      filter: {
        fieldName: 'eventName',
        inListFilter: { values: Object.keys(EVENT_TO_COL) },
      },
    },
  });

  // ② question_viewed のうち question_num=1 だけを「質問開始」として絞る
  //    （カスタムディメンション question_num が無くても、全 question_viewed の最低値=
  //     1問目を見たユーザー数の近似として後段でフィルタ）
  //    Phase3.1 では q1 を question_started として扱う。
  //    （question_num ディメンション未登録の環境では all question_viewed が混入する点に注意）
  const q1Rows = fetchGA4Report({
    dateRanges: [{ startDate: dateStr, endDate: dateStr }],
    dimensions: [
      { name: 'eventName' },
      { name: 'customEvent:source' },
      { name: 'customEvent:question_num' },
    ],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: {
      andGroup: { expressions: [
        { filter: { fieldName: 'eventName',                 stringFilter: { value: 'question_viewed' } } },
        { filter: { fieldName: 'customEvent:question_num',  stringFilter: { value: '1' } } },
      ] },
    },
  });

  // ③ scroll_depth × percent × source
  const scrollRows = fetchGA4Report({
    dateRanges: [{ startDate: dateStr, endDate: dateStr }],
    dimensions: [
      { name: 'customEvent:percent' },
      { name: 'customEvent:source' },
    ],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: {
      filter: {
        fieldName: 'eventName',
        stringFilter: { value: 'scroll_depth' },
      },
    },
  });

  // ④ (date, source) ごとの行に集約
  const bySource = {};
  const ensure = (src) => {
    const key = src || 'direct';
    if (!bySource[key]) {
      bySource[key] = { date: dateStr, source: key };
      RAW_COLUMNS.forEach((c) => { if (c !== 'date' && c !== 'source') bySource[key][c] = 0; });
    }
    return bySource[key];
  };

  // メインイベントを列に詰める
  eventRows.forEach((row) => {
    const [eventName, source] = row.dimensions;
    const count = row.metrics[0];
    const col = EVENT_TO_COL[eventName];
    if (!col) return;
    if (col === 'question_started') return; // q1 だけは別途処理
    ensure(source)[col] += count;
  });

  // question_started は q1Rows から
  q1Rows.forEach((row) => {
    const [, source] = row.dimensions; // [eventName, source, question_num]
    const count = row.metrics[0];
    ensure(source).question_started += count;
  });

  // scroll_depth を percent 別列に
  scrollRows.forEach((row) => {
    const [percent, source] = row.dimensions;
    const count = row.metrics[0];
    const p = Number(percent);
    if (!SCROLL_THRESHOLDS.includes(p)) return;
    ensure(source)['scroll_' + p] += count;
  });

  // 書き出し
  const rowsOut = Object.values(bySource).map((obj) => RAW_COLUMNS.map((c) => obj[c]));
  if (rowsOut.length === 0) {
    Logger.log('[GA4Agg] no raw_events rows for ' + dateStr);
    return;
  }
  appendRows_(sheet, rowsOut);
}

/* =========================================================
   Sheet2: funnel_cvr （raw_events から導出）
   ========================================================= */

function writeFunnelCvr_(dateStr) {
  const ss = getSpreadsheet_();
  const raw = readSheetAsObjects_(ss.getSheetByName(SHEET.RAW), RAW_COLUMNS);
  const target = raw.filter((r) => String(r.date) === dateStr);

  const sheet = ss.getSheetByName(SHEET.CVR);
  deleteRowsForDate_(sheet, 'date', dateStr);
  if (target.length === 0) return;

  const rowsOut = target.map((r) => {
    const lpToDiag       = safeDiv_(r.diag_lp_view,        r.lp_view);
    const diagToQuestion = safeDiv_(r.industry_selected,   r.diag_lp_view); // 業種選択を質問開始の前段とする
    const questionComplete = safeDiv_(r.diagnosis_complete, r.question_started);
    const resultToForm   = safeDiv_(r.form_start,          r.result_view);
    const formSubmit     = safeDiv_(r.lead_captured,       r.form_start);
    const consultRate    = safeDiv_(r.consult_click,       r.result_view);
    const totalCvr       = safeDiv_(r.lead_captured,       r.lp_view);

    return [
      r.date, r.source,
      lpToDiag, diagToQuestion, questionComplete,
      resultToForm, formSubmit, consultRate,
      totalCvr,
    ];
  });
  appendRows_(sheet, rowsOut);
}

/* =========================================================
   Sheet3: cta_analysis
   ========================================================= */

function writeCtaAnalysis_(dateStr) {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(SHEET.CTA);
  deleteRowsForDate_(sheet, 'date', dateStr);

  // CTA位置別クリック数
  const ctaRows = fetchGA4Report({
    dateRanges: [{ startDate: dateStr, endDate: dateStr }],
    dimensions: [{ name: 'customEvent:cta_location' }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: {
      filter: {
        fieldName: 'eventName',
        stringFilter: { value: 'cta_click' },
      },
    },
  });

  // 当日の lead_captured / consult_click 総数（pro-rata 用）
  const totalsRows = fetchGA4Report({
    dateRanges: [{ startDate: dateStr, endDate: dateStr }],
    dimensions: [{ name: 'eventName' }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: {
      filter: {
        fieldName: 'eventName',
        inListFilter: { values: ['lead_captured', 'consult_click'] },
      },
    },
  });
  const totals = { lead_captured: 0, consult_click: 0 };
  totalsRows.forEach((r) => { totals[r.dimensions[0]] = r.metrics[0]; });

  // 当日 CTA クリック総数
  const totalClicks = ctaRows.reduce((acc, r) => acc + r.metrics[0], 0);

  // 既知の CTA に未出現分を 0 で埋める
  const seen = new Set();
  const rowsOut = [];
  ctaRows.forEach((r) => {
    const loc = r.dimensions[0] || 'unknown';
    const clicks = r.metrics[0];
    const share  = totalClicks > 0 ? clicks / totalClicks : 0;
    const dsLeads    = totals.lead_captured * share;   // ※pro-rata 推計（Phase3.2でセッション結合に置換予定）
    const dsConsults = totals.consult_click * share;
    rowsOut.push([
      dateStr, loc, clicks,
      Math.round(dsLeads * 100) / 100,
      Math.round(dsConsults * 100) / 100,
      safeDiv_(dsLeads, clicks),
    ]);
    seen.add(loc);
  });
  // 既知CTAで未出現のものを 0行として残す（前日比較・空白防止）
  KNOWN_CTA_LOCATIONS.forEach((loc) => {
    if (seen.has(loc)) return;
    rowsOut.push([dateStr, loc, 0, 0, 0, 0]);
  });

  if (rowsOut.length === 0) return;
  appendRows_(sheet, rowsOut);
}

/* =========================================================
   Sheet4: form_error_breakdown
   ========================================================= */

function writeFormErrorBreakdown_(dateStr) {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(SHEET.FORM_ERR);
  deleteRowsForDate_(sheet, 'date', dateStr);

  const rows = fetchGA4Report({
    dateRanges: [{ startDate: dateStr, endDate: dateStr }],
    dimensions: [
      { name: 'customEvent:field' },
      { name: 'customEvent:reason' },
    ],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: {
      filter: {
        fieldName: 'eventName',
        stringFilter: { value: 'form_error' },
      },
    },
  });

  const rowsOut = rows.map((r) => {
    const [field, reason] = r.dimensions;
    return [dateStr, field || 'unknown', reason || 'unknown', r.metrics[0]];
  });

  if (rowsOut.length === 0) return;
  appendRows_(sheet, rowsOut);
}

/* =========================================================
   Sheet5: dashboard_summary （raw_events からの集計）
   ========================================================= */

function updateDashboardSummary() {
  const ss = getSpreadsheet_();
  const sheet = getOrCreateSheet_(ss, SHEET.DASHBOARD);
  sheet.clearContents();

  const raw = readSheetAsObjects_(ss.getSheetByName(SHEET.RAW), RAW_COLUMNS);
  const today = new Date();

  const yesterday = dateStrDaysAgo_(1);
  const thisWeek  = lastNDates_(7);
  const lastWeek  = lastNDates_(14).filter((d) => !thisWeek.includes(d));

  const sumBy = (dates, col) =>
    raw.filter((r) => dates.includes(String(r.date)))
       .reduce((acc, r) => acc + Number(r[col] || 0), 0);

  const yLeads = sumBy([yesterday], 'lead_captured');
  const wLeads = sumBy(thisWeek,    'lead_captured');
  const pLeads = sumBy(lastWeek,    'lead_captured');

  // source 別 CVR (this week)
  const bySource = {};
  raw.filter((r) => thisWeek.includes(String(r.date))).forEach((r) => {
    const s = r.source || 'direct';
    if (!bySource[s]) bySource[s] = { lp: 0, lead: 0 };
    bySource[s].lp   += Number(r.lp_view       || 0);
    bySource[s].lead += Number(r.lead_captured || 0);
  });
  const sourceCvr = Object.keys(bySource).map((s) => ({
    source: s,
    cvr:    safeDiv_(bySource[s].lead, bySource[s].lp),
    leads:  bySource[s].lead,
  })).sort((a, b) => b.cvr - a.cvr);

  // CTA 位置別 CVR (this week, cta_analysis を直接参照)
  const ctaSheet = ss.getSheetByName(SHEET.CTA);
  const ctaRaw   = readSheetAsObjects_(ctaSheet, CTA_COLUMNS);
  const ctaAgg   = {};
  ctaRaw.filter((r) => thisWeek.includes(String(r.date))).forEach((r) => {
    const loc = r.cta_location;
    if (!ctaAgg[loc]) ctaAgg[loc] = { clicks: 0, leads: 0 };
    ctaAgg[loc].clicks += Number(r.clicks || 0);
    ctaAgg[loc].leads  += Number(r.downstream_leads || 0);
  });
  const ctaCvr = Object.keys(ctaAgg).map((loc) => ({
    cta_location: loc,
    clicks:       ctaAgg[loc].clicks,
    cvr:          safeDiv_(ctaAgg[loc].leads, ctaAgg[loc].clicks),
  })).sort((a, b) => b.cvr - a.cvr);

  // 完走率・フォーム離脱率 (this week)
  const wkLpView         = sumBy(thisWeek, 'lp_view');
  const wkQStarted       = sumBy(thisWeek, 'question_started');
  const wkComplete       = sumBy(thisWeek, 'diagnosis_complete');
  const wkFormStart      = sumBy(thisWeek, 'form_start');
  const wkLead           = sumBy(thisWeek, 'lead_captured');
  const completeRate     = safeDiv_(wkComplete,  wkQStarted);
  const formAbandonRate  = 1 - safeDiv_(wkLead, wkFormStart);

  // 出力（2列 key/value 構造）
  const out = [
    ['GTN LP - KPI Summary',     Utilities.formatDate(today, TIMEZONE, 'yyyy-MM-dd HH:mm')],
    [''],
    ['昨日のリード数 (' + yesterday + ')',   yLeads],
    ['今週のリード数 (直近7日)',              wLeads],
    ['前週のリード数 (8〜14日前)',            pLeads],
    ['前週比',                                 safeDiv_(wLeads - pLeads, pLeads)],
    [''],
    ['今週: LP閲覧数',           wkLpView],
    ['今週: 質問開始',           wkQStarted],
    ['今週: 診断完了 (完走率)',  wkComplete + '   (' + (completeRate * 100).toFixed(1) + '%)'],
    ['今週: フォーム開始',       wkFormStart],
    ['今週: リード化',           wkLead],
    ['今週: フォーム離脱率',     (formAbandonRate * 100).toFixed(1) + '%'],
    [''],
    ['── source 別 CVR (今週) TOP3 ──'],
  ];
  sourceCvr.slice(0, 3).forEach((s) => {
    out.push([s.source, (s.cvr * 100).toFixed(2) + '%   (' + s.leads + ' leads)']);
  });

  out.push(['']);
  out.push(['── CTA 位置別 CVR (今週) ──']);
  ctaCvr.forEach((c) => {
    out.push([c.cta_location, (c.cvr * 100).toFixed(2) + '%   (' + c.clicks + ' clicks)']);
  });

  sheet.getRange(1, 1, out.length, 2).setValues(
    out.map((row) => (row.length === 2 ? row : [row[0] || '', '']))
  );
  sheet.getRange('A1:B1').setFontWeight('bold');
}

/* =========================================================
   ヘルパー
   ========================================================= */

function getSpreadsheet_() {
  return SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}

function getOrCreateSheet_(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function setHeadersIfMissing_(ss, name, columns) {
  const sheet = getOrCreateSheet_(ss, name);
  const current = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0] || [];
  const same = columns.every((c, i) => current[i] === c) && current.length >= columns.length;
  if (same) return;
  sheet.getRange(1, 1, 1, columns.length).setValues([columns]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, columns.length).setFontWeight('bold');
}

function appendRows_(sheet, rows) {
  if (!rows || rows.length === 0) return;
  const startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
}

/**
 * 指定列の値が dateStr と一致する全行を削除（先頭から走査、後ろから消す）。
 */
function deleteRowsForDate_(sheet, dateColName, dateStr) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const colIdx  = headers.indexOf(dateColName);
  if (colIdx < 0) return;
  const range = sheet.getRange(2, colIdx + 1, lastRow - 1, 1).getValues();
  for (let i = range.length - 1; i >= 0; i--) {
    if (String(range[i][0]) === dateStr) {
      sheet.deleteRow(i + 2);
    }
  }
}

/**
 * シートを { columnName: value, ... } の配列として読み出す。
 */
function readSheetAsObjects_(sheet, expectedCols) {
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];
  const values  = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0];
  return values.slice(1).map((row) => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    expectedCols.forEach((c) => { if (!(c in obj)) obj[c] = ''; });
    return obj;
  });
}

function yesterdayStr_() {
  return dateStrDaysAgo_(1);
}

function dateStrDaysAgo_(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return Utilities.formatDate(d, TIMEZONE, 'yyyy-MM-dd');
}

function lastNDates_(n) {
  const out = [];
  for (let i = 1; i <= n; i++) out.push(dateStrDaysAgo_(i));
  return out;
}

function safeDiv_(num, den) {
  const n = Number(num) || 0;
  const d = Number(den) || 0;
  if (d === 0) return 0;
  return n / d;
}

/* =========================================================
   Phase3.2: Slack 異常検知 → 通知
   ---------------------------------------------------------
   検知ルール:
     - lp_view_dod          : 前日比 -30%
     - lp_view_wow          : 前週比 -20%
     - question_complete    : 完走率 前週比 -20%
     - form_error_rate      : form_error/form_start > 25%（絶対値）
     - source_cvr           : source別 CVR 前週比 -30%
     - cta_cvr              : CTA位置別 CVR 前週比 -30%
   誤通知防止:
     - 最小母数ガード（baseline が薄ければスキップ）
     - 12時間クールダウン（PropertiesService 保存）
     - 0除算ガード
     - DROP のみ通知（上昇は無視）
     - Slack失敗を catch して日次バッチを止めない
   ========================================================= */

const SLACK_WEBHOOK_URL = ''; // ← Slack Incoming Webhook URL を設定（空欄なら通知スキップ）

const ANOMALY_THRESHOLDS = {
  lp_view_dod_drop:           -0.30,  // 前日比 -30%
  lp_view_wow_drop:           -0.20,  // 前週比 -20%
  question_complete_drop_wow: -0.20,
  form_error_rate_max:         0.25,  // form_error / form_start > 25%
  source_cvr_drop_wow:        -0.30,
  cta_cvr_drop_wow:           -0.30,
};

const ANOMALY_MIN_SAMPLE = {
  lp_view_dod_baseline:     50,
  lp_view_wow_baseline:    200,
  question_started:         30,
  form_start:               20,
  source_lp_view_baseline:  50,
  cta_clicks_baseline:      50,
};

const ALERT_COOLDOWN_HOURS = 12;
const ALERT_TS_KEY = 'gtn_anomaly_last_fired'; // PropertiesService 用 JSON キー

// 推定原因・推奨アクションのヒント
const ALERT_HINTS = {
  lp_view_dod: {
    cause:  '広告停止 / リファラ障害 / Vercel 配信エラー / ドメイン障害',
    action: 'GA4 リアルタイム + Vercel Logs + Search Console 緊急確認',
  },
  lp_view_wow: {
    cause:  '広告予算減 / SEO順位低下 / シーズン変動 / 競合参入',
    action: '広告管理画面 + Search Console 順位推移 + 競合動向確認',
  },
  question_complete: {
    cause:  '質問数増 / UX変更 / 直近リリースで離脱増 / 設問難化',
    action: 'GA4 探索で question_viewed の設問別ファネル離脱を確認',
  },
  form_error_rate: {
    cause:  'メール正規表現 / 必須項目追加 / 入力欄ラベル不明瞭',
    action: 'form_error_breakdown シートで field/reason TOP3 確認 → 入力例追記検討',
  },
  source_cvr: {
    cause:  '紹介経路の品質劣化 / ref 設定ミス / 流入元の質変化',
    action: 'ref パラメータ別の到達率と業種分布を GA4 探索で確認',
  },
  cta_cvr: {
    cause:  'CTA文言変更 / 配置変更 / 画像/レイアウト崩れ',
    action: '該当 cta_location の最近のコミット差分確認 → 必要なら A/B 戻し',
  },
};

/* ---------- エントリポイント ---------- */

/**
 * 異常検知を全種類実行し、Slack に通知する。
 * runGA4DailyReport の末尾から呼ばれる。手動実行も可。
 */
function checkAnomaliesAndNotify() {
  try {
    if (!SLACK_WEBHOOK_URL) {
      Logger.log('[Slack] SLACK_WEBHOOK_URL 未設定: スキップ');
      return;
    }
    const ss  = getSpreadsheet_();
    const raw = readSheetAsObjects_(ss.getSheetByName(SHEET.RAW), RAW_COLUMNS);
    const cta = readSheetAsObjects_(ss.getSheetByName(SHEET.CTA), CTA_COLUMNS);
    const formErr = readSheetAsObjects_(ss.getSheetByName(SHEET.FORM_ERR), FORM_ERR_COLUMNS);

    const alerts = [];
    alerts.push(...detectLpViewDrop_(raw));
    alerts.push(...detectCompleteRateDrop_(raw));
    alerts.push(...detectFormErrorSpike_(raw, formErr));
    alerts.push(...detectSourceCvrDrop_(raw));
    alerts.push(...detectCtaCvrDrop_(cta));

    Logger.log('[Slack] detected ' + alerts.length + ' anomalies');
    if (alerts.length === 0) return;

    const filtered = filterByCooldown_(alerts);
    if (filtered.length === 0) {
      Logger.log('[Slack] all alerts within cooldown, skipped');
      return;
    }

    sendSlackAlert_(filtered);
    recordAlertTimestamps_(filtered);
  } catch (err) {
    // Slackの障害でも日次バッチ全体を止めない
    Logger.log('[Slack] anomaly check FAILED: ' + err + '\n' + (err && err.stack));
  }
}

/* ---------- 検知ロジック ---------- */

function detectLpViewDrop_(raw) {
  const alerts = [];
  const yesterday = dateStrDaysAgo_(1);
  const twoDaysAgo = dateStrDaysAgo_(2);
  const yLp = sumByDates_(raw, [yesterday],  'lp_view');
  const dLp = sumByDates_(raw, [twoDaysAgo], 'lp_view');

  // DoD
  if (dLp >= ANOMALY_MIN_SAMPLE.lp_view_dod_baseline) {
    const change = (yLp - dLp) / dLp;
    if (change <= ANOMALY_THRESHOLDS.lp_view_dod_drop) {
      alerts.push(makeAlert_('lp_view_dod', 'high',
        'LP閲覧数 (前日比)', yLp, dLp, change,
        { current_label: yesterday, baseline_label: twoDaysAgo }));
    }
  }

  // WoW
  const thisWk = lastNDates_(7);
  const lastWk = lastNDates_(14).filter((d) => !thisWk.includes(d));
  const tLp = sumByDates_(raw, thisWk, 'lp_view');
  const pLp = sumByDates_(raw, lastWk, 'lp_view');
  if (pLp >= ANOMALY_MIN_SAMPLE.lp_view_wow_baseline) {
    const change = (tLp - pLp) / pLp;
    if (change <= ANOMALY_THRESHOLDS.lp_view_wow_drop) {
      alerts.push(makeAlert_('lp_view_wow', 'medium',
        'LP閲覧数 (前週比)', tLp, pLp, change,
        { current_label: '今週', baseline_label: '先週' }));
    }
  }
  return alerts;
}

function detectCompleteRateDrop_(raw) {
  const alerts = [];
  const thisWk = lastNDates_(7);
  const lastWk = lastNDates_(14).filter((d) => !thisWk.includes(d));

  const tQ  = sumByDates_(raw, thisWk, 'question_started');
  const tC  = sumByDates_(raw, thisWk, 'diagnosis_complete');
  const pQ  = sumByDates_(raw, lastWk, 'question_started');
  const pC  = sumByDates_(raw, lastWk, 'diagnosis_complete');
  if (tQ < ANOMALY_MIN_SAMPLE.question_started) return alerts;
  if (pQ === 0) return alerts;

  const tRate = tC / tQ;
  const pRate = pC / pQ;
  if (pRate === 0) return alerts;
  const change = (tRate - pRate) / pRate;
  if (change <= ANOMALY_THRESHOLDS.question_complete_drop_wow) {
    alerts.push(makeAlert_('question_complete', 'high',
      '質問完走率 (前週比)',
      formatPct_(tRate), formatPct_(pRate), change,
      { current_label: '今週', baseline_label: '先週' }));
  }
  return alerts;
}

function detectFormErrorSpike_(raw, formErr) {
  const alerts = [];
  const thisWk = lastNDates_(7);
  const fStart = sumByDates_(raw, thisWk, 'form_start');
  if (fStart < ANOMALY_MIN_SAMPLE.form_start) return alerts;

  const fErrCount = formErr
    .filter((r) => thisWk.includes(String(r.date)))
    .reduce((acc, r) => acc + Number(r.count || 0), 0);

  const rate = fErrCount / fStart;
  if (rate > ANOMALY_THRESHOLDS.form_error_rate_max) {
    alerts.push(makeAlert_('form_error_rate', 'high',
      'フォームエラー率 (今週、絶対値)',
      formatPct_(rate),
      formatPct_(ANOMALY_THRESHOLDS.form_error_rate_max) + ' (閾値)',
      rate, // changeフィールド流用：絶対値そのもの
      { current_label: '今週', baseline_label: '閾値', is_absolute: true }));
  }
  return alerts;
}

function detectSourceCvrDrop_(raw) {
  const alerts = [];
  const thisWk = lastNDates_(7);
  const lastWk = lastNDates_(14).filter((d) => !thisWk.includes(d));

  const sources = new Set();
  raw.forEach((r) => { if (r.source) sources.add(r.source); });

  sources.forEach((src) => {
    const tLp = sumByDatesAndSource_(raw, thisWk, src, 'lp_view');
    const tLd = sumByDatesAndSource_(raw, thisWk, src, 'lead_captured');
    const pLp = sumByDatesAndSource_(raw, lastWk, src, 'lp_view');
    const pLd = sumByDatesAndSource_(raw, lastWk, src, 'lead_captured');
    if (pLp < ANOMALY_MIN_SAMPLE.source_lp_view_baseline) return;
    const tCvr = safeDiv_(tLd, tLp);
    const pCvr = safeDiv_(pLd, pLp);
    if (pCvr === 0) return;
    const change = (tCvr - pCvr) / pCvr;
    if (change <= ANOMALY_THRESHOLDS.source_cvr_drop_wow) {
      alerts.push(makeAlert_('source_cvr__' + src, 'medium',
        'source CVR 急落: ' + src,
        formatPct_(tCvr), formatPct_(pCvr), change,
        { current_label: '今週', baseline_label: '先週', source: src }));
    }
  });
  return alerts;
}

function detectCtaCvrDrop_(cta) {
  const alerts = [];
  const thisWk = lastNDates_(7);
  const lastWk = lastNDates_(14).filter((d) => !thisWk.includes(d));

  const locations = new Set();
  cta.forEach((r) => { if (r.cta_location) locations.add(r.cta_location); });

  locations.forEach((loc) => {
    const tRows = cta.filter((r) => thisWk.includes(String(r.date)) && r.cta_location === loc);
    const pRows = cta.filter((r) => lastWk.includes(String(r.date)) && r.cta_location === loc);
    const tClicks = tRows.reduce((a, r) => a + Number(r.clicks || 0), 0);
    const tLeads  = tRows.reduce((a, r) => a + Number(r.downstream_leads || 0), 0);
    const pClicks = pRows.reduce((a, r) => a + Number(r.clicks || 0), 0);
    const pLeads  = pRows.reduce((a, r) => a + Number(r.downstream_leads || 0), 0);
    if (pClicks < ANOMALY_MIN_SAMPLE.cta_clicks_baseline) return;
    const tCvr = safeDiv_(tLeads, tClicks);
    const pCvr = safeDiv_(pLeads, pClicks);
    if (pCvr === 0) return;
    const change = (tCvr - pCvr) / pCvr;
    if (change <= ANOMALY_THRESHOLDS.cta_cvr_drop_wow) {
      alerts.push(makeAlert_('cta_cvr__' + loc, 'medium',
        'CTA CVR 急落: ' + loc,
        formatPct_(tCvr), formatPct_(pCvr), change,
        { current_label: '今週', baseline_label: '先週', cta_location: loc }));
    }
  });
  return alerts;
}

/* ---------- 共通アラート構造 ---------- */

function makeAlert_(typeKey, severity, title, current, baseline, change, ctx) {
  // typeKey 先頭セグメント（"_"以前）が hint 参照キー
  const hintKey = typeKey.split('__')[0].replace(/_dod$|_wow$/, '');
  const hint    = ALERT_HINTS[hintKey] || ALERT_HINTS[typeKey.split('__')[0]] ||
                  { cause: '不明', action: 'GA4 / sheet 確認' };
  return {
    type_key: typeKey,   // クールダウン管理用ユニークID
    severity: severity,  // high / medium / low
    title:    title,
    current:  current,
    baseline: baseline,
    change:   change,
    context:  ctx || {},
    cause:    hint.cause,
    action:   hint.action,
    ts:       new Date().toISOString(),
  };
}

/* ---------- Cooldown ---------- */

function filterByCooldown_(alerts) {
  const props = PropertiesService.getScriptProperties();
  const stored = JSON.parse(props.getProperty(ALERT_TS_KEY) || '{}');
  const now    = Date.now();
  const limit  = ALERT_COOLDOWN_HOURS * 3600 * 1000;
  return alerts.filter((a) => {
    const last = stored[a.type_key];
    if (!last) return true;
    return (now - new Date(last).getTime()) > limit;
  });
}

function recordAlertTimestamps_(alerts) {
  const props  = PropertiesService.getScriptProperties();
  const stored = JSON.parse(props.getProperty(ALERT_TS_KEY) || '{}');
  alerts.forEach((a) => { stored[a.type_key] = a.ts; });
  props.setProperty(ALERT_TS_KEY, JSON.stringify(stored));
}

/**
 * Cooldown 履歴をリセット（テスト・誤発火復旧用）
 */
function resetAlertCooldown() {
  PropertiesService.getScriptProperties().deleteProperty(ALERT_TS_KEY);
  Logger.log('[Slack] cooldown reset');
}

/* ---------- Slack 送信 ---------- */

function sendSlackAlert_(alerts) {
  const dateStr = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm');
  const hasHigh = alerts.some((a) => a.severity === 'high');
  const header  = (hasHigh ? '🚨' : '⚠️') + ' GTN LP 異常検知 (' + dateStr + ')';

  const blocks = [
    { type: 'header', text: { type: 'plain_text', text: header } },
    { type: 'section', text: { type: 'mrkdwn',
        text: '*検知件数:* ' + alerts.length + ' 件\n*重要度内訳:* high=' +
              alerts.filter((a) => a.severity === 'high').length +
              ' / medium=' + alerts.filter((a) => a.severity === 'medium').length } },
    { type: 'divider' },
  ];

  alerts.forEach((a) => {
    const isAbs   = a.context && a.context.is_absolute;
    const sevTag  = a.severity === 'high' ? '🔴 *high*' : '🟠 *medium*';
    const deltaStr = isAbs ? ''
      : '   Δ ' + (a.change >= 0 ? '+' : '') + (a.change * 100).toFixed(1) + '%';
    const text =
      sevTag + '  *' + a.title + '*\n' +
      '`current` ' + a.current + '   →   `baseline` ' + a.baseline + deltaStr + '\n' +
      ':bulb: *推定原因:* ' + a.cause + '\n' +
      ':wrench: *推奨アクション:* ' + a.action;
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: text } });
    blocks.push({ type: 'divider' });
  });

  blocks.push({ type: 'context', elements: [{ type: 'mrkdwn',
    text: 'Phase3.2 anomaly detector ｜ クールダウン ' + ALERT_COOLDOWN_HOURS + 'h ｜ 閾値変更は ANOMALY_THRESHOLDS' }] });

  const payload = { text: header, blocks: blocks };
  const res = UrlFetchApp.fetch(SLACK_WEBHOOK_URL, {
    method:       'post',
    contentType:  'application/json',
    payload:      JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  if (code >= 200 && code < 300) {
    Logger.log('[Slack] sent ' + alerts.length + ' alerts (HTTP ' + code + ')');
  } else {
    Logger.log('[Slack] FAILED HTTP ' + code + ' body=' + res.getContentText());
  }
}

/* ---------- 集計ヘルパー ---------- */

function sumByDates_(raw, dates, col) {
  return raw.filter((r) => dates.includes(String(r.date)))
            .reduce((acc, r) => acc + Number(r[col] || 0), 0);
}

function sumByDatesAndSource_(raw, dates, source, col) {
  return raw.filter((r) => dates.includes(String(r.date)) && r.source === source)
            .reduce((acc, r) => acc + Number(r[col] || 0), 0);
}

function formatPct_(rate) {
  return (Number(rate) * 100).toFixed(2) + '%';
}

/* ---------- 手動テスト ---------- */

/**
 * Webhook と通知フォーマット確認用。実データに関係なくダミー1件送信する。
 * SLACK_WEBHOOK_URL を設定したあと一度だけ実行する想定。
 */
function testSlackNotification() {
  if (!SLACK_WEBHOOK_URL) throw new Error('SLACK_WEBHOOK_URL が未設定です');
  const fake = [makeAlert_('test_alert', 'high',
    '[TEST] LP閲覧数 (前日比)', 120, 200, -0.40,
    { current_label: '昨日', baseline_label: '一昨日' })];
  sendSlackAlert_(fake);
}

/* =========================================================
   Phase4: AI 週次分析レポート → Slack 投稿
   ---------------------------------------------------------
   毎週月曜 08:00 JST に、先週(7日)のファネルデータを集計し、
   Claude API で解釈・改善示唆を生成して Slack に1メッセージ投稿する。

   設計方針（重要）:
     - 数値計算は全て GAS 側で実施し、AI には解釈のみ依頼
     - 数値はそのまま Slack 数値ブロックに転記（AI出力を信用しない）
     - AI 失敗時は fallback として「数値のみ」のレポートを投稿
     - hallucination 防止: AI 出力は厳格 JSON schema、evidence に JSON path 必須
     - 原データ JSON 抜粋を Slack 末尾に添付して照合可能にする
   ========================================================= */

const CLAUDE_API_KEY    = '';   // ← Anthropic API キーを設定
const CLAUDE_MODEL      = 'claude-haiku-4-5-20251001'; // コスト最小・分析十分
const CLAUDE_API_URL    = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MAX_TOKENS = 2000;

// ---- Prompt 定数（編集はここだけで完結） ----------
const AI_PROMPT_SYSTEM = [
  'あなたは GTN LP（外国人雇用支援サービス）の CVR 改善を支援するシニアアナリストです。',
  '入力された JSON データのみを根拠に週次の変化を分析し、改善優先順位を提示します。',
  '',
  '絶対ルール:',
  '- 与えられた JSON データに **存在しない数値を出力しない**。',
  '- 数値を引用するときは元 JSON のフィールドパス（例: data.totals_this_week.lead_captured）を必ず添える。',
  '- データが不十分な場合は "データ不足" と明記する。',
  '- 自然言語の前置き・末尾の挨拶禁止。指定の JSON 形式のみ出力する。',
  '- LP の文脈知識: 外国人雇用診断 → リード → 無料相談予約 のファネル。source=bni/linkedin/note 等の流入別、CTA=hero/middle/final 等の位置別、結果ページで form 入力 → form_submit → lead_captured。',
].join('\n');

const AI_PROMPT_USER_TEMPLATE = [
  '以下は GTN LP の週次ファネルデータです。',
  '',
  '```json',
  '{{DATA}}',
  '```',
  '',
  '次の JSON 形式で出力してください（コードブロックや前置き不要、JSON のみ）:',
  '',
  '{',
  '  "summary": "今週の総評。150字以内。データから読み取れる事実ベースで。",',
  '  "key_changes": [',
  '    {',
  '      "title": "短い見出し",',
  '      "metric_path": "data 内の JSON パス",',
  '      "value_this_week": <number or string>,',
  '      "value_last_week": <number or string>,',
  '      "change_pct": <number, 例 -0.42>,',
  '      "severity": "high"|"medium"|"low",',
  '      "likely_cause": "推定原因。データから推定できる範囲のみ。"',
  '    }',
  '  ],',
  '  "improvements": [',
  '    {',
  '      "priority": 1,',
  '      "action": "具体的なアクション。1〜2文。",',
  '      "expected_impact": "期待される改善幅の方向性",',
  '      "evidence": "data.<path> = <value> 形式で根拠を1つ以上"',
  '    }',
  '  ]',
  '}',
  '',
  '制約: key_changes / improvements は最大3件まで。重要度の高い順に並べる。',
].join('\n');

/* ---------- エントリポイント ---------- */

/**
 * 週次 AI 分析レポートを Slack に投稿する。
 * 月曜 08:00 JST トリガーから呼ばれる。手動実行も可。
 */
function runWeeklyAIReport() {
  try {
    if (!SLACK_WEBHOOK_URL) {
      Logger.log('[AIWeekly] SLACK_WEBHOOK_URL 未設定: スキップ');
      return;
    }
    const data = buildWeeklyData_();
    let aiResult   = null;
    let aiErrorMsg = null;
    try {
      aiResult = callClaudeAPI_(data);
      Logger.log('[AIWeekly] AI ok: ' + Object.keys(aiResult || {}).join(','));
    } catch (apiErr) {
      aiErrorMsg = String(apiErr);
      Logger.log('[AIWeekly] AI failed, fallback path: ' + aiErrorMsg);
    }
    const blocks = formatWeeklySlackMessage_(data, aiResult, aiErrorMsg);
    sendWeeklySlackMessage_(blocks);
  } catch (err) {
    Logger.log('[AIWeekly] FATAL: ' + err + '\n' + (err && err.stack));
  }
}

/**
 * 月曜 08:00 JST の週次トリガー設置（多重設置防止）。
 */
function setupWeeklyAITrigger() {
  ScriptApp.getProjectTriggers().forEach((t) => {
    if (t.getHandlerFunction() === 'runWeeklyAIReport') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('runWeeklyAIReport')
    .timeBased()
    .everyWeeks(1)
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(8)
    .inTimezone(TIMEZONE)
    .create();
  Logger.log('[AIWeekly] weekly trigger installed (Mon 08:00 ' + TIMEZONE + ')');
}

/**
 * 手動テスト: AI レポートをその場で生成して Slack 投稿する。
 */
function testWeeklyAIReport() {
  runWeeklyAIReport();
}

/* ---------- データ集計 ---------- */

/**
 * 先週/前週の全集計を JSON に詰めて返す（AI へのコンテキスト）。
 */
function buildWeeklyData_() {
  const ss = getSpreadsheet_();
  const raw     = readSheetAsObjects_(ss.getSheetByName(SHEET.RAW),      RAW_COLUMNS);
  const cta     = readSheetAsObjects_(ss.getSheetByName(SHEET.CTA),      CTA_COLUMNS);
  const formErr = readSheetAsObjects_(ss.getSheetByName(SHEET.FORM_ERR), FORM_ERR_COLUMNS);

  const thisWk = lastNDates_(7);                                      // [yesterday..7d ago]
  const lastWk = lastNDates_(14).filter((d) => !thisWk.includes(d));  // [8d..14d ago]

  // --- 主要メトリクス合計（今週/先週） ---
  const totalCols = [
    'lp_view', 'cta_click', 'diag_lp_view', 'industry_selected',
    'question_started', 'diagnosis_complete', 'result_view',
    'form_start', 'form_submit', 'lead_captured',
    'consult_click', 'external_link_click',
    'scroll_25', 'scroll_50', 'scroll_75', 'scroll_100',
  ];
  const totalsThis = {};
  const totalsLast = {};
  totalCols.forEach((c) => {
    totalsThis[c] = sumByDates_(raw, thisWk, c);
    totalsLast[c] = sumByDates_(raw, lastWk, c);
  });

  // --- 派生CVR（今週/先週） ---
  const rate = (tw) => ({
    LP_to_diag_rate:        safeDiv_(tw.diag_lp_view,       tw.lp_view),
    diag_to_question_rate:  safeDiv_(tw.industry_selected,  tw.diag_lp_view),
    question_complete_rate: safeDiv_(tw.diagnosis_complete, tw.question_started),
    result_to_form_rate:    safeDiv_(tw.form_start,         tw.result_view),
    form_submit_rate:       safeDiv_(tw.lead_captured,      tw.form_start),
    consult_rate:           safeDiv_(tw.consult_click,      tw.result_view),
    total_cvr:              safeDiv_(tw.lead_captured,      tw.lp_view),
  });
  const ratesThis = rate(totalsThis);
  const ratesLast = rate(totalsLast);

  // --- source 別（今週・先週・CVR・WoW） ---
  const sources = new Set();
  raw.forEach((r) => { if (r.source) sources.add(r.source); });
  const sourceBreakdown = [];
  sources.forEach((src) => {
    const tLp = sumByDatesAndSource_(raw, thisWk, src, 'lp_view');
    const tLd = sumByDatesAndSource_(raw, thisWk, src, 'lead_captured');
    const pLp = sumByDatesAndSource_(raw, lastWk, src, 'lp_view');
    const pLd = sumByDatesAndSource_(raw, lastWk, src, 'lead_captured');
    sourceBreakdown.push({
      source:               src,
      lp_view_this_week:    tLp,
      lp_view_last_week:    pLp,
      leads_this_week:      tLd,
      leads_last_week:      pLd,
      cvr_this_week:        round4_(safeDiv_(tLd, tLp)),
      cvr_last_week:        round4_(safeDiv_(pLd, pLp)),
      cvr_change_pct:       round4_(wow_(safeDiv_(tLd, tLp), safeDiv_(pLd, pLp))),
    });
  });

  // --- CTA 位置別 ---
  const locations = new Set();
  cta.forEach((r) => { if (r.cta_location) locations.add(r.cta_location); });
  const ctaBreakdown = [];
  locations.forEach((loc) => {
    const tRows = cta.filter((r) => thisWk.includes(String(r.date)) && r.cta_location === loc);
    const pRows = cta.filter((r) => lastWk.includes(String(r.date)) && r.cta_location === loc);
    const tClicks = tRows.reduce((a, r) => a + Number(r.clicks || 0), 0);
    const tLeads  = tRows.reduce((a, r) => a + Number(r.downstream_leads || 0), 0);
    const pClicks = pRows.reduce((a, r) => a + Number(r.clicks || 0), 0);
    const pLeads  = pRows.reduce((a, r) => a + Number(r.downstream_leads || 0), 0);
    ctaBreakdown.push({
      cta_location:       loc,
      clicks_this_week:   tClicks,
      clicks_last_week:   pClicks,
      cvr_this_week:      round4_(safeDiv_(tLeads, tClicks)),
      cvr_last_week:      round4_(safeDiv_(pLeads, pClicks)),
      cvr_change_pct:     round4_(wow_(safeDiv_(tLeads, tClicks), safeDiv_(pLeads, pClicks))),
    });
  });

  // --- form_error TOP（今週、count降順） ---
  const errAgg = {};
  formErr.filter((r) => thisWk.includes(String(r.date))).forEach((r) => {
    const key = (r.field || 'unknown') + '::' + (r.reason || 'unknown');
    errAgg[key] = (errAgg[key] || 0) + Number(r.count || 0);
  });
  const formErrorsTop = Object.keys(errAgg)
    .map((k) => ({ field: k.split('::')[0], reason: k.split('::')[1], count: errAgg[k] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // --- 直近7日以内の Slack アラート（クールダウン履歴を利用） ---
  const stored = JSON.parse(PropertiesService.getScriptProperties().getProperty(ALERT_TS_KEY) || '{}');
  const since  = Date.now() - 7 * 24 * 3600 * 1000;
  const activeAnomalies = Object.keys(stored)
    .filter((k) => new Date(stored[k]).getTime() >= since)
    .map((k) => ({ type_key: k, fired_at: stored[k] }));

  return {
    period: {
      this_week: { start: thisWk[thisWk.length - 1], end: thisWk[0] },
      last_week: { start: lastWk[lastWk.length - 1], end: lastWk[0] },
    },
    totals_this_week: totalsThis,
    totals_last_week: totalsLast,
    derived_rates_this_week: roundObj_(ratesThis),
    derived_rates_last_week: roundObj_(ratesLast),
    source_breakdown:        sourceBreakdown,
    cta_breakdown:           ctaBreakdown,
    form_errors_top:         formErrorsTop,
    active_anomalies:        activeAnomalies,
  };
}

/* ---------- Claude API 呼び出し ---------- */

/**
 * Claude API を呼んで AI 解釈を取得。失敗時は throw（呼び出し元で fallback）。
 * @returns {Object|null} AI 出力 JSON
 */
function callClaudeAPI_(data) {
  if (!CLAUDE_API_KEY) throw new Error('CLAUDE_API_KEY が未設定です');

  const userPrompt = AI_PROMPT_USER_TEMPLATE.replace('{{DATA}}', JSON.stringify(data, null, 2));

  const res = UrlFetchApp.fetch(CLAUDE_API_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key':         CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    payload: JSON.stringify({
      model:       CLAUDE_MODEL,
      max_tokens:  CLAUDE_MAX_TOKENS,
      system:      AI_PROMPT_SYSTEM,
      messages:    [{ role: 'user', content: userPrompt }],
    }),
    muteHttpExceptions: true,
  });

  const code = res.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('Claude API HTTP ' + code + ': ' + res.getContentText().substring(0, 500));
  }
  const body = JSON.parse(res.getContentText());
  const text = (body.content && body.content[0] && body.content[0].text) || '';
  return parseAiJson_(text);
}

/**
 * AI 応答テキストから JSON を抽出する。コードブロックで囲まれていても拾う。
 */
function parseAiJson_(text) {
  if (!text) throw new Error('AI 応答が空');
  // 素のJSONを試す
  try { return JSON.parse(text); } catch (_) { /* fallthrough */ }
  // ```json ... ``` ブロックを試す
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try { return JSON.parse(fence[1]); } catch (_) { /* fallthrough */ }
  }
  // 最初の { から最後の } を試す
  const first = text.indexOf('{');
  const last  = text.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try { return JSON.parse(text.substring(first, last + 1)); } catch (_) { /* fallthrough */ }
  }
  throw new Error('AI 応答を JSON としてパースできない: ' + text.substring(0, 200));
}

/* ---------- Slack メッセージ整形 ---------- */

function formatWeeklySlackMessage_(data, aiResult, aiErrorMsg) {
  const t  = data.totals_this_week;
  const p  = data.totals_last_week;
  const rt = data.derived_rates_this_week;
  const rp = data.derived_rates_last_week;
  const period = data.period;

  const fmtPct = (x) => (Number(x) * 100).toFixed(1) + '%';
  const fmtChg = (n, b) => {
    if (!b) return 'n/a';
    const pct = (n - b) / b * 100;
    return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
  };
  const fmtPpt = (n, b) => ((n - b) * 100 >= 0 ? '+' : '') + ((n - b) * 100).toFixed(1) + 'pt';

  const header = ':bar_chart: GTN LP 週次レポート (' +
                 period.this_week.start + ' 〜 ' + period.this_week.end + ')';

  const blocks = [
    { type: 'header', text: { type: 'plain_text', text: header } },
    { type: 'section', text: { type: 'mrkdwn', text:
        '*── 主要数値（GASによる実測） ──*\n' +
        '今週: lp_view *' + t.lp_view + '* / leads *' + t.lead_captured + '* / 完走率 *' + fmtPct(rt.question_complete_rate) + '* / form離脱率 *' + fmtPct(1 - rt.form_submit_rate) + '*\n' +
        '先週: lp_view ' + p.lp_view + ' / leads ' + p.lead_captured + ' / 完走率 ' + fmtPct(rp.question_complete_rate) + ' / form離脱率 ' + fmtPct(1 - rp.form_submit_rate) + '\n' +
        '前週比: leads *' + fmtChg(t.lead_captured, p.lead_captured) + '* / total_cvr *' + fmtChg(rt.total_cvr, rp.total_cvr) + '* / 完走率 *' + fmtPpt(rt.question_complete_rate, rp.question_complete_rate) + '*' } },
    { type: 'divider' },
  ];

  // AI 解釈ブロック
  if (aiResult && aiResult.summary) {
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text:
      ':robot_face: *AI解釈* (Claude Haiku)\n' + aiResult.summary } });
  } else {
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text:
      ':warning: *AI解釈は取得できませんでした*' + (aiErrorMsg ? '（' + aiErrorMsg.substring(0, 200) + '）' : '') } });
  }
  blocks.push({ type: 'divider' });

  // 重要変化 TOP
  if (aiResult && aiResult.key_changes && aiResult.key_changes.length) {
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: '*── 重要変化 TOP' + aiResult.key_changes.length + ' ──*' } });
    aiResult.key_changes.slice(0, 3).forEach((c) => {
      const sev = c.severity === 'high' ? '🔴 *high*' : c.severity === 'medium' ? '🟠 *medium*' : '🟡 *low*';
      const chg = typeof c.change_pct === 'number'
        ? '  Δ ' + ((c.change_pct >= 0 ? '+' : '') + (c.change_pct * 100).toFixed(1)) + '%' : '';
      blocks.push({ type: 'section', text: { type: 'mrkdwn', text:
        sev + '  *' + (c.title || '(no title)') + '*\n' +
        '`current` ' + c.value_this_week + '  →  `baseline` ' + c.value_last_week + chg + '\n' +
        ':bulb: 推定原因: ' + (c.likely_cause || '(不明)') + '\n' +
        ':mag: metric_path: `' + (c.metric_path || 'n/a') + '`' } });
    });
    blocks.push({ type: 'divider' });
  }

  // 推奨アクション
  if (aiResult && aiResult.improvements && aiResult.improvements.length) {
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: '*── 推奨アクション TOP' + Math.min(3, aiResult.improvements.length) + ' ──*' } });
    aiResult.improvements.slice(0, 3).sort((a, b) => (a.priority || 99) - (b.priority || 99)).forEach((imp) => {
      blocks.push({ type: 'section', text: { type: 'mrkdwn', text:
        '*P' + (imp.priority || '?') + '.* ' + (imp.action || '(no action)') + '\n' +
        ':rocket: 期待効果: ' + (imp.expected_impact || '(未記載)') + '\n' +
        ':receipt: 根拠: `' + (imp.evidence || '(根拠なし)') + '`' } });
    });
    blocks.push({ type: 'divider' });
  }

  // 原データ（operator 検証用 / hallucination 照合用）
  const sourceTop = (data.source_breakdown || [])
    .filter((s) => s.lp_view_this_week >= 10 || s.lp_view_last_week >= 10)
    .sort((a, b) => (b.leads_this_week || 0) - (a.leads_this_week || 0))
    .slice(0, 5);
  const ctaTop = (data.cta_breakdown || [])
    .sort((a, b) => (b.clicks_this_week || 0) - (a.clicks_this_week || 0))
    .slice(0, 7);
  const provenance = {
    period:               data.period,
    totals_this_week:     data.totals_this_week,
    totals_last_week:     data.totals_last_week,
    rates_this_week:      data.derived_rates_this_week,
    rates_last_week:      data.derived_rates_last_week,
    source_top:           sourceTop,
    cta_top:              ctaTop,
    form_errors_top:      data.form_errors_top,
    active_anomalies:     data.active_anomalies,
  };
  let provJson = JSON.stringify(provenance, null, 2);
  if (provJson.length > 2800) provJson = provJson.substring(0, 2800) + '\n... (truncated)';
  blocks.push({ type: 'section', text: { type: 'mrkdwn', text:
    '*── 原データ (AI/operator 検証用) ──*\n```' + provJson + '```' } });

  blocks.push({ type: 'context', elements: [{ type: 'mrkdwn',
    text: 'Phase4 AI weekly ｜ model: ' + CLAUDE_MODEL + ' ｜ prompt: AI_PROMPT_SYSTEM / AI_PROMPT_USER_TEMPLATE' }] });

  return blocks;
}

function sendWeeklySlackMessage_(blocks) {
  const payload = { text: 'GTN LP 週次レポート', blocks: blocks };
  const res = UrlFetchApp.fetch(SLACK_WEBHOOK_URL, {
    method:       'post',
    contentType:  'application/json',
    payload:      JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  if (code >= 200 && code < 300) {
    Logger.log('[AIWeekly] sent (HTTP ' + code + ')');
  } else {
    Logger.log('[AIWeekly] Slack FAILED HTTP ' + code + ' body=' + res.getContentText());
  }
}

/* ---------- 数値ヘルパー ---------- */

function round4_(n) { return Math.round(Number(n) * 10000) / 10000; }
function wow_(curr, base) { return (Number(base) === 0) ? 0 : (Number(curr) - Number(base)) / Number(base); }
function roundObj_(obj) {
  const out = {};
  Object.keys(obj).forEach((k) => { out[k] = round4_(obj[k]); });
  return out;
}

/**
 * GTN 外国人材活用診断 — メインロジック
 * -----------------------------------------------
 * GAS連携URLは下記 GAS_URL を差し替えてください
 * 相談ページURLは下記 CONSULT_URL を差し替えてください
 */

'use strict';

/* =============================================
   ★ 設定値（差し替えポイント）
   ============================================= */

/** Google Apps Script デプロイURL ← ここを差し替え */
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwCUN-cO15RF-T5-BU5zJR74FHutgnWnuP3G7Mmar4QZwEWfLSpUBoNGn4TGsxn9SJl/exec';

/** 無料相談ページURL ← ここを差し替え */
const CONSULT_URL = 'https://www.globaltalent-navi.com/consultation/';

/* =============================================
   診断データ
   ============================================= */

const QUESTIONS = [
  {
    id: 1,
    axis: 'strategy',
    text: '外国人材を雇用する目的は明確ですか？',
    options: [
      { label: 'A', text: '明確に定義されている',           score: 2, axisScore: 3 },
      { label: 'B', text: '人手不足解消が中心',             score: 1, axisScore: 2 },
      { label: 'C', text: 'とりあえず採用を検討している',   score: 0, axisScore: 1 },
    ],
    risks: {
      B: { label: '雇用目的が「人手不足解消」に偏っている', detail: '採用後の役割設計・定着支援が手薄になりやすい状態です。', level: 'mid' },
      C: { label: '雇用目的が不明確', detail: '採用・受入の設計全体に影響する根本的なリスク要因です。', level: 'high' },
    },
  },
  {
    id: 2,
    axis: 'structure',
    text: '外国人材の受入責任者は決まっていますか？',
    options: [
      { label: 'A', text: '専任または明確な責任者がいる', score: 2, axisScore: 3 },
      { label: 'B', text: '兼任で対応予定',               score: 1, axisScore: 2 },
      { label: 'C', text: '特に決まっていない',           score: 0, axisScore: 1 },
    ],
    risks: {
      B: { label: '受入担当者が兼任で対応が手薄', detail: 'サポートの質が安定せず、対応が後回しになりやすい状態です。', level: 'mid' },
      C: { label: '受入責任者が不明確', detail: '問題発生時に対応できず、現場対応が属人化するリスクがあります。', level: 'high' },
    },
  },
  {
    id: 3,
    axis: 'operation',
    text: '外国人材に任せる仕事内容は明確ですか？',
    options: [
      { label: 'A', text: '明確に定義されている',     score: 2, axisScore: 3 },
      { label: 'B', text: 'ある程度決まっている',     score: 1, axisScore: 2 },
      { label: 'C', text: '現場判断に任せる予定',     score: 0, axisScore: 1 },
    ],
    risks: {
      B: { label: '業務内容の定義が不十分', detail: '入社後のミスマッチや、期待値のズレが生じやすい状態です。', level: 'mid' },
      C: { label: '業務内容の定義が未設定', detail: '指示・評価の基準が定まらず、早期離職につながるリスクがあります。', level: 'high' },
    },
  },
  {
    id: 4,
    axis: 'retention',
    text: '外国人材の評価方法や基準はありますか？',
    options: [
      { label: 'A', text: '明確な評価制度がある',     score: 2, axisScore: 3 },
      { label: 'B', text: '一部あるが十分ではない',   score: 1, axisScore: 2 },
      { label: 'C', text: '特にない',                 score: 0, axisScore: 1 },
    ],
    risks: {
      B: { label: '評価基準が不完全', detail: '公平感の欠如がモチベーション低下の原因になる可能性があります。', level: 'mid' },
      C: { label: '評価制度が未整備', detail: '成長実感や公平感が持てず、離職リスクが高まる状態です。', level: 'high' },
    },
  },
  {
    id: 5,
    axis: 'operation',
    text: '日本語力や業務理解を支援する仕組みはありますか？',
    options: [
      { label: 'A', text: '教育やフォロー体制がある', score: 2, axisScore: 3 },
      { label: 'B', text: '必要に応じて対応予定',     score: 1, axisScore: 2 },
      { label: 'C', text: '特にない',                 score: 0, axisScore: 1 },
    ],
    risks: {
      B: { label: '教育・フォロー体制が場当たり的', detail: '業務習熟が遅れ、現場の負担増にもつながる可能性があります。', level: 'mid' },
      C: { label: '教育・サポート体制がない', detail: '業務理解の遅れや孤立感から、早期離職につながるリスクがあります。', level: 'high' },
    },
  },
  {
    id: 6,
    axis: 'structure',
    text: '生活面のサポート体制はありますか？',
    options: [
      { label: 'A', text: '社内または外部連携で整っている', score: 2, axisScore: 3 },
      { label: 'B', text: '一部のみ対応できる',           score: 1, axisScore: 2 },
      { label: 'C', text: '特に想定していない',           score: 0, axisScore: 1 },
    ],
    risks: {
      B: { label: '生活サポートが限定的', detail: '住居・行政手続きなど生活面の不安が仕事に影響するリスクがあります。', level: 'mid' },
      C: { label: '生活支援体制がない', detail: '入国後の生活基盤が不安定になり、定着率に大きく影響します。', level: 'high' },
    },
  },
  {
    id: 7,
    axis: 'retention',
    text: 'これまでに外国人材の早期離職はありましたか？',
    options: [
      { label: 'A', text: 'ほとんどない',                 score: 2, axisScore: 3 },
      { label: 'B', text: '一部ある',                     score: 1, axisScore: 2 },
      { label: 'C', text: '複数回ある、または不安が大きい', score: 0, axisScore: 1 },
    ],
    risks: {
      B: { label: '過去の離職要因が未解消の可能性', detail: '同様の状況が繰り返されるリスクがあります。', level: 'mid' },
      C: { label: '離職再発リスクが高い状態', detail: '受入体制の根本的な見直しが必要な状況と考えられます。', level: 'high' },
    },
  },
  {
    id: 8,
    axis: 'retention',
    text: '外国人材のキャリアや将来像を考えていますか？',
    options: [
      { label: 'A', text: '考えている',         score: 2, axisScore: 3 },
      { label: 'B', text: 'これから考える予定', score: 1, axisScore: 2 },
      { label: 'C', text: '特に考えていない',   score: 0, axisScore: 1 },
    ],
    risks: {
      B: { label: 'キャリアビジョンが未定義', detail: '将来への見通しが持てないことが離職動機になるケースがあります。', level: 'mid' },
      C: { label: 'キャリア設計が未整備', detail: '長期定着を見込みにくく、転職先に流出するリスクが高い状態です。', level: 'high' },
    },
  },
  {
    id: 9,
    axis: 'structure',
    text: '外国人雇用に関する社内ルールや受入方針はありますか？',
    options: [
      { label: 'A', text: 'ある',         score: 2, axisScore: 3 },
      { label: 'B', text: '一部だけある', score: 1, axisScore: 2 },
      { label: 'C', text: 'ない',         score: 0, axisScore: 1 },
    ],
    risks: {
      B: { label: '社内方針が部分的で対応にムラがある', detail: '担当者によって対応がバラつき、不公平感につながるリスクがあります。', level: 'mid' },
      C: { label: '社内受入方針がない', detail: 'トラブル時の判断基準がなく、組織として対応できないリスクがあります。', level: 'high' },
    },
  },
  {
    id: 10,
    axis: 'strategy',
    text: '外国人雇用の最終責任を誰が持つか明確ですか？',
    options: [
      { label: 'A', text: '経営者または責任者が明確', score: 2, axisScore: 3 },
      { label: 'B', text: '人事や現場が担当予定',   score: 1, axisScore: 2 },
      { label: 'C', text: '曖昧',                   score: 0, axisScore: 1 },
    ],
    risks: {
      B: { label: '責任体制が現場・人事任せ', detail: '経営レベルのリスク管理ができておらず、問題の発見が遅れる可能性があります。', level: 'mid' },
      C: { label: '雇用責任の所在が曖昧', detail: '問題発生時に誰も判断できない状態は、組織全体のリスクになります。', level: 'high' },
    },
  },
];

/* =============================================
   4軸ラベル定義
   ============================================= */

/**
 * 4軸の表示情報
 * strategy  : 戦略（Q1, Q10）
 * structure : 受入体制（Q2, Q6, Q9）
 * operation : 現場運用（Q3, Q5）
 * retention : 定着・育成（Q4, Q7, Q8）
 */
// 軸ラベルは経営者向けの表現に統一（戦略設計／受入体制／現場運用／定着支援）。
// ※内部キー（strategy/structure/operation/retention）と採点ロジックは不変。表示名のみ。
const AXIS_LABELS = {
  strategy:  { label: '戦略設計', desc: '目的・方針の明確さ',           icon: '🎯', color: '#1a5c3a', bg: '#edf7f1', border: '#a7e3bf' },
  structure: { label: '受入体制', desc: '制度・社内支援・役割設計',       icon: '🏗',  color: '#1e40af', bg: '#eff6ff', border: '#93c5fd' },
  operation: { label: '現場運用', desc: '教育・コミュニケーション・業務運用', icon: '⚙️',  color: '#92400e', bg: '#fffbeb', border: '#fcd34d' },
  retention: { label: '定着支援', desc: '面談・評価・育成設計',         icon: '🌱',  color: '#6b21a8', bg: '#faf5ff', border: '#c4b5fd' },
};

/* スコア → 成功確率のルックアップ */
const SCORE_RATE_MAP = {
  20: 95, 19: 91, 18: 86,
  17: 80, 16: 75,
  15: 70, 14: 65, 13: 61,
  12: 56, 11: 51, 10: 46,
   9: 41,  8: 37,  7: 33,
   6: 30,  5: 27,  4: 25,
   3: 23,  2: 22,  1: 21,
   0: 20,
};

/* スコア → 評価 */
function calcRating(score) {
  if (score >= 16) return 'A';
  if (score >= 10) return 'B';
  return 'C';
}

/**
 * 評価ランク別の補足ラベル（v3.2）
 * バッジ表示：「総合評価：Bランク（改善余地あり）」の形式で使用
 */
const RATING_LABELS = {
  A: 'Aランク（戦力化・定着の基盤あり）',
  B: 'Bランク（受入・運用設計の改善余地あり）',
  C: 'Cランク（戦力化・定着に課題あり）',
};

/**
 * 成功確率の直下に出す「経営者が次に取るべき認識」（評価別・1行）
 * 27%等の数値が「良いのか悪いのか」を即座に伝える危機/打ち手フレーム。
 */
const RATING_VERDICT = {
  A: '受入・定着の基盤は良好。設計精度の維持が次の打ち手です',
  B: '受入体制・運用設計の見直しが必要な状態です',
  C: '早期離職リスクが高い状態です。受入体制の改善が急務です',
};

/* 総評コメント（評価ランク別・フォールバック用） */
const COMMENTS = {
  A: '受入体制の基盤は比較的整っています。一方で、運用面や定着支援の精度によっては離職リスクが生じる可能性があります。役割分担と運用設計を定期的に見直すことで、さらに戦力化・定着の成功確率を高められます。',
  B: '外国人材活用の土台は一定ありますが、受入体制や運用設計にいくつか重要な課題が見られます。このまま運用を続けると、定着率の低下や現場負荷の増加につながる可能性があります。',
  C: '現時点では、外国人材の戦力化・定着に課題が残る状態です。早期離職や現場の混乱を防ぐために、受入体制と運用設計の見直しを優先することをおすすめします。',
};

/**
 * 企業タイプ別 基本コメント（タイプ判定後の主コメントとして使用）
 */
const TYPE_RESULT_COMMENTS = {
  strategic_utilization: '外国人材を戦力として活用する土台が整っています。4軸のバランスも取れており、今後は運用の高度化・定着率の再現性向上がテーマです。',
  growth_driving:        '外国人材活用の基盤は一定整っており、弱点軸の集中改善で成果をさらに伸ばしやすい状態です。改善余地のある軸を優先的に整備することで、戦力化・定着の成功確率向上が期待できます。',
  operation_challenge:   '外国人材活用の方向性はある一方で、現場運用や受入設計に課題が残る状態です。定着率や現場負荷に影響しやすいタイプです。優先改善軸を中心に設計を整えることをおすすめします。',
  reception_unprepared:  '受入体制の整備が十分でないため、戦力化・定着や社内運用に課題が生じやすい状態です。受入設計と運用体制の見直しが、成功確率を高める最短の手段です。',
  direction_unclear:     '外国人材活用の目的や方向性が十分に整理されていない状態です。運用方法の検討より先に、「なぜ外国人材を活用するのか」「どこで戦力化するのか」を経営として定義することが重要です。',
};

/**
 * 最弱軸ごとの改善アドバイス（タイプコメントに追記）
 */
const AXIS_IMPROVEMENT_NOTES = {
  strategy:  '【戦略軸が優先課題】活用の目的・方針・優先順位の明確化が最初のステップです。目的が曖昧なままでは、受入設計・評価・定着設計のすべてがブレます。',
  structure: '【受入体制軸が優先課題】担当者の決定・受入フローの標準化・生活支援体制の整備が先決です。体制が不十分なまま運用を続けると、現場負荷と定着率悪化につながります。',
  operation: '【現場運用軸が優先課題】業務内容の定義・OJT設計・コミュニケーション体制の整備が鍵です。現場運用の設計不足は、戦力化スピードと早期離職率に直結します。',
  retention: '【定着・育成軸が優先課題】評価制度の透明化・キャリアビジョンの提示・定期面談の仕組み化が必要です。定着設計の欠如は、教育コストの無駄と離職リスクの増大に直結します。',
};

/* =============================================
   ストレージユーティリティ
   ============================================= */

const STORAGE_ANSWERS_KEY  = 'gtn_risk_answers';    // { "1": "A", "2": "C", ... }
const STORAGE_SOURCE_KEY   = 'gtn_risk_source';     // 流入元（bni / linkedin / x / note / facebook / direct）
const STORAGE_REF_KEY      = 'gtn_risk_ref';        // 紹介者・紹介コード（任意）
const STORAGE_INDUSTRY_KEY = 'gtn_risk_industry';   // 業種（AI個別最適化用・スコア非影響）

// Google Ads 計測用（Phase3.2 追加）— 既存 source/ref とは独立。既存 attribution を壊さない
const STORAGE_UTM_SOURCE_KEY   = 'gtn_utm_source';
const STORAGE_UTM_MEDIUM_KEY   = 'gtn_utm_medium';
const STORAGE_UTM_CAMPAIGN_KEY = 'gtn_utm_campaign';
const STORAGE_GCLID_KEY        = 'gtn_gclid';        // { value, createdAt, expiresAt } を JSON 保存
const GCLID_TTL_MS             = 30 * 24 * 60 * 60 * 1000; // 30日

/** トラッキングパラメータのストレージキー一覧（後から参照用） */
const TRACKING_KEYS = {
  source: STORAGE_SOURCE_KEY,
  ref:    STORAGE_REF_KEY,
};

function saveAnswers(answers) {
  localStorage.setItem(STORAGE_ANSWERS_KEY, JSON.stringify(answers));
}

function loadAnswers() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_ANSWERS_KEY)) || {};
  } catch { return {}; }
}

function clearAnswers() {
  localStorage.removeItem(STORAGE_ANSWERS_KEY);
  sessionStorage.removeItem('gtn_risk_current');
}

/** 業種を保存（AI個別最適化用・スコアに影響しない） */
function saveIndustry(val) {
  localStorage.setItem(STORAGE_INDUSTRY_KEY, val || '');
}
/** 業種を読み込む */
function loadIndustry() {
  return localStorage.getItem(STORAGE_INDUSTRY_KEY) || '';
}

/* =============================================
   診断メタ（汎用ペイロード）
   ─────────────────────────────────────────────
   採点に絡まない「診断中に取得した付帯情報」を
   キー・バリューの集合で保持する。立場(role)が初出。
   将来 timeline 等を足す場合は META_QUESTIONS に1定義を
   追加し、HubSpot側プロパティ＋GASのマッピングを足すだけで拡張可能。
   採点用 answers（gtn_risk_answers）とは完全に分離する。
   ============================================= */

const STORAGE_META_KEY = 'gtn_risk_meta';   // { role: 'executive', ... }

/**
 * メタ設問定義（QUESTIONS とは別管理・スコア非影響）
 * key      : ペイロード/HubSpotマッピングで使う安定キー
 * value    : HubSpotに渡す内部値（表示文言と分離）
 * position : 'pre'＝採点設問の前（診断冒頭）／省略時＝採点設問の後（結果直前）
 * showIf   : (meta) => boolean。条件付き表示（省略時は常に表示）
 */
const META_QUESTIONS = [
  {
    key: 'employment_experience',
    required: true,
    position: 'pre',
    label: 'はじめに',
    text: '外国人材の雇用経験はありますか？',
    options: [
      { value: 'current',          text: '現在雇用している' },
      { value: 'past',             text: '過去に雇用していたが、現在はいない' },
      { value: 'none_considering', text: '雇用経験はない' },
    ],
  },
  {
    // Q2: 現在雇用中の企業のみに表示（商談前の顧客分類用・スコア非影響）
    key: 'foreign_talent_status',
    required: true,
    position: 'pre',
    label: 'はじめに',
    text: '現在の外国人材活用状況に最も近いものを選んでください',
    showIf: function (meta) { return !!meta && meta.employment_experience === 'current'; },
    options: [
      { value: 'working_well', text: 'うまくいっている' },
      { value: 'some_issues',  text: '一部課題がある' },
      { value: 'major_issues', text: '大きな課題がある' },
    ],
  },
  {
    // 業種: スコア非影響のメタ設問（旧・診断導入ページの必須ゲートから移設）。
    // 雇用経験(Q1)→活用状況(条件付)→業種 の順。選択値は onMetaSelect で
    // saveIndustry() に併走保存し、AIコメントの loadIndustry() を維持する。
    // options の value は結果フォーム #f-industry と一致させ、プリフィルを成立させる。
    key: 'industry',
    required: true,
    position: 'pre',
    label: 'はじめに',
    text: '業種を選択してください',
    options: [
      { value: '製造業',        text: '製造業' },
      { value: '建設業',        text: '建設業' },
      { value: '農業・水産業',  text: '農業・水産業' },
      { value: '介護・福祉',    text: '介護・福祉' },
      { value: '外食・飲食',    text: '外食・飲食' },
      { value: 'サービス業',    text: 'サービス業' },
      { value: '小売・流通',    text: '小売・流通' },
      { value: 'IT・情報通信',  text: 'IT・情報通信' },
      { value: 'その他',        text: 'その他' },
    ],
  },
  {
    key: 'role',
    required: true,
    label: '立場',
    text: 'より精度の高い分析結果をお出しするため、あなたの立場を教えてください',
    options: [
      { value: 'executive',    text: '経営者・役員' },
      { value: 'hr',           text: '人事・採用担当' },
      { value: 'site_manager', text: '現場責任者' },
      { value: 'other',        text: 'その他' },
    ],
  },
];

/** 診断冒頭に出すメタ設問（position: 'pre'） */
const PRE_META_QUESTIONS  = META_QUESTIONS.filter(m => m.position === 'pre');
/** 採点設問の後に出すメタ設問（従来どおり結果直前） */
const POST_META_QUESTIONS = META_QUESTIONS.filter(m => m.position !== 'pre');

/** 雇用経験の内部値 → 表示文言（結果・PDF・レポート用） */
const EXPERIENCE_LABELS = {
  current:          '現在雇用している',
  past:             '過去に雇用していたが、現在はいない',
  none_considering: '雇用経験はない',
};

/** 活用状況（Q2）の内部値 → 表示文言 */
const STATUS_LABELS = {
  working_well: 'うまくいっている',
  some_issues:  '一部課題がある',
  major_issues: '大きな課題がある',
};

/**
 * 雇用経験から診断ルートを判定する
 * - experienced   : 現在雇用 or 過去に雇用（改善・再発防止の文脈）
 * - inexperienced : 雇用経験なし・検討中（受入準備の文脈）
 * - unknown       : 未回答・既存データ（既存表示のまま＝後方互換）
 * @param {Object} meta loadMeta() の戻り値
 * @returns {'experienced'|'inexperienced'|'unknown'}
 */
function getExperienceRoute(meta) {
  const v = meta && meta.employment_experience;
  if (v === 'current' || v === 'past') return 'experienced';
  if (v === 'none_considering')        return 'inexperienced';
  return 'unknown';
}

/** 診断ルートの内部値 → 通知用の表示文言（Slack/Notion/メール向け） */
const EXPERIENCE_ROUTE_LABELS = {
  experienced:   '経験者',
  inexperienced: '未経験',
};

/**
 * 商談前の顧客分類（customer segment）を判定する
 * - current_well         : 現在雇用 × うまくいっている
 * - current_some_issues  : 現在雇用 × 一部課題がある
 * - current_major_issues : 現在雇用 × 大きな課題がある
 * - past_not_current     : 過去に雇用していたが、現在はいない
 * - inexperienced        : 雇用経験はない
 * - unknown              : 既存データ・未回答（current だが活用状況欠損の旧データ含む）
 * @param {Object} meta loadMeta() の戻り値
 * @returns {string}
 */
function getCustomerSegment(meta) {
  const exp    = meta && meta.employment_experience;
  const status = meta && meta.foreign_talent_status;
  if (exp === 'current') {
    if (status === 'working_well') return 'current_well';
    if (status === 'some_issues')  return 'current_some_issues';
    if (status === 'major_issues') return 'current_major_issues';
    return 'unknown'; // Q2導入前の旧データ等。推測で分類しない
  }
  if (exp === 'past')             return 'past_not_current';
  if (exp === 'none_considering') return 'inexperienced';
  return 'unknown';
}

/** 顧客分類の内部値 → 表示文言（Slack/Notion/メール・PDF向け） */
const SEGMENT_LABELS = {
  current_well:         '活用中・良好',
  current_some_issues:  '活用中・一部課題あり',
  current_major_issues: '活用中・大きな課題あり',
  past_not_current:     '過去雇用・現在はいない',
  inexperienced:        '未経験',
  unknown:              '不明',
};

/**
 * 顧客分類別の結果コメント・CTA文言（商談前分類の出し分け）
 * ─────────────────────────────────────────────
 * 方針（2026-06）: 診断名「外国人材活用診断」と成功確率の指標表記は全分類共通。
 * 出し分けるのは「結果コメント・PDF内コメント・CTA文言・AIコメント文脈・通知用の相談方針」のみ。
 * - unknown（既存データ・未回答）はキー自体を持たず、既存の汎用表示にフォールバックする
 * - 将来分類別に質問・スコアリングを分ける場合も、まずここに文言を追加していく
 */
const SEGMENT_CONTENT = {
  current_well: {
    // 結果画面・PDFに表示する分類別コメント
    resultComment: '御社はすでに外国人材の活用が一定の成果につながっている状態です。次のテーマは、増員・横展開と、属人的な運用を仕組みに変えて再現性を持たせることです。今の良い状態のうちに教育・評価・受入の制度を整備することで、人数が増えても安定した定着と戦力化が可能になります。',
    // ロック予告バナーの補足文
    teaserSupplement: 'この分析をもとに、増員・横展開と運用の仕組み化に向けた具体策が分かります。',
    // 相談CTA（結果画面・最終セクション）
    ctaLabel: '外国人材活用の拡大について相談する',
    ctaNote:  '増員・横展開・制度整備など、今の良い状態を仕組みとして定着させる進め方を一緒に整理します。',
    // 通知（Slack/Notion/メール）用の相談方針
    consultFocus: '増員・横展開・制度整備の相談',
  },
  current_some_issues: {
    resultComment: '御社はすでに外国人材を雇用・運用していますが、現場コミュニケーションや定着面に改善余地がある状態です。小さな違和感を放置すると、離職や現場の疲弊につながりやすいため、早めに受入体制と現場支援を見直すことが重要です。',
    teaserSupplement: 'この分析をもとに、定着と現場コミュニケーション改善の具体策が分かります。',
    ctaLabel: '外国人材活用の課題を相談する',
    ctaNote:  '現在の課題を整理し、定着・現場コミュニケーションの改善策を一緒に検討します。',
    consultFocus: '定着・現場コミュニケーション改善の相談',
  },
  current_major_issues: {
    resultComment: '現在の外国人材活用には、受入体制の大きな見直しが必要な状態です。課題の多くは外国人材そのものではなく、受入設計・教育・現場支援の不足から生じている可能性があります。まずは課題を整理し、受入体制を再設計することが先決です。',
    teaserSupplement: 'この分析をもとに、課題の整理と受入体制再設計の方向性が分かります。',
    ctaLabel: '受入体制の再設計を相談する',
    ctaNote:  '早急に課題を整理し、受入設計・教育・現場支援の再設計を一緒に進めます。',
    consultFocus: '早急な課題整理・受入体制再設計の相談',
  },
  past_not_current: {
    resultComment: '御社は過去に外国人材を雇用した経験があります。当時うまくいかなかった原因は、外国人材そのものではなく、職務設計・支援体制・現場理解に改善余地があった可能性があります。失敗体験を整理することで、再チャレンジすべきかどうかも含めて冷静に判断できます。',
    teaserSupplement: 'この分析をもとに、過去の失敗原因の整理と再チャレンジ可否の判断材料が分かります。',
    ctaLabel: '過去の失敗原因を相談する',
    ctaNote:  '過去の失敗原因を整理し、再チャレンジの可否と進め方を一緒に判断します。',
    consultFocus: '失敗原因分析・再チャレンジ可否の相談',
  },
  inexperienced: {
    resultComment: '御社はこれから外国人材の雇用を検討する段階です。重要なのは「採用できるか」よりも「受け入れられる体制があるか」です。在留資格・職務設計・教育担当者・生活支援・入社後90日の定着設計を採用前に整えることで、ミスマッチや早期離職を防ぎやすくなります。',
    teaserSupplement: 'この分析をもとに、採用前に整えるべき受入体制と入社後90日の設計の方向性が分かります。',
    ctaLabel: '外国人材の受入準備を相談する',
    ctaNote:  '採用前に整えるべき体制や在留資格、入社後90日の定着設計について相談できます。',
    consultFocus: '受入準備・在留資格・90日設計の相談',
  },
};

/** メタ集合を保存（オブジェクト丸ごと） */
function saveMeta(meta) {
  try { localStorage.setItem(STORAGE_META_KEY, JSON.stringify(meta || {})); } catch (_) {}
}
/** メタ集合を読み込む（失敗時は空オブジェクト — 送信ブロックしない） */
function loadMeta() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_META_KEY)) || {};
  } catch { return {}; }
}
/** メタ集合をクリア（送信完了時に呼ぶ — 別セッションへの混入防止） */
function clearMeta() {
  try { localStorage.removeItem(STORAGE_META_KEY); } catch (_) {}
}

function saveCurrentIndex(idx) {
  sessionStorage.setItem('gtn_risk_current', String(idx));
}

function loadCurrentIndex() {
  const v = sessionStorage.getItem('gtn_risk_current');
  return v !== null ? parseInt(v, 10) : 0;
}

function saveSource(src) {
  localStorage.setItem(STORAGE_SOURCE_KEY, src);
}

function loadSource() {
  return localStorage.getItem(STORAGE_SOURCE_KEY) || 'direct';
}

function saveRef(ref) {
  localStorage.setItem(STORAGE_REF_KEY, ref || '');
}

function loadRef() {
  return localStorage.getItem(STORAGE_REF_KEY) || '';
}

/* =============================================
   Phase3.2: Google Ads 計測 — utm_* / gclid / session_id
   既存 source/ref とは独立。既存イベントには付与しない（互換維持）
   ============================================= */

function _setLs(key, val) {
  if (val === undefined || val === null || val === '') return;
  try { localStorage.setItem(key, String(val)); } catch (_) { /* quota / privacy mode */ }
}
function _getLs(key) {
  try { return localStorage.getItem(key) || ''; } catch (_) { return ''; }
}

function saveUtm(source, medium, campaign) {
  _setLs(STORAGE_UTM_SOURCE_KEY,   source);
  _setLs(STORAGE_UTM_MEDIUM_KEY,   medium);
  _setLs(STORAGE_UTM_CAMPAIGN_KEY, campaign);
}
function loadUtmSource()   { return _getLs(STORAGE_UTM_SOURCE_KEY); }
function loadUtmMedium()   { return _getLs(STORAGE_UTM_MEDIUM_KEY); }
function loadUtmCampaign() { return _getLs(STORAGE_UTM_CAMPAIGN_KEY); }

/** gclid を TTL付きで保存（30日） */
function saveGclid(value) {
  if (!value) return;
  const now = Date.now();
  const rec = { value: String(value), createdAt: now, expiresAt: now + GCLID_TTL_MS };
  try { localStorage.setItem(STORAGE_GCLID_KEY, JSON.stringify(rec)); } catch (_) {}
}

/** gclid を取得。期限切れなら自動削除して '' を返す */
function loadGclid() {
  let raw;
  try { raw = localStorage.getItem(STORAGE_GCLID_KEY); } catch (_) { return ''; }
  if (!raw) return '';
  try {
    const rec = JSON.parse(raw);
    if (!rec || !rec.value || !rec.expiresAt) return '';
    if (Date.now() > rec.expiresAt) {
      try { localStorage.removeItem(STORAGE_GCLID_KEY); } catch (_) {}
      return '';
    }
    return rec.value;
  } catch (_) { return ''; }
}

/**
 * debug_mode の検出と永続化（GA4 DebugView 用）
 * - URL に ?debug_mode=true|1 があれば LocalStorage に永続化（ページ遷移後も継続）
 * - URL に ?debug_mode=off があれば LocalStorage から削除
 * - 本番ユーザーの URL には付かないので、本番計測にはノイズが乗らない
 */
const STORAGE_DEBUG_MODE_KEY = 'gtn_debug_mode';
function initDebugMode() {
  try {
    const p = new URLSearchParams(window.location.search);
    const v = (p.get('debug_mode') || '').toLowerCase().trim();
    if (v === 'off' || v === 'false' || v === '0') {
      localStorage.removeItem(STORAGE_DEBUG_MODE_KEY);
    } else if (v === 'true' || v === '1') {
      localStorage.setItem(STORAGE_DEBUG_MODE_KEY, 'true');
    }
  } catch (_) {}
}
function isDebugMode() {
  try {
    const p = new URLSearchParams(window.location.search);
    const v = (p.get('debug_mode') || '').toLowerCase().trim();
    if (v === 'true' || v === '1') return true;
    return localStorage.getItem(STORAGE_DEBUG_MODE_KEY) === 'true';
  } catch (_) { return false; }
}

/** URL から utm_* / gclid を取り込み、優先度: URL > 保存値 で永続化 */
function saveAdsParams() {
  const p = new URLSearchParams(window.location.search);
  const urlSrc      = (p.get('utm_source')   || '').trim();
  const urlMed      = (p.get('utm_medium')   || '').trim();
  const urlCamp     = (p.get('utm_campaign') || '').trim();
  const urlGclid    = (p.get('gclid')        || '').trim();

  // utm_* は URL指定があったキーのみ上書き
  if (urlSrc)  _setLs(STORAGE_UTM_SOURCE_KEY,   urlSrc);
  if (urlMed)  _setLs(STORAGE_UTM_MEDIUM_KEY,   urlMed);
  if (urlCamp) _setLs(STORAGE_UTM_CAMPAIGN_KEY, urlCamp);

  // gclid: URLに新しい値があれば上書き保存（30日リセット）
  if (urlGclid) saveGclid(urlGclid);
}

/** GA4 session_id を非同期取得してキャッシュ（gtag('get') 利用） */
let _ga4SessionIdCache = '';
function primeSessionId() {
  if (_ga4SessionIdCache) return;
  if (typeof gtag !== 'function') return;
  try {
    gtag('get', 'G-HK43N5MW3L', 'session_id', (id) => {
      if (id) _ga4SessionIdCache = String(id);
    });
  } catch (_) { /* gtag 未ロード時は無視 */ }
}
function getSessionId() { return _ga4SessionIdCache; }

/**
 * 新規イベント用 共通パラメータ
 * 既存イベントには付与しない（互換維持）
 */
function getCommonParams(extra) {
  const utmSource = loadUtmSource();
  const base = {
    page_path: (window.location && window.location.pathname) || '',
    // source は utm_source 優先、無ければ既存 source（bni 等の独自値）にフォールバック
    source:    utmSource || loadSource() || 'direct',
    medium:    loadUtmMedium()   || '(none)',
    campaign:  loadUtmCampaign() || '(none)',
    gclid:     loadGclid() || '',
    session_id: getSessionId() || '',
  };
  // GA4 DebugView 表示用 — URL ?debug_mode=true / LS gtn_debug_mode=true の時のみ付与
  // 本番ユーザーには付かないので通常計測には影響しない
  if (isDebugMode()) base.debug_mode = true;
  return { ...base, ...(extra || {}) };
}

/**
 * 共通 eventDispatcher（重複実装禁止 — 新規イベントはこの関数経由）
 * - gtag と dataLayer の両方に同一ペイロードを送る
 * - 片系障害は try/catch で吸収
 * - sessionStorage にクロスページのイベントログを記録（検証用、最大50件）
 * - 既存 trackEvent には触れない（互換維持）
 */
const STORAGE_EVENT_LOG_KEY = 'gtn_event_log';
function trackNewEvent(name, extraParams) {
  const payload = getCommonParams(extraParams);
  try {
    if (typeof gtag === 'function') gtag('event', name, payload);
  } catch (_) {}
  try {
    if (typeof window !== 'undefined' && Array.isArray(window.dataLayer)) {
      window.dataLayer.push({ event: name, ...payload });
    }
  } catch (_) {}
  // クロスページ検証用ログ（sessionStorage）— DebugViewでも見えるが、開発者がDevToolsで即時確認できるように
  try {
    const raw = sessionStorage.getItem(STORAGE_EVENT_LOG_KEY);
    const log = raw ? JSON.parse(raw) : [];
    log.push({ name, ts: Date.now(), ...payload });
    if (log.length > 50) log.splice(0, log.length - 50);
    sessionStorage.setItem(STORAGE_EVENT_LOG_KEY, JSON.stringify(log));
  } catch (_) {}
}

/**
 * URLとLocalStorageからトラッキングパラメータを取得して返す
 * URLパラメータが最優先。なければLocalStorage値を使用。
 * @returns {{ source: string, ref: string }}
 */
function getTrackingParams() {
  const params = new URLSearchParams(window.location.search);
  const srcUrl = (params.get('source') || '').toLowerCase().trim();
  const refUrl = params.get('ref');

  const source = srcUrl || loadSource() || 'direct';
  const ref    = refUrl !== null
    ? decodeURIComponent(refUrl).trim()
    : loadRef();

  return { source, ref };
}

/**
 * URLからトラッキングパラメータを取得してLocalStorageに保存する
 * 各ページ初期化時に呼び出す（CheckPage.init / ResultPage.init / diagnosis.html）
 * ・source: URLにあれば上書き（小文字・トリム）、なければ既存値を維持
 * ・ref   : URLにあれば上書き（URLデコード・トリム）、なければ既存値を維持
 *
 * 標準 source 値: bni / linkedin / x / note / facebook / direct / other
 */
function saveTrackingParams() {
  const params    = new URLSearchParams(window.location.search);
  const srcFromUrl = params.get('source');
  const refFromUrl = params.get('ref');

  // source: URL指定あり → 正規化して上書き。未指定かつ未保存 → 'direct' を初期値として設定
  if (srcFromUrl !== null) {
    saveSource(srcFromUrl.toLowerCase().trim() || 'direct');
  } else if (!localStorage.getItem(STORAGE_SOURCE_KEY)) {
    saveSource('direct');
  }

  // ref: URL指定あり → URLデコードして上書き。未指定なら既存値を維持
  if (refFromUrl !== null) {
    saveRef(decodeURIComponent(refFromUrl).trim());
  }

  // デバッグログ（開発時の動作確認用）
  console.log('[GTN] tracking :', { source: loadSource(), ref: loadRef() });
}

/* =============================================
   GA4 イベント
   ============================================= */
function trackEvent(name, params = {}) {
  // GA4 gtag
  if (typeof gtag !== 'undefined') {
    gtag('event', name, params);
  }
  // GTM dataLayer
  if (typeof dataLayer !== 'undefined') {
    dataLayer.push({ event: name, ...params });
  }
}

/* =============================================
   GAS送信（Google Sheets連携）
   ============================================= */
async function sendToGAS(payload) {
  // ── デバッグ: URL確認 ──────────────────────────
  console.log('[GTN] GAS_URL :', GAS_URL);
  console.log('[GTN] payload :', JSON.parse(JSON.stringify(payload))); // 深いコピーで確実に展開

  if (!GAS_URL || GAS_URL === 'YOUR_GAS_DEPLOYMENT_URL_HERE') {
    console.warn('[GTN] ⚠ GAS_URL が未設定です。送信をスキップします。');
    return;
  }

  // ── デバッグ: 送信開始 ─────────────────────────
  console.log('[GTN] sending to GAS...');
  console.log('[GTN] fetch オプション:', {
    method: 'POST',
    mode:   'no-cors',
    body:   JSON.stringify(payload),
  });

  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      mode:   'no-cors', // GASはno-corsが必要（レスポンス本文は読めない）
      headers: { 'Content-Type': 'application/json' },
      body:   JSON.stringify(payload),
    });

    // ── デバッグ: fetch 完了（no-cors は type:'opaque' になる） ──
    console.log('[GTN] GAS送信完了');
    console.log('[GTN] Response type:', res.type);   // "opaque" なら GAS に到達している
    console.log('[GTN] Response status:', res.status); // no-cors は常に 0

  } catch (err) {
    // ── デバッグ: エラー詳細 ───────────────────────
    console.error('[GTN] GAS送信エラー ▼');
    console.error('  name   :', err.name);
    console.error('  message:', err.message);
    console.error('  stack  :', err.stack);
  }
}

/* =============================================
   CHECK PAGE ロジック
   ============================================= */
const CheckPage = {
  answers: {},
  currentIdx: 0,
  viewedQuestions: {},  // QA: question_viewed 重複発火防止用
  _autoAdvanceTimer: null,  // UX: 自動遷移タイマーID
  phase: 'questions',   // 'pre'（雇用経験などの冒頭メタ）| 'questions' | 'meta'（立場などのメタ設問）
  meta: {},             // 診断メタ集合（gtn_risk_meta と同期）
  metaIdx: 0,           // POST_META_QUESTIONS 内の現在位置
  preIdx: 0,            // PRE_META_QUESTIONS 内の現在位置

  init() {
    // トラッキングパラメータ（source / ref）を保存（v2.3）
    saveTrackingParams();
    // Phase3.2: utm_* / gclid を取り込み・保存（既存 attribution と並走）
    saveAdsParams();
    // Phase3.3: debug_mode を URL から検出して LS 永続化（DebugView 用）
    initDebugMode();
    // GA4 session_id を非同期取得してキャッシュ
    primeSessionId();
    // 新規診断セッション開始時に complete_diagnosis 保険発火フラグをクリア
    try { sessionStorage.removeItem('gtn_complete_fired_for'); } catch (_) {}

    this.answers    = loadAnswers();
    this.currentIdx = loadCurrentIndex();
    this.meta       = loadMeta();
    this.metaIdx    = 0;
    this.preIdx     = 0;

    // 冒頭メタ（雇用経験など）に未回答の表示対象があれば 'pre' フェーズから開始。
    // 回答済み（途中再開）なら従来どおり採点設問から（後方互換）。
    const preUnanswered = this.visiblePreMeta().some(
      m => m.required && this.meta[m.key] === undefined
    );
    this.phase = (PRE_META_QUESTIONS.length > 0 && preUnanswered) ? 'pre' : 'questions';

    // インデックスが範囲外ならリセット
    if (this.currentIdx >= QUESTIONS.length) this.currentIdx = 0;

    this.bindEvents();
    if (this.phase === 'pre') {
      this.renderPre();
    } else {
      this.render();
    }

    // QA: 診断ページ到達イベント（page_view_lp と同形式）
    trackEvent('page_view_check', {
      source: loadSource(),
      ref:    loadRef(),
    });

    // Phase3.2: Google広告計測用 — 診断開始
    trackNewEvent('start_diagnosis');
  },

  bindEvents() {
    document.getElementById('btn-prev').addEventListener('click', () => this.prev());
    document.getElementById('btn-next').addEventListener('click', () => this.next());
  },

  render() {
    const q   = QUESTIONS[this.currentIdx];
    const tot = QUESTIONS.length;

    // プログレスバー（回答済み数ベース・上限100%）
    const answeredCount = Object.keys(this.answers).length;
    const pct = Math.min(Math.round((answeredCount / tot) * 100), 100);
    document.getElementById('progress-fill').style.width = pct + '%';
    document.getElementById('progress-label').textContent =
      `質問 ${this.currentIdx + 1} / ${tot}`;
    // progress-count を直接更新（MutationObserver 非依存で安定化）
    const pctEl = document.getElementById('progress-count');
    if (pctEl) pctEl.textContent = pct + '% 完了';

    // 質問本文
    document.getElementById('q-label').textContent = `Q${q.id}`;
    document.getElementById('q-text').textContent  = q.text;

    // 選択肢描画
    const container = document.getElementById('options-container');
    container.innerHTML = '';
    q.options.forEach((opt) => {
      const alreadySelected = this.answers[q.id] === opt.label;
      const item = document.createElement('div');
      item.className = 'option-item';
      item.innerHTML = `
        <input type="radio" name="q${q.id}" id="opt_${q.id}_${opt.label}"
               value="${opt.label}" ${alreadySelected ? 'checked' : ''}>
        <label class="option-label" for="opt_${q.id}_${opt.label}">
          <span class="option-badge">${opt.label}</span>
          <span>${opt.text}</span>
        </label>
      `;
      container.appendChild(item);
    });

    // 選択イベント
    container.querySelectorAll('input[type="radio"]').forEach(radio => {
      radio.addEventListener('change', () => this.onSelect(q.id, radio.value));
    });

    // ボタン状態
    const hasAns = this.answers[q.id] !== undefined;
    const isLast = this.currentIdx === tot - 1;
    const prevBtn  = document.getElementById('btn-prev');
    const nextBtn  = document.getElementById('btn-next');

    // 先頭の採点設問でも、冒頭メタ（雇用経験）があればそこへ戻れる
    prevBtn.disabled = this.currentIdx === 0 && PRE_META_QUESTIONS.length === 0;

    if (isLast) {
      // 立場などのメタ設問が後続にある場合は、まだ結果に飛ばさず「次へ」
      if (POST_META_QUESTIONS.length > 0) {
        nextBtn.textContent = '次へ →';
        nextBtn.className   = 'btn-next-q';
      } else {
        nextBtn.textContent = '結果を見る →';
        nextBtn.className   = 'btn-finish';
      }
    } else {
      nextBtn.textContent = '次の質問へ →';
      nextBtn.className   = 'btn-next-q';
    }
    nextBtn.disabled = !hasAns;

    // フェードアニメーション
    const card = document.getElementById('question-card');
    card.classList.remove('fade-up');
    void card.offsetWidth;
    card.classList.add('fade-up');

    // QA: 問ごとの表示計測（初回表示のみ発火、戻るで再表示した場合はスキップ）
    if (!this.viewedQuestions[q.id]) {
      this.viewedQuestions[q.id] = true;
      trackEvent('question_viewed', {
        question_num: q.id,
        source:       loadSource(),
      });
    }
  },

  onSelect(qId, label) {
    const wasAnswered = this.answers[qId] !== undefined;
    this.answers[qId] = label;
    saveAnswers(this.answers);
    document.getElementById('btn-next').disabled = false;

    // GA4イベント
    const q = QUESTIONS.find(q => q.id === qId);
    const opt = q.options.find(o => o.label === label);
    trackEvent('question_answered', {
      question_num: qId,
      answer_label: label,
      answer_score: opt.score,
    });

    // UX: 初回選択時のみ0.5秒後に自動遷移（回答変更時・最終問はスキップ）
    if (!wasAnswered && this.currentIdx < QUESTIONS.length - 1) {
      clearTimeout(this._autoAdvanceTimer);
      this._autoAdvanceTimer = setTimeout(() => this.next(), 500);
    }
  },

  prev() {
    // 冒頭メタフェーズ：先頭なら戻る先なし
    if (this.phase === 'pre') {
      if (this.preIdx > 0) {
        this.preIdx--;
        this.renderPre();
      }
      return;
    }
    // 立場フェーズ：先頭メタなら質問フェーズ（最終問）へ戻る
    if (this.phase === 'meta') {
      if (this.metaIdx > 0) {
        this.metaIdx--;
        this.renderMeta();
      } else {
        this.phase = 'questions';
        this.render();
      }
      return;
    }
    if (this.currentIdx > 0) {
      clearTimeout(this._autoAdvanceTimer);  // UX: 自動遷移キャンセル
      this.currentIdx--;
      saveCurrentIndex(this.currentIdx);
      this.render();
    } else if (PRE_META_QUESTIONS.length > 0) {
      // 先頭の採点設問 → 冒頭メタの最後の表示対象設問へ戻る
      clearTimeout(this._autoAdvanceTimer);
      this.phase  = 'pre';
      this.preIdx = Math.max(this.visiblePreMeta().length - 1, 0);
      this.renderPre();
    }
  },

  next() {
    // 冒頭メタフェーズ中は専用ハンドラへ
    if (this.phase === 'pre') return this.nextPre();
    // 立場フェーズ中は専用ハンドラへ
    if (this.phase === 'meta') return this.nextMeta();

    const q = QUESTIONS[this.currentIdx];
    if (!this.answers[q.id]) return;

    if (this.currentIdx < QUESTIONS.length - 1) {
      this.currentIdx++;
      saveCurrentIndex(this.currentIdx);
      this.render();
    } else {
      // 全問完了 → 立場などのメタ設問があれば先にメタフェーズへ（結果表示直前）
      if (POST_META_QUESTIONS.length > 0) {
        this.enterMetaPhase();
      } else {
        this.goToResult();
      }
    }
  },

  /* ---- 冒頭メタ（雇用経験・活用状況）フェーズ ---- */

  /**
   * 現在の回答状態で表示対象となる冒頭メタ設問の一覧
   * （showIf 条件付き設問＝Q2活用状況は、Q1が「現在雇用している」のときだけ含まれる）
   */
  visiblePreMeta() {
    return PRE_META_QUESTIONS.filter(m => !m.showIf || m.showIf(this.meta));
  },

  renderPre() {
    const list = this.visiblePreMeta();
    // 回答変更で表示対象が減った場合に備えてインデックスを安全側に丸める
    if (this.preIdx >= list.length) this.preIdx = Math.max(list.length - 1, 0);
    const m = list[this.preIdx];

    // 採点設問の前なのでプログレスは0%スタート
    document.getElementById('progress-fill').style.width = '0%';
    document.getElementById('progress-label').textContent =
      list.length > 1 ? `事前確認 ${this.preIdx + 1} / ${list.length}` : '最初の質問';
    const pctEl = document.getElementById('progress-count');
    if (pctEl) pctEl.textContent = '0% 完了';

    document.getElementById('q-label').textContent = m.label || '';
    document.getElementById('q-text').textContent  = m.text;

    // 選択肢描画（値ベース・バッジなし — renderMeta と同形式）
    const container = document.getElementById('options-container');
    container.innerHTML = '';
    m.options.forEach((opt) => {
      const selected = this.meta[m.key] === opt.value;
      const item = document.createElement('div');
      item.className = 'option-item';
      item.innerHTML = `
        <input type="radio" name="meta_${m.key}" id="meta_${m.key}_${opt.value}"
               value="${opt.value}" ${selected ? 'checked' : ''}>
        <label class="option-label" for="meta_${m.key}_${opt.value}">
          <span>${opt.text}</span>
        </label>
      `;
      container.appendChild(item);
    });
    container.querySelectorAll('input[type="radio"]').forEach(radio => {
      radio.addEventListener('change', () => this.onMetaSelect(m.key, radio.value));
    });

    // ボタン状態
    const prevBtn = document.getElementById('btn-prev');
    const nextBtn = document.getElementById('btn-next');
    prevBtn.disabled = this.preIdx === 0;  // 最初の画面なので戻れない
    nextBtn.textContent = '次の質問へ →';
    nextBtn.className   = 'btn-next-q';
    nextBtn.disabled = m.required ? (this.meta[m.key] === undefined) : false;

    // フェードアニメーション
    const card = document.getElementById('question-card');
    card.classList.remove('fade-up');
    void card.offsetWidth;
    card.classList.add('fade-up');
  },

  nextPre() {
    const list = this.visiblePreMeta();
    const m = list[this.preIdx];
    // 必須ガード（未選択では進めない）
    if (m && m.required && this.meta[m.key] === undefined) return;

    if (this.preIdx < list.length - 1) {
      this.preIdx++;
      this.renderPre();
    } else {
      this.phase = 'questions';
      this.render();
    }
  },

  /* ---- 立場（メタ設問）フェーズ ---- */
  enterMetaPhase() {
    clearTimeout(this._autoAdvanceTimer);  // 自動遷移が残っていれば解除
    this.phase   = 'meta';
    this.metaIdx = 0;
    this.renderMeta();
  },

  renderMeta() {
    const m = POST_META_QUESTIONS[this.metaIdx];

    // 全質問回答済みなのでプログレスは100%
    document.getElementById('progress-fill').style.width = '100%';
    document.getElementById('progress-label').textContent = '最後の質問';
    const pctEl = document.getElementById('progress-count');
    if (pctEl) pctEl.textContent = '100% 完了';

    document.getElementById('q-label').textContent = m.label || '';
    document.getElementById('q-text').textContent  = m.text;

    // 選択肢描画（値ベース・バッジなし）
    const container = document.getElementById('options-container');
    container.innerHTML = '';
    m.options.forEach((opt) => {
      const selected = this.meta[m.key] === opt.value;
      const item = document.createElement('div');
      item.className = 'option-item';
      item.innerHTML = `
        <input type="radio" name="meta_${m.key}" id="meta_${m.key}_${opt.value}"
               value="${opt.value}" ${selected ? 'checked' : ''}>
        <label class="option-label" for="meta_${m.key}_${opt.value}">
          <span>${opt.text}</span>
        </label>
      `;
      container.appendChild(item);
    });
    container.querySelectorAll('input[type="radio"]').forEach(radio => {
      radio.addEventListener('change', () => this.onMetaSelect(m.key, radio.value));
    });

    // ボタン状態
    const prevBtn = document.getElementById('btn-prev');
    const nextBtn = document.getElementById('btn-next');
    prevBtn.disabled = false;  // 質問フェーズへ戻れる
    nextBtn.textContent = '結果を見る →';
    nextBtn.className   = 'btn-finish';
    // 必須なら未選択時は進めない
    nextBtn.disabled = m.required ? (this.meta[m.key] === undefined) : false;

    // フェードアニメーション
    const card = document.getElementById('question-card');
    card.classList.remove('fade-up');
    void card.offsetWidth;
    card.classList.add('fade-up');
  },

  onMetaSelect(key, value) {
    this.meta[key] = value;
    // 雇用経験を「現在雇用している」以外に変更した場合、
    // 条件付きQ2（活用状況）の回答は無効になるため破棄する（誤分類防止）
    if (key === 'employment_experience' && value !== 'current') {
      delete this.meta.foreign_talent_status;
    }
    // 業種: 既存の保存先（gtn_risk_industry）へ併走保存し、AIコメントの loadIndustry() を維持。
    // GA4 industry_selected も従来計測を維持するため、診断開始後（check）で移設発火する。
    if (key === 'industry') {
      if (typeof saveIndustry === 'function') saveIndustry(value);
      if (typeof trackEvent === 'function') {
        trackEvent('industry_selected', {
          page_id:  'diag_check',
          industry: value,
          source:   (typeof loadSource === 'function') ? loadSource() : '',
          ref:      (typeof loadRef    === 'function') ? loadRef()    : '',
        });
      }
    }
    saveMeta(this.meta);
    document.getElementById('btn-next').disabled = false;
    // 任意計測（既存イベントと並走・互換維持）
    trackEvent('meta_answered', {
      meta_key:   key,
      meta_value: value,
      source:     loadSource(),
    });
  },

  nextMeta() {
    const m = POST_META_QUESTIONS[this.metaIdx];
    // 必須ガード（未選択では進めない）
    if (m.required && this.meta[m.key] === undefined) return;

    if (this.metaIdx < POST_META_QUESTIONS.length - 1) {
      this.metaIdx++;
      this.renderMeta();
    } else {
      this.goToResult();
    }
  },

  /** 全問＋メタ完了 → 結果ページへ（完了計測は従来どおりここで発火） */
  goToResult() {
    const score = this.calcScore();
    const rating = calcRating(score);
    trackEvent('diagnosis_complete', {
      score,
      rating,
      source: loadSource(),
    });
    // Phase3.2: Google広告計測用 — 診断完了
    trackNewEvent('complete_diagnosis', {
      score,
      diagnosis_result_type: rating,
    });
    // 同一診断での result.html 保険発火を抑止するためのフラグ
    // 値は完了スコア。新たな診断開始時（CheckPage.init / clearAnswers）でクリア
    try { sessionStorage.setItem('gtn_complete_fired_for', String(score)); } catch (_) {}
    sessionStorage.setItem('gtn_risk_current', '0');
    window.location.href = 'result.html';
  },

  calcScore() {
    return QUESTIONS.reduce((acc, q) => {
      const label = this.answers[q.id];
      if (!label) return acc;
      const opt = q.options.find(o => o.label === label);
      return acc + (opt ? opt.score : 0);
    }, 0);
  },
};

/* =============================================
   RESULT PAGE ロジック
   ============================================= */
const ResultPage = {
  score:          0,
  rating:         'B',
  rate:           0,
  risks:          [],
  answers:        {},
  companyTypeKey: 'growth_driving',
  axisScores:     null,  // v4.0: 4軸スコア情報
  experience:     '',        // 雇用経験（current / past / none_considering / ''）
  talentStatus:   '',        // 活用状況（working_well / some_issues / major_issues / ''）
  route:          'unknown', // 診断ルート（experienced / inexperienced / unknown）
  segment:        'unknown', // 顧客分類（current_well 等 / unknown）

  init() {
    this.answers = loadAnswers();

    // 回答がなければ診断ページへ戻す
    if (Object.keys(this.answers).length === 0) {
      window.location.href = 'check.html';
      return;
    }

    this.score          = this.calcScore();
    this.rating         = calcRating(this.score);
    this.rate           = SCORE_RATE_MAP[this.score] ?? 20;
    this.risks          = this.extractRisks();
    this.axisScores     = this.calcAxisScores();                    // v4.0
    this.companyTypeKey = getCompanyType(this.rate, this.axisScores); // v4.0

    // 雇用経験・活用状況・顧客分類（送信後の clearMeta() に備え、init 時点で確定保持する）
    // 既存データ（メタ未保存）の場合は 'unknown' となり、表示は従来のまま
    const meta        = (typeof loadMeta === 'function') ? loadMeta() : {};
    this.experience   = (meta && meta.employment_experience) || '';
    this.talentStatus = (meta && meta.foreign_talent_status) || '';
    this.route        = getExperienceRoute(meta);
    this.segment      = getCustomerSegment(meta);

    // Phase3.2: utm_* / gclid を取り込み・保存（直接URLアクセス対応）
    if (typeof saveAdsParams === 'function')   saveAdsParams();
    if (typeof initDebugMode === 'function')   initDebugMode();
    if (typeof primeSessionId === 'function')  primeSessionId();

    // 結果フォームの業種 select #f-industry を、診断中（メタ設問）で選んだ業種でプリフィルする。
    // ※現行 v6.0 は簡易フォーム（会社名＋メール＋任意の名前）で #f-industry はコメントアウト中
    //   （result.html）のため、本処理は実質 no-op。フルフォーム復活時に二重質問を防ぐ前方互換。
    //   taxonomy はメタ設問の options と #f-industry の option を一致させてあるため、復活後はそのまま機能。
    try {
      const _indEl = document.getElementById('f-industry');
      const _ind   = (typeof loadIndustry === 'function') ? loadIndustry() : '';
      if (_indEl && _ind && Array.from(_indEl.options).some(o => o.value === _ind)) {
        _indEl.value = _ind;
      }
    } catch (_) {}

    // Phase3.2: complete_diagnosis 保険発火
    //   CheckPage.next() 経由でのページ遷移直前発火は、ブラウザによっては
    //   GA4 collect ビーコンが間に合わない or dataLayer がクリアされる場合がある
    //   ※「同一診断スコアでの重複発火」は sessionStorage フラグで抑止
    try {
      const firedFor = sessionStorage.getItem('gtn_complete_fired_for');
      if (firedFor !== String(this.score)) {
        if (typeof trackNewEvent === 'function') {
          trackNewEvent('complete_diagnosis', {
            score:                 this.score,
            diagnosis_result_type: this.rating,
            fallback:              true,   // 保険発火である旨を識別可能に
          });
        }
        sessionStorage.setItem('gtn_complete_fired_for', String(this.score));
      }
    } catch (_) { /* sessionStorage 不可環境では諦める */ }

    // ローディング後に描画
    // result-main を visible にしてから overlay を hide する順番で
    // 「overlay フェード中に result-main が opacity:0 のまま」になるのを防ぐ
    setTimeout(() => {
      this.render();
      const resultMain = document.getElementById('result-main');
      if (resultMain) resultMain.classList.add('visible');
      document.getElementById('loading-overlay').classList.add('hide');
    }, 2000);

    // フォームハンドリング
    this.initForm();

    // スクロール導線の初期化（v5.2）
    this.initScrollCTAs();

    // トラッキングパラメータ（source / ref）を保存（v2.3）
    saveTrackingParams();
  },

  calcScore() {
    return QUESTIONS.reduce((acc, q) => {
      const label = this.answers[q.id];
      if (!label) return acc;
      const opt = q.options.find(o => o.label === label);
      return acc + (opt ? opt.score : 0);
    }, 0);
  },

  /**
   * 4軸スコアを計算して返す（v4.0）
   * axisScore: A=3 / B=2 / C=1 で各軸の実得点・最大点・達成率(%)を算出
   * @returns {{ strategyScore, structureScore, operationScore, retentionScore,
   *             strategyMax, structureMax, operationMax, retentionMax,
   *             strategyRate, structureRate, operationRate, retentionRate,
   *             weakestAxis, secondWeakestAxis }}
   */
  calcAxisScores() {
    const axes = ['strategy', 'structure', 'operation', 'retention'];
    const scores = { strategy: 0, structure: 0, operation: 0, retention: 0 };
    const maxes  = { strategy: 0, structure: 0, operation: 0, retention: 0 };

    QUESTIONS.forEach(q => {
      const label = this.answers[q.id];
      const opt   = label ? q.options.find(o => o.label === label) : null;
      if (q.axis) {
        scores[q.axis] += opt ? (opt.axisScore ?? 0) : 0;
        maxes[q.axis]  += 3; // max axisScore per question
      }
    });

    const rates = {};
    axes.forEach(axis => {
      rates[axis + 'Rate'] = maxes[axis] > 0
        ? Math.round((scores[axis] / maxes[axis]) * 100)
        : 0;
    });

    // 最弱・2番目に弱い軸を特定
    const sorted = [...axes].sort((a, b) => rates[a + 'Rate'] - rates[b + 'Rate']);

    return {
      strategyScore:    scores.strategy,
      structureScore:   scores.structure,
      operationScore:   scores.operation,
      retentionScore:   scores.retention,
      strategyMax:      maxes.strategy,
      structureMax:     maxes.structure,
      operationMax:     maxes.operation,
      retentionMax:     maxes.retention,
      strategyRate:     rates.strategyRate,
      structureRate:    rates.structureRate,
      operationRate:    rates.operationRate,
      retentionRate:    rates.retentionRate,
      weakestAxis:      sorted[0],
      secondWeakestAxis: sorted[1],
    };
  },

  extractRisks() {
    const risks = [];
    // C回答（high）→ B回答（mid）の順で収集
    const collectLevel = (level) => {
      QUESTIONS.forEach(q => {
        const label = this.answers[q.id];
        if (!label || label === 'A') return;
        const riskDef = q.risks[label];
        if (!riskDef || riskDef.level !== level) return;
        risks.push({ qId: q.id, ...riskDef });
      });
    };
    collectLevel('high');
    collectLevel('mid');
    return risks.slice(0, 5); // 最大5件
  },

  render() {
    // 成功確率アニメーション
    this.animateCounter(this.rate);

    // 評価バッジ（v3.2: ランク別補足ラベルを付加）
    const badge = document.getElementById('rating-badge');
    badge.textContent = `総合評価：${RATING_LABELS[this.rating] || this.rating + 'ランク'}`;
    badge.className   = `rating-badge rating-${this.rating.toLowerCase()}`;

    // 総評（v4.0: タイプベースのコメント・簡易版は概要のみ表示）
    const typeComment  = TYPE_RESULT_COMMENTS[this.companyTypeKey] || COMMENTS[this.rating];
    document.getElementById('result-comment').textContent = typeComment;

    // リスクリスト描画
    this.renderRisks();

    // スコア補足
    const scoreEl = document.getElementById('score-detail');
    if (scoreEl) {
      scoreEl.textContent = `スコア：${this.score} / 20点`;
    }

    // GA4
    trackEvent('result_viewed', {
      score:  this.score,
      rating: this.rating,
      rate:   this.rate,
      source: loadSource(),
    });
  },

  animateCounter(target) {
    const el = document.getElementById('rate-num');
    if (!el) return;
    const duration = 1500;
    const start = performance.now();
    const step = (ts) => {
      const progress = Math.min((ts - start) / duration, 1);
      // ease-out
      const ease = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(ease * target);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  },

  renderRisks() {
    const container = document.getElementById('risk-list');
    if (!container) return;

    if (this.risks.length === 0) {
      container.innerHTML = `
        <div class="risk-none">
          ✓ 現時点で抽出された主要リスクはありません。<br>
          引き続き受入体制の維持・改善をおすすめします。
        </div>
      `;
      return;
    }

    container.innerHTML = this.risks.map(r => `
      <div class="risk-item risk-${r.level}" role="listitem">
        <span class="risk-icon">${r.level === 'high' ? '⚠' : '△'}</span>
        <div>
          <div class="risk-item-label">${r.label}</div>
          <div class="risk-item-detail">${r.detail}</div>
        </div>
      </div>
    `).join('');
  },

  /* ---- フォーム ---- */
  initForm() {
    const form = document.getElementById('lead-form');
    if (!form) return;

    // Phase2: form_start — 初回 focus で1度だけ発火
    let formStarted = false;
    form.addEventListener('focusin', () => {
      if (formStarted) return;
      formStarted = true;
      trackEvent('form_start', {
        page_id: 'diag_result',
        source:  loadSource(),
        ref:     loadRef(),
        rating:  this.rating || '',
      });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!this.validateForm(form)) {
        // Phase2: form_error — 失敗フィールドごとに発火
        const errs = this._lastValidationErrors || [];
        errs.forEach((er) => {
          trackEvent('form_error', {
            page_id: 'diag_result',
            field:   er.field,
            reason:  er.reason,
            source:  loadSource(),
            ref:     loadRef(),
            rating:  this.rating || '',
          });
        });
        return;
      }

      const submitBtn = form.querySelector('[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = '送信中...';

      const formData = this.getFormData(form);
      const payload  = this.buildPayload(formData);

      console.group('[GTN] フォーム送信');
      console.log('formData :', JSON.parse(JSON.stringify(formData)));
      console.log('payload  :', JSON.parse(JSON.stringify(payload)));
      console.groupEnd();

      await sendToGAS(payload);

      console.log('[GTN] sendToGAS 処理完了');

      // 診断メタ（立場 role 等）は送信完了後に必ずクリアする。
      // 前回セッションの古い立場が、別人/別セッションの送信に混入するのを防ぐ（4-2 / 6-2）。
      // ※ payload には送信前に meta を取り込み済みのため、ここでのクリアは送信値に影響しない。
      clearMeta();

      // フォームを非表示にしてサンクス表示（v6.0: gate-form-wrap）
      const formWrap = document.getElementById('gate-form-wrap') || document.getElementById('form-body');
      if (formWrap) formWrap.style.display = 'none';
      document.getElementById('thanks-msg').classList.add('show');

      // フォーム前のレポートプレビュー＋情報ギャップを非表示にする（送信後は完全版を表示するため）
      const reportPreview = document.getElementById('report-preview-section');
      if (reportPreview) reportPreview.style.display = 'none';
      const diagGap = document.querySelector('.diag-gap-section');
      if (diagGap) diagGap.style.display = 'none';

      // PDF セクション & 完全版分析 & 相談CTA を表示
      const pdfSection         = document.getElementById('pdf-section');
      const fullReportSection  = document.getElementById('full-report-section');
      const consultSection     = document.getElementById('consult-final-section') || document.getElementById('final-consult-section');
      if (pdfSection)        pdfSection.classList.remove('hidden');
      if (fullReportSection) fullReportSection.classList.remove('hidden');
      if (consultSection)    consultSection.classList.remove('hidden');

      // v6.0: 完全版セクション内に詳細分析を描画
      this.renderAxisSummary();
      this.renderTypeDiagnosis();
      this.renderPeerComparison();
      this.renderCrisisBlock();

      // 「Global Talent Navi（GTN）とは」信頼ブロックをCTA導線途中から除外（v5.3）
      const trustSection = document.getElementById('trust-section');
      if (trustSection) trustSection.classList.add('hidden');

      // 相談リンクに CONSULT_URL を再セット（新たに表示された要素も対象）
      this._applyConsultLinks();

      // PDF ダウンロードボタンのセットアップ
      const pdfBtn = document.getElementById('btn-pdf-download');
      if (pdfBtn) {
        pdfBtn.addEventListener('click', async () => {
          trackEvent('pdf_download', { rating: this.rating, score: this.score, source: loadSource() });
          pdfBtn.disabled = true;
          pdfBtn.textContent = 'PDF生成中...';
          const genMsg = document.getElementById('pdf-generating-msg');
          if (genMsg) genMsg.classList.remove('hidden');

          try {
            await this.generatePDF(formData);
          } catch (err) {
            console.error('[GTN] PDF生成エラー:', err);
            // フォールバック: 印刷ウィンドウを開く
            const html = this.buildReportHTML(formData);
            const win  = window.open('', '_blank');
            if (win) {
              win.document.write(html);
              win.document.close();
              win.focus();
              setTimeout(() => win.print(), 800);
            }
          } finally {
            pdfBtn.disabled = false;
            pdfBtn.textContent = '📥 PDFをダウンロードする';
            if (genMsg) genMsg.classList.add('hidden');
          }
        });
      }

      // ① フォーム送信と同時にPDFを自動ダウンロード（ダウンロードし忘れ防止）
      //   ・jsPDF/html2canvas が揃っている時のみ自動実行（未ロード時に印刷ウィンドウが
      //     勝手に開くのを避けるため、フォールバックの自動起動はしない）
      //   ・失敗してもサンクス表示・以降の処理は止めない（付帯処理）
      //   ・手動の「PDFをダウンロードする」ボタンは再ダウンロード用に引き続き有効
      if (typeof window.jspdf !== 'undefined' && typeof html2canvas !== 'undefined') {
        const autoGenMsg = document.getElementById('pdf-generating-msg');
        if (autoGenMsg) autoGenMsg.classList.remove('hidden');
        if (pdfBtn) { pdfBtn.disabled = true; pdfBtn.textContent = 'PDF生成中...'; }
        trackEvent('pdf_download', { rating: this.rating, score: this.score, source: loadSource(), trigger: 'auto' });
        Promise.resolve(this.generatePDF(formData))
          .catch((err) => console.error('[GTN] PDF自動生成エラー:', err))
          .finally(() => {
            if (autoGenMsg) autoGenMsg.classList.add('hidden');
            if (pdfBtn) { pdfBtn.disabled = false; pdfBtn.textContent = '📥 PDFをダウンロードする'; }
          });
      }

      // PDF セクションまでスクロール
      if (pdfSection) {
        pdfSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      // GA4
      trackEvent('form_submit', {
        variant:         'new',   // v6.0
        rating:          this.rating,
        score:           this.score,
        source:          loadSource(),
        ref:             loadRef(),
        industry:        formData.industry,
        employees:       formData.employees,
        foreignEmployed: formData.foreignEmployed,
      });
      trackEvent('lead_captured', {
        variant: 'new',   // v6.0
        rating:  this.rating,
        source:  loadSource(),
        ref:     loadRef(),
      });
      // Phase3.2: Google広告コンバージョン候補 — フォーム送信完了
      trackNewEvent('submit_lead_form', {
        score:                 this.score,
        diagnosis_result_type: this.rating,
      });
    });
  },

  /* ---- スクロール導線 & 相談リンク初期化 (v5.3) ---- */
  initScrollCTAs() {
    /**
     * フォームセクションへスムーススクロール
     */
    const scrollToForm = () => {
      // v6.0: main-gate-section（新）または lead-form-section（旧）を探す
      const target = document.getElementById('main-gate-section') || document.getElementById('lead-form-section');
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      trackEvent && trackEvent('scroll_to_form', { trigger: 'cta_click' });
      // Phase3.2: Google広告計測用 — CTA クリック（フォーム遷移）
      trackNewEvent('click_cta', {
        cta_location:          'result_scroll_to_form',
        diagnosis_result_type: this.rating || '',
      });
    };

    // ① js-scroll-to-form クラスを持つすべての要素（<a>以外も含む）
    document.querySelectorAll('.js-scroll-to-form').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        scrollToForm();
      });
      // キーボードアクセシビリティ
      if (el.getAttribute('tabindex') !== null || el.getAttribute('role') === 'button') {
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            scrollToForm();
          }
        });
      }
    });

    // ② js-consult-link: ページロード時点で CONSULT_URL を設定する
    //    フォーム送信前のボタン（dual-cta 等）も含め、全箇所を一括設定
    //    フォーム送信後は再度上書きされるので競合しない
    this._applyConsultLinks();

    // ③ consult_click 計測 (Phase1)
    //    .js-consult-link クリックを document 委譲で1回だけ補足
    //    （_applyConsultLinks は複数回呼ばれるため、要素単位の addEventListener は不可）
    const self = this;
    document.addEventListener('click', (e) => {
      const link = e.target.closest('.js-consult-link');
      if (!link) return;
      const location = link.getAttribute('data-consult-location')
                    || link.id
                    || 'unknown';
      trackEvent('consult_click', {
        page_id:  'diag_result',
        location,
        source:   loadSource(),
        ref:      loadRef(),
        rating:   self.rating || '',
      });
      // Phase3.2: Google広告計測用 — CTA クリック（無料相談）
      trackNewEvent('click_cta', {
        cta_location:          'consult_' + location,
        diagnosis_result_type: self.rating || '',
      });
    });
  },

  /**
   * .js-consult-link を持つ全 <a> タグに CONSULT_URL をセット（v5.3）
   * ページロード時・フォーム送信後の両タイミングで呼ぶ
   */
  _applyConsultLinks() {
    document.querySelectorAll('.js-consult-link').forEach(el => {
      el.href   = CONSULT_URL;
      el.target = '_blank';
      el.rel    = 'noopener noreferrer';
    });
  },

  validateForm(form) {
    let valid = true;
    const errors = [];
    const fields = form.querySelectorAll('[data-required]');

    fields.forEach(field => {
      const errEl = document.getElementById(field.id + '-err');
      field.classList.remove('error');
      if (errEl) errEl.classList.remove('show');

      if (!field.value.trim()) {
        field.classList.add('error');
        if (errEl) { errEl.textContent = 'この項目は必須です。'; errEl.classList.add('show'); }
        valid = false;
        errors.push({ field: field.id || field.name || 'unknown', reason: 'required' });
      }
    });

    // メールバリデーション
    const emailEl = document.getElementById('f-email');
    if (emailEl && emailEl.value.trim()) {
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailEl.value.trim());
      if (!emailOk) {
        emailEl.classList.add('error');
        const errEl = document.getElementById('f-email-err');
        if (errEl) { errEl.textContent = '正しいメールアドレスを入力してください。'; errEl.classList.add('show'); }
        valid = false;
        errors.push({ field: 'f-email', reason: 'invalid_email' });
      }
    }

    // v6.0: foreignEmployed は v6 では非表示なのでスキップ
    // 将来復活用に残す
    const foreignEmployedField = form.querySelector('[name="foreignEmployed"]');
    if (foreignEmployedField && foreignEmployedField.offsetParent !== null) {
      const foreignEmployedChecked = form.querySelector('[name="foreignEmployed"]:checked');
      if (!foreignEmployedChecked) {
        const errEl = document.getElementById('f-foreign-employed-err');
        if (errEl) { errEl.textContent = 'いずれかを選択してください。'; errEl.classList.add('show'); }
        valid = false;
        errors.push({ field: 'foreignEmployed', reason: 'required' });
      }
    }

    // Phase2: 呼び出し元が form_error 発火で使えるよう、失敗内訳を保持
    this._lastValidationErrors = errors;

    return valid;
  },

  getFormData(form) {
    // v6.0: 2項目フォーム対応（存在しないフィールドは空文字）
    const val = (sel) => { const el = form.querySelector(sel); return el ? el.value.trim() : ''; };
    const foreignEmployedEl = form.querySelector('[name="foreignEmployed"]:checked');
    return {
      company:         val('#f-company'),
      name:            val('#f-name'),
      email:           val('#f-email'),
      phone:           val('#f-phone'),
      industry:        val('#f-industry') || loadIndustry(),
      employees:       val('#f-employees'),
      foreignEmployed: foreignEmployedEl ? foreignEmployedEl.value : '',
      foreignCount:    val('#f-foreign-count'),
      challenges:      Array.from(form.querySelectorAll('[name="challenges"]:checked')).map(cb => cb.value).join('、'),
    };
  },

  buildPayload(formData) {
    const answerLabels = QUESTIONS.map(q => this.answers[q.id] || '未回答');
    const ax = this.axisScores || {};
    // 診断メタ（立場 role など）を汎用集合としてまとめて同梱。
    // 取得失敗・空でも {} となり送信はブロックしない（4-1）。
    // 将来 timeline 等を足す場合も META_QUESTIONS に定義を足すだけで自動的にここへ乗る。
    const meta    = (typeof loadMeta === 'function') ? loadMeta() : {};
    const route   = getExperienceRoute(meta);
    const segment = getCustomerSegment(meta);
    // HubSpot連携用: 派生値（顧客分類）も meta に同梱して既存のGASマッピング機構に乗せる。
    // unknown は書き込まない（既存コンタクトの分類を「不明」で上書きしない）
    const hsMeta = Object.assign({}, meta);
    if (segment !== 'unknown') hsMeta.customer_segment = segment;
    return {
      timestamp:        new Date().toISOString(),
      variant:          'new',  // v6.0: A/Bテスト用識別子
      meta:             hsMeta, // { role, employment_experience, foreign_talent_status, customer_segment } — GAS側でHubSpotプロパティへマッピング
      // 雇用経験（Q1）・活用状況（Q2）・顧客分類 — Slack通知・Notion・メール等で
      // metaを掘らずに使えるようトップレベルにも展開。
      // 未回答・既存データでは空文字 / 'unknown'（GAS側でのnull安全を担保）
      employmentExperience:      (meta && meta.employment_experience) || '',
      employmentExperienceLabel: EXPERIENCE_LABELS[(meta && meta.employment_experience)] || '',
      foreignTalentStatus:       (meta && meta.foreign_talent_status) || '',
      foreignTalentStatusLabel:  STATUS_LABELS[(meta && meta.foreign_talent_status)] || '',
      customerSegment:           segment,
      customerSegmentLabel:      SEGMENT_LABELS[segment] || '',
      experienceRoute:           route,
      experienceRouteLabel:      EXPERIENCE_ROUTE_LABELS[route] || '',
      consultFocus:              (SEGMENT_CONTENT[segment] || {}).consultFocus || '',
      score:            this.score,
      rate:             this.rate,
      rating:           this.rating,
      companyType:      this.companyTypeKey,
      risks:            this.risks.map(r => r.label),
      source:           loadSource(),
      ref:              loadRef(),
      // Google広告アトリビューション（HubSpot連携用・初回接点保持はGAS側で担保）
      // 空文字のときはGAS側で送信スキップ（既存値を汚さない）
      gclid:            loadGclid()      || '',
      utm_source:       loadUtmSource()  || '',
      utm_medium:       loadUtmMedium()  || '',
      utm_campaign:     loadUtmCampaign()|| '',
      sendReport:       true,
      // 4軸スコア（v4.0）
      strategyScore:    ax.strategyScore,
      structureScore:   ax.structureScore,
      operationScore:   ax.operationScore,
      retentionScore:   ax.retentionScore,
      strategyRate:     ax.strategyRate,
      structureRate:    ax.structureRate,
      operationRate:    ax.operationRate,
      retentionRate:    ax.retentionRate,
      weakestAxis:      ax.weakestAxis,
      // フォーム情報
      company:          formData.company,
      name:             formData.name,
      email:            formData.email,
      phone:            formData.phone,
      industry:         formData.industry,
      employees:        formData.employees,
      foreignEmployed:  formData.foreignEmployed,
      foreignCount:     formData.foreignCount,
      challenges:       formData.challenges,
      // 各回答（Q1〜Q10）
      a1: answerLabels[0],  a2: answerLabels[1],  a3: answerLabels[2],
      a4: answerLabels[3],  a5: answerLabels[4],  a6: answerLabels[5],
      a7: answerLabels[6],  a8: answerLabels[7],  a9: answerLabels[8],
      a10: answerLabels[9],
    };
  },
};

/* =============================================
   離職コストモデル（参考値 v1）
   ─────────────────────────────────────────────
   ・baseMin / baseMax : 参考レンジの基準値（円）
   ・将来的に業種係数・難易度係数・採用タイプ係数で調整できる構造
   ・今バージョンでは評価（A/B/C）のみ係数を適用
   ============================================= */

const ATTRITION_COST_MODEL = {
  /** 参考コスト基準（円） */
  baseMin: 1200000,  // 120万円
  baseMax: 4200000,  // 420万円

  /**
   * 業種係数（将来拡張用）
   * 現バージョンでは参照しているが、calcAttritionCost 内で係数適用を切り替え可能
   */
  industryWeights: {
    '製造業':      1.1,
    '建設業':      1.1,
    '農業・水産業': 1.0,
    '介護・福祉':   1.1,
    '外食・飲食':   1.0,
    'サービス業':   0.95,
    '小売・流通':   0.95,
    'IT・情報通信': 1.0,
    'その他':      1.0,
    '_default':    1.0,
  },

  /**
   * 受入難易度係数（評価ベース）
   * C評価 = 整備不足 = 離職リスク高め → コスト係数大
   */
  difficultyWeights: {
    A: 0.9,   // 受入体制良好 → コスト低め
    B: 1.0,   // 標準
    C: 1.1,   // 受入体制未整備 → コスト高め
  },

  /**
   * 採用タイプ係数（将来拡張用）
   * 今バージョンでは使用しないが、将来「採用タイプ選択」追加時に活用
   */
  hiringTypeWeights: {
    professional: 0.9,   // 専門職採用型
    frontline:    1.0,   // 現場戦力採用型
    development:  1.1,   // 育成前提採用型
    undecided:    1.0,   // 未定
  },
};

/**
 * 参考離職コストを計算して返す
 * @param {string} industry - 業種文字列（未入力 or 不明は '_default'）
 * @param {string} rating   - 'A' | 'B' | 'C'
 * @returns {{ min: number, max: number }} 参考コスト（円）
 */
function calcAttritionCost(industry, rating) {
  const model = ATTRITION_COST_MODEL;

  // 難易度係数（評価から算出）
  const diffW = model.difficultyWeights[rating] ?? 1.0;

  // 業種係数（将来活用。現バージョンでは乗算しない）
  // const indW = model.industryWeights[industry] ?? model.industryWeights['_default'];

  const combined = diffW; // 将来: combined = diffW * indW * hiringTypeW

  return {
    min: Math.round(model.baseMin * combined / 10000) * 10000,  // 1万円単位で丸め
    max: Math.round(model.baseMax * combined / 10000) * 10000,
  };
}

/** 万円表示に変換 */
function fmtManyen(yen) {
  return (yen / 10000).toFixed(0) + '万円';
}

/**
 * グレード別の離職コスト強調メッセージを返す（v5.1）
 * "1名あたり" と "採用コスト・教育コスト・再採用コスト含む" を明示
 * @param {string} grade - 'A' | 'B' | 'C'
 * @returns {string} HTML文字列
 */
function getAttritionCostMessage(grade) {
  const basis = '採用コスト・教育コスト・再採用コスト含む';
  if (grade === 'C') {
    return `受入体制が未整備のままでは、<strong>1名あたり数十万〜100万円以上の損失が発生する可能性</strong>があります（${basis}）。早期離職を防ぐ体制整備が、コスト削減の最も効果的な手段です。`;
  }
  if (grade === 'B') {
    return `受入体制に課題がある状態では、<strong>1名あたり数十万円規模の損失リスク</strong>があります（${basis}）。受入・運用設計を整えることで、このリスクは大きく軽減できます。`;
  }
  // grade === 'A'
  return `現在の受入体制が維持できれば、1名あたりの早期離職リスクは低水準です（${basis}）。引き続き定着支援・評価制度の整備を続けることで、さらなるコスト最適化が可能です。`;
}

/* =============================================
   ソース別メッセージ（BNI対応）
   ─────────────────────────────────────────────
   source パラメータに応じた補助文言を一元管理。
   将来的に note / linkedin / x 向けも追加可能。
   ============================================= */

const SOURCE_MESSAGES = {
  bni: {
    /** 診断LP（diagnosis.html）に表示する補助文言 */
    diagnosisNote: 'ご紹介でこの診断をご利用いただいた方へ<br>診断後の無料相談では、制度論だけでなく、現場運用や定着まで含めて整理します。',
    /** 結果ページ（result.html）の CTA 付近に表示する補助文言 */
    ctaNote: '紹介を受けてご利用の方は、診断結果の見方や次の打ち手について無料でご相談いただけます。',
  },
  // 将来追加例:
  // note: { diagnosisNote: '...', ctaNote: '...' },
};

/**
 * source に対応するメッセージオブジェクトを返す
 * @param {string} source - loadSource() の戻り値
 * @returns {object|null}
 */
function getSourceMessage(source) {
  return SOURCE_MESSAGES[source] || null;
}

/**
 * 紹介用コピーテキスト（result.html の「ご紹介にもご活用いただけます」ブロック用）
 * この文面をそのまま転送・コピペできるように設計
 */
const REFERRAL_COPY_TEXT =
  '外国人材活用診断 — 外国人材の採用を検討中の企業様にも、すでに雇用中・過去に雇用した企業様にも使える簡易診断です。\n' +
  '採用の進め方、受入体制、定着リスクを整理できます。\n' +
  '▶ https://www.globaltalent-navi.com/diagnosis/';

/* =============================================
   評価別コンテンツ（v2.1 追加）
   ─────────────────────────────────────────────
   改善余地メッセージ・経営コメント・次ステップを定数管理。
   文言のみ後から調整できる構造にする。
   ============================================= */

/**
 * 改善余地メッセージ（result-hero の成功確率表示の下に補足表示）
 * 断定的に新数値を出さず、「改善可能性」を伝えることが目的
 */
const IMPROVEMENT_NOTES = {
  A: '受入体制の基盤は比較的整っています。一方で、評価制度・現場運用・定着支援まで含めた設計の精度によって、長期的な定着率や戦力化に大きな差が生まれます。',
  B: '一定の土台はありますが、受入体制と運用設計を見直すことで、戦力化・定着の成功確率を大きく高めることができます。',
  C: '現状のままでは、外国人材を雇用しても戦力化・定着でつまずくリスクがあります。ただし、活用目的・受入責任者・定着設計を整理することで、改善していくことは十分可能です。',
};

/**
 * GTN 経営コメント（評価別）
 * 「採用問題ではなく経営設計の問題」と認識してもらうための視点提供
 */
const MANAGEMENT_COMMENTS = {
  A: '現状は比較的良い土台が整っています。良い状態のうちに設計精度を高めておくことが重要です。外国人材活用の成果は、受入体制・定着・戦力化まで含めた設計の精度で決まります。評価制度・現場運用の継続的な改善が、長期的な安定運用につながります。',
  B: '外国人材活用は、単なる人材確保ではなく、活用目的・受入責任者・定着設計まで含めた「経営設計」です。体制を整えることが、戦力化・定着の成功確率を最も高める方法です。今のうちに整理することが、離職や現場負荷を大きく減らします。',
  C: '現状のままでは、外国人材を雇用しても戦力化・定着でつまずく可能性があります。活用目的・受入責任者・現場運用の整理が不十分な状態は、早期離職や現場負荷の増加に直結します。ただし、体制を整理することで改善は十分可能です。',
};

/**
 * 次に整理すべきポイント
 * 評価別の見出し + 共通3項目（シンプルに保守しやすい構造）
 */
const NEXT_STEPS = {
  heading: {
    A: '安定運用に向けて確認・精度向上すべきポイント',
    B: '戦力化・定着のために整理すべき3つのポイント',
    C: 'まず整えるべき3つのポイント',
  },
  items: [
    {
      title: '活用目的の明確化',
      desc:  '人員補充なのか、戦力化なのかを経営として定義する。目的が曖昧なままでは、定着・評価設計全体がブレます。',
    },
    {
      title: '受入責任者の決定と役割分担',
      desc:  '誰が外国人材活用の責任を持つかを明確にする。責任の所在が曖昧な組織では、問題が発生しても誰も動けない状態になります。',
    },
    {
      title: '定着設計の整備',
      desc:  '教育・生活支援・評価・現場フォローの仕組みを整理する。受入後の運用設計こそが、戦力化・定着の成功確率を最も左右する要素です。',
    },
  ],
};

/**
 * 改善提案PDF用：固定3項目（NEXT_STEPS.items）に対応する「最初の一歩」「期待効果」。
 * ※診断データには依存しない静的アドバイス（items と同じ並び順）。推測スコアは生成しない。
 */
const NEXT_STEP_DETAILS = [
  { firstStep: '「人員補充」か「戦力化」かを、経営として一文で定義する', effect: '受入・評価・定着設計すべての判断軸が定まる' },
  { firstStep: '受入責任者を1名決め、役割と権限を明文化する',           effect: '問題発生時に現場が止まらず動ける体制になる' },
  { firstStep: '教育・面談・評価・現場フォローの運用フローを1枚に整理する', effect: '早期離職と教育コストの無駄を抑えられる' },
];

/**
 * 評価別CTAメッセージ（v2.2 追加）
 * ─────────────────────────────────────────────
 * CTA①（軽め／リスク確認後の入口）と
 * CTA②（本命／ページ下部）のテキストを評価別に一元管理。
 * lightCta : CTA①の誘導文（→ を末尾に付加して表示）
 * mainTitle: CTA②の見出し
 * mainDesc : CTA②の説明文
 */
const CTA_MESSAGES = {
  A: {
    lightCta:  'この結果を踏まえて、より安定した受入・定着設計を整理したい場合は、無料相談をご利用いただけます',
    mainTitle: '診断結果をもとに、無料で相談できます',
    mainDesc:  '良い土台がある企業ほど、設計精度によって定着率や戦力化に差が生まれます。運用設計・定着設計・評価制度まで整理したい場合は、無料相談をご利用ください。',
  },
  B: {
    lightCta:  'この結果を踏まえて、受入体制と運用設計を整理したい場合は、無料相談をご利用いただけます',
    mainTitle: '戦力化・定着のために、無料で整理できます',
    mainDesc:  '受入体制・役割設計・定着支援を見直すことで、戦力化・定着の成功確率を大きく高めることができます。貴社の状況に合わせた進め方を整理したい場合は、無料相談をご利用ください。',
  },
  C: {
    lightCta:  'この結果を踏まえて、現状課題と優先順位を整理したい場合は、無料相談をご利用いただけます',
    mainTitle: '現状を整理して、改善の第一歩を',
    mainDesc:  '受入体制や運用設計に課題がある状態では、早期離職や現場負荷の増加につながる可能性があります。まず何を整えるべきかを整理したい場合は、診断結果をもとに無料でご相談いただけます。',
  },
};

/* =============================================
   v3.1 追加：企業タイプ診断
   ============================================= */

/**
 * 5分類の企業タイプ定義（v4.0 軸スコアベース）
 * ─────────────────────────────────────────────
 * 1. strategic_utilization   戦略活用型
 * 2. growth_driving          成長推進型
 * 3. operation_challenge     運用課題型
 * 4. reception_unprepared    受入体制未整備型
 * 5. direction_unclear       方向性未整理型
 */
const COMPANY_TYPES = {
  strategic_utilization: {
    label:    '戦略活用型',
    badge:    '外国人材活用リーダー',
    desc:     '外国人材を戦力として活用する土台が整っている状態です。今後は活用の高度化・定着の再現性向上がテーマです。',
    colorKey: 'a',
    icon:     '🏆',
  },
  growth_driving: {
    label:    '成長推進型',
    badge:    '運用改善フェーズ',
    desc:     '外国人材活用の基盤は一定程度整っており、制度や運用の見直しで戦力化・定着の成果をさらに伸ばしやすい状態です。',
    colorKey: 'b',
    icon:     '📈',
  },
  operation_challenge: {
    label:    '運用課題型',
    badge:    '現場設計の見直しが急務',
    desc:     '外国人材活用の方向性はある一方で、現場運用や受入設計に課題が残る状態です。定着率や現場負荷に影響しやすいタイプです。',
    colorKey: 'c',
    icon:     '⚙️',
  },
  reception_unprepared: {
    label:    '受入体制未整備型',
    badge:    '体制構築フェーズ',
    desc:     '受入体制の整備が十分でないため、戦力化・定着や社内運用に課題が生じやすい状態です。受入設計と運用体制の見直しが重要です。',
    colorKey: 'd',
    icon:     '⚠',
  },
  direction_unclear: {
    label:    '方向性未整理型',
    badge:    '活用方針の整理が先決',
    desc:     '外国人材活用の方向性や目的が十分に整理されていない状態です。運用の検討より先に、まず活用方針の整理が重要です。',
    colorKey: 'e',
    icon:     '🔴',
  },
};

/**
 * 軸スコアから最弱軸キーを返すヘルパー
 * @param {{ strategyRate, structureRate, operationRate, retentionRate }} axisRates
 * @returns {string}
 */
function getWeakestAxisKey(axisRates) {
  const axes = ['strategy', 'structure', 'operation', 'retention'];
  return axes.reduce((min, a) =>
    (axisRates[a + 'Rate'] < axisRates[min + 'Rate'] ? a : min)
  );
}

/**
 * 軸スコアの組み合わせで企業タイプを判定する（v4.0）
 * 単純な成功確率帯ではなく、4軸の弱点構造で分類する。
 *
 * @param {number} rate       - 成功確率(%)
 * @param {object} axisRates  - { strategyRate, structureRate, operationRate, retentionRate }
 * @returns {string} COMPANY_TYPES のキー
 */
function getCompanyType(rate, axisRates) {
  // axisRates が渡されない場合（後方互換）は成功確率のみで判定
  if (!axisRates) {
    if (rate >= 80) return 'strategic_utilization';
    if (rate >= 65) return 'growth_driving';
    if (rate >= 45) return 'reception_unprepared';
    return 'direction_unclear';
  }

  const { strategyRate, structureRate, operationRate, retentionRate } = axisRates;
  const minAxisRate = Math.min(strategyRate, structureRate, operationRate, retentionRate);

  // ① 方向性未整理型：strategy が弱く、全体も低い
  if (strategyRate < 45 && rate < 60) {
    return 'direction_unclear';
  }

  // ② 戦略活用型：全体高い + 戦略・定着両方強い + 全軸50%以上
  if (rate >= 72 && strategyRate >= 65 && retentionRate >= 65 && minAxisRate >= 50) {
    return 'strategic_utilization';
  }

  // ③ 運用課題型：戦略は比較的高いが、受入または現場運用が弱い
  if (strategyRate >= 55 && (structureRate < 50 || operationRate < 50)) {
    return 'operation_challenge';
  }

  // ④ 受入体制未整備型：受入または定着が弱い
  if (structureRate < 50 || retentionRate < 50) {
    return 'reception_unprepared';
  }

  // ⑤ 成長推進型：それ以外（中程度・改善余地あり）
  return 'growth_driving';
}

/* =============================================
   v3.1 追加：同規模企業比較
   ============================================= */

/**
 * 従業員規模別の平均成功確率（%）
 */
const PEER_AVERAGES = {
  '1〜9名':    58,
  '10〜29名':  58,
  '30〜99名':  62,
  '100〜299名': 67,
  '300名以上':  70,
  '_default':   65,
};

/**
 * 従業員規模に対応する平均成功確率を返す
 * @param {string} employees - f-employees の選択値
 * @returns {number}
 */
function getPeerAverage(employees) {
  return PEER_AVERAGES[employees] ?? PEER_AVERAGES['_default'];
}

/* =============================================
   v3.1 追加：危機認識ブロック
   ============================================= */

/**
 * 成功確率帯別の危機認識メッセージ
 * high < 45% / mid 45〜64% / low ≥ 65%
 */
const CRISIS_MESSAGES = {
  high: {
    headline:  '受入体制・運用設計に複数のリスク要因が見られます',
    text:      '受入体制や運用設計に重大な課題があり、このまま放置すると早期離職・現場負荷の増加・教育コストの無駄につながる可能性があります。戦力化・定着のために、体制の見直しを優先することを推奨します。',
    impact:    '早期離職などが発生した場合の参考損失レンジ：100万〜500万円程度',
    impactKey: 'high',
  },
  mid: {
    headline:  '改善が必要なリスク要因が見られます',
    text:      '受入体制や運用設計に一部課題があります。放置すると定着率の低下や現場負荷の増加につながる可能性があります。',
    impact:    '早期離職などが発生した場合の参考損失レンジ：数十万〜100万円程度',
    impactKey: 'mid',
  },
  low: {
    headline:  'リスクは低水準ですが、継続改善が重要です',
    text:      '現時点では大きなリスク要因は見られません。引き続き受入体制・運用設計の改善を行うことで、安定した戦力化・定着が期待できます。',
    impact:    '現状維持で安定した運用が期待できます',
    impactKey: 'low',
  },
};

/**
 * 成功確率から危機レベルを返す
 * @param {number} rate
 * @returns {string} 'high' | 'mid' | 'low'
 */
function getCrisisLevel(rate) {
  if (rate >= 65) return 'low';
  if (rate >= 45) return 'mid';
  return 'high';
}

/**
 * グレードとGTN基準とのスコアギャップに応じたリスク警告メッセージを返す（v5.1）
 * ・C評価：早期離職・現場混乱・社内負担増加のリスクを明示
 * ・B評価：配属後のミスマッチ・定着率低下の可能性を明示
 * ・A評価：継続整備の重要性を伝える
 * @param {number} scoreGap - GTN基準値との差分（負 = 基準未満）
 * @param {string} grade    - 'A' | 'B' | 'C'
 * @returns {string} HTML文字列
 */
function getRiskAlertMessage(scoreGap, grade) {
  if (grade === 'C') {
    if (scoreGap < -20) {
      return '受入体制・運用設計に重大な課題が複数確認されています。このままでは<strong>早期離職・現場の混乱・教育コストの無駄</strong>が高い確率で起きやすい状態です。戦力化・定着のために、体制設計の抜本的な見直しを強くおすすめします。';
    }
    return '受入体制・運用設計に複数の課題が見られます。このままでは<strong>早期離職・現場の混乱・現場負担の増加</strong>につながるリスクがあります。体制整備を優先的に進めてください。';
  }
  if (grade === 'B') {
    if (scoreGap < 0) {
      return '受入体制の一部が整備不足の状態です。このままでは<strong>役割分担の曖昧さによるミスマッチや定着率の低下</strong>につながる可能性があります。運用設計の精度を高めることをおすすめします。';
    }
    return '受入体制の基本は整っていますが、改善余地があります。<strong>定着率の低下や現場負荷の増加</strong>を防ぐために、引き続き運用設計の精度を高めておくことをおすすめします。';
  }
  // grade === 'A'
  return '現時点では良い受入体制が整っています。<strong>継続的な体制整備と運用改善</strong>を続けることで、外国人材の安定した戦力化・定着が期待できます。';
}

/* =============================================
   フォーム前「レポートプレビュー」描画（実データ・公開範囲限定）
   ─────────────────────────────────────────────
   公開 : 成功確率 / 評価 / レーダー / 各軸スコア / リスク件数 / 優先改善TOP3タイトル
   ゲート: リスク詳細・改善アクション詳細・ROI試算・PDF本体（フォーム送信後）
   ※診断ロジック非変更。this.rate / rating / axisScores / risks / NEXT_STEPS を読むだけ。
   ============================================= */

/**
 * 「このような診断レポートを無料で受け取れます」プレビューカードを実データで描画。
 * 対象: #report-preview-card（result.html）
 */
ResultPage.renderReportPreview = function () {
  const card = document.getElementById('report-preview-card');
  if (!card) return;

  const ratingColors = {
    A: { bg: '#edf7f1', color: '#1a5c3a', border: '#a7e3bf' },
    B: { bg: '#fffbeb', color: '#92400e', border: '#fcd34d' },
    C: { bg: '#fef2f2', color: '#991b1b', border: '#fecaca' },
  };
  const rc = ratingColors[this.rating] || ratingColors['B'];

  // 4軸スコアバー（レーダー併記）
  const AXES = ['strategy', 'structure', 'operation', 'retention'];
  const ax   = this.axisScores || {};
  const barsHTML = AXES.map(a => {
    const info = AXIS_LABELS[a];
    const rate = (ax[a + 'Rate'] != null) ? ax[a + 'Rate'] : 0;
    const bc   = rate < 45 ? '#b91c1c' : rate < 65 ? '#d97706' : '#1a5c3a';
    return `
      <div class="rp-bar-row">
        <span class="rp-bar-label">${info.label}</span>
        <span class="rp-bar-track"><span class="rp-bar-fill" style="width:${rate}%;background:${bc};"></span></span>
        <span class="rp-bar-val" style="color:${bc};">${rate}%</span>
      </div>`;
  }).join('');

  // レーダー（PDFと同じ canvas→PNG ロジックを共通利用）
  const radarURL = (typeof buildRadarDataURL === 'function')
    ? buildRadarDataURL(this.axisScores, { size: 200, dpr: 2 }) : '';
  const radarHTML = radarURL
    ? `<img src="${radarURL}" alt="4軸レーダーチャート" class="rp-radar-img" width="150" height="150">`
    : '';

  // リスク件数（詳細はゲート）
  const riskCount = this.risks.length;
  const riskStrip = riskCount > 0
    ? `<div class="rp-strip rp-strip--risk"><span class="rp-strip-ico">⚠</span><span><strong>${riskCount}件</strong>のリスクを検出 <span class="rp-strip-lock">🔒 内容はレポートで</span></span></div>`
    : `<div class="rp-strip rp-strip--ok"><span class="rp-strip-ico">✓</span><span>大きなリスクは検出されていません</span></div>`;

  // 「処方箋（改善内容）」はゲート。代わりに完全レポートで得られる価値を提示する。
  const includeItems = ['優先改善順位', '改善ロードマップ', '定着率向上施策', 'GTN専門家コメント', '改善優先順位の理由', '相談時のアジェンダ'];
  const includesHTML = includeItems.map(function (t) {
    return `<li class="rp-inc-item"><span class="rp-inc-check">✓</span><span>${t}</span></li>`;
  }).join('');

  // 経営者向け「認識」1行（成功確率が良いのか悪いのかを即伝える）
  const verdictIco = this.rating === 'C' ? '⚠' : this.rating === 'B' ? '△' : '✓';
  const verdictMsg = RATING_VERDICT[this.rating] || RATING_VERDICT['B'];

  // 想定損失額（簡易・先出し）。※ROI試算の詳細・改善内容はフォーム送信後に限定
  let lossRange = '';
  try {
    const cost = (typeof calcAttritionCost === 'function') ? calcAttritionCost('_default', this.rating) : null;
    if (cost && typeof fmtManyen === 'function') lossRange = fmtManyen(cost.min) + '〜' + fmtManyen(cost.max);
  } catch (_) {}
  const lossHTML = lossRange
    ? `<div class="rp-loss">
         <span class="rp-loss-label">想定損失額（早期離職・1名あたり概算）</span>
         <span class="rp-loss-val">${lossRange}</span>
         <span class="rp-loss-note">採用費・教育費・離職（再採用）コストを含む概算</span>
       </div>`
    : '';

  card.innerHTML = `
    <div class="rp-head">
      <div class="rp-rate">
        <span class="rp-rate-num">${this.rate}</span><span class="rp-rate-unit">%</span>
        <span class="rp-rate-cap">戦力化・定着 成功確率</span>
      </div>
      <div class="rp-rate-side">
        <span class="rp-rating-badge" style="background:${rc.bg};color:${rc.color};border-color:${rc.border};">総合評価：${RATING_LABELS[this.rating] || this.rating + 'ランク'}</span>
        <span class="rp-score">診断スコア ${this.score} / 20点</span>
      </div>
    </div>
    <div class="rp-verdict rp-verdict--${(this.rating || 'b').toLowerCase()}">
      <span class="rp-verdict-ico">${verdictIco}</span><span>${verdictMsg}</span>
    </div>
    <div class="rp-body">
      <div class="rp-radar">${radarHTML}<span class="rp-radar-cap">4軸バランス</span></div>
      <div class="rp-bars">
        <div class="rp-bars-title">4軸スコア</div>
        ${barsHTML}
      </div>
    </div>
    ${lossHTML}
    ${riskStrip}
    <div class="rp-includes">
      <div class="rp-includes-head">完全レポートで分かること</div>
      <ul class="rp-includes-list">${includesHTML}</ul>
    </div>`;
};

/**
 * 顧客分類別の文言を結果画面へ反映（商談前分類の出し分け）
 * 診断名・成功確率キャプションは全分類共通（出し分けない）。
 * segment が unknown（既存データ・未回答）の場合は何もしない＝既存の汎用表示のまま
 */
ResultPage.applySegmentContent = function () {
  const c = SEGMENT_CONTENT[this.segment];
  if (!c) return;

  // 分類別の結果コメント（unknown時は非表示のまま）
  const rcEl = document.getElementById('route-comment');
  if (rcEl && c.resultComment) {
    rcEl.textContent = c.resultComment;
    rcEl.classList.remove('hidden');
  }

  // ロック予告バナーの補足文
  const supEl = document.getElementById('lock-teaser-supplement');
  if (supEl && c.teaserSupplement) supEl.textContent = c.teaserSupplement;

  // 相談CTA（最終セクション）の文言・補足文
  // ※ id / class / data-consult-location は変更しない（GA4計測・リンク設定を維持）
  const ctaEl = document.getElementById('cta-consult-final');
  if (ctaEl && c.ctaLabel) ctaEl.textContent = c.ctaLabel;
  const ctaNoteEl = document.getElementById('consult-cta-note');
  if (ctaNoteEl && c.ctaNote) ctaNoteEl.textContent = c.ctaNote;
};

/**
 * v6.0: リスク示唆テキストを更新
 */
ResultPage.renderRiskHint = function () {
  const el = document.getElementById('risk-hint-text');
  if (!el) return;
  const highCount = this.risks.filter(r => r.level === 'high').length;
  const total     = this.risks.length;

  if (total === 0) {
    el.innerHTML = '現時点で大きなリスクは検出されていません。<br>完全版レポートでは、さらに詳しい分析と継続改善のポイントをご確認いただけます。';
  } else if (highCount > 0) {
    el.innerHTML = `この診断で、戦力化・定着に影響する<strong>深刻度の高いリスクが${highCount}件</strong>、合計${total}件のリスクが検出されています。<br>リスクの詳細と改善策は、完全版レポートでご確認いただけます。`;
  } else {
    el.innerHTML = `戦力化・定着に関する${total}件の改善ポイントが見つかっています。<br>具体的な内容と優先順位は、完全版レポートでご確認いただけます。`;
  }
};

/**
 * v6.0: ロック済みリスクプレースホルダーを実リスク件数に合わせて描画
 */
ResultPage.renderLockedRisksPreview = function () {
  const container = document.getElementById('locked-risks-list');
  if (!container) return;
  if (this.risks.length === 0) {
    container.innerHTML = '<div style="padding:12px;font-size:0.85rem;color:var(--text-sub);">検出されたリスクはありません。完全版レポートでは継続改善のポイントをお届けします。</div>';
    return;
  }
  container.innerHTML = this.risks.map(r => {
    const icon = r.level === 'high' ? '\u26A0' : '\u25B3';
    const severity = r.level === 'high' ? '深刻度：高' : '深刻度：中';
    return `
      <div class="locked-risk-placeholder">
        <span class="locked-risk-ph-icon">${icon}</span>
        <span class="locked-risk-ph-text">${severity} \u2015 詳細は完全版レポートに記載</span>
      </div>`;
  }).join('');
};

/**
 * v7.0: 想定損失額（概算）を無料診断画面に表示
 * 既存の calcAttritionCost() + fmtManyen() + getAttritionCostMessage() を再利用
 * ID: #cost-estimate-section / #cost-estimate-value / #cost-estimate-detail
 */
ResultPage.renderCostEstimate = function () {
  var section  = document.getElementById('cost-estimate-section');
  var valueEl  = document.getElementById('cost-estimate-value');
  var subEl    = document.getElementById('cost-estimate-sub');
  var detailEl = document.getElementById('cost-estimate-detail');
  var urgEl    = document.getElementById('cost-estimate-urgency');
  if (!section || !valueEl) return;

  // 既存の共通関数を呼び出し（重複ロジックなし）
  var cost = calcAttritionCost('_default', this.rating);
  var rangeText = fmtManyen(cost.min) + '〜' + fmtManyen(cost.max);

  // 損失額の表現を強化：「発生している可能性」
  valueEl.innerHTML = '年間 <strong>' + rangeText + '</strong>';

  // 評価別のサブテキスト（放置リスクの文脈付き）
  if (subEl) {
    if (this.rating === 'C') {
      subEl.textContent = 'この状態が続くと、上記の損失が毎年発生し続ける可能性があります。';
    } else if (this.rating === 'B') {
      subEl.textContent = '受入体制の課題を放置した場合、上記の損失が発生するリスクがあります。';
    } else {
      subEl.textContent = '現在の体制を維持できれば、損失リスクは低水準です。';
    }
  }

  // 評価別の補足メッセージ（既存の getAttritionCostMessage を再利用）
  if (detailEl) {
    detailEl.innerHTML = getAttritionCostMessage(this.rating);
  }

  // 放置リスクの緊急文（A評価は非表示）
  if (urgEl) {
    if (this.rating === 'A') {
      urgEl.style.display = 'none';
    }
    // B/C はHTMLの初期テキストをそのまま表示
  }

  section.style.display = '';
};

/* =============================================
   v3.1 追加：タイプ診断・比較・危機認識 描画
   ============================================= */

/**
 * 企業タイプ診断ブロックを描画（v3.1）
 * ID: #type-diagnosis-section
 */
ResultPage.renderTypeDiagnosis = function () {
  const section = document.getElementById('type-diagnosis-section');
  if (!section) return;

  const typeKey = this.companyTypeKey;
  const type    = COMPANY_TYPES[typeKey];
  if (!type) return;

  const colorMap = {
    a: { bg: '#edf7f1', color: '#1a5c3a', border: '#a7e3bf' },
    b: { bg: '#fffbeb', color: '#92400e', border: '#fcd34d' },
    c: { bg: '#fff7ed', color: '#9a3412', border: '#fed7aa' },
    d: { bg: '#fef2f2', color: '#991b1b', border: '#fecaca' },
    e: { bg: '#fef2f2', color: '#7f1d1d', border: '#fca5a5' },
  };
  const c = colorMap[type.colorKey] || colorMap['b'];

  section.innerHTML = `
    <div class="type-diagnosis-card" style="--type-bg:${c.bg};--type-color:${c.color};--type-border:${c.border}">
      <div class="type-diagnosis-icon" aria-hidden="true">${type.icon}</div>
      <div class="type-diagnosis-body">
        <div class="type-diagnosis-badge" style="color:${c.color};border-color:${c.border};background:${c.bg}">${type.badge}</div>
        <div class="type-diagnosis-label">あなたの企業タイプ：<strong>${type.label}</strong></div>
        <div class="type-diagnosis-desc">${type.desc}</div>
      </div>
    </div>
  `;
  section.classList.remove('hidden');
};

/**
 * GTN基準との比較ブロックを描画（v3.2改訂）
 * ─────────────────────────────────────────────
 * 結果ページでは従業員規模を未取得のため、固定の GTN基準値（65%）と比較する。
 * 「同規模企業比較」はフォーム送信後に生成する PDF 内のみで使用する。
 *
 * ID: #peer-comparison-section
 */
ResultPage.renderPeerComparison = function () {
  const section = document.getElementById('peer-comparison-section');
  if (!section) return;

  /** GTN が外国人材の安定受入に必要と定義する基準値 */
  const GTN_BASELINE = 65;
  const myRate = this.rate;
  const diff   = myRate - GTN_BASELINE;

  // v3.2: 差分に意味の説明を追加（断定を避け、状態を伝える）
  const absDiff = Math.abs(diff);
  const diffText = diff > 0
    ? `GTN推奨基準より <strong>+${absDiff}pt 高く</strong>、安定した外国人材活用ができる体制の土台が整っています`
    : diff < 0
    ? `GTN推奨基準より <strong>${absDiff}pt 低く</strong>、受入体制の整備に改善余地があります。運用設計の見直しが有効です`
    : 'GTN推奨基準と <strong>同水準</strong> です。引き続き体制の維持・改善をおすすめします';
  const diffClass = diff > 0 ? 'peer-diff-up' : diff < 0 ? 'peer-diff-down' : 'peer-diff-same';

  const riskAlert = getRiskAlertMessage(diff, this.rating);

  section.innerHTML = `
    <div class="peer-comparison-card">
      <div class="peer-comparison-title">GTN基準との比較</div>
      <div class="peer-comparison-subtitle">外国人材を安定的に受け入れるための基準値と比較しています</div>
      <div class="peer-comparison-bars">
        <div class="peer-bar-row">
          <div class="peer-bar-label">貴社</div>
          <div class="peer-bar-track">
            <div class="peer-bar-fill peer-bar-mine" style="width:${Math.min(myRate, 100)}%"></div>
          </div>
          <div class="peer-bar-value">${myRate}%</div>
        </div>
        <div class="peer-bar-row">
          <div class="peer-bar-label">GTN基準値</div>
          <div class="peer-bar-track">
            <div class="peer-bar-fill peer-bar-peer" style="width:${Math.min(GTN_BASELINE, 100)}%"></div>
          </div>
          <div class="peer-bar-value">${GTN_BASELINE}%</div>
        </div>
      </div>
      <div class="peer-diff ${diffClass}">${diffText}</div>
      <div class="peer-risk-alert">${riskAlert}</div>
    </div>
  `;
  section.classList.remove('hidden');
};

/**
 * 危機認識ブロックを描画（v3.1）
 * ID: #crisis-block-section
 */
ResultPage.renderCrisisBlock = function () {
  const section = document.getElementById('crisis-block-section');
  if (!section) return;

  const level = getCrisisLevel(this.rate);
  const msg   = CRISIS_MESSAGES[level];
  if (!msg) return;

  const colorMap = {
    high: { bg: '#fef2f2', border: '#fecaca', headColor: '#991b1b', impactBg: '#fee2e2', impactColor: '#991b1b' },
    mid:  { bg: '#fffbeb', border: '#fcd34d', headColor: '#92400e', impactBg: '#fef3c7', impactColor: '#92400e' },
    low:  { bg: '#edf7f1', border: '#a7e3bf', headColor: '#1a5c3a', impactBg: '#d1fae5', impactColor: '#1a5c3a' },
  };
  const c = colorMap[level];

  section.innerHTML = `
    <div class="crisis-block-card" style="background:${c.bg};border-color:${c.border}">
      <div class="crisis-headline" style="color:${c.headColor}">${msg.headline}</div>
      <div class="crisis-impact" style="background:${c.impactBg};color:${c.impactColor}">${msg.impact}</div>
      <div class="crisis-full-version-note">詳細なリスク内容・改善の優先順位は完全版レポートでご確認いただけます</div>
    </div>
  `;
  section.classList.remove('hidden');
};

/* =============================================
   レーダーチャート（4軸）描画ヘルパー
   ─────────────────────────────────────────────
   結果プレビュー（live DOM）と PDF（html2canvas）で共通利用。
   html2canvas の SVG 描画不具合を避けるため canvas→PNG data URL 方式。
   診断ロジックには非依存（axisScores の達成率%を読むだけ）。
   ============================================= */

/**
 * 4軸レーダーチャートを Canvas に描画し PNG の data URL を返す。
 * @param {object} axisScores - calcAxisScores() の戻り値（*Rate を参照）
 * @param {object} [opts] - { size, dpr, color, fill, grid }
 * @returns {string} data:image/png;base64,...（canvas 不可環境では ''）
 */
function buildRadarDataURL(axisScores, opts) {
  opts = opts || {};
  var size  = opts.size  || 240;            // 論理px（正方）
  var dpr   = opts.dpr   || 2;              // 解像度倍率（Retina / PDF 高精細）
  var color = opts.color || '#1a5c3a';      // GTN グリーン（線・頂点）
  var fill  = opts.fill  || 'rgba(26,92,58,0.16)';
  var grid  = opts.grid  || '#cbd5e1';

  // 表示順（時計回り・上始まり）。内部キーは不変、表示名は AXIS_LABELS に追従。
  var axes = ['strategy', 'structure', 'operation', 'retention'];

  var canvas = document.createElement('canvas');
  canvas.width  = size * dpr;
  canvas.height = size * dpr;
  var ctx = canvas.getContext && canvas.getContext('2d');
  if (!ctx) return '';
  ctx.scale(dpr, dpr);

  var cx = size / 2;
  var cy = size / 2;
  var R  = size * 0.40;                      // ラベルは併記のバーが担うため余白少なめでOK
  var N  = axes.length;
  var start = -Math.PI / 2;                   // 頂点を真上から

  function pt(i, r) {
    var a = start + (Math.PI * 2 * i) / N;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  }

  // 同心グリッド（4段）
  ctx.lineWidth = 1;
  for (var g = 1; g <= 4; g++) {
    var rr = (R * g) / 4;
    ctx.beginPath();
    for (var i = 0; i < N; i++) {
      var p = pt(i, rr);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.strokeStyle = grid;
    ctx.globalAlpha = (g === 4) ? 0.9 : 0.4;
    ctx.stroke();
  }
  // 軸線
  ctx.globalAlpha = 0.45;
  for (var j = 0; j < N; j++) {
    var pe = pt(j, R);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(pe.x, pe.y);
    ctx.strokeStyle = grid;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // データポリゴン
  var ax = axisScores || {};
  function rateAt(i) {
    var v = ax[axes[i] + 'Rate'];
    return Math.max(0, Math.min(100, (typeof v === 'number' ? v : 0)));
  }
  ctx.beginPath();
  for (var k = 0; k < N; k++) {
    var pk = pt(k, (R * rateAt(k)) / 100);
    if (k === 0) ctx.moveTo(pk.x, pk.y); else ctx.lineTo(pk.x, pk.y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();

  // 頂点ドット
  for (var m = 0; m < N; m++) {
    var pm = pt(m, (R * rateAt(m)) / 100);
    ctx.beginPath();
    ctx.arc(pm.x, pm.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  try { return canvas.toDataURL('image/png'); }
  catch (e) { return ''; }
}

/* =============================================
   v3.0 追加：PDF レポート HTML 生成
   ============================================= */

/**
 * 診断レポートのHTML文字列を生成する（経営ダッシュボード型・3ページ構成）
 * @param {object} formData - getFormData() の戻り値
 * @returns {string} 完全なHTML文字列
 */
ResultPage.buildReportHTML = function (formData) {
  const now     = new Date();
  const dateStr = now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日';
  const cost    = calcAttritionCost('_default', this.rating);
  const costRange = fmtManyen(cost.min) + '〜' + fmtManyen(cost.max);

  // 評価バッジの配色
  const ratingColors = {
    A: { bg: '#edf7f1', color: '#1a5c3a', border: '#a7e3bf' },
    B: { bg: '#fffbeb', color: '#92400e', border: '#fcd34d' },
    C: { bg: '#fef2f2', color: '#991b1b', border: '#fecaca' },
  };
  const rc = ratingColors[this.rating] || ratingColors['B'];

  // 現状ステータスの短評（1行・図表中心のため簡潔に）
  const SHORT_STATUS = {
    A: '受入・定着の基盤は概ね良好。設計精度の向上が次のテーマです。',
    B: '土台はあるものの、受入体制・運用設計に改善余地があります。',
    C: '戦力化・定着に課題あり。受入体制と運用設計の見直しが優先です。',
  };
  const shortStatus = SHORT_STATUS[this.rating] || SHORT_STATUS['B'];

  // 会社情報（未回答・既存データは空文字＝表示しない）
  const foreignInfo = formData.foreignEmployed === 'YES'
    ? `雇用中（${formData.foreignCount ? formData.foreignCount + '名' : '人数未入力'}）`
    : '現在雇用なし';
  // 顧客分類（相談方向性のみ利用。unknown は空）
  const segContent       = SEGMENT_CONTENT[this.segment] || {};
  const consultFocusText = segContent.consultFocus || '';

  // レーダー（4軸・PNG data URL／html2canvas 安全）
  const radarURL = (typeof buildRadarDataURL === 'function')
    ? buildRadarDataURL(this.axisScores, { size: 200, dpr: 2 }) : '';

  // 4軸スコアバー（レーダー併記）
  const AXES = ['strategy', 'structure', 'operation', 'retention'];
  const ax   = this.axisScores || {};
  const axisBarsHTML = AXES.map(a => {
    const info = AXIS_LABELS[a];
    const rate = (ax[a + 'Rate'] != null) ? ax[a + 'Rate'] : 0;
    const bc   = rate < 45 ? '#b91c1c' : rate < 65 ? '#d97706' : '#1a5c3a';
    return `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px;">
        <span style="width:62px;font-size:11px;font-weight:700;color:#374151;flex-shrink:0;">${info.label}</span>
        <span style="flex:1;height:10px;background:#eef2f5;border-radius:5px;overflow:hidden;">
          <span style="display:block;height:100%;width:${rate}%;background:${bc};border-radius:5px;"></span>
        </span>
        <span style="width:34px;font-size:11px;font-weight:800;color:${bc};text-align:right;">${rate}%</span>
      </div>`;
  }).join('');

  // リスクの簡易ラベル（既存 level からの決定的マッピング・推測スコアは生成しない）
  const riskChip = (txt, tone) =>
    `<span style="display:inline-block;font-size:9px;font-weight:700;padding:2px 8px;border-radius:10px;background:${tone.bg};color:${tone.color};white-space:nowrap;">${txt}</span>`;
  const TONE_HI = { bg: '#fee2e2', color: '#b91c1c' };
  const TONE_MD = { bg: '#fef3c7', color: '#92400e' };

  // PAGE2: リスク詳細カード（重要度で強弱／影響度・緊急度・対応）
  // ※重要度は既存 level（high/mid）からの決定的マッピング。high は視覚的に強調。
  const riskCardsHTML = this.risks.length > 0
    ? this.risks.map((r, i) => {
        const hi     = r.level === 'high';
        const tone   = hi ? TONE_HI : TONE_MD;
        const accent = hi ? '#b91c1c' : '#d97706';
        const stars  = hi ? '★★★' : '★★☆';
        const sevLbl = hi ? '重要度：高' : '重要度：中';
        return `
          <div style="border:1px solid ${hi ? '#fecaca' : '#e5e7eb'};border-left:6px solid ${accent};border-radius:8px;
                      padding:11px 14px;margin-bottom:9px;background:${hi ? '#fff5f5' : '#fff'};">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
              <span style="width:20px;height:20px;border-radius:50%;background:${accent};color:#fff;font-size:10px;font-weight:900;
                           display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;line-height:1;">${i + 1}</span>
              <span style="font-weight:700;font-size:12.5px;color:#1f2937;line-height:1.5;flex:1;">${r.label}</span>
              <span style="font-size:11px;font-weight:800;color:${accent};white-space:nowrap;letter-spacing:0.04em;">${stars}<span style="font-size:8.5px;margin-left:4px;">${sevLbl}</span></span>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:7px;padding-left:28px;">
              ${riskChip('影響度：' + (hi ? '高' : '中'), tone)}
              ${riskChip('緊急度：' + (hi ? '高' : '中'), tone)}
              ${riskChip('対応：' + (hi ? '早急' : '計画的'), tone)}
            </div>
            <div style="font-size:11px;color:#6b7280;line-height:1.65;padding-left:28px;">${r.detail}</div>
          </div>`;
      }).join('')
    : `<div style="padding:14px;background:#edf7f1;border-radius:8px;color:#1a5c3a;font-size:12.5px;line-height:1.6;">
         ✓ 現時点で特定された主要リスクはありません。引き続き受入体制の維持・改善をおすすめします。
       </div>`;

  // PAGE1: 主なリスクTOP3（件名のみ・コンパクト）
  const dashRisksHTML = this.risks.length > 0
    ? this.risks.slice(0, 3).map(r => {
        const hi = r.level === 'high';
        return `
          <div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:6px;">
            <span style="font-size:11px;color:${hi ? '#b91c1c' : '#d97706'};line-height:1.5;">${hi ? '⚠' : '△'}</span>
            <span style="font-size:10.5px;color:#374151;line-height:1.5;">${r.label}</span>
          </div>`;
      }).join('')
    : `<div style="font-size:10.5px;color:#1a5c3a;">✓ 主要リスクなし</div>`;

  // PAGE1: 優先改善TOP3（タイトルのみ）
  const dashImprovementsHTML = NEXT_STEPS.items.slice(0, 3).map((it, i) => `
      <div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:6px;">
        <span style="width:15px;height:15px;border-radius:50%;background:#1a5c3a;color:#fff;font-size:9px;font-weight:900;
                     display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;line-height:1;">${i + 1}</span>
        <span style="font-size:10.5px;color:#374151;line-height:1.5;font-weight:600;">${it.title}</span>
      </div>`).join('');

  // PAGE3: 改善提案カード（順位＋最初の一歩＋期待効果）
  const improvementCardsHTML = NEXT_STEPS.items.map((it, i) => {
    const d        = NEXT_STEP_DETAILS[i] || {};
    const rankNote = i === 0 ? '最優先で着手' : i === 1 ? '次に着手' : 'その後に整備';
    return `
      <div style="display:flex;gap:12px;padding:13px 15px;border:1px solid #e5e7eb;border-radius:8px;
                  margin-bottom:10px;background:#f9fafb;">
        <div style="width:28px;height:28px;border-radius:50%;background:#1a5c3a;color:#fff;font-size:13px;font-weight:900;
                    display:flex;align-items:center;justify-content:center;flex-shrink:0;">${i + 1}</div>
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;flex-wrap:wrap;">
            <span style="font-weight:700;font-size:13px;color:#1f2937;">${it.title}</span>
            <span style="font-size:9px;font-weight:700;color:#1a5c3a;background:#edf7f1;border-radius:10px;padding:2px 8px;">${rankNote}</span>
          </div>
          <div style="font-size:11px;color:#6b7280;line-height:1.6;margin-bottom:6px;">${it.desc}</div>
          ${d.firstStep ? `<div style="font-size:10.5px;color:#374151;line-height:1.55;"><strong style="color:#1a5c3a;">最初の一歩：</strong>${d.firstStep}</div>` : ''}
          ${d.effect ? `<div style="font-size:10.5px;color:#374151;line-height:1.55;margin-top:2px;"><strong style="color:#1a5c3a;">期待効果：</strong>${d.effect}</div>` : ''}
        </div>
      </div>`;
  }).join('');

  // PAGE3: 最優先改善軸ノート
  const weakestAxisNote = this.axisScores
    ? `<div style="background:#edf7f1;border-left:4px solid #1a5c3a;padding:12px 15px;border-radius:6px;
                   font-size:12px;color:#124429;line-height:1.7;margin-bottom:14px;">
        <strong>最優先改善軸：${AXIS_LABELS[this.axisScores.weakestAxis]?.label || '—'}</strong>
        （${AXIS_LABELS[this.axisScores.weakestAxis]?.desc || '—'}）<br>
        ${AXIS_IMPROVEMENT_NOTES[this.axisScores.weakestAxis] || ''}
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>外国人材活用 診断レポート | GTN</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Hiragino Kaku Gothic ProN', 'Yu Gothic Medium', 'Yu Gothic', 'Meiryo', sans-serif;
      font-size: 14px; line-height: 1.7; color: #1f2937; background: #fff;
    }
    .page { max-width: 740px; margin: 0 auto; }
    /* pdf-block: セクション単位の描画グループ（1ブロック=1ページ想定・A4内に収める） */
    .pdf-block {
      padding: 28px 40px;
      background: #fff;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .pdf-block + .pdf-block { border-top: 1px solid #f0f0f0; }
    .section-title {
      font-size: 14px; font-weight: 900; color: #1f2937;
      border-left: 4px solid #1a5c3a; padding-left: 11px; margin-bottom: 13px;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .pdf-block { page-break-inside: avoid; break-inside: avoid; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- ═══ PAGE 1: 経営ダッシュボード（診断サマリー） ═══ -->
  <div class="pdf-block" style="padding-top:34px;">
    <!-- ヘッダー -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;
                padding-bottom:12px;border-bottom:2px solid #1a5c3a;margin-bottom:14px;">
      <div>
        <span style="background:#1a5c3a;color:#fff;font-size:11px;font-weight:900;
                     padding:4px 8px;border-radius:4px;letter-spacing:0.1em;display:inline-block;">GTN</span>
        <span style="font-size:12px;font-weight:700;color:#1f2937;margin-left:8px;">Global Talent Navi（GTN）</span>
      </div>
      <div style="text-align:right;font-size:10px;color:#6b7280;">
        <div>診断日：${dateStr}</div>
        <div>No：GTN-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${this.score}</div>
      </div>
    </div>

    <!-- タイトル -->
    <div style="text-align:center;margin-bottom:14px;padding:13px 20px;
                background:linear-gradient(135deg,#0f3d26,#1a5c3a);border-radius:10px;color:#fff;">
      <div style="font-size:10px;opacity:0.75;letter-spacing:0.14em;margin-bottom:4px;">外国人材活用 診断レポート</div>
      <div style="font-size:17px;font-weight:900;">経営ダッシュボード（診断サマリー）</div>
    </div>

    <!-- 会社情報（コンパクト1段） -->
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:9px 15px;margin-bottom:13px;
                display:flex;flex-wrap:wrap;gap:5px 20px;font-size:11px;color:#374151;">
      <span><strong style="color:#6b7280;font-weight:700;">会社名：</strong>${formData.company || '—'}</span>
      ${formData.name ? `<span><strong style="color:#6b7280;font-weight:700;">担当者：</strong>${formData.name}</span>` : ''}
      ${formData.industry ? `<span><strong style="color:#6b7280;font-weight:700;">業種：</strong>${formData.industry}</span>` : ''}
      ${formData.employees ? `<span><strong style="color:#6b7280;font-weight:700;">従業員数：</strong>${formData.employees}</span>` : ''}
      <span><strong style="color:#6b7280;font-weight:700;">外国人雇用：</strong>${foreignInfo}</span>
    </div>

    <!-- ヒーロー：成功確率 ＋ 評価 ＋ 短評 -->
    <div style="display:flex;align-items:center;gap:18px;background:#fff;border:1px solid #e5e7eb;
                border-radius:10px;padding:14px 18px;margin-bottom:12px;">
      <div style="text-align:center;flex-shrink:0;min-width:104px;">
        <div style="font-size:44px;font-weight:900;color:#1a5c3a;line-height:1.2;height:54px;">${this.rate}<span style="font-size:18px;">%</span></div>
        <div style="font-size:9.5px;color:#6b7280;margin-top:6px;letter-spacing:0.02em;line-height:1.45;">戦力化・定着<br>成功確率</div>
      </div>
      <div style="flex:1;">
        <div style="display:inline-block;padding:4px 12px;border-radius:50px;font-size:12px;font-weight:800;
                    background:${rc.bg};color:${rc.color};border:1px solid ${rc.border};margin-bottom:6px;line-height:1.5;">
          総合評価：${RATING_LABELS[this.rating] || this.rating + 'ランク'}
        </div>
        <div style="font-size:11.5px;font-weight:700;color:${rc.color};line-height:1.6;">${this.rating === 'C' ? '⚠ ' : this.rating === 'B' ? '△ ' : '✓ '}${RATING_VERDICT[this.rating] || RATING_VERDICT['B']}</div>
        <div style="font-size:10.5px;color:#6b7280;margin-top:3px;line-height:1.55;">${shortStatus}</div>
        <div style="font-size:10px;color:#9ca3af;margin-top:3px;">診断スコア：${this.score} / 20点</div>
      </div>
    </div>

    <!-- レーダー ＋ 4軸スコアバー -->
    <div style="display:flex;align-items:center;gap:16px;background:#fff;border:1px solid #e5e7eb;
                border-radius:10px;padding:12px 16px;margin-bottom:12px;">
      <div style="flex-shrink:0;text-align:center;">
        ${radarURL ? `<img src="${radarURL}" width="150" height="150" alt="4軸レーダーチャート" style="display:block;">` : ''}
        <div style="font-size:9px;color:#9ca3af;margin-top:2px;">4軸バランス</div>
      </div>
      <div style="flex:1;">
        <div style="font-size:11px;font-weight:900;color:#1f2937;margin-bottom:9px;border-left:3px solid #1a5c3a;padding-left:8px;">4軸スコア</div>
        ${axisBarsHTML}
      </div>
    </div>

    <!-- 主なリスクTOP3 ／ 優先改善TOP3（2カラム） -->
    <div style="display:flex;gap:12px;margin-bottom:12px;">
      <div style="flex:1;background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:12px 14px;">
        <div style="font-size:10.5px;font-weight:900;color:#b91c1c;margin-bottom:8px;">⚠ 主なリスク TOP3（全${this.risks.length}件）</div>
        ${dashRisksHTML}
      </div>
      <div style="flex:1;background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:12px 14px;">
        <div style="font-size:10.5px;font-weight:900;color:#1a5c3a;margin-bottom:8px;">✓ 優先改善 TOP3</div>
        ${dashImprovementsHTML}
      </div>
    </div>

    <!-- 想定損失額（概算） -->
    <div style="background:#fff8f4;border:1px solid #fdd5b8;border-radius:10px;padding:11px 16px;
                display:flex;align-items:center;justify-content:space-between;gap:14px;">
      <div>
        <div style="font-size:9.5px;font-weight:700;letter-spacing:0.04em;color:#6b7280;">想定損失額（外国人材が早期離職した場合・1名あたり概算）</div>
        <div style="font-size:10px;color:#9ca3af;margin-top:2px;">採用費・教育費・離職（再採用）コストを含む概算</div>
      </div>
      <div style="font-size:20px;font-weight:900;color:#a34300;white-space:nowrap;">${costRange}</div>
    </div>
  </div>

  <!-- ═══ PAGE 2: リスク分析 ═══ -->
  <div class="pdf-block">
    <div class="section-title">リスク分析（${this.risks.length}件検出）</div>
    <div style="font-size:11px;color:#6b7280;margin-bottom:13px;line-height:1.65;">
      検出された各リスクについて、影響度・緊急度・推奨対応を整理しています。<br>
      具体的な改善策は、無料相談で貴社の状況に合わせてご提案します。
    </div>
    ${riskCardsHTML}
  </div>

  <!-- ═══ PAGE 3: 改善提案 ＋ 相談CTA ═══ -->
  <div class="pdf-block">
    <div class="section-title">改善提案（優先順位つき）</div>
    ${weakestAxisNote}
    ${improvementCardsHTML}

    <!-- 期待効果まとめ -->
    <div style="background:#f9fafb;border-radius:8px;padding:11px 15px;font-size:11px;color:#374151;line-height:1.7;margin-bottom:16px;">
      これらを順に整えることで、受入体制と運用設計が安定し、<strong style="color:#124429;">戦力化・定着の成功確率を高める</strong>ことができます。
    </div>

    <!-- 無料相談 CTA -->
    <div style="background:linear-gradient(135deg,#124429,#1a5c3a);color:#fff;
                border-radius:10px;padding:20px 26px;text-align:center;margin-bottom:14px;">
      <div style="font-size:13px;font-weight:900;margin-bottom:10px;line-height:1.5;">
        この診断結果をもとに、貴社に最適な改善ステップを個別に整理できます
      </div>
      <!-- 無料相談でできること（相談予約の価値を明示） -->
      <div style="display:inline-block;text-align:left;margin:0 auto 11px;">
        <div style="font-size:10.5px;font-weight:800;margin-bottom:6px;letter-spacing:0.04em;">無料相談でできること</div>
        <div style="font-size:10.5px;opacity:0.92;line-height:1.95;">
          <div>✓ 診断結果の解説</div>
          <div>✓ 優先改善項目の整理</div>
          <div>✓ 貴社向け改善ロードマップのご提案</div>
          <div>✓ 外国人材活用に関する質疑応答</div>
        </div>
      </div>
      ${consultFocusText ? `<div style="display:inline-block;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.25);
                  border-radius:50px;padding:4px 14px;font-size:10px;font-weight:700;margin-bottom:10px;">
        ご相談の方向性：${consultFocusText}
      </div>` : ''}
      <div style="font-size:10px;opacity:0.78;margin-bottom:12px;">無料 60分 ／ オンライン対応 ／ 秘密厳守 ／ 無理な営業なし</div>
      <div data-pdf-link="consult"
           style="display:inline-block;background:#c75200;color:#fff;font-weight:700;
                  font-size:12px;padding:9px 24px;border-radius:6px;letter-spacing:0.03em;">
        ▶ 無料相談を予約する
      </div>
      <div style="font-size:9px;opacity:0.6;margin-top:8px;word-break:break-all;">${CONSULT_URL}</div>
      <div style="font-size:10px;opacity:0.78;margin-top:8px;">メールでのお問い合わせ: info@globaltalent-navi.com</div>
    </div>

    <!-- フッター -->
    <div style="padding-top:13px;border-top:1px solid #e5e7eb;
                font-size:9px;color:#9ca3af;text-align:center;line-height:1.7;">
      本レポートは Global Talent Navi（GTN）の分析モデルをもとに企業別に自動生成されたものです。<br>
      株式会社フレアー / Global Talent Navi (GTN)｜© 2025 All rights reserved.<br>
      プライバシーポリシー: https://globaltalent-navi.com/privacy
    </div>
  </div>

</div>
</body>
</html>`;
};

/* =============================================
   v3.0 追加：PDF 生成（jsPDF + html2canvas）
   ============================================= */

/**
 * 診断レポートをPDFとして生成・ダウンロードする
 * v5.0: セクション（.pdf-block）単位で個別描画してページ分断を防ぐ方式
 * @param {object} formData - getFormData() の戻り値
 */
ResultPage.generatePDF = async function (formData) {
  const reportHTML = this.buildReportHTML(formData);

  // jsPDF & html2canvas の確認
  if (typeof window.jspdf === 'undefined' || typeof html2canvas === 'undefined') {
    console.warn('[GTN] PDF ライブラリ未ロード → 印刷ウィンドウで代替');
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(reportHTML);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 800);
    }
    return;
  }

  const { jsPDF } = window.jspdf;

  // オフスクリーン描画コンテナ（A4幅 794px 固定）
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:#fff;overflow:visible;z-index:-9999;';
  wrap.innerHTML = reportHTML;
  document.body.appendChild(wrap);

  // レイアウト確定を待つ
  await new Promise(r => setTimeout(r, 600));

  try {
    const pdf    = new jsPDF('p', 'mm', 'a4');
    const pageW  = pdf.internal.pageSize.getWidth();   // 210mm
    const pageH  = pdf.internal.pageSize.getHeight();  // 297mm
    const SCALE       = 2;          // 高解像度レンダリング倍率
    const PX_PER_MM   = 794 / pageW; // px ÷ mm（794px = 210mm）
    const MARGIN_BOTTOM = 8;         // ページ末尾の最低余白（mm）

    // .pdf-block 要素を全て取得（セクション単位描画の対象）
    const blocks = Array.from(wrap.querySelectorAll('.pdf-block'));
    if (blocks.length === 0) {
      // フォールバック：.page の直接子要素を対象にする
      const pageDiv = wrap.querySelector('.page');
      if (pageDiv) blocks.push(...Array.from(pageDiv.children));
    }

    let yMm    = 0; // 現在ページ上の描画 Y 座標（mm）
    let pageNum = 1;

    for (let i = 0; i < blocks.length; i++) {
      const block    = blocks[i];
      const blockHPx = block.offsetHeight;
      const blockHMm = blockHPx / PX_PER_MM;

      // ブロックが現在ページに収まらなければ改ページ
      if (i > 0 && yMm + blockHMm > pageH - MARGIN_BOTTOM) {
        pdf.addPage();
        yMm = 0;
        pageNum++;
      }

      // ブロック単体を canvas 化
      const canvas = await html2canvas(block, {
        scale:           SCALE,
        useCORS:         true,
        backgroundColor: '#ffffff',
        logging:         false,
        windowWidth:     794,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      const imgHmm  = (canvas.height / SCALE) / PX_PER_MM;

      // 1ブロックが1ページを超える場合（稀）はそのまま配置し改ページ処理
      if (imgHmm > pageH - MARGIN_BOTTOM && i > 0 && yMm > 0) {
        pdf.addPage();
        yMm = 0;
        pageNum++;
      }

      // 画像配置前の Y 座標を記録（リンク注釈の基準点）
      const yMmBeforeAdd = yMm;

      pdf.addImage(imgData, 'JPEG', 0, yMm, pageW, imgHmm);
      yMm += imgHmm;

      // ── jsPDF リンク注釈: [data-pdf-link="consult"] 要素にクリック可能リンクを追加 ──
      const ctaLinkEl = block.querySelector('[data-pdf-link="consult"]');
      if (ctaLinkEl) {
        try {
          const blockRect = block.getBoundingClientRect();
          const ctaRect   = ctaLinkEl.getBoundingClientRect();
          // ブロック内の相対座標（px）→ mm変換
          const ctaX = (ctaRect.left - blockRect.left) / PX_PER_MM;
          const ctaY = yMmBeforeAdd + (ctaRect.top  - blockRect.top) / PX_PER_MM;
          const ctaW = ctaRect.width  / PX_PER_MM;
          const ctaH = ctaRect.height / PX_PER_MM;
          pdf.link(ctaX, ctaY, ctaW, ctaH, { url: CONSULT_URL });
        } catch (linkErr) {
          console.warn('[GTN] PDF リンク注釈の追加に失敗しました:', linkErr);
        }
      }
    }

    // ページ番号とフッターを各ページに追加
    const totalPages = pdf.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      pdf.setPage(p);
      pdf.setFontSize(8);
      pdf.setTextColor(160, 160, 160);
      // jsPDF 標準フォントは日本語非対応のため、ページ脚注は英字表記にして文字化けを回避
      pdf.text('GTN Diagnosis Report', 10, pageH - 5);
      pdf.text(`${p} / ${totalPages}`, pageW - 18, pageH - 5);
    }

    pdf.save('GTN_外国人材活用診断レポート.pdf');
    console.log('[GTN] PDF生成完了（セクション別描画）');

  } finally {
    document.body.removeChild(wrap);
  }
};

/* =============================================
   v4.0 追加：4軸診断サマリー 描画
   ============================================= */

/**
 * 4軸診断サマリーを描画（v4.0）
 * ID: #axis-summary-section
 */
ResultPage.renderAxisSummary = function () {
  const section = document.getElementById('axis-summary-section');
  if (!section || !this.axisScores) return;

  const axes = ['strategy', 'structure', 'operation', 'retention'];
  const { weakestAxis, secondWeakestAxis } = this.axisScores;

  const cardsHTML = axes.map(axis => {
    const info   = AXIS_LABELS[axis];
    const rate   = this.axisScores[axis + 'Rate'];
    const score  = this.axisScores[axis + 'Score'];
    const max    = this.axisScores[axis + 'Max'];
    const isWeakest  = axis === weakestAxis;
    const is2ndWeak  = axis === secondWeakestAxis;

    // バーの色を達成率で変える
    let barColor = '#1a5c3a';
    if (rate < 45)       barColor = '#b91c1c';
    else if (rate < 65)  barColor = '#d97706';

    const priorityBadge = isWeakest
      ? `<span class="axis-priority-badge axis-priority-top">優先改善</span>`
      : is2ndWeak
      ? `<span class="axis-priority-badge axis-priority-2nd">要注意</span>`
      : '';

    return `
      <div class="axis-card ${isWeakest ? 'axis-card--weakest' : ''}"
           style="--axis-color:${info.color};--axis-bg:${info.bg};--axis-border:${info.border}">
        <div class="axis-card-header">
          <span class="axis-card-icon" aria-hidden="true">${info.icon}</span>
          <span class="axis-card-label">${info.label}</span>
          ${priorityBadge}
        </div>
        <div class="axis-card-desc">${info.desc}</div>
        <div class="axis-bar-wrap">
          <div class="axis-bar-track">
            <div class="axis-bar-fill" style="width:${rate}%;background:${barColor}" aria-label="${rate}%"></div>
          </div>
          <span class="axis-bar-value">${rate}%</span>
        </div>
        <div class="axis-score-sub">${score} / ${max}点</div>
      </div>`;
  }).join('');

  section.innerHTML = `
    <div class="axis-summary-inner">
      <p class="section-eyebrow">STRUCTURAL ANALYSIS</p>
      <h2 class="axis-summary-title">4つの観点で見る外国人材活用の現状</h2>
      <p class="axis-summary-subtitle">
        単なる合計点ではなく、<strong>どの軸が弱いか</strong>を見ることが改善の出発点です。
      </p>
      <div class="axis-cards">${cardsHTML}</div>
      <div class="axis-full-version-teaser">
        📋 軸ごとの詳細改善アドバイスと優先改善順位は、完全版レポートでご確認いただけます
      </div>
    </div>
  `;
  section.classList.remove('hidden');
};

/* ─── ResultPage に離職コスト・BNIメッセージ表示メソッドを追加 ─── */

/**
 * 参考離職コストを結果ページに表示する
 * ID: #attrition-cost-display
 */
ResultPage.renderAttritionCost = function () {
  const el = document.getElementById('attrition-cost-display');
  if (!el) return;
  const cost = calcAttritionCost('_default', this.rating);
  const rangeText = fmtManyen(cost.min) + '〜' + fmtManyen(cost.max);
  const msgHTML   = getAttritionCostMessage(this.rating);
  el.innerHTML = `<span class="cost-range-value">${rangeText}</span><span class="cost-range-msg">${msgHTML}</span>`;
};

/**
 * source=bni 時の補助メッセージを表示する
 * ・#bni-cta-note-wrap : CTAセクションの補助文言
 */
ResultPage.renderSourceMessage = function () {
  const source = loadSource();
  const msg = getSourceMessage(source);

  // CTA 付近の BNI 補助文言
  const ctaWrap = document.getElementById('bni-cta-note-wrap');
  if (ctaWrap && msg && msg.ctaNote) {
    const ctaEl = document.getElementById('bni-cta-note');
    if (ctaEl) ctaEl.textContent = msg.ctaNote;
    ctaWrap.classList.remove('hidden');
  }
};

/**
 * 改善余地メモを result-hero 内に表示（v2.1）
 * ID: #improvement-note
 */
ResultPage.renderImprovementNote = function () {
  const el = document.getElementById('improvement-note');
  if (!el) return;
  const note = IMPROVEMENT_NOTES[this.rating];
  if (!note) return;
  el.textContent = note;
  el.classList.remove('hidden');
};

/**
 * GTN 経営コメントを表示（v2.1）
 * ID: #management-comment
 */
ResultPage.renderManagementComment = function () {
  const el = document.getElementById('management-comment');
  if (!el) return;
  el.textContent = MANAGEMENT_COMMENTS[this.rating] || MANAGEMENT_COMMENTS['B'];
};

/**
 * 次に整理すべきポイントを描画（v2.1）
 * ID: #next-steps-heading, #next-steps-list
 */
ResultPage.renderNextSteps = function () {
  const headEl = document.getElementById('next-steps-heading');
  const listEl = document.getElementById('next-steps-list');
  if (!listEl) return;

  // 評価別の見出しを設定
  if (headEl) {
    headEl.textContent = NEXT_STEPS.heading[this.rating] || '次に整理すべきポイント';
  }

  // カード形式でリスト描画
  listEl.innerHTML = NEXT_STEPS.items.map((item, idx) => `
    <div class="next-step-item" role="listitem">
      <div class="next-step-num" aria-hidden="true">${idx + 1}</div>
      <div class="next-step-body">
        <div class="next-step-title">${item.title}</div>
        <div class="next-step-desc">${item.desc}</div>
      </div>
    </div>
  `).join('');
};

/**
 * 評価別CTAテキストをCTA①・CTA②に反映（v2.2）
 * ・CTA① テキスト : #cta-light-text-content（span 内の textContent）
 * ・CTA② 見出し  : #cta-main-title
 * ・CTA② 説明文  : #cta-main-desc
 */
ResultPage.renderCtaMessages = function () {
  const msgs = CTA_MESSAGES[this.rating];
  if (!msgs) return;

  // CTA①: 評価別テキスト（末尾に矢印を付加）
  const lightTextEl = document.getElementById('cta-light-text-content');
  if (lightTextEl) lightTextEl.textContent = msgs.lightCta + ' →';

  // CTA②: 見出し
  const mainTitleEl = document.getElementById('cta-main-title');
  if (mainTitleEl) mainTitleEl.textContent = msgs.mainTitle;

  // CTA②: 説明文
  const mainDescEl = document.getElementById('cta-main-desc');
  if (mainDescEl) mainDescEl.textContent = msgs.mainDesc;
};

/* ─── ResultPage.render() に追加メソッドを注入 ─── */
const _origRender = ResultPage.render.bind(ResultPage);
ResultPage.render = function () {
  _origRender();
  this.applySegmentContent();       // 顧客分類別の文言反映（unknown は既存表示）
  // フォーム前：実データの「レポートプレビュー」を描画（公開範囲を限定）
  //   公開 = 成功確率 / 評価 / レーダー / 各軸スコア / リスク件数 / 優先改善TOP3タイトル
  //   ゲート = リスク詳細・改善アクション詳細・ROI試算・PDF本体（フォーム送信後）
  this.renderReportPreview();       // 実データのプレビューカード
  this.renderRiskHint();            // リスク示唆テキスト（件数レベル）
  this.renderCostEstimate();        // ROI（想定損失）は送信後エリアで表示（描画のみ・親が非表示）
  // NOTE: renderAxisSummary / renderTypeDiagnosis / renderPeerComparison / renderCrisisBlock
  //       は initForm() 内のフォーム送信後に呼ばれる（ゲート方式）
};

/* =============================================
   初期化
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page === 'check')  CheckPage.init();
  if (page === 'result') ResultPage.init();
});

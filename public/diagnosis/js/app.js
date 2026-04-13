/**
 * GTN 外国人雇用リスク診断 — メインロジック
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
const CONSULT_URL = 'https://calendar.app.google/erJ8R63g9zWargiR9';

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
const AXIS_LABELS = {
  strategy:  { label: '戦略',     desc: '目的・方針の明確さ',           icon: '🎯', color: '#1a5c3a', bg: '#edf7f1', border: '#a7e3bf' },
  structure: { label: '受入体制', desc: '制度・社内支援・役割設計',       icon: '🏗',  color: '#1e40af', bg: '#eff6ff', border: '#93c5fd' },
  operation: { label: '現場運用', desc: '教育・コミュニケーション・業務運用', icon: '⚙️',  color: '#92400e', bg: '#fffbeb', border: '#fcd34d' },
  retention: { label: '定着・育成', desc: '面談・評価・育成設計',         icon: '🌱',  color: '#6b21a8', bg: '#faf5ff', border: '#c4b5fd' },
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

  init() {
    // トラッキングパラメータ（source / ref）を保存（v2.3）
    saveTrackingParams();

    this.answers    = loadAnswers();
    this.currentIdx = loadCurrentIndex();

    // インデックスが範囲外ならリセット
    if (this.currentIdx >= QUESTIONS.length) this.currentIdx = 0;

    this.bindEvents();
    this.render();

    // QA: 診断ページ到達イベント（page_view_lp と同形式）
    trackEvent('page_view_check', {
      source: loadSource(),
      ref:    loadRef(),
    });
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

    prevBtn.disabled = this.currentIdx === 0;

    if (isLast) {
      nextBtn.textContent = '結果を見る →';
      nextBtn.className   = 'btn-finish';
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
    if (this.currentIdx > 0) {
      clearTimeout(this._autoAdvanceTimer);  // UX: 自動遷移キャンセル
      this.currentIdx--;
      saveCurrentIndex(this.currentIdx);
      this.render();
    }
  },

  next() {
    const q = QUESTIONS[this.currentIdx];
    if (!this.answers[q.id]) return;

    if (this.currentIdx < QUESTIONS.length - 1) {
      this.currentIdx++;
      saveCurrentIndex(this.currentIdx);
      this.render();
    } else {
      // 全問完了 → 結果ページへ
      const score = this.calcScore();
      trackEvent('diagnosis_complete', {
        score,
        rating: calcRating(score),
        source: loadSource(),
      });
      sessionStorage.setItem('gtn_risk_current', '0');
      window.location.href = 'result.html';
    }
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

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!this.validateForm(form)) return;

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

      // フォームを非表示にしてサンクス表示（v6.0: gate-form-wrap）
      const formWrap = document.getElementById('gate-form-wrap') || document.getElementById('form-body');
      if (formWrap) formWrap.style.display = 'none';
      document.getElementById('thanks-msg').classList.add('show');

      // v6.0: ロックUIを非表示にする
      const lockedAxis  = document.getElementById('locked-axis-preview');
      const lockedRisks = document.getElementById('locked-risks-preview');
      if (lockedAxis)  lockedAxis.style.display = 'none';
      if (lockedRisks) lockedRisks.style.display = 'none';

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

      // 「外国人材活用研究所とは」をCTA導線途中から除外（v5.3）
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
    const fields = form.querySelectorAll('[data-required]');

    fields.forEach(field => {
      const errEl = document.getElementById(field.id + '-err');
      field.classList.remove('error');
      if (errEl) errEl.classList.remove('show');

      if (!field.value.trim()) {
        field.classList.add('error');
        if (errEl) { errEl.textContent = 'この項目は必須です。'; errEl.classList.add('show'); }
        valid = false;
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
      }
    }

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
    return {
      timestamp:        new Date().toISOString(),
      variant:          'new',  // v6.0: A/Bテスト用識別子
      score:            this.score,
      rate:             this.rate,
      rating:           this.rating,
      companyType:      this.companyTypeKey,
      risks:            this.risks.map(r => r.label),
      source:           loadSource(),
      ref:              loadRef(),
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
  '外国人採用を検討している企業様向けの簡易診断です。\n' +
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
   v3.0 追加：ロックプレビューのリスク件数表示
   ============================================= */

/**
 * 簡易結果の「ロックされたプレビュー」にリスク件数を表示
 */
ResultPage.renderLockedPreview = function () {
  // v6.0: 旧IDとの互換 + 新ID
  const el  = document.getElementById('locked-risk-count');
  const el2 = document.getElementById('locked-risk-count-v6');
  if (el)  el.textContent = this.risks.length;
  if (el2) el2.textContent = this.risks.length;
};

/**
 * v6.0: ロック済み4軸プレビュー（ぼかしカード）に実スコアをセット
 */
ResultPage.renderLockedBlurCards = function () {
  if (!this.axisScores) return;
  const axisMap = [
    { key: 'strategy',  label: '戦略設計' },
    { key: 'structure', label: '受入体制' },
    { key: 'operation', label: '現場運用' },
    { key: 'retention', label: '定着支援' },
  ];
  const container = document.getElementById('blur-axis-cards');
  if (!container) return;

  container.innerHTML = axisMap.map(a => {
    const rate = this.axisScores[a.key + 'Rate'] || 0;
    return `
      <div class="blur-preview-card">
        <div class="blur-preview-card-label">${a.label}</div>
        <div class="blur-preview-card-value">${rate}%</div>
        <div class="blur-preview-card-bar"><div class="blur-preview-card-bar-fill" style="width:${rate}%"></div></div>
      </div>`;
  }).join('');
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
   v3.0 追加：PDF レポート HTML 生成
   ============================================= */

/**
 * 診断レポートのHTML文字列を生成する（v5.0 改訂：セクション構成・ページ分断防止）
 * @param {object} formData - getFormData() の戻り値
 * @returns {string} 完全なHTML文字列
 */
ResultPage.buildReportHTML = function (formData) {
  const now     = new Date();
  const dateStr = now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日';
  const cost    = calcAttritionCost('_default', this.rating);

  const ratingColors = {
    A: { bg: '#edf7f1', color: '#1a5c3a', border: '#a7e3bf' },
    B: { bg: '#fffbeb', color: '#92400e', border: '#fcd34d' },
    C: { bg: '#fef2f2', color: '#991b1b', border: '#fecaca' },
  };
  const rc = ratingColors[this.rating] || ratingColors['B'];

  const foreignInfo = formData.foreignEmployed === 'YES'
    ? `雇用中（${formData.foreignCount ? formData.foreignCount + '名' : '人数未入力'}）`
    : '現在雇用なし';

  // 企業タイプ
  const companyType = COMPANY_TYPES[this.companyTypeKey] || COMPANY_TYPES['growth_driving'];
  const typeColorMap = {
    a: { bg: '#edf7f1', color: '#1a5c3a', border: '#a7e3bf' },
    b: { bg: '#fffbeb', color: '#92400e', border: '#fcd34d' },
    c: { bg: '#fff7ed', color: '#9a3412', border: '#fed7aa' },
    d: { bg: '#fef2f2', color: '#991b1b', border: '#fecaca' },
    e: { bg: '#fef2f2', color: '#7f1d1d', border: '#fca5a5' },
  };
  const tc = typeColorMap[companyType.colorKey] || typeColorMap['b'];

  // 同規模比較
  const peerAvg  = getPeerAverage(formData.employees);
  const peerDiff = this.rate - peerAvg;
  const peerDiffText = peerDiff > 0
    ? `同規模企業平均より +${Math.abs(peerDiff)}pt 上回っており、受入体制の基盤が比較的整っています`
    : peerDiff < 0
    ? `同規模企業平均より ${Math.abs(peerDiff)}pt 下回っており、受入・運用設計の見直しが有効です`
    : '同規模企業平均と同水準です。引き続き体制の維持・改善をおすすめします';

  // GTN基準比較
  const GTN_BASELINE = 65;
  const gtnDiff  = this.rate - GTN_BASELINE;
  const gtnDiffText = gtnDiff > 0
    ? `GTN推奨基準より +${Math.abs(gtnDiff)}pt 高く、安定した受入体制の基盤が整っています`
    : gtnDiff < 0
    ? `GTN推奨基準より ${Math.abs(gtnDiff)}pt 低く、受入体制の整備に改善余地があります。運用設計の見直しが有効です`
    : 'GTN推奨基準と同水準です。引き続き体制の維持・改善をおすすめします';
  const gtnDiffBg    = gtnDiff >= 0 ? '#edf7f1' : '#fef2f2';
  const gtnDiffColor = gtnDiff >= 0 ? '#1a5c3a' : '#991b1b';

  // 危機レベル
  const crisisLevel = getCrisisLevel(this.rate);
  const crisisMsg   = CRISIS_MESSAGES[crisisLevel];
  const crisisColorMap = {
    high: { bg: '#fef2f2', border: '#fecaca', headColor: '#991b1b', impactBg: '#fee2e2' },
    mid:  { bg: '#fffbeb', border: '#fcd34d', headColor: '#92400e', impactBg: '#fef3c7' },
    low:  { bg: '#edf7f1', border: '#a7e3bf', headColor: '#1a5c3a', impactBg: '#d1fae5' },
  };
  const cc = crisisColorMap[crisisLevel];

  // リスクHTML
  const riskItemsHTML = this.risks.length > 0
    ? this.risks.map(r => {
        const isHigh = r.level === 'high';
        return `
          <div style="margin-bottom:10px;padding:12px 14px;border-radius:6px;
                      background:${isHigh ? '#fef2f2' : '#fffbeb'};
                      border:1px solid ${isHigh ? '#fecaca' : '#fcd34d'};">
            <div style="font-weight:700;color:${isHigh ? '#b91c1c' : '#92400e'};font-size:13px;">
              ${isHigh ? '⚠' : '△'} ${r.label}
            </div>
            <div style="font-size:12px;color:${isHigh ? '#b91c1c' : '#92400e'};margin-top:4px;opacity:0.85;">
              ${r.detail}
            </div>
          </div>`;
      }).join('')
    : `<div style="padding:14px;background:#edf7f1;border-radius:6px;color:#1a5c3a;font-size:13px;">
         ✓ 現時点で特定された主要リスクはありません。引き続き受入体制の維持・改善をおすすめします。
       </div>`;

  // 改善ポイントHTML
  const nextStepsHTML = NEXT_STEPS.items.map((item, i) => `
    <div style="display:flex;gap:14px;align-items:flex-start;margin-bottom:10px;
                padding:13px 15px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
      <div style="width:26px;height:26px;border-radius:50%;background:#1a5c3a;
                  color:white;font-size:12px;font-weight:900;display:flex;
                  align-items:center;justify-content:center;flex-shrink:0;">
        ${i + 1}
      </div>
      <div>
        <div style="font-weight:700;font-size:13px;color:#1f2937;margin-bottom:3px;">${item.title}</div>
        <div style="font-size:12px;color:#6b7280;line-height:1.6;">${item.desc}</div>
      </div>
    </div>`).join('');

  // 4軸カードHTML（PDF版：軸ごとの詳細コメント付き）
  const axisCardsHTML = ['strategy','structure','operation','retention'].map(axis => {
    const info      = AXIS_LABELS[axis];
    const rate      = (this.axisScores || {})[axis + 'Rate'] ?? 0;
    const score     = (this.axisScores || {})[axis + 'Score'] ?? 0;
    const max       = (this.axisScores || {})[axis + 'Max'] ?? 0;
    const isWeakest = this.axisScores && this.axisScores.weakestAxis === axis;
    const barColor  = rate < 45 ? '#b91c1c' : rate < 65 ? '#d97706' : '#1a5c3a';
    return `
      <div style="background:${info.bg};border:1px solid ${info.border};border-radius:8px;
                  padding:12px 13px;${isWeakest ? 'outline:2px solid '+info.color+';' : ''}">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
          <span style="font-size:15px;">${info.icon}</span>
          <span style="font-size:12px;font-weight:700;color:${info.color};">${info.label}</span>
          ${isWeakest ? `<span style="font-size:10px;font-weight:700;background:${barColor};color:white;padding:2px 7px;border-radius:10px;margin-left:auto;">優先改善</span>` : ''}
        </div>
        <div style="font-size:10px;color:#6b7280;margin-bottom:7px;">${info.desc}</div>
        <div style="height:9px;background:#e5e7eb;border-radius:5px;overflow:hidden;margin-bottom:4px;">
          <div style="height:100%;width:${rate}%;background:${barColor};border-radius:5px;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10px;">
          <span style="color:#6b7280;">${score} / ${max}点</span>
          <span style="font-weight:700;color:${info.color};">${rate}%</span>
        </div>
      </div>`;
  }).join('\n');

  // 最弱軸アドバイスノート（PDF版のみ表示）
  const weakestAxisNote = this.axisScores
    ? `<div style="background:#f9fafb;border-left:3px solid #1a5c3a;padding:10px 14px;border-radius:6px;
                   font-size:12px;color:#374151;line-height:1.65;margin-top:10px;">
        <strong>優先改善軸：${AXIS_LABELS[this.axisScores.weakestAxis]?.label || '—'}</strong>
        （${AXIS_LABELS[this.axisScores.weakestAxis]?.desc || '—'}）<br>
        ${AXIS_IMPROVEMENT_NOTES[this.axisScores.weakestAxis] || ''}
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>外国人材活用戦略診断レポート | GTN</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Hiragino Kaku Gothic ProN', 'Yu Gothic Medium', 'Yu Gothic', 'Meiryo', sans-serif;
      font-size: 14px; line-height: 1.7; color: #1f2937; background: #fff;
    }
    .page { max-width: 740px; margin: 0 auto; }
    /* pdf-block: セクション単位の描画グループ */
    .pdf-block {
      padding: 28px 40px;
      background: #fff;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .pdf-block + .pdf-block { border-top: 1px solid #f0f0f0; }
    .section-title {
      font-size: 13px; font-weight: 900; color: #1f2937;
      border-left: 3px solid #1a5c3a; padding-left: 10px; margin-bottom: 13px;
    }
    .cost-box {
      background: #fff8f4; border: 1px solid #fdd5b8; border-radius: 8px;
      padding: 15px 18px; text-align: center;
    }
    .cost-label { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; color: #6b7280;
                  text-transform: uppercase; margin-bottom: 5px; }
    .cost-value { font-size: 22px; font-weight: 900; color: #a34300; }
    .cost-note  { font-size: 11px; color: #6b7280; margin-top: 7px; line-height: 1.5; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .pdf-block { page-break-inside: avoid; break-inside: avoid; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- ═══ GROUP 1: タイトル ／ 会社情報 ／ 診断サマリー ═══ -->
  <div class="pdf-block" style="padding-top:36px;">
    <!-- レポートヘッダー -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;
                padding-bottom:16px;border-bottom:2px solid #1a5c3a;margin-bottom:18px;">
      <div>
        <span style="background:#1a5c3a;color:#fff;font-size:11px;font-weight:900;
                     padding:4px 8px;border-radius:4px;letter-spacing:0.1em;display:inline-block;">GTN</span>
        <span style="font-size:12px;font-weight:700;color:#1f2937;margin-left:8px;">Global Talent Navi</span>
        <div style="font-size:10px;color:#6b7280;margin-top:4px;">外国人材活用研究所</div>
      </div>
      <div style="text-align:right;font-size:11px;color:#6b7280;">
        <div>診断日：${dateStr}</div>
        <div>No：GTN-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${this.score}</div>
      </div>
    </div>

    <!-- レポートタイトル -->
    <div style="text-align:center;margin-bottom:18px;padding:16px 20px;
                background:linear-gradient(135deg,#0f3d26,#1a5c3a);border-radius:10px;color:#fff;">
      <div style="font-size:10px;opacity:0.7;letter-spacing:0.1em;margin-bottom:5px;">FULL REPORT</div>
      <div style="font-size:18px;font-weight:900;margin-bottom:4px;">外国人材活用戦略診断レポート</div>
      <div style="font-size:11px;opacity:0.75;">Global Talent Navi 外国人材活用研究所｜企業別カスタム生成</div>
    </div>

    <!-- 会社情報 -->
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;
                padding:13px 17px;margin-bottom:18px;
                display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <div><div style="font-size:9px;color:#6b7280;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:2px;">会社名</div>
           <div style="font-weight:600;color:#1f2937;font-size:13px;">${formData.company || '—'}</div></div>
      <div><div style="font-size:9px;color:#6b7280;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:2px;">担当者</div>
           <div style="font-weight:600;color:#1f2937;font-size:13px;">${formData.name || '—'}</div></div>
      <div><div style="font-size:9px;color:#6b7280;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:2px;">業種</div>
           <div style="font-weight:600;color:#1f2937;font-size:13px;">${formData.industry || '—'}</div></div>
      <div><div style="font-size:9px;color:#6b7280;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:2px;">従業員数</div>
           <div style="font-weight:600;color:#1f2937;font-size:13px;">${formData.employees || '—'}</div></div>
      <div${formData.challenges ? '' : ' style="grid-column:1/-1"'}>
           <div style="font-size:9px;color:#6b7280;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:2px;">外国人雇用</div>
           <div style="font-weight:600;color:#1f2937;font-size:13px;">${foreignInfo}</div></div>
      ${formData.challenges ? `<div style="grid-column:1/-1"><div style="font-size:9px;color:#6b7280;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:2px;">現在の課題</div>
           <div style="font-size:12px;color:#374151;">${formData.challenges}</div></div>` : ''}
    </div>

    <!-- ① 診断結果サマリー -->
    <div class="section-title">① 診断結果サマリー</div>
    <div style="display:flex;align-items:center;gap:20px;background:#fff;border:1px solid #e5e7eb;
                border-radius:10px;padding:17px 20px;margin-bottom:12px;">
      <div style="font-size:50px;font-weight:900;color:#1a5c3a;line-height:1;">
        ${this.rate}<span style="font-size:20px;">%</span>
      </div>
      <div>
        <div style="display:inline-block;padding:4px 13px;border-radius:50px;font-size:11px;font-weight:800;
                    background:${rc.bg};color:${rc.color};border:1px solid ${rc.border};margin-bottom:6px;">
          総合評価：${RATING_LABELS[this.rating] || this.rating + 'ランク'}
        </div>
        <div style="font-size:11px;color:#6b7280;margin-bottom:5px;">診断スコア：${this.score} / 20点</div>
        <div style="font-size:12px;color:#374151;line-height:1.6;">${COMMENTS[this.rating]}</div>
      </div>
    </div>
    <div style="background:#edf7f1;border-radius:6px;padding:10px 14px;font-size:12px;color:#124429;line-height:1.65;">
      ${IMPROVEMENT_NOTES[this.rating] || ''}
    </div>
  </div>

  <!-- ═══ GROUP 2: 成功確率・総合評価・タイプ診断 ═══ -->
  <div class="pdf-block">
    <!-- ② 企業タイプ診断 -->
    <div class="section-title">② 外国人雇用タイプ診断</div>
    <div style="display:flex;align-items:flex-start;gap:14px;padding:14px 16px;
                background:${tc.bg};border:1px solid ${tc.border};border-radius:8px;margin-bottom:12px;">
      <div style="font-size:26px;line-height:1;flex-shrink:0;">${companyType.icon}</div>
      <div>
        <div style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;
                    letter-spacing:0.05em;background:#fff;border:1px solid ${tc.border};color:${tc.color};
                    margin-bottom:5px;">${companyType.badge}</div>
        <div style="font-size:14px;font-weight:900;color:#1f2937;margin-bottom:4px;">企業タイプ：${companyType.label}</div>
        <div style="font-size:12px;color:#374151;line-height:1.65;">${companyType.desc}</div>
        <div style="font-size:12px;color:#374151;line-height:1.65;margin-top:5px;border-top:1px solid ${tc.border};padding-top:5px;">
          ${TYPE_RESULT_COMMENTS[this.companyTypeKey] || ''}
        </div>
      </div>
    </div>
  </div>

  <!-- ═══ GROUP 3: 4軸診断サマリー ═══ -->
  <div class="pdf-block">
    <!-- ③ 4軸診断サマリー -->
    <div class="section-title">③ 4軸診断サマリー</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
      ${axisCardsHTML}
    </div>
    ${weakestAxisNote}
  </div>

  <!-- ═══ GROUP 4: GTN基準比較 ═══ -->
  <div class="pdf-block">
    <div class="section-title">④ GTN基準との比較</div>
    <div style="font-size:11px;color:#6b7280;margin-bottom:11px;">
      外国人材を安定的に受け入れるためのGTN推奨基準値・同規模企業平均と比較しています
    </div>

    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 17px;margin-bottom:10px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:9px;">
        <div style="width:76px;font-size:11px;color:#374151;font-weight:600;flex-shrink:0;">貴社</div>
        <div style="flex:1;height:14px;background:#e5e7eb;border-radius:7px;overflow:hidden;">
          <div style="height:100%;width:${Math.min(this.rate,100)}%;background:#1a5c3a;border-radius:7px;"></div>
        </div>
        <div style="width:38px;font-size:12px;font-weight:800;color:#1a5c3a;text-align:right;">${this.rate}%</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:9px;">
        <div style="width:76px;font-size:11px;color:#374151;font-weight:600;flex-shrink:0;">GTN基準値</div>
        <div style="flex:1;height:14px;background:#e5e7eb;border-radius:7px;overflow:hidden;">
          <div style="height:100%;width:${GTN_BASELINE}%;background:#9ca3af;border-radius:7px;"></div>
        </div>
        <div style="width:38px;font-size:12px;font-weight:800;color:#6b7280;text-align:right;">${GTN_BASELINE}%</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:76px;font-size:11px;color:#374151;font-weight:600;flex-shrink:0;">${formData.employees ? formData.employees + '平均' : '業界平均'}</div>
        <div style="flex:1;height:14px;background:#e5e7eb;border-radius:7px;overflow:hidden;">
          <div style="height:100%;width:${Math.min(peerAvg,100)}%;background:#d1d5db;border-radius:7px;"></div>
        </div>
        <div style="width:38px;font-size:12px;font-weight:800;color:#9ca3af;text-align:right;">${peerAvg}%</div>
      </div>
    </div>

    <div style="background:${gtnDiffBg};border-radius:6px;padding:9px 13px;font-size:12px;
                font-weight:700;color:${gtnDiffColor};margin-bottom:7px;">
      ${gtnDiffText}
    </div>
    <div style="font-size:11px;color:#6b7280;">
      ${peerDiff !== 0 ? `同規模（${formData.employees || '一般'}）比：${peerDiffText}` : ''}
    </div>
  </div>

  <!-- ═══ GROUP 5: 主要リスク分析 ═══ -->
  <div class="pdf-block">
    <!-- リスク危機レベル -->
    <div style="background:${cc.bg};border:1px solid ${cc.border};border-radius:8px;padding:13px 15px;margin-bottom:15px;">
      <div style="font-size:13px;font-weight:900;color:${cc.headColor};margin-bottom:7px;">${crisisMsg.headline}</div>
      <div style="font-size:12px;color:#374151;line-height:1.65;margin-bottom:8px;">${crisisMsg.text}</div>
      <div style="background:${cc.impactBg};border-radius:6px;padding:7px 11px;font-size:11px;
                  font-weight:700;color:${cc.headColor};display:inline-block;">${crisisMsg.impact}</div>
    </div>

    <!-- ⑤ 主要リスク分析 -->
    <div class="section-title">⑤ 主要リスク分析（${this.risks.length}件検出）</div>
    ${riskItemsHTML}
  </div>

  <!-- ═══ GROUP 6: 参考離職コスト ═══ -->
  <div class="pdf-block">
    <div class="section-title">⑥ 参考離職コスト試算</div>
    <div class="cost-box">
      <div class="cost-label">外国人材が早期離職した場合の参考コストレンジ（1名あたり）</div>
      <div class="cost-value">${fmtManyen(cost.min)}〜${fmtManyen(cost.max)}</div>
      <div class="cost-note" style="margin-top:10px;line-height:1.75;">
        ${getAttritionCostMessage(this.rating)}
      </div>
      <div class="cost-note" style="margin-top:6px;font-size:11px;color:#9ca3af;">
        ※ 実際の損失額は職種・採用方法・受入体制により変動します。本値は参考レンジです。
      </div>
    </div>
  </div>

  <!-- ═══ GROUP 7: GTN経営コメント ═══ -->
  <div class="pdf-block">
    <div class="section-title">⑦ GTN 経営コメント</div>
    <div style="background:#f9fafb;border-left:3px solid #1a5c3a;border-radius:8px;
                padding:14px 18px;font-size:13px;color:#374151;line-height:1.85;">
      ${MANAGEMENT_COMMENTS[this.rating] || ''}
    </div>
  </div>

  <!-- ═══ GROUP 8: 優先改善ポイント ═══ -->
  <div class="pdf-block">
    <div class="section-title">⑧ ${NEXT_STEPS.heading[this.rating] || '次に整理すべきポイント'}</div>
    ${nextStepsHTML}
  </div>

  <!-- ═══ GROUP 9: 無料相談 CTA ／ フッター ═══ -->
  <div class="pdf-block">
    <div style="background:linear-gradient(135deg,#124429,#1a5c3a);color:#fff;
                border-radius:10px;padding:22px 28px;margin-bottom:18px;text-align:center;">
      <div style="font-size:13px;font-weight:900;margin-bottom:10px;line-height:1.5;">
        この診断結果をもとに、貴社に最適な外国人材活用の設計を個別に整理できます
      </div>
      <ul style="list-style:none;padding:0;margin:0 0 12px;text-align:left;display:inline-block;">
        <li style="font-size:11px;opacity:0.88;line-height:1.7;padding:3px 0;">
          ✓ 診断で検出されたリスクへの具体的な改善策をご提案します
        </li>
        <li style="font-size:11px;opacity:0.88;line-height:1.7;padding:3px 0;">
          ✓ 採用・定着・受入体制の優先整備ポイントを明確にします
        </li>
        <li style="font-size:11px;opacity:0.88;line-height:1.7;padding:3px 0;">
          ✓ 貴社の業種・規模に合った外国人材活用の設計を一緒に整理します
        </li>
      </ul>
      <div style="font-size:10px;opacity:0.65;margin-bottom:10px;">無料 60分 ／ 秘密厳守 ／ 勧誘はありません</div>
      <div data-pdf-link="consult"
           style="display:inline-block;background:#c75200;color:#fff;font-weight:700;
                  font-size:12px;padding:9px 22px;border-radius:6px;letter-spacing:0.03em;">
        ▶ 無料相談を予約する
      </div>
      <div style="font-size:9px;opacity:0.55;margin-top:8px;word-break:break-all;">
        ${CONSULT_URL}
      </div>
      <div style="font-size:10px;opacity:0.75;margin-top:10px;">
        メールでのお問い合わせ: info@globaltalent-navi.com
      </div>
    </div>

    <div style="padding-top:13px;border-top:1px solid #e5e7eb;
                font-size:10px;color:#9ca3af;text-align:center;line-height:1.7;">
      本レポートは Global Talent Navi 外国人材活用研究所 の分析モデルをもとに企業別に自動生成されたものです。<br>
      株式会社フレアスタッフ / Global Talent Navi (GTN)｜© 2025 All rights reserved.<br>
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
      pdf.text('GTN 外国人材活用戦略診断レポート', 10, pageH - 5);
      pdf.text(`${p} / ${totalPages}`, pageW - 18, pageH - 5);
    }

    pdf.save('GTN_外国人材活用戦略診断レポート.pdf');
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
  // v6.0: 無料エリアではロックUIのみ描画。詳細分析はフォーム送信後に描画する
  this.renderLockedPreview();       // リスク件数をロックUIに反映
  this.renderLockedBlurCards();     // v6.0: 4軸ぼかしカードに実スコアをセット
  this.renderRiskHint();            // v6.0: リスク示唆テキスト更新
  this.renderCostEstimate();        // v7.0: 想定損失額（概算）を表示
  this.renderLockedRisksPreview();  // v6.0: リスクプレースホルダー更新
  // NOTE: renderAxisSummary / renderTypeDiagnosis / renderPeerComparison / renderCrisisBlock
  //       は initForm() 内のフォーム送信後に呼ばれる（v6.0 ゲート方式）
};

/* =============================================
   初期化
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page === 'check')  CheckPage.init();
  if (page === 'result') ResultPage.init();
});

// =======================================================================
// api/lib/ai-rules.js
// -----------------------------------------------------------------------
// AI呼び出しの「深さ」「刺し方」を決める判定ロジック。
//
//  - determineAiLevel(data)     : full / light / minimal
//  - determineTargetState(data) : manifest / prevention / latent / unknown
//
// 業種で切らず、業種 × 状態 × スコアで出力の深さを切り替える。
// =======================================================================

'use strict';

const { classifyIndustry } = require('./industry-rules');

/**
 * ターゲット状態を推定する
 * - manifest   : すでに雇用中で課題が顕在化している（最優先ターゲット）
 * - prevention : これから採用／予防視点で整えたい（第二ターゲット）
 * - latent     : 雇用中だが大きな問題を感じていないが潜在リスクあり（潜在ターゲット）
 * - unknown    : 情報不足（初期レンダリング時など）
 *
 * @param {object} data - 正規化済み診断データ
 * @returns {'manifest'|'prevention'|'latent'|'unknown'}
 */
function determineTargetState(data) {
  const fe   = (data.foreignEmployed || '').toUpperCase();
  const rate = Number(data.rate);

  // 外国人雇用していない → 予防ターゲット
  if (fe === 'NO') return 'prevention';

  // 雇用中
  if (fe === 'YES') {
    if (Number.isFinite(rate) && rate < 65) return 'manifest';
    // 雇用中だが高スコア → 現場と経営のズレ・潜在リスク
    return 'latent';
  }

  // foreignEmployed 未入力（初期レンダリング時）
  // → スコアから推定。低スコアは何かしら課題が見えているので manifest 寄り
  if (Number.isFinite(rate)) {
    if (rate < 45) return 'manifest';
    if (rate < 65) return 'latent';
  }
  return 'unknown';
}

/**
 * AI呼び出しの深さレベルを決定する
 *  - full    : コア業種 / 低スコア / manifest ターゲット
 *  - light   : 準コア業種 / 中スコア / その他一般
 *  - minimal : 情報不足 / 高スコアで潜在リスク薄め
 *
 * @param {object} data
 * @returns {'full'|'light'|'minimal'}
 */
function determineAiLevel(data) {
  const tier       = classifyIndustry(data.industry);
  const rate       = Number(data.rate);
  const target     = determineTargetState(data);

  // 情報不足
  if (tier === 'unknown' && target === 'unknown') return 'minimal';

  // 顕在ターゲット or 低スコア or コア業種は full
  if (target === 'manifest') return 'full';
  if (Number.isFinite(rate) && rate < 45) return 'full';
  if (tier === 'core') return 'full';

  // 準コア業種 or 予防ターゲット or 中程度スコア
  if (tier === 'semi_core') return 'light';
  if (target === 'prevention') return 'light';
  if (Number.isFinite(rate) && rate < 80) return 'light';

  // それ以外（高スコア・情報薄め）
  return 'minimal';
}

/**
 * レベル別の文字数ガイド（プロンプトに差し込む）
 * @param {'full'|'light'|'minimal'} level
 */
function getLevelGuide(level) {
  if (level === 'full') {
    return {
      summary:      '100〜140字',
      core_issue:   '80〜120字',
      risk_message: '50〜80字',
      tone:         '業種特有の落とし穴と弱い軸を具体文脈で指摘し、核心に踏み込む。',
    };
  }
  if (level === 'light') {
    return {
      summary:      '80〜110字',
      core_issue:   '60〜90字',
      risk_message: '40〜60字',
      tone:         '一般的な業界文脈を軽く添え、弱い軸を中心に指摘する。',
    };
  }
  return {
    summary:      '60〜90字',
    core_issue:   '50〜70字',
    risk_message: '30〜50字',
    tone:         '情報が少ない前提で、弱い軸を中心に抽象度高めで指摘する。',
  };
}

/**
 * ターゲット状態ごとの「刺し方」ガイド
 * @param {'manifest'|'prevention'|'latent'|'unknown'} target
 */
function getTargetGuide(target) {
  if (target === 'manifest') {
    return '顕在課題企業向け：現場で起きている痛みに共感しつつ、核心を一言で指摘する。';
  }
  if (target === 'prevention') {
    return '予防視点企業向け：採用前に整えるべき観点を示し、失敗パターンを未然に避ける文脈。';
  }
  if (target === 'latent') {
    return '潜在リスク企業向け：今は大きな問題が出ていなくても、このまま人数が増えると崩れる違和感を作る。';
  }
  return '情報不足向け：一般論に逃げず、弱い軸を起点に抽象度高めで指摘する。';
}

module.exports = {
  determineTargetState,
  determineAiLevel,
  getLevelGuide,
  getTargetGuide,
};

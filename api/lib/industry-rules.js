// =======================================================================
// api/lib/industry-rules.js
// -----------------------------------------------------------------------
// GTN としてコメントを強めたい優先業種の定義・分類関数。
// 「制度上受け入れ可能か」の判定ではなく、あくまで個別化の深さ制御用。
// 業種名の表記ゆれ（/ ・ ／ 半角/全角）に強いよう、includes 方式で判定する。
// =======================================================================

'use strict';

/** コア業種（深く刺す／full レベル寄り） */
const CORE_INDUSTRIES = [
  '製造業',
  '食品加工',   // 食品加工業
  '建設業',
  '物流',       // 物流/倉庫・物流倉庫 もヒット
  '倉庫',
];

/** 準コア業種（中程度の個別化） */
const SEMI_CORE_INDUSTRIES = [
  '外食',       // 外食業 / 外食産業
  '宿泊',       // 宿泊業
  '介護',
];

/**
 * 業種ティアを返す
 * @param {string} industry
 * @returns {'core'|'semi_core'|'other'|'unknown'}
 */
function classifyIndustry(industry) {
  if (!industry || typeof industry !== 'string') return 'unknown';
  const s = industry.trim();
  if (!s) return 'unknown';
  if (CORE_INDUSTRIES.some((k) => s.indexOf(k) !== -1)) return 'core';
  if (SEMI_CORE_INDUSTRIES.some((k) => s.indexOf(k) !== -1)) return 'semi_core';
  return 'other';
}

/**
 * 業種固有の文脈ヒント（プロンプトに差し込む一言）
 * 具体策ではなく「この業種特有の落とし穴」を示すフック
 * @param {string} industry
 * @returns {string}
 */
function getIndustryHint(industry) {
  const tier = classifyIndustry(industry);
  if (tier === 'unknown') return '';

  const s = String(industry || '');
  if (s.indexOf('製造') !== -1) {
    return '現場OJT依存・多能工化の停滞・日本語での品質基準伝達のズレが起こりやすい業種です。';
  }
  if (s.indexOf('食品加工') !== -1) {
    return '衛生管理・作業手順のルール徹底と、繁閑差による教育の断絶が起こりやすい業種です。';
  }
  if (s.indexOf('建設') !== -1) {
    return '安全教育の言語化・班長依存・現場ごとの受入バラつきが起こりやすい業種です。';
  }
  if (s.indexOf('物流') !== -1 || s.indexOf('倉庫') !== -1) {
    return '人手不足が深刻化している領域で、短期離職・教育コストの回収失敗が起こりやすい業種です。';
  }
  if (s.indexOf('外食') !== -1) {
    return '接客品質・シフト運用・店舗間のバラつきが定着に直結する業種です。';
  }
  if (s.indexOf('宿泊') !== -1) {
    return '繁閑差の大きさ・接客品質・現場育成の属人化が起こりやすい業種です。';
  }
  if (s.indexOf('介護') !== -1) {
    return '利用者との信頼関係・資格支援・キャリアパスの不透明さが離職要因になりやすい業種です。';
  }
  return '';
}

module.exports = {
  CORE_INDUSTRIES,
  SEMI_CORE_INDUSTRIES,
  classifyIndustry,
  getIndustryHint,
};

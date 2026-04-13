/* =======================================================================
   js/render.js — AIコメントの描画層
   -----------------------------------------------------------------------
   責務:
     - GTN_AI から返ってきた result コメントを result.html に反映する
     - 既存の #result-comment を AI summary で置き換える（空なら据え置き）
     - core_issue / risk_message は事前配置済みプレースホルダーを更新
     - ラベル(.ai-card-label)は保持し、本文(.ai-card-content)のみ差し替え
     - DOM不在／失敗時は何もしない（既存UIを絶対に壊さない）
   ======================================================================= */

(function (global) {
  'use strict';

  var CORE_ID  = 'ai-core-issue';
  var RISK_ID  = 'ai-risk-message';

  /**
   * カード内の .ai-card-content を本文で差し替え（ラベルは残す）
   */
  function updateCardContent(el, text) {
    if (!el || !text) return;
    var content = el.querySelector('.ai-card-content');
    if (content) {
      content.textContent = text;
    } else {
      // フォールバック: content要素がなければ全体を差し替え
      el.textContent = text;
    }
    el.classList.remove('ai-card-placeholder');
    el.classList.add('ai-card-loaded');
  }

  /**
   * AIの result 結果を DOM に反映
   * プレースホルダーが result.html に事前配置されている前提
   * @param {{summary?:string, core_issue?:string, risk_message?:string}} result
   */
  function renderResultComment(result) {
    if (!result || typeof result !== 'object') return false;

    var commentEl = document.getElementById('result-comment');
    if (!commentEl) return false;

    // summary: 既存の総評テキストを置き換え
    if (result.summary) {
      commentEl.textContent = result.summary;
      commentEl.setAttribute('data-ai', '1');
    }

    // core_issue / risk_message: 事前配置済み要素を更新（ラベル保持）
    if (result.core_issue) {
      updateCardContent(document.getElementById(CORE_ID), result.core_issue);
    }
    if (result.risk_message) {
      updateCardContent(document.getElementById(RISK_ID), '\u26A0 ' + result.risk_message);
    }

    return true;
  }

  global.GTN_Render = {
    renderResultComment: renderResultComment,
  };
})(window);

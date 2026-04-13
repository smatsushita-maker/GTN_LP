/* =======================================================================
   js/ai.js — フロント側のAI呼び出し補助（薄いクライアント）
   -----------------------------------------------------------------------
   責務:
     - /api/ai へ POST する薄いラッパー
     - APIキー・プロンプトはここに置かない（すべてサーバー側 /api/ai）
     - 失敗・タイムアウト時も例外を投げず { ok:false, error } を返す
     - result / email など mode を増やしやすい汎用I/Fにしておく
   ======================================================================= */

(function (global) {
  'use strict';

  var AI_ENDPOINT = '/api/ai';
  var DEFAULT_TIMEOUT_MS = 9000;

  /**
   * 共通: /api/ai を呼ぶ
   * @param {'result'|'email'} mode
   * @param {object} data
   * @param {{ timeoutMs?: number, signal?: AbortSignal }} [opts]
   * @returns {Promise<{ok:boolean, result?:object, error?:string}>}
   */
  function fetchAI(mode, data, opts) {
    opts = opts || {};
    var timeoutMs = opts.timeoutMs || DEFAULT_TIMEOUT_MS;
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = null;
    if (controller) {
      timer = setTimeout(function () { try { controller.abort(); } catch (_) {} }, timeoutMs);
    }

    var fetchOpts = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: mode, data: data || {} }),
    };
    if (controller) fetchOpts.signal = opts.signal || controller.signal;

    return fetch(AI_ENDPOINT, fetchOpts)
      .then(function (res) {
        if (timer) clearTimeout(timer);
        if (!res || !res.ok) return { ok: false, error: 'http_' + (res && res.status) };
        return res.json().then(function (json) {
          if (!json || json.ok !== true || !json.result) {
            return { ok: false, error: 'bad_payload' };
          }
          return { ok: true, result: json.result };
        }).catch(function () {
          return { ok: false, error: 'bad_json' };
        });
      })
      .catch(function (e) {
        if (timer) clearTimeout(timer);
        var err = (e && e.name === 'AbortError') ? 'timeout' : 'network';
        return { ok: false, error: err };
      });
  }

  /** result ページ向けショートカット */
  function fetchResultComment(data, opts) {
    return fetchAI('result', data, opts);
  }

  /** email 用ショートカット（将来拡張） */
  function fetchEmailCopy(data, opts) {
    return fetchAI('email', data, opts);
  }

  /**
   * ResultPage の内部状態から /api/ai 用 payload を組み立てる
   * 将来 industry / employees 等をフォーム値から渡したくなった時も
   * この関数だけ直せば良いように、呼び出し元を一箇所にまとめる。
   * @param {object} rp  - ResultPage オブジェクト
   * @param {object} [extra] - フォーム由来などの追加情報
   */
  function buildResultPayloadFromResultPage(rp, extra) {
    if (!rp) return {};
    var ax = rp.axisScores || {};
    var e  = extra || {};
    return {
      score:           rp.score,
      rate:            rp.rate,
      rating:          rp.rating,
      companyType:     rp.companyTypeKey,
      weakestAxis:     ax.weakestAxis || '',
      axisRates: {
        strategy:  ax.strategyRate,
        structure: ax.structureRate,
        operation: ax.operationRate,
        retention: ax.retentionRate,
      },
      // industry は localStorage から自動取得。extra で上書き可。
      industry:        e.industry || (typeof loadIndustry === 'function' ? loadIndustry() : '') || '',
      employees:       e.employees       || '',
      foreignRatio:    e.foreignRatio    || '',
      foreignEmployed: e.foreignEmployed || '',
      companyName:     e.companyName     || '',
    };
  }

  global.GTN_AI = {
    fetchAI: fetchAI,
    fetchResultComment: fetchResultComment,
    fetchEmailCopy: fetchEmailCopy,
    buildResultPayloadFromResultPage: buildResultPayloadFromResultPage,
  };
})(window);

// =======================================================================
// /api/ai.js — Vercel Serverless Function（AI診断コメント生成）
// -----------------------------------------------------------------------
// 責務:
//   - フロントからの診断データを受け取り、レベル判定＆プロンプト生成 →
//     AIプロバイダ呼び出し → 安全なJSONに整形してフロントへ返す
//   - APIキーはサーバー側の環境変数からのみ読み込む（フロントに出さない）
//
// 責務分離（api/lib/ 配下）:
//   - industry-rules.js : 業種ティア（core/semi_core/other）と業種ヒント
//   - ai-rules.js       : AIレベル判定 / ターゲット状態推定
//   - prompt-builder.js : result / email 別プロンプト生成
//
// 環境変数（Vercel → Project Settings → Environment Variables）:
//   AI_PROVIDER         : "anthropic"（既定） | "openai"
//   ANTHROPIC_API_KEY   : Claude API キー
//   ANTHROPIC_MODEL     : 任意（既定: claude-haiku-4-5-20251001）
//   OPENAI_API_KEY      : OpenAI API キー
//   OPENAI_MODEL        : 任意（既定: gpt-4o-mini）
//   AI_ALLOW_ORIGINS    : 任意。カンマ区切りの許可オリジン（未指定時は "*"）
//
// Request:
//   POST /api/ai
//   { "mode": "result" | "email", "data": { ...診断データ } }
//
// Response:
//   200 { ok:true, mode, level, target, result:{ ... } }
//   4xx/5xx { ok:false, error:"..." }
// =======================================================================

'use strict';

const { classifyIndustry } = require('./lib/industry-rules');
const { determineAiLevel, determineTargetState } = require('./lib/ai-rules');
const { buildResultPrompt, buildEmailPrompt } = require('./lib/prompt-builder');

const DEFAULT_TIMEOUT_MS = 12000;

/* -----------------------------------------------------------------------
   utils
----------------------------------------------------------------------- */

function setCors(res, origin) {
  const allow = process.env.AI_ALLOW_ORIGINS || '*';
  let allowed = '';
  if (allow === '*') {
    allowed = '*';
  } else {
    const list = allow.split(',').map((s) => s.trim()).filter(Boolean);
    if (origin && list.indexOf(origin) !== -1) allowed = origin;
  }
  if (allowed) res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
}

function sanitizeStr(v, max) {
  if (v == null) return '';
  return String(v)
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, max || 200);
}

function sanitizeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function validatePayload(body) {
  if (!body || typeof body !== 'object') throw new Error('invalid body');
  const mode = body.mode === 'email' ? 'email' : 'result';
  const d = body.data || {};
  const ax = (d.axisRates && typeof d.axisRates === 'object') ? d.axisRates : {};

  return {
    mode,
    data: {
      companyName:     sanitizeStr(d.companyName, 80),
      industry:        sanitizeStr(d.industry, 60),
      employees:       sanitizeStr(d.employees, 40),
      foreignRatio:    sanitizeStr(d.foreignRatio, 40),
      foreignEmployed: sanitizeStr(d.foreignEmployed, 8),  // YES / NO / ''
      score:           sanitizeNum(d.score),
      rate:            sanitizeNum(d.rate),
      rating:          sanitizeStr(d.rating, 4),
      companyType:     sanitizeStr(d.companyType, 40),
      weakestAxis:     sanitizeStr(d.weakestAxis, 40),
      axisRates: {
        strategy:  sanitizeNum(ax.strategy),
        structure: sanitizeNum(ax.structure),
        operation: sanitizeNum(ax.operation),
        retention: sanitizeNum(ax.retention),
      },
    },
  };
}

/* -----------------------------------------------------------------------
   providers
----------------------------------------------------------------------- */

async function callAnthropic(prompt, signal) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
  const model = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 800,
      temperature: 0.5,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: signal,
  });
  if (!r.ok) throw new Error('anthropic_' + r.status);
  const j = await r.json();
  const text = (j && j.content && j.content[0] && j.content[0].text) || '';
  return text;
}

async function callOpenAI(prompt, signal) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer ' + apiKey,
    },
    body: JSON.stringify({
      model: model,
      temperature: 0.5,
      max_tokens: 800,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: signal,
  });
  if (!r.ok) throw new Error('openai_' + r.status);
  const j = await r.json();
  const text = (j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
  return text;
}

async function callProvider(prompt) {
  const provider = (process.env.AI_PROVIDER || 'anthropic').toLowerCase();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), DEFAULT_TIMEOUT_MS);
  try {
    if (provider === 'openai') return await callOpenAI(prompt, ctrl.signal);
    return await callAnthropic(prompt, ctrl.signal);
  } finally {
    clearTimeout(timer);
  }
}

/* -----------------------------------------------------------------------
   parse & shape
----------------------------------------------------------------------- */

function extractJson(text) {
  if (!text) return null;
  const cleaned = String(text).replace(/```json\s*|\s*```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end   = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch (_) {
    return null;
  }
}

function shapeResult(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const shaped = {
    summary:      sanitizeStr(obj.summary, 400),
    core_issue:   sanitizeStr(obj.core_issue, 400),
    risk_message: sanitizeStr(obj.risk_message, 300),
  };
  if (!shaped.summary && !shaped.core_issue && !shaped.risk_message) return null;
  return shaped;
}

function shapeEmail(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const shaped = {
    subject: sanitizeStr(obj.subject, 120),
    body:    sanitizeStr(obj.body, 2000),
  };
  if (!shaped.body) return null;
  return shaped;
}

/* -----------------------------------------------------------------------
   handler
----------------------------------------------------------------------- */

module.exports = async function handler(req, res) {
  const origin = (req.headers && req.headers.origin) || '';
  setCors(res, origin);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: 'method not allowed' }));
  }

  // Vercel は自動パース、その他ランタイムは文字列の場合があるので両対応
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = null; }
  }

  let payload;
  try {
    payload = validatePayload(body);
  } catch (_) {
    res.statusCode = 400;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: 'invalid payload' }));
  }

  // ── レベル判定 & ターゲット状態推定（api/lib に分離済み）
  const level  = determineAiLevel(payload.data);
  const target = determineTargetState(payload.data);
  const tier   = classifyIndustry(payload.data.industry);

  // ── プロンプト生成（mode ごとに分離）
  const prompt = payload.mode === 'email'
    ? buildEmailPrompt(payload.data, level, target)
    : buildResultPrompt(payload.data, level, target);

  try {
    const raw    = await callProvider(prompt);
    const parsed = extractJson(raw);
    const shaped = payload.mode === 'email' ? shapeEmail(parsed) : shapeResult(parsed);
    if (!shaped) throw new Error('empty_ai_response');

    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');
    res.setHeader('cache-control', 'no-store');
    return res.end(JSON.stringify({
      ok: true,
      mode: payload.mode,
      level: level,
      target: target,
      tier: tier,
      result: shaped,
    }));
  } catch (_) {
    // 内部エラー詳細はフロントに漏らさない
    res.statusCode = 502;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: 'ai_unavailable' }));
  }
};

/**
 * Global Talent Navi - Landing Page Scripts
 * Handles: header scroll, mobile nav, scroll animations, GA4 tracking
 */

document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  initMobileNav();
  initScrollAnimations();
  initCountUp();
  initSmoothScroll();

  // GA4 tracking
  // Phase3.2: utm_* / gclid を取り込み・保存（既存 attribution と並走）
  saveAdsParams();
  // Phase3.3: debug_mode を URL から検出して LS 永続化（DebugView 用）
  initDebugMode();
  primeSessionId();
  // Phase2: 先に href を書き換えてから cta_click を計測する順序を守る
  inheritParamsToDiagnosisLinks();
  // Phase1
  initLpView();
  initCtaTracking();
  initConsultTracking();
  initExternalLinkTracking();
  initScrollDepth();
});

/* ---------- Header Scroll Effect ---------- */
function initHeader() {
  const header = document.getElementById('header');
  let lastScroll = 0;

  window.addEventListener('scroll', () => {
    const currentScroll = window.scrollY;

    if (currentScroll > 20) {
      header.classList.add('header--scrolled');
    } else {
      header.classList.remove('header--scrolled');
    }

    lastScroll = currentScroll;
  }, { passive: true });
}

/* ---------- Mobile Navigation ---------- */
function initMobileNav() {
  const hamburger = document.getElementById('hamburger');
  const mobileNav = document.getElementById('mobileNav');

  if (!hamburger || !mobileNav) return;

  hamburger.addEventListener('click', () => {
    const isOpen = mobileNav.classList.contains('active');
    hamburger.classList.toggle('active');
    mobileNav.classList.toggle('active');
    document.body.style.overflow = isOpen ? '' : 'hidden';
    hamburger.setAttribute('aria-label', isOpen ? 'メニューを開く' : 'メニューを閉じる');
  });

  // Close on link click
  mobileNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('active');
      mobileNav.classList.remove('active');
      document.body.style.overflow = '';
    });
  });
}

/* ---------- Scroll Animations (IntersectionObserver) ---------- */
function initScrollAnimations() {
  const elements = document.querySelectorAll('[data-animate]');
  if (!elements.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.15,
      rootMargin: '0px 0px -40px 0px',
    }
  );

  elements.forEach(el => observer.observe(el));
}

/* ---------- Count-up Animation for Numbers Section ---------- */
function initCountUp() {
  const counters = document.querySelectorAll('[data-count]');
  if (!counters.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const target = parseInt(el.getAttribute('data-count'), 10);
          animateCount(el, target);
          observer.unobserve(el);
        }
      });
    },
    { threshold: 0.3 }
  );

  counters.forEach(el => observer.observe(el));
}

function animateCount(el, target) {
  const duration = 1500;
  const start = performance.now();

  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(target * eased).toLocaleString();

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

/* ---------- Smooth Scroll for Anchor Links ---------- */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (targetId === '#') return;

      const target = document.querySelector(targetId);
      if (!target) return;

      e.preventDefault();

      const headerHeight = document.getElementById('header').offsetHeight;
      const targetPosition = target.getBoundingClientRect().top + window.scrollY - headerHeight;

      window.scrollTo({
        top: targetPosition,
        behavior: 'smooth',
      });
    });
  });
}

/* ============================================================
   GA4 Tracking (Phase1)
   ------------------------------------------------------------
   - lp_view             : ページ表示時1回
   - cta_click           : [data-cta-location] クリック委譲
   - consult_click       : [data-consult-location] クリック委譲（無料相談リンク）
   - external_link_click : [data-external-link] クリック委譲（note記事等）
   - scroll_depth        : 25 / 50 / 75 / 100% 各1回
   ============================================================ */
const TRACK_PAGE_ID = 'top_lp';
const TRACK_SCROLL_THRESHOLDS = [25, 50, 75, 100];

function getTrackingParams() {
  const params = new URLSearchParams(window.location.search);
  const source = (params.get('source') || '').toLowerCase().trim() || 'direct';
  const ref    = (params.get('ref')    || '').trim();
  return { source, ref };
}

function trackEvent(name, params) {
  if (typeof gtag === 'function') {
    gtag('event', name, params);
  }
}

/* ============================================================
   Phase3.2: Google Ads 計測 — utm_* / gclid / session_id
   既存 trackEvent には触れない（互換維持）。新規イベント専用
   ============================================================ */
const STORAGE_UTM_SOURCE_KEY   = 'gtn_utm_source';
const STORAGE_UTM_MEDIUM_KEY   = 'gtn_utm_medium';
const STORAGE_UTM_CAMPAIGN_KEY = 'gtn_utm_campaign';
const STORAGE_GCLID_KEY        = 'gtn_gclid';
const GCLID_TTL_MS             = 30 * 24 * 60 * 60 * 1000; // 30日

function _setLs(k, v) {
  if (!v) return;
  try { localStorage.setItem(k, String(v)); } catch (_) {}
}
function _getLs(k) {
  try { return localStorage.getItem(k) || ''; } catch (_) { return ''; }
}

/**
 * debug_mode 検出・永続化（GA4 DebugView 用）
 * - URL ?debug_mode=true|1 → LocalStorage に保存
 * - URL ?debug_mode=off → LocalStorage から削除
 * - 本番ユーザーには付かないので通常計測には影響しない
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

function saveAdsParams() {
  const p = new URLSearchParams(window.location.search);
  const urlSrc   = (p.get('utm_source')   || '').trim();
  const urlMed   = (p.get('utm_medium')   || '').trim();
  const urlCamp  = (p.get('utm_campaign') || '').trim();
  const urlGclid = (p.get('gclid')        || '').trim();
  if (urlSrc)  _setLs(STORAGE_UTM_SOURCE_KEY,   urlSrc);
  if (urlMed)  _setLs(STORAGE_UTM_MEDIUM_KEY,   urlMed);
  if (urlCamp) _setLs(STORAGE_UTM_CAMPAIGN_KEY, urlCamp);
  if (urlGclid) {
    const now = Date.now();
    try {
      localStorage.setItem(STORAGE_GCLID_KEY, JSON.stringify({
        value: urlGclid, createdAt: now, expiresAt: now + GCLID_TTL_MS,
      }));
    } catch (_) {}
  }
}

function loadGclid() {
  const raw = _getLs(STORAGE_GCLID_KEY);
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

let _ga4SessionIdCache = '';
function primeSessionId() {
  if (_ga4SessionIdCache || typeof gtag !== 'function') return;
  try {
    gtag('get', 'G-HK43N5MW3L', 'session_id', (id) => {
      if (id) _ga4SessionIdCache = String(id);
    });
  } catch (_) {}
}

function getCommonParams(extra) {
  const utmSrc = _getLs(STORAGE_UTM_SOURCE_KEY);
  // トップLP既存 source は URLパラメータから取得（getTrackingParams）
  const legacy = (function () {
    try { return getTrackingParams().source; } catch (_) { return 'direct'; }
  })();
  const base = {
    page_path:  (window.location && window.location.pathname) || '',
    source:     utmSrc || legacy || 'direct',
    medium:     _getLs(STORAGE_UTM_MEDIUM_KEY)   || '(none)',
    campaign:   _getLs(STORAGE_UTM_CAMPAIGN_KEY) || '(none)',
    gclid:      loadGclid() || '',
    session_id: _ga4SessionIdCache || '',
  };
  if (isDebugMode()) base.debug_mode = true;
  return { ...base, ...(extra || {}) };
}

/** 共通 eventDispatcher（gtag + dataLayer 両方、片系障害を吸収＋クロスページログ） */
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
  // クロスページ検証用ログ（sessionStorage）— DevToolsで即時確認可能
  try {
    const raw = sessionStorage.getItem(STORAGE_EVENT_LOG_KEY);
    const log = raw ? JSON.parse(raw) : [];
    log.push({ name, ts: Date.now(), ...payload });
    if (log.length > 50) log.splice(0, log.length - 50);
    sessionStorage.setItem(STORAGE_EVENT_LOG_KEY, JSON.stringify(log));
  } catch (_) {}
}

function initLpView() {
  const { source, ref } = getTrackingParams();
  trackEvent('lp_view', {
    page_id: TRACK_PAGE_ID,
    source,
    ref,
  });
}

function initCtaTracking() {
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-cta-location]');
    if (!el) return;
    const { source, ref } = getTrackingParams();
    trackEvent('cta_click', {
      page_id:      TRACK_PAGE_ID,
      cta_location: el.getAttribute('data-cta-location') || '',
      destination:  el.getAttribute('href') || '',
      source,
      ref,
    });
    // Phase3.2: Google広告計測用 — click_cta 並走発火
    trackNewEvent('click_cta', {
      cta_location: el.getAttribute('data-cta-location') || '',
      destination:  el.getAttribute('href') || '',
    });
  });
}

function initConsultTracking() {
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-consult-location]');
    if (!el) return;
    const { source, ref } = getTrackingParams();
    trackEvent('consult_click', {
      page_id:  TRACK_PAGE_ID,
      location: el.getAttribute('data-consult-location') || '',
      source,
      ref,
    });
  });
}

function initExternalLinkTracking() {
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-external-link]');
    if (!el) return;
    trackEvent('external_link_click', {
      page_id:  TRACK_PAGE_ID,
      url:      el.getAttribute('href') || '',
      position: el.getAttribute('data-position') || '',
    });
  });
}

/**
 * Phase2: Top LP → diagnosis の <a> に source / ref / utm_* を継承
 * - 対象: [data-cta-location] かつ pathname に /diagnosis を含むリンク
 * - 既存 query は保持、衝突キーは現URL値で上書き
 * - DOMContentLoaded 内で cta_click 委譲より前に呼ぶこと
 */
function inheritParamsToDiagnosisLinks() {
  const src = new URLSearchParams(window.location.search);
  const carry = new URLSearchParams();

  ['source', 'ref'].forEach((k) => {
    if (src.has(k)) carry.set(k, src.get(k));
  });
  for (const [k, v] of src.entries()) {
    if (k.startsWith('utm_')) carry.set(k, v);
  }
  if (Array.from(carry.keys()).length === 0) return;

  document.querySelectorAll('a[data-cta-location]').forEach((a) => {
    const href = a.getAttribute('href');
    if (!href) return;
    try {
      const url = new URL(href, window.location.origin);
      if (!/\/diagnosis(\/|$)/.test(url.pathname)) return;
      for (const [k, v] of carry.entries()) {
        url.searchParams.set(k, v);
      }
      a.setAttribute('href', url.toString());
    } catch (_) { /* invalid URL は無視 */ }
  });
}

function initScrollDepth() {
  const fired = new Set();
  let ticking = false;

  const check = () => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (docHeight <= 0) return;
    const percent = (scrollTop / docHeight) * 100;
    TRACK_SCROLL_THRESHOLDS.forEach((t) => {
      if (percent >= t && !fired.has(t)) {
        fired.add(t);
        trackEvent('scroll_depth', {
          page_id: TRACK_PAGE_ID,
          percent: t,
        });
      }
    });
  };

  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      check();
      ticking = false;
    });
  }, { passive: true });

  // 初回チェック（ファーストビューで既に100%到達するケース対策）
  check();
}

// ==UserScript==
// @name         Social Shield All-in-One: Anti-Rage, Anti-Scam, Universal Reels & Monk Mode
// @namespace    https://classifier.dev/
// @version      2.3.0
// @description  Automatically blurs rage-bait, blocks scam posts, collapses seeding comments, and activates Monk Mode to hide thirst traps & Reels/Shorts on Instagram, YouTube, Facebook, Threads, and X.
// @author       Antigravity
// @match        *://*.threads.com/*
// @match        *://threads.com/*
// @match        *://*.threads.net/*
// @match        *://threads.net/*
// @match        *://*.facebook.com/*
// @match        *://facebook.com/*
// @match        *://*.fb.com/*
// @match        *://*.instagram.com/*
// @match        *://instagram.com/*
// @match        *://*.youtube.com/*
// @match        *://youtube.com/*
// @match        *://*.x.com/*
// @match        *://x.com/*
// @match        *://*.twitter.com/*
// @match        *://twitter.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      classifier.dev
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const CONFIG = {
    apiEndpoint: 'https://classifier.dev',
    batchDebounceMs: 120,
    confidenceThreshold: 0.30,
    filterMotivationalEnabled: true,
    filterMemeEnabled: true,
    filterDeepDiveEnabled: true,
    filterWholesomeEnabled: true,
    filterDoomEnabled: true,
    filterFomoEnabled: true,
    filterCasualEnabled: true,
    customLabels: [],
    monkModeEnabled: true,
    blockReelsEnabled: true,
    autoBlurRageEnabled: true,
    blockScamsEnabled: true,
    collapseSeedingEnabled: true,
    focusModeEnabled: false,
    focusWhitelistTags: ['motivational', 'meme', 'deepdive', 'wholesome'],
  };

  try {
    const savedFocus = localStorage.getItem('social_shield_focus_mode');
    if (savedFocus !== null) CONFIG.focusModeEnabled = savedFocus === 'true';
    const savedTags = localStorage.getItem('social_shield_focus_tags');
    if (savedTags) CONFIG.focusWhitelistTags = JSON.parse(savedTags);
  } catch (e) {}

  let scannedCount = 0;
  let monkModeBlockedCount = 0;
  let blockedRageCount = 0;
  let blockedScamCount = 0;
  let cleanedSeedingCount = 0;
  let focusCollapsedCount = 0;
  let motivationalCount = 0;
  let memeCount = 0;
  let deepDiveCount = 0;
  let wholesomeCount = 0;
  let doomCount = 0;
  let fomoCount = 0;
  let casualCount = 0;
  let customCount = 0;

  function getPlatform() {
    const host = window.location.hostname.toLowerCase();
    if (host.includes('threads.net') || host.includes('threads.com')) return 'threads';
    if (host.includes('facebook.com') || host.includes('fb.com')) return 'facebook';
    if (host.includes('instagram.com')) return 'instagram';
    if (host.includes('youtube.com')) return 'youtube';
    return 'x';
  }

  const WOMEN_OR_GOONBAIT_REGEX =
    /(\b(woman|women|girl|girls|female|lady|ladies|bikini|cleavage|swimwear|selfie|thirst\s*trap|goon|gooning|onlyfans|fansly)\b|phụ nữ|con gái|cô gái|gái xinh|nữ sinh|hot girl|mặc hở|khoe thân|áo tắm|nội y|gái|mlem)/i;

  const css = `
    .x-jev-badge-container {
      display: flex !important;
      flex-wrap: wrap !important;
      align-items: center !important;
      gap: 6px !important;
      margin: 4px 0 8px 0 !important;
      width: 100% !important;
      position: relative !important;
      z-index: 10 !important;
    }
    .x-jev-badge-container:empty,
    .x-jev-badge-container:not(:has(.x-jev-badge:not(.x-jev-hidden))) {
      display: none !important;
    }
    .x-jev-badge-container .x-jev-badge {
      margin: 0 !important;
    }
    .x-jev-badge {
      display: inline-flex;
      align-items: center !important;
      gap: 6px !important;
      padding: 3px 10px !important;
      border-radius: 9999px !important;
      font-size: 11.5px !important;
      font-weight: 600 !important;
      letter-spacing: 0.02em !important;
      margin: 4px 0 8px 0 !important;
      border: 1px solid !important;
      width: fit-content !important;
      user-select: none !important;
      transition: all 0.2s ease !important;
      cursor: help !important;
      line-height: 1.2 !important;
      z-index: 10 !important;
      position: relative !important;
      filter: none !important;
      opacity: 1 !important;
      pointer-events: auto !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
    }
    .x-jev-badge:hover {
      filter: brightness(1.2) !important;
      transform: translateY(-1px) !important;
    }
    .x-jev-badge.x-jev-hidden {
      display: none !important;
    }
    .x-jev-confidence {
      font-size: 10px !important;
      opacity: 0.85 !important;
      font-weight: 500 !important;
    }
    [data-monk-blocked="true"]:not(.monk-revealed):not([data-monk-revealed="true"]) img:not([alt*="avatar"]):not([alt*="profile"]):not([src*="profile_images"]),
    [data-monk-blocked="true"]:not(.monk-revealed):not([data-monk-revealed="true"]) video,
    .monk-blur-media {
      filter: blur(28px) grayscale(60%) !important;
      opacity: 0.1 !important;
      user-select: none !important;
      pointer-events: none !important;
      transition: filter 0.25s ease, opacity 0.25s ease !important;
    }
    .monk-revealed,
    .monk-revealed img,
    .monk-revealed video,
    .monk-revealed .monk-blur-media,
    [data-monk-revealed="true"],
    [data-monk-revealed="true"] img,
    [data-monk-revealed="true"] video,
    body.x-jev-no-monk-blur [data-monk-blocked="true"] img,
    body.x-jev-no-monk-blur [data-monk-blocked="true"] video,
    body.x-jev-no-monk-blur .monk-blur-media,
    body.x-jev-disable-all-blur [data-monk-blocked="true"] img,
    body.x-jev-disable-all-blur [data-monk-blocked="true"] video {
      filter: none !important;
      opacity: 1 !important;
      user-select: auto !important;
      pointer-events: auto !important;
    }
    body.x-jev-no-monk-blur .x-monk-warning-box,
    body.x-jev-disable-all-blur .x-monk-warning-box {
      display: none !important;
    }
    .x-monk-warning-box {
      background: rgba(15, 23, 42, 0.9) !important;
      border: 1.5px solid #0ea5e9 !important;
      border-radius: 10px !important;
      padding: 8px 14px !important;
      margin: 6px 0 10px 0 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      font-size: 12px !important;
      color: #38bdf8 !important;
      z-index: 99 !important;
      box-sizing: border-box !important;
      width: 100% !important;
    }
    .x-monk-reveal-btn {
      background: #0284c7 !important;
      border: none !important;
      color: #fff !important;
      padding: 5px 12px !important;
      border-radius: 6px !important;
      cursor: pointer !important;
      font-size: 11.5px !important;
      font-weight: 700 !important;
    }
    [data-monk-reels-blocked="true"]:not(.monk-revealed) video,
    [data-monk-reels-blocked="true"]:not(.monk-revealed) img,
    [data-monk-tray-blocked="true"]:not(.monk-revealed) video,
    [data-monk-tray-blocked="true"]:not(.monk-revealed) img {
      filter: blur(36px) grayscale(80%) !important;
      opacity: 0.05 !important;
      pointer-events: none !important;
      transition: filter 0.25s ease, opacity 0.25s ease !important;
    }
    [data-monk-reels-blocked="true"].monk-revealed video,
    [data-monk-reels-blocked="true"].monk-revealed img,
    [data-monk-tray-blocked="true"].monk-revealed video,
    [data-monk-tray-blocked="true"].monk-revealed img {
      filter: none !important;
      opacity: 1 !important;
      pointer-events: auto !important;
    }
    .x-monk-reels-overlay {
      position: absolute !important;
      inset: 0 !important;
      width: 100% !important;
      height: 100% !important;
      min-height: 240px !important;
      background: rgba(9, 13, 22, 0.94) !important;
      backdrop-filter: blur(25px) !important;
      -webkit-backdrop-filter: blur(25px) !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      z-index: 999999 !important;
      padding: 24px !important;
      box-sizing: border-box !important;
    }
    [data-monk-reels-blocked="true"].monk-revealed .x-monk-reels-overlay {
      display: none !important;
    }
    .x-monk-reels-card {
      max-width: 360px !important;
      background: rgba(15, 23, 42, 0.96) !important;
      border: 1.5px solid rgba(56, 189, 248, 0.5) !important;
      border-radius: 16px !important;
      padding: 22px 20px !important;
      text-align: center !important;
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.7) !important;
      color: #f8fafc !important;
    }
    .x-monk-reels-icon {
      font-size: 38px !important;
      margin-bottom: 10px !important;
      line-height: 1 !important;
    }
    .x-monk-reels-title {
      font-size: 15px !important;
      font-weight: 700 !important;
      color: #38bdf8 !important;
      margin-bottom: 6px !important;
    }
    .x-monk-reels-desc {
      font-size: 12px !important;
      color: #94a3b8 !important;
      line-height: 1.45 !important;
      margin-bottom: 16px !important;
    }
    .x-monk-reels-actions {
      display: flex !important;
      gap: 10px !important;
      justify-content: center !important;
    }
    .x-monk-btn-reveal {
      background: #0284c7 !important;
      color: #ffffff !important;
      border: none !important;
      border-radius: 8px !important;
      padding: 8px 16px !important;
      font-size: 12.5px !important;
      font-weight: 700 !important;
      cursor: pointer !important;
    }
    .x-monk-btn-close {
      background: rgba(239, 68, 68, 0.18) !important;
      color: #fca5a5 !important;
      border: 1px solid rgba(239, 68, 68, 0.4) !important;
      border-radius: 8px !important;
      padding: 8px 16px !important;
      font-size: 12.5px !important;
      font-weight: 700 !important;
      cursor: pointer !important;
    }
    .x-monk-btn-home {
      background: rgba(255, 255, 255, 0.12) !important;
      color: #f1f5f9 !important;
      border: 1px solid rgba(255, 255, 255, 0.22) !important;
      border-radius: 8px !important;
      padding: 8px 16px !important;
      font-size: 12.5px !important;
      font-weight: 700 !important;
      cursor: pointer !important;
    }
    .x-monk-re-blur-floating {
      position: absolute !important;
      top: 14px !important;
      left: 14px !important;
      z-index: 999999 !important;
      background: rgba(15, 23, 42, 0.88) !important;
      border: 1px solid rgba(56, 189, 248, 0.6) !important;
      color: #38bdf8 !important;
      padding: 6px 12px !important;
      border-radius: 20px !important;
      font-size: 11.5px !important;
      font-weight: 700 !important;
      cursor: pointer !important;
      backdrop-filter: blur(8px) !important;
      display: none;
    }
    [data-monk-reels-blocked="true"].monk-revealed .x-monk-re-blur-floating {
      display: flex !important;
      align-items: center !important;
      gap: 6px !important;
    }
    .x-monk-tray-banner {
      background: linear-gradient(90deg, rgba(15, 23, 42, 0.96) 0%, rgba(30, 58, 138, 0.9) 100%) !important;
      border: 1.5px solid rgba(56, 189, 248, 0.4) !important;
      border-radius: 10px !important;
      padding: 10px 14px !important;
      margin: 10px 0 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      color: #f8fafc !important;
      z-index: 10 !important;
      position: relative !important;
      box-sizing: border-box !important;
      width: 100% !important;
    }
    .x-monk-tray-content {
      display: flex !important;
      align-items: center !important;
      gap: 10px !important;
      font-size: 12.5px !important;
    }
    .x-monk-tray-toggle {
      background: #0284c7 !important;
      color: #fff !important;
      border: none !important;
      border-radius: 6px !important;
      padding: 6px 14px !important;
      font-size: 11.5px !important;
      font-weight: 700 !important;
      cursor: pointer !important;
      flex-shrink: 0 !important;
    }
    [data-jev-rage="true"]:not(.x-jev-revealed):not([data-jev-revealed="true"]) [data-jev-blur-item="true"],
    [data-jev-scam="true"]:not(.x-jev-revealed):not([data-jev-revealed="true"]) [data-jev-blur-item="true"],
    .x-jev-blurred-content {
      filter: blur(14px) !important;
      opacity: 0.15 !important;
      user-select: none !important;
      pointer-events: none !important;
    }
    [data-jev-revealed="true"] [data-jev-blur-item="true"],
    [data-jev-revealed="true"][data-jev-blur-item="true"],
    [data-jev-rage="true"][data-jev-revealed="true"] [data-jev-blur-item="true"],
    [data-jev-scam="true"][data-jev-revealed="true"] [data-jev-blur-item="true"],
    [data-jev-rage="true"].x-jev-revealed [data-jev-blur-item="true"],
    [data-jev-scam="true"].x-jev-revealed [data-jev-blur-item="true"],
    .x-jev-revealed,
    .x-jev-revealed[data-jev-blur-item="true"],
    .x-jev-revealed [data-jev-blur-item="true"],
    .x-jev-revealed .x-jev-blurred-content,
    .x-jev-unblurred,
    [data-jev-revealed="true"],
    [data-jev-revealed="true"] span,
    [data-jev-revealed="true"] div,
    [data-jev-revealed="true"] img,
    [data-jev-revealed="true"] video {
      filter: none !important;
      opacity: 1 !important;
      user-select: auto !important;
      pointer-events: auto !important;
    }
    /* Global Unblur overrides when user disables blur in settings */
    body.x-jev-no-rage-blur [data-jev-blur-item="true"],
    body.x-jev-no-rage-blur [data-jev-rage="true"],
    body.x-jev-no-rage-blur [data-jev-rage="true"] [data-jev-blur-item="true"],
    body.x-jev-no-rage-blur [data-jev-rage="true"] span,
    body.x-jev-no-rage-blur [data-jev-rage="true"] div,
    body.x-jev-no-scam-blur [data-jev-scam="true"],
    body.x-jev-no-scam-blur [data-jev-scam="true"] [data-jev-blur-item="true"],
    body.x-jev-disable-all-blur [data-jev-blur-item="true"],
    body.x-jev-disable-all-blur [data-jev-rage="true"] *,
    body.x-jev-disable-all-blur [data-jev-scam="true"] *,
    body.x-jev-disable-all-blur .x-jev-blurred-content {
      filter: none !important;
      opacity: 1 !important;
      user-select: auto !important;
      pointer-events: auto !important;
    }
    body.x-jev-no-rage-blur .x-jev-warning-box,
    body.x-jev-no-scam-blur .x-jev-scam-box,
    body.x-jev-disable-all-blur .x-jev-warning-box,
    body.x-jev-disable-all-blur .x-jev-scam-box {
      display: none !important;
    }
    .x-jev-warning-box {
      background: rgba(239, 68, 68, 0.16) !important;
      border: 1.5px dashed #ef4444 !important;
      border-radius: 10px !important;
      padding: 8px 14px !important;
      margin: 6px 0 10px 0 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      font-size: 12.5px !important;
      color: #ef4444 !important;
      width: 100% !important;
      box-sizing: border-box !important;
    }
    .x-jev-scam-box {
      background: rgba(220, 38, 38, 0.18) !important;
      border: 1.5px dashed #dc2626 !important;
      border-radius: 10px !important;
      padding: 9px 14px !important;
      margin: 6px 0 10px 0 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      font-size: 12.5px !important;
      color: #f87171 !important;
      width: 100% !important;
      box-sizing: border-box !important;
    }
    .x-jev-reveal-btn {
      background: #ef4444 !important;
      border: none !important;
      color: #ffffff !important;
      padding: 5px 14px !important;
      border-radius: 6px !important;
      cursor: pointer !important;
      font-size: 12px !important;
      font-weight: 700 !important;
    }
    .x-jev-seeding-collapsed {
      background: rgba(168, 85, 247, 0.12) !important;
      border: 1px dashed rgba(168, 85, 247, 0.45) !important;
      border-radius: 8px !important;
      padding: 6px 12px !important;
      margin: 4px 0 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      font-size: 11.5px !important;
      color: #c084fc !important;
      cursor: pointer !important;
      width: 100% !important;
      box-sizing: border-box !important;
    }
    .x-jev-collapsed-body {
      display: none !important;
    }
    /* --- Focus Feed Mode: Collapsed Bar for Off-Topic Posts --- */
    .x-jev-focus-bar {
      background: rgba(30, 41, 59, 0.5) !important;
      border: 1px dashed rgba(148, 163, 184, 0.35) !important;
      border-radius: 8px !important;
      padding: 6px 12px !important;
      margin: 4px 0 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      font-size: 11.5px !important;
      color: #94a3b8 !important;
      cursor: pointer !important;
      user-select: none !important;
      transition: all 0.15s ease !important;
      width: 100% !important;
      box-sizing: border-box !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
    }

    .x-jev-focus-bar:hover {
      background: rgba(30, 41, 59, 0.8) !important;
      border-color: rgba(56, 189, 248, 0.6) !important;
      color: #f1f5f9 !important;
      transform: translateX(2px) !important;
    }

    .x-jev-focus-info {
      display: flex !important;
      align-items: center !important;
      gap: 6px !important;
      font-weight: 500 !important;
    }

    .x-jev-focus-action {
      font-size: 11px !important;
      font-weight: 700 !important;
      color: #38bdf8 !important;
      background: rgba(56, 189, 248, 0.15) !important;
      padding: 2px 8px !important;
      border-radius: 4px !important;
      transition: background 0.15s ease !important;
    }

    .x-jev-focus-bar:hover .x-jev-focus-action {
      background: rgba(56, 189, 248, 0.25) !important;
    }

    .x-jev-focus-collapsed-content {
      display: none !important;
    }

    .x-jev-focus-expanded .x-jev-focus-collapsed-content {
      display: block !important;
    }

    body.x-jev-no-focus .x-jev-focus-bar {
      display: none !important;
    }

    body.x-jev-no-focus .x-jev-focus-collapsed-content {
      display: revert !important;
    }

    .x-jev-floating-pill {
      position: fixed !important;
      bottom: 24px !important;
      right: 24px !important;
      z-index: 999999 !important;
      background: rgba(15, 23, 42, 0.94) !important;
      color: #e2e8f0 !important;
      padding: 8px 16px !important;
      border-radius: 9999px !important;
      font-size: 12px !important;
      font-weight: 600 !important;
      cursor: pointer !important;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5) !important;
      border: 1px solid rgba(255,255,255,0.12) !important;
    }
    body.x-jev-hide-pill .x-jev-floating-pill,
    .x-jev-floating-pill.x-jev-pill-hidden,
    .x-jev-floating-pill[data-hidden="true"],
    .x-jev-pill-hidden {
      display: none !important;
      opacity: 0 !important;
      pointer-events: none !important;
      visibility: hidden !important;
    }
    .x-jev-pill-close {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      margin-left: 8px !important;
      padding: 2px 8px !important;
      min-width: 18px !important;
      min-height: 18px !important;
      font-size: 13px !important;
      font-weight: 800 !important;
      color: #94a3b8 !important;
      cursor: pointer !important;
      border-radius: 9999px !important;
      background: rgba(255, 255, 255, 0.12) !important;
      user-select: none !important;
      z-index: 1000000 !important;
      pointer-events: auto !important;
    }
    .x-jev-pill-close:hover {
      color: #ffffff !important;
      background: #ef4444 !important;
      transform: scale(1.15) !important;
    }
  `;

  if (typeof GM_addStyle !== 'undefined') {
    GM_addStyle(css);
  } else {
    const s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
  }

  const CACHE_KEY = `social_shield_userjs_cache_v4_${getPlatform()}`;
  const textCache = new Map();
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      Object.entries(parsed).forEach(([k, v]) => textCache.set(k, v));
    }
  } catch (e) {}

  function saveCache() {
    try {
      const obj = {};
      const entries = Array.from(textCache.entries()).slice(-300);
      entries.forEach(([k, v]) => (obj[k] = v));
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(obj));
    } catch (e) {}
  }

  const countedTexts = new Set();

  const REVEALED_KEY = `social_shield_revealed_v1_${getPlatform()}`;
  const revealedTexts = new Set();
  try {
    const rawRevealed = sessionStorage.getItem(REVEALED_KEY);
    if (rawRevealed) {
      JSON.parse(rawRevealed).forEach((t) => revealedTexts.add(t));
    }
  } catch (e) {}

  function saveRevealedToStorage() {
    try {
      const arr = Array.from(revealedTexts).slice(-500);
      sessionStorage.setItem(REVEALED_KEY, JSON.stringify(arr));
    } catch (e) {}
  }

  const TAXONOMY_CATALOG = {
    'self-improvement / motivational': {
      configKey: 'filterMotivationalEnabled',
      instruction: 'personal growth, discipline, fitness, productivity lessons, inspiring mindsets, self-help, stoicism.',
      badge: {
        text: '🌱 Motivational / Mindset',
        desc: 'Personal growth, productivity, and constructive mindset',
        bg: 'rgba(245, 158, 11, 0.18)',
        border: '#f59e0b',
        color: '#fbbf24',
      },
    },
    'meme / humor / satire': {
      configKey: 'filterMemeEnabled',
      instruction: 'lighthearted jokes, funny memes, sarcastic humor, parody, troll posts.',
      badge: {
        text: '🎭 Meme / Entertainment',
        desc: 'Humor, memes, satire, and playful wit',
        bg: 'rgba(236, 72, 153, 0.18)',
        border: '#ec4899',
        color: '#f472b6',
      },
    },
    'deep dive / technical breakdown / industry insider': {
      configKey: 'filterDeepDiveEnabled',
      instruction: 'in-depth technical threads, architectural teardowns, insider industry analysis, comprehensive teardowns of complex problems.',
      badge: {
        text: '🔬 Deep Dive / Teardown',
        desc: 'Detailed domain teardown, insider analysis, or technical deep dive',
        bg: 'rgba(99, 102, 241, 0.2)',
        border: '#6366f1',
        color: '#818cf8',
      },
    },
    'wholesome / positive': {
      configKey: 'filterWholesomeEnabled',
      instruction: 'uplifting, heartwarming, kind, peaceful, constructive positive stories, wholesome moments.',
      badge: {
        text: '🌿 Wholesome / Positive',
        desc: 'Uplifting, heartwarming, and constructive positive content',
        bg: 'rgba(16, 185, 129, 0.18)',
        border: '#10b981',
        color: '#34d399',
      },
    },
    'fearmongering / doom': {
      configKey: 'filterDoomEnabled',
      instruction: 'alarming, sensationalized bad news, apocalyptic anxiety, catastrophic predictions, fearmongering.',
      badge: {
        text: '⚠️ Doom / Alarmism',
        desc: 'Sensationalized bad news, existential threat, or doom anxiety',
        bg: 'rgba(249, 115, 22, 0.18)',
        border: '#f97316',
        color: '#fb923c',
      },
    },
    'fomo / hype': {
      configKey: 'filterFomoEnabled',
      instruction: 'exaggerated financial hype, crypto shill, urgency to buy, get-rich-quick, fear of missing out.',
      badge: {
        text: '⚡ FOMO / Hype',
        desc: 'Hyperbolic hype, get-rich-quick claims, or unrealistic promises',
        bg: 'rgba(234, 179, 8, 0.18)',
        border: '#eab308',
        color: '#fde047',
      },
    },
    'other / casual discussion': {
      configKey: 'filterCasualEnabled',
      countKey: 'casualCount',
      badge: {
        text: '💬 Discussion / Casual',
        desc: 'Everyday casual talk or general conversation',
        bg: 'rgba(100, 116, 139, 0.15)',
        border: '#64748b',
        color: '#94a3b8',
      },
      instruction: 'everyday personal chatter, news, generic talk, or any content that does not fit the other categories.',
    },
    'rage bait / toxic / hostile / dismissive negativity': {
      configKey: 'autoBlurRageEnabled',
      instruction: 'provocative content designed to incite outrage, anger, toxic drama, hostile or dismissive negativity, cynicism, or insults.',
    },
    'scam / fraudulent scheme': {
      configKey: 'blockScamsEnabled',
      instruction: 'online fraud, deceptive financial schemes, crypto Ponzi, fake high-yield investment, or fake remote job scams.',
    },
    'bot seeding / affiliate spam / fake review': {
      configKey: 'collapseSeedingEnabled',
      instruction: 'commercial astroturfing, bot farming, fake praise, affiliate link spam, or deceptive promotional clone comments.',
    },
  };

  const CATCH_ALL_LABEL = 'other / casual discussion';
  const CATCH_ALL_INSTRUCTION = 'everyday personal chatter, news, generic talk, or any content that does not fit the other categories.';

  const BADGE_MAP = {
    'self-improvement / motivational': TAXONOMY_CATALOG['self-improvement / motivational'].badge,
    'meme / humor / satire': TAXONOMY_CATALOG['meme / humor / satire'].badge,
    'deep dive / technical breakdown / industry insider': TAXONOMY_CATALOG['deep dive / technical breakdown / industry insider'].badge,
    'wholesome / positive': TAXONOMY_CATALOG['wholesome / positive'].badge,
    'fearmongering / doom': TAXONOMY_CATALOG['fearmongering / doom'].badge,
    'fomo / hype': TAXONOMY_CATALOG['fomo / hype'].badge,
    'other / casual discussion': TAXONOMY_CATALOG['other / casual discussion'].badge,
  };

  function getActiveTaxonomy(cfg = {}) {
    const activeLabels = [];
    const instructionsList = [];

    Object.entries(TAXONOMY_CATALOG).forEach(([label, def]) => {
      if (label === CATCH_ALL_LABEL) return; // Always appended at the end
      if (cfg && cfg[def.configKey] !== false) {
        activeLabels.push(label);
        instructionsList.push(`"${label}": ${def.instruction}`);
      }
    });

    if (Array.isArray(cfg?.customLabels)) {
      cfg.customLabels.forEach((c) => {
        const rawName = typeof c === 'string' ? c : c?.name;
        const enabled = typeof c === 'object' ? c?.enabled !== false : true;
        const name = rawName ? rawName.replace(/["\r\n\t]/g, '').slice(0, 40).trim() : '';
        const isDuplicate =
          !name ||
          name.toLowerCase() === CATCH_ALL_LABEL.toLowerCase() ||
          Boolean(TAXONOMY_CATALOG[name.toLowerCase()]) ||
          activeLabels.some((l) => l.toLowerCase() === name.toLowerCase());
        if (enabled && !isDuplicate) {
          activeLabels.push(name);
          instructionsList.push(`"${name}": content specifically discussing, focused on, or related to ${name}.`);
        }
      });
    }

    if (activeLabels.length === 0) {
      return { labels: [], instructions: '' };
    }

    activeLabels.push(CATCH_ALL_LABEL);
    instructionsList.push(`"${CATCH_ALL_LABEL}": ${CATCH_ALL_INSTRUCTION}`);

    const formattedInstructions = instructionsList.map((item, idx) => `${idx + 1}. ${item}`).join(' ');

    return {
      labels: activeLabels,
      instructions:
        'Analyze social media content in Vietnamese or English for any categories that apply: ' +
        formattedInstructions,
    };
  }

  let queue = [];
  let debounceTimer = null;

  let hideFloatingPill = false;
  try {
    hideFloatingPill = localStorage.getItem('social_shield_hide_pill') === 'true';
  } catch (e) {}

  const pill = document.createElement('div');
  pill.className = 'x-jev-floating-pill';

  // Separate stats container from close button to preserve close button DOM & event listeners
  const pillStats = document.createElement('span');
  pillStats.className = 'x-jev-pill-stats';
  pill.appendChild(pillStats);

  const pillClose = document.createElement('span');
  pillClose.className = 'x-jev-pill-close';
  pillClose.title = 'Hide floating status pill';
  pillClose.textContent = '✕';
  pill.appendChild(pillClose);

  // Fast capture phase listener on document ensures clicks/taps on close button are never swallowed
  const handlePillClose = (e) => {
    const target = e.target;
    if (target && (target.classList?.contains('x-jev-pill-close') || target.closest?.('.x-jev-pill-close'))) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      hideFloatingPill = true;
      document.body?.classList.add('x-jev-hide-pill');
      try { localStorage.setItem('social_shield_hide_pill', 'true'); } catch (err) {}
      initPill();
    }
  };
  document.addEventListener('pointerdown', handlePillClose, { capture: true, passive: false });
  document.addEventListener('click', handlePillClose, { capture: true, passive: false });

  function initPill() {
    if (hideFloatingPill) {
      document.body?.classList.add('x-jev-hide-pill');
      pill.setAttribute('data-hidden', 'true');
      pill.classList.add('x-jev-pill-hidden');
      pill.style.setProperty('display', 'none', 'important');
      document.querySelectorAll('.x-jev-floating-pill').forEach((el) => {
        el.setAttribute('data-hidden', 'true');
        el.classList.add('x-jev-pill-hidden');
        el.style.setProperty('display', 'none', 'important');
        el.remove();
      });
      return;
    }

    document.body?.classList.remove('x-jev-hide-pill');
    pill.removeAttribute('data-hidden');
    pill.classList.remove('x-jev-pill-hidden');
    pill.style.removeProperty('display');
    if (document.body && !document.contains(pill)) {
      document.body.appendChild(pill);
    }
  }

  function updatePill() {
    if (hideFloatingPill) {
      initPill();
      return;
    }
    initPill();
    const pName = getPlatform().toUpperCase();
    const parts = [
      `🛡️ ${pName}: <span style="color:#ededed; font-family:'Geist Mono',monospace;">ON</span>`,
      `👁️ Scanned: <span style="color:#ededed; font-family:'Geist Mono',monospace;">${scannedCount}</span>`,
    ];
    if (CONFIG.focusModeEnabled) {
      parts.push(`<span class="x-jev-pill-focus-toggle" title="Click to toggle Focus Feed Mode" style="cursor:pointer;">🎯 Focus: <span style="color:#ededed; font-family:'Geist Mono',monospace;">${focusCollapsedCount}</span></span>`);
    }
    if (CONFIG.autoBlurRageEnabled) {
      parts.push(`🚨 Rage: <span style="color:#ef4444; font-family:'Geist Mono',monospace;">${blockedRageCount}</span>`);
    }
    if (CONFIG.filterMotivationalEnabled !== false && motivationalCount > 0) {
      parts.push(`🌱 Motivational: <span style="color:#ededed; font-family:'Geist Mono',monospace;">${motivationalCount}</span>`);
    }
    if (CONFIG.filterMemeEnabled !== false && memeCount > 0) {
      parts.push(`🎭 Meme: <span style="color:#ededed; font-family:'Geist Mono',monospace;">${memeCount}</span>`);
    }
    if (CONFIG.filterDeepDiveEnabled !== false && deepDiveCount > 0) {
      parts.push(`🔬 Deep Dive: <span style="color:#ededed; font-family:'Geist Mono',monospace;">${deepDiveCount}</span>`);
    }
    if (CONFIG.filterWholesomeEnabled !== false && wholesomeCount > 0) {
      parts.push(`🌿 Wholesome: <span style="color:#ededed; font-family:'Geist Mono',monospace;">${wholesomeCount}</span>`);
    }
    if (CONFIG.filterDoomEnabled !== false && doomCount > 0) {
      parts.push(`⚠️ Doom: <span style="color:#fb923c; font-family:'Geist Mono',monospace;">${doomCount}</span>`);
    }
    if (CONFIG.filterFomoEnabled !== false && fomoCount > 0) {
      parts.push(`⚡ FOMO: <span style="color:#fde047; font-family:'Geist Mono',monospace;">${fomoCount}</span>`);
    }
    if (CONFIG.filterCasualEnabled !== false && casualCount > 0) {
      parts.push(`💬 Casual: <span style="color:#888888; font-family:'Geist Mono',monospace;">${casualCount}</span>`);
    }
    const hasActiveCustom = Array.isArray(CONFIG.customLabels) && CONFIG.customLabels.some((c) => (c && typeof c === 'object' ? c.enabled !== false : Boolean(c)));
    if (hasActiveCustom && customCount > 0) {
      parts.push(`🏷️ Custom: <span style="color:#ededed; font-family:'Geist Mono',monospace;">${customCount}</span>`);
    }
    pillStats.innerHTML = parts.join(' | ');
  }

  updatePill();
  pill.addEventListener('click', (e) => {
    if (e.target.closest('.x-jev-pill-close')) return;
    if (e.target.closest('.x-jev-pill-focus-toggle')) {
      CONFIG.focusModeEnabled = !CONFIG.focusModeEnabled;
      try { localStorage.setItem('social_shield_focus_mode', CONFIG.focusModeEnabled); } catch (err) {}
      updatePill();
      applyStateToDOM();
      return;
    }
    const allOn = CONFIG.monkModeEnabled || CONFIG.autoBlurRageEnabled || CONFIG.blockScamsEnabled || CONFIG.collapseSeedingEnabled;
    CONFIG.monkModeEnabled = !allOn;
    CONFIG.autoBlurRageEnabled = !allOn;
    CONFIG.blockScamsEnabled = !allOn;
    CONFIG.collapseSeedingEnabled = !allOn;
    updatePill();
    applyStateToDOM();
    scanFeed();
  });

  if (document.body) {
    initPill();
  } else {
    document.addEventListener('DOMContentLoaded', initPill);
  }

  function applyStateToDOM() {
    if (document.body) {
      document.body.classList.toggle('x-jev-no-rage-blur', !CONFIG.autoBlurRageEnabled);
      document.body.classList.toggle('x-jev-no-monk-blur', !CONFIG.monkModeEnabled);
      document.body.classList.toggle('x-jev-no-scam-blur', !CONFIG.blockScamsEnabled);
      document.body.classList.toggle('x-jev-hide-pill', !!hideFloatingPill);
      document.body.classList.toggle('x-jev-no-focus', !CONFIG.focusModeEnabled);
      const disableAll = !CONFIG.autoBlurRageEnabled && !CONFIG.monkModeEnabled && !CONFIG.blockScamsEnabled;
      document.body.classList.toggle('x-jev-disable-all-blur', disableAll);
    }

    // 0. Facebook Reels & Video Popups State
    document.querySelectorAll('[data-monk-reels-blocked="true"]').forEach((dialog) => {
      const overlay = dialog.querySelector('.x-monk-reels-overlay');
      if (CONFIG.monkModeEnabled || CONFIG.blockReelsEnabled) {
        if (!dialog.classList.contains('monk-revealed')) {
          if (overlay) overlay.style.display = 'flex';
          dialog.querySelectorAll('video').forEach((v) => { try { v.pause(); v.muted = true; } catch (e) {} });
        }
      } else {
        dialog.classList.add('monk-revealed');
        if (overlay) overlay.style.display = 'none';
      }
    });

    document.querySelectorAll('[data-monk-tray-blocked="true"]').forEach((tray) => {
      const banner = tray.querySelector('.x-monk-tray-banner');
      if (CONFIG.monkModeEnabled || CONFIG.blockReelsEnabled) {
        if (!tray.classList.contains('monk-revealed')) {
          if (banner) banner.style.display = 'flex';
        }
      } else {
        tray.classList.add('monk-revealed');
        if (banner) banner.style.display = 'none';
      }
    });

    // 1. Monk Mode State
    document.querySelectorAll('[data-monk-blocked="true"]').forEach((post) => {
      const box = post.querySelector('.x-monk-warning-box');
      if (CONFIG.monkModeEnabled) {
        if (!post.hasAttribute('data-user-revealed')) {
          post.classList.remove('monk-revealed');
          post.removeAttribute('data-monk-revealed');
          if (box) box.style.display = 'flex';
        }
      } else {
        post.classList.add('monk-revealed');
        post.setAttribute('data-monk-revealed', 'true');
        post.querySelectorAll('img, video, .monk-blur-media').forEach((m) => {
          m.style.setProperty('filter', 'none', 'important');
          m.style.setProperty('opacity', '1', 'important');
          m.style.setProperty('pointer-events', 'auto', 'important');
        });
        if (box) box.style.display = 'none';
      }
    });

    // 2. Rage Bait state
    document.querySelectorAll('[data-jev-rage="true"]').forEach((post) => {
      const warning = post.querySelector('.x-jev-warning-box');
      if (CONFIG.autoBlurRageEnabled) {
        if (!post.hasAttribute('data-user-revealed')) {
          post.classList.remove('x-jev-revealed');
          post.removeAttribute('data-jev-revealed');
          if (warning) warning.style.display = 'flex';
        }
      } else {
        post.classList.add('x-jev-revealed');
        post.setAttribute('data-jev-revealed', 'true');
        post.querySelectorAll('[data-jev-blur-item="true"], span[dir="auto"], div[dir="auto"], img, video').forEach((el) => {
          el.style.setProperty('filter', 'none', 'important');
          el.style.setProperty('opacity', '1', 'important');
          el.style.setProperty('pointer-events', 'auto', 'important');
          el.style.setProperty('user-select', 'auto', 'important');
        });
        if (warning) warning.style.display = 'none';
      }
    });

    // 3. Scam state
    document.querySelectorAll('[data-jev-scam="true"]').forEach((post) => {
      const scamBox = post.querySelector('.x-jev-scam-box');
      if (CONFIG.blockScamsEnabled) {
        if (!post.hasAttribute('data-user-revealed')) {
          post.classList.remove('x-jev-revealed');
          post.removeAttribute('data-jev-revealed');
          if (scamBox) scamBox.style.display = 'flex';
        }
      } else {
        post.classList.add('x-jev-revealed');
        post.setAttribute('data-jev-revealed', 'true');
        post.querySelectorAll('[data-jev-blur-item="true"], span[dir="auto"], div[dir="auto"], img, video').forEach((el) => {
          el.style.setProperty('filter', 'none', 'important');
          el.style.setProperty('opacity', '1', 'important');
          el.style.setProperty('pointer-events', 'auto', 'important');
        });
        if (scamBox) scamBox.style.display = 'none';
      }
    });

    // 7. Focus Feed Mode: Re-evaluate state on all classified posts
    let currentFocusCount = 0;
    document.querySelectorAll('[data-jev-assigned-label]').forEach((post) => {
      const assignedLabel = post.getAttribute('data-jev-assigned-label');
      const matchesFocus = isPostMatchingFocus(assignedLabel);
      const bar = post.querySelector('.x-jev-focus-bar');
      const textEl = post.querySelector('[data-jev-tracked-text="true"]') || post.querySelector('span[dir="auto"], div[dir="auto"]');

      if (CONFIG.focusModeEnabled && !matchesFocus) {
        currentFocusCount++;
        post.setAttribute('data-jev-focus-offtag', 'true');
        if (textEl) textEl.classList.add('x-jev-focus-collapsed-content');
        post.querySelectorAll('img, video, .x-jev-badge, .x-jev-warning-box, .x-jev-scam-box, .x-monk-warning-box, .x-jev-seeding-collapsed').forEach((m) => {
          if (!m.closest('a[href*="/@"]')) m.classList.add('x-jev-focus-collapsed-content');
        });
        if (!bar && textEl) {
          createFocusBar(post, textEl, assignedLabel);
        } else if (bar) {
          bar.style.display = 'flex';
        }
      } else {
        post.removeAttribute('data-jev-focus-offtag');
        if (textEl) textEl.classList.remove('x-jev-focus-collapsed-content');
        post.querySelectorAll('.x-jev-focus-collapsed-content').forEach((m) => {
          m.classList.remove('x-jev-focus-collapsed-content');
        });
        if (bar) bar.style.display = 'none';
        post.classList.remove('x-jev-focus-expanded');
      }
    });

    if (CONFIG.focusModeEnabled) {
      focusCollapsedCount = currentFocusCount;
    }
  }

  function getPostTagKey(label) {
    if (label === 'self-improvement / motivational') return 'motivational';
    if (label === 'meme / humor / satire') return 'meme';
    if (label === 'deep dive / technical breakdown / industry insider') return 'deepdive';
    if (label === 'wholesome / positive') return 'wholesome';
    if (label === 'fearmongering / doom') return 'doom';
    if (label === 'fomo / hype') return 'fomo';
    if (label === 'other / casual discussion') return 'casual';
    if (Array.isArray(CONFIG.customLabels)) {
      const isCustom = CONFIG.customLabels.some(
        (c) => (typeof c === 'string' ? c : c?.name)?.trim().toLowerCase() === label?.trim().toLowerCase()
      );
      if (isCustom) return 'custom';
    }
    return null;
  }

  function getDisplayLabelName(label) {
    if (label === 'self-improvement / motivational') return 'Motivational';
    if (label === 'meme / humor / satire') return 'Meme';
    if (label === 'deep dive / technical breakdown / industry insider') return 'Deep Dive';
    if (label === 'wholesome / positive') return 'Wholesome';
    if (label === 'fearmongering / doom') return 'Doom';
    if (label === 'fomo / hype') return 'FOMO';
    if (label === 'other / casual discussion') return 'Casual';
    if (label === 'scam / fraudulent scheme') return 'Scam';
    if (label === 'rage bait / toxic / hostile / dismissive negativity') return 'Rage Bait';
    if (label === 'bot seeding / affiliate spam / fake review') return 'Seeding';
    return label || 'Other';
  }

  function isPostMatchingFocus(labels) {
    if (!CONFIG.focusModeEnabled) return true;
    const allowedTags = Array.isArray(CONFIG.focusWhitelistTags) ? CONFIG.focusWhitelistTags : [];
    if (allowedTags.length === 0) return true;

    const labelList = Array.isArray(labels)
      ? labels
      : (typeof labels === 'string' ? labels.split('|') : []);
    if (labelList.length === 0) return false;

    return labelList.some((lbl) => {
      const tagKey = getPostTagKey(lbl);
      return tagKey && allowedTags.includes(tagKey);
    });
  }

  function createFocusBar(postEl, textEl, labels) {
    if (postEl.querySelector('.x-jev-focus-bar')) return;
    const parentContainer = textEl.parentElement;
    if (!parentContainer) return;

    const labelList = Array.isArray(labels)
      ? labels
      : (typeof labels === 'string' ? labels.split('|') : []);
    const displayTag = labelList.map((l) => getDisplayLabelName(l)).join(', ') || 'Other';
    const focusBar = document.createElement('div');
    focusBar.className = 'x-jev-focus-bar';

    const infoDiv = document.createElement('div');
    infoDiv.className = 'x-jev-focus-info';

    const iconSpan = document.createElement('span');
    iconSpan.textContent = '🎯';

    const textSpan = document.createElement('span');
    textSpan.textContent = 'Off-topic (Focus Mode): ';

    const boldTag = document.createElement('b');
    boldTag.style.color = '#ededed';
    boldTag.textContent = displayTag;

    textSpan.appendChild(boldTag);
    infoDiv.appendChild(iconSpan);
    infoDiv.appendChild(textSpan);

    const actionSpan = document.createElement('span');
    actionSpan.className = 'x-jev-focus-action';
    actionSpan.textContent = 'View content ▾';

    focusBar.appendChild(infoDiv);
    focusBar.appendChild(actionSpan);
    focusBar.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isExpanded = postEl.classList.toggle('x-jev-focus-expanded');
      const actionBtn = focusBar.querySelector('.x-jev-focus-action');
      if (actionBtn) {
        actionBtn.textContent = isExpanded ? 'Collapse ▴' : 'View content ▾';
      }
    });
    parentContainer.insertBefore(focusBar, textEl);
  }

  function checkAndApplyFocusCollapse(postEl, textEl, labels) {
    const labelStr = Array.isArray(labels) ? labels.join('|') : (labels || '');
    postEl.setAttribute('data-jev-assigned-label', labelStr);
    textEl.setAttribute('data-jev-tracked-text', 'true');
    if (CONFIG.focusModeEnabled && !isPostMatchingFocus(labels)) {
      postEl.setAttribute('data-jev-focus-offtag', 'true');
      textEl.classList.add('x-jev-focus-collapsed-content');
      postEl.querySelectorAll('img, video, .x-jev-badge, .x-jev-badge-container, .x-jev-warning-box, .x-jev-scam-box, .x-monk-warning-box, .x-jev-seeding-collapsed').forEach((m) => {
        if (!m.closest('a[href*="/@"]')) m.classList.add('x-jev-focus-collapsed-content');
      });
      createFocusBar(postEl, textEl, labels);
      focusCollapsedCount++;
      updatePill();
    }
  }

  function checkAndApplyMonkMode(postEl, text) {
    if (!CONFIG.monkModeEnabled) return false;
    if (postEl.hasAttribute('data-monk-blocked')) return true;

    const mediaList = postEl.querySelectorAll('img, video');
    if (mediaList.length === 0) return false;

    let hasWomenMedia = false;
    let detectedReason = '';

    mediaList.forEach((media) => {
      const isAvatar = (media.closest('a[href*="/@"]') && (media.width < 50 || media.height < 50)) ||
                       media.alt?.toLowerCase().includes('avatar') ||
                       media.alt?.toLowerCase().includes('profile');
      if (isAvatar) return;

      const altText = (media.alt || '') + ' ' + (media.getAttribute('aria-label') || '') + ' ' + (media.title || '');
      if (WOMEN_OR_GOONBAIT_REGEX.test(altText)) {
        hasWomenMedia = true;
        detectedReason = 'Female imagery detected (Meta AI Alt-Tag)';
      }
    });

    if (!hasWomenMedia && WOMEN_OR_GOONBAIT_REGEX.test(text)) {
      hasWomenMedia = true;
      detectedReason = 'Goon-baiting / Thirst trap content';
    }

    if (hasWomenMedia) {
      postEl.setAttribute('data-monk-blocked', 'true');
      monkModeBlockedCount++;
      updatePill();

      if (!postEl.querySelector('.x-monk-warning-box')) {
        const box = document.createElement('div');
        box.className = 'x-monk-warning-box';
        box.innerHTML = `
          <div>
            <b>🧘 Monk Mode: Media hidden to preserve focus.</b>
            <div style="font-size:10.5px;opacity:0.9;">${detectedReason}</div>
          </div>
        `;
        const btn = document.createElement('button');
        btn.className = 'x-monk-reveal-btn';
        btn.textContent = 'Reveal media';
        btn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const isRevealed = postEl.classList.toggle('monk-revealed');
          if (isRevealed) {
            postEl.setAttribute('data-monk-revealed', 'true');
            postEl.setAttribute('data-user-revealed', 'true');
            postEl.querySelectorAll('img, video, .monk-blur-media').forEach((m) => {
              m.style.setProperty('filter', 'none', 'important');
              m.style.setProperty('opacity', '1', 'important');
              m.style.setProperty('pointer-events', 'auto', 'important');
            });
            btn.textContent = 'Hide media';
          } else {
            postEl.removeAttribute('data-monk-revealed');
            postEl.removeAttribute('data-user-revealed');
            postEl.querySelectorAll('img, video, .monk-blur-media').forEach((m) => {
              m.style.removeProperty('filter');
              m.style.removeProperty('opacity');
              m.style.removeProperty('pointer-events');
            });
            btn.textContent = 'Reveal media';
          }
        };
        box.appendChild(btn);

        const firstMedia = Array.from(mediaList).find((m) => !m.closest('a[href*="/@"]'));
        if (firstMedia && firstMedia.parentElement) {
          firstMedia.parentElement.insertBefore(box, firstMedia);
        } else {
          postEl.prepend(box);
        }
      }
      postEl.classList.remove('monk-revealed');
      return true;
    }
    return false;
  }

  function callJevBatch(inputs) {
    return new Promise((resolve) => {
      const taxonomy = getActiveTaxonomy(CONFIG);
      if (!taxonomy.labels || taxonomy.labels.length <= 1) {
        resolve(inputs.map(() => ({ label: CATCH_ALL_LABEL, confidence: 1 })));
        return;
      }

      const sendReq =
        typeof GM_xmlhttpRequest !== 'undefined'
          ? GM_xmlhttpRequest
          : function (opts) {
              fetch(opts.url, {
                method: opts.method,
                headers: opts.headers,
                body: opts.data,
              })
                .then((r) => r.json())
                .then((d) => opts.onload({ responseText: JSON.stringify(d) }))
                .catch((e) => opts.onerror(e));
            };

      sendReq({
        method: 'POST',
        url: CONFIG.apiEndpoint,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'social-shield-userjs/2.1',
        },
        data: JSON.stringify({
          labels: taxonomy.labels,
          inputs: inputs,
          instructions: taxonomy.instructions,
          multi: true,
          max_labels: 5,
        }),
        onload: function (res) {
          try {
            const data = JSON.parse(res.responseText);
            resolve(data.results || []);
          } catch (e) {
            resolve([]);
          }
        },
        onerror: function () {
          resolve([]);
        },
      });
    });
  }

  function isProfileOnlyLink(el) {
    if (!el) return false;
    if (el.closest('[data-testid="User-Name"]') || el.closest('[data-testid="Tweet-User-Avatar"]') || el.closest('[data-testid="UserAvatar-Container"]')) return true;
    const a = el.closest('a[href*="/@"]');
    if (!a) return false;
    const href = a.getAttribute('href') || '';
    // If href contains /post/ or /t/, it links to post content, NOT a user profile link!
    return !href.includes('/post/') && !href.includes('/t/');
  }

  function syncRevealState(targetEl, isRevealed, text) {
    if (text) {
      if (isRevealed) revealedTexts.add(text);
      else revealedTexts.delete(text);
      saveRevealedToStorage();
    }

    const apply = (el) => {
      el.classList.toggle('x-jev-revealed', isRevealed);
      if (isRevealed) el.setAttribute('data-jev-revealed', 'true');
      else el.removeAttribute('data-jev-revealed');
    };

    apply(targetEl);

    let p = targetEl.parentElement;
    while (p && p !== document.body) {
      if (p.hasAttribute('data-jev-rage') || p.hasAttribute('data-jev-scam') || p.hasAttribute('data-jev-scanned')) {
        apply(p);
      }
      p = p.parentElement;
    }
    targetEl.querySelectorAll('[data-jev-rage="true"], [data-jev-scam="true"], [data-jev-scanned="true"]').forEach((child) => {
      apply(child);
    });
  }

  function applyInlineUnblur(postEl, isRevealed) {
    const targets = postEl.querySelectorAll('[data-jev-blur-item="true"], span[dir="auto"], div[dir="auto"], img, video');
    if (isRevealed) {
      targets.forEach((el) => {
        el.style.setProperty('filter', 'none', 'important');
        el.style.setProperty('opacity', '1', 'important');
        el.style.setProperty('pointer-events', 'auto', 'important');
      });
    } else {
      targets.forEach((el) => {
        el.style.removeProperty('filter');
        el.style.removeProperty('opacity');
        el.style.removeProperty('pointer-events');
      });
    }
  }

  function renderClassification(item, res) {
    const { postEl, textEl } = item;
    if (!textEl || !textEl.parentElement) return;

    checkAndApplyMonkMode(postEl, item.text);
    if (postEl.hasAttribute('data-jev-handled')) return;
    if (!res || typeof res !== 'object') return;

    const scores = (typeof res.scores === 'object' && res.scores !== null)
      ? res.scores
      : (res.label ? { [res.label]: res.confidence || 0 } : {});
    const parentContainer = textEl.parentElement;

    // 1. SCAM
    const rawScam = scores['scam / fraudulent scheme'];
    const scamScore = typeof rawScam === 'number' && Number.isFinite(rawScam) ? rawScam : 0;
    if (scamScore >= CONFIG.confidenceThreshold) {
      postEl.setAttribute('data-jev-handled', 'true');
      postEl.setAttribute('data-jev-scam', 'true');
      blockedScamCount++;
      updatePill();

      // Remove any lingering badges or container (including sibling container on comments)
      postEl.querySelectorAll('.x-jev-badge-container, .x-jev-badge').forEach((b) => b.remove());
      if (postEl.previousElementSibling && postEl.previousElementSibling.classList.contains('x-jev-badge-container')) {
        postEl.previousElementSibling.remove();
      }

      textEl.setAttribute('data-jev-blur-item', 'true');
      postEl.querySelectorAll('img, video').forEach((m) => {
        if (!m.closest('a[href*="/@"]')) m.setAttribute('data-jev-blur-item', 'true');
      });

      if (!postEl.querySelector('.x-jev-scam-box')) {
        const box = document.createElement('div');
        box.className = 'x-jev-scam-box';
        const pct = Math.round(scamScore * 100);
        box.innerHTML = `
          <div>
            <b>🛑 Scam / Deceptive Scheme Warning (${pct}%):</b>
            <div style="font-size:11px;opacity:0.9;">Suspicious financial scheme, unrealistic income promises, or deceptive links.</div>
          </div>
        `;
        const btn = document.createElement('button');
        btn.className = 'x-jev-reveal-btn';
        btn.textContent = 'Reveal post';
        btn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const isRevealed = !postEl.classList.contains('x-jev-revealed') && !postEl.hasAttribute('data-jev-revealed');
          syncRevealState(postEl, isRevealed, item.text);
          if (isRevealed) {
            postEl.setAttribute('data-jev-revealed', 'true');
            postEl.setAttribute('data-user-revealed', 'true');
            applyInlineUnblur(postEl, true);
            btn.textContent = 'Re-blur';
          } else {
            postEl.removeAttribute('data-jev-revealed');
            postEl.removeAttribute('data-user-revealed');
            applyInlineUnblur(postEl, false);
            btn.textContent = 'Reveal post';
          }
        };
        box.appendChild(btn);
        parentContainer.insertBefore(box, textEl);
      }

      const isScamRevealedByUser = revealedTexts.has(item.text);
      if (isScamRevealedByUser) {
        postEl.classList.add('x-jev-revealed');
        postEl.setAttribute('data-jev-revealed', 'true');
        postEl.setAttribute('data-user-revealed', 'true');
        applyInlineUnblur(postEl, true);
        const scamBtn = postEl.querySelector('.x-jev-scam-box .x-jev-reveal-btn');
        if (scamBtn) scamBtn.textContent = 'Re-blur';
      } else if (CONFIG.blockScamsEnabled) {
        postEl.classList.remove('x-jev-revealed');
        postEl.removeAttribute('data-jev-revealed');
        postEl.removeAttribute('data-user-revealed');
        applyInlineUnblur(postEl, false);
        const scamBtn = postEl.querySelector('.x-jev-scam-box .x-jev-reveal-btn');
        if (scamBtn) scamBtn.textContent = 'Reveal post';
      } else {
        postEl.classList.add('x-jev-revealed');
        postEl.setAttribute('data-jev-revealed', 'true');
        applyInlineUnblur(postEl, true);
      }
      checkAndApplyFocusCollapse(postEl, textEl, 'scam / fraudulent scheme');
      return;
    }

    // 2. RAGE BAIT / TOXIC NEGATIVITY
    const rawRage =
      scores['rage bait / toxic / hostile / dismissive negativity'] || scores['rage bait / outrage'];
    const rageScore = typeof rawRage === 'number' && Number.isFinite(rawRage) ? rawRage : 0;
    if (rageScore >= CONFIG.confidenceThreshold) {
      postEl.setAttribute('data-jev-handled', 'true');
      postEl.setAttribute('data-jev-rage', 'true');
      blockedRageCount++;
      updatePill();

      // Remove any lingering badges or container (including sibling container on comments)
      postEl.querySelectorAll('.x-jev-badge-container, .x-jev-badge').forEach((b) => b.remove());
      if (postEl.previousElementSibling && postEl.previousElementSibling.classList.contains('x-jev-badge-container')) {
        postEl.previousElementSibling.remove();
      }

      textEl.setAttribute('data-jev-blur-item', 'true');
      postEl.querySelectorAll('span[dir="auto"], div[dir="auto"]').forEach((span) => {
        if (!span.closest('button') && !span.closest('time') && !isProfileOnlyLink(span)) {
          span.setAttribute('data-jev-blur-item', 'true');
        }
      });
      postEl.querySelectorAll('a').forEach((m) => {
        if (!isProfileOnlyLink(m)) m.setAttribute('data-jev-blur-item', 'true');
      });

      if (!postEl.querySelector('.x-jev-warning-box')) {
        const warning = document.createElement('div');
        warning.className = 'x-jev-warning-box';
        const pct = Math.round(rageScore * 100);
        warning.innerHTML = `
          <div class="x-jev-warning-text">
            <span>🛡️</span>
            <div>
              <b>Rage / Toxic Warning (${pct}%):</b>
              <div style="font-size:11px;font-weight:400;opacity:0.9;margin-top:2px;">Potentially hostile, outrage-inducing, or toxic content blurred.</div>
            </div>
          </div>
        `;

        const btn = document.createElement('button');
        btn.className = 'x-jev-reveal-btn';
        btn.textContent = 'Reveal post';
        btn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const isRevealed = !postEl.classList.contains('x-jev-revealed') && !postEl.hasAttribute('data-jev-revealed');
          syncRevealState(postEl, isRevealed, item.text);
          if (isRevealed) {
            postEl.setAttribute('data-jev-revealed', 'true');
            postEl.setAttribute('data-user-revealed', 'true');
            applyInlineUnblur(postEl, true);
            btn.textContent = 'Re-blur';
          } else {
            postEl.removeAttribute('data-jev-revealed');
            postEl.removeAttribute('data-user-revealed');
            applyInlineUnblur(postEl, false);
            btn.textContent = 'Reveal post';
          }
        };

        warning.appendChild(btn);
        parentContainer.insertBefore(warning, textEl);
      }

      const isRageRevealedByUser = revealedTexts.has(item.text);
      if (isRageRevealedByUser) {
        postEl.classList.add('x-jev-revealed');
        postEl.setAttribute('data-jev-revealed', 'true');
        postEl.setAttribute('data-user-revealed', 'true');
        applyInlineUnblur(postEl, true);
        const rBtn = postEl.querySelector('.x-jev-warning-box .x-jev-reveal-btn');
        if (rBtn) rBtn.textContent = 'Re-blur';
      } else if (CONFIG.autoBlurRageEnabled) {
        postEl.classList.remove('x-jev-revealed');
        postEl.removeAttribute('data-jev-revealed');
        postEl.removeAttribute('data-user-revealed');
        applyInlineUnblur(postEl, false);
        const rBtn = postEl.querySelector('.x-jev-warning-box .x-jev-reveal-btn');
        if (rBtn) rBtn.textContent = 'Reveal post';
      } else {
        postEl.classList.add('x-jev-revealed');
        postEl.setAttribute('data-jev-revealed', 'true');
        applyInlineUnblur(postEl, true);
      }
      checkAndApplyFocusCollapse(postEl, textEl, 'rage bait / toxic / hostile / dismissive negativity');
      return;
    }

    // 3. BOT SEEDING / AFFILIATE SPAM
    const rawSeeding =
      scores['bot seeding / affiliate spam / fake review'] || scores['bot seeding / affiliate spam'];
    const seedingScore = typeof rawSeeding === 'number' && Number.isFinite(rawSeeding) ? rawSeeding : 0;
    if (seedingScore >= CONFIG.confidenceThreshold) {
      postEl.setAttribute('data-jev-handled', 'true');
      postEl.setAttribute('data-jev-seeding', 'true');
      cleanedSeedingCount++;
      updatePill();

      // Remove any lingering badges or container (including sibling container on comments)
      postEl.querySelectorAll('.x-jev-badge-container, .x-jev-badge').forEach((b) => b.remove());
      if (postEl.previousElementSibling && postEl.previousElementSibling.classList.contains('x-jev-badge-container')) {
        postEl.previousElementSibling.remove();
      }

      textEl.setAttribute('data-jev-seeding-content', 'true');
      if (!postEl.querySelector('.x-jev-seeding-collapsed')) {
        const bar = document.createElement('div');
        bar.className = 'x-jev-seeding-collapsed';
        const pct = Math.round(seedingScore * 100);
        bar.innerHTML = `
          <div>🧹 Collapsed suspected <b>Seeding / Bot</b> comment (${pct}%)</div>
          <span style="font-size:11px;font-weight:700;">View comment ▾</span>
        `;
        bar.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const isCollapsed = textEl.classList.toggle('x-jev-collapsed-body');
          bar.querySelector('span').textContent = isCollapsed ? 'View comment ▾' : 'Collapse ▴';
        };
        parentContainer.insertBefore(bar, textEl);
        if (CONFIG.collapseSeedingEnabled) {
          textEl.classList.add('x-jev-collapsed-body');
        }
      }
      checkAndApplyFocusCollapse(postEl, textEl, 'bot seeding / affiliate spam / fake review');
      return;
    }

    // 4. MULTI-TAG CONTENT BADGES
    const isActivity = window.location.pathname.includes('/activity');
    const eligibleBadges = [];

    Object.entries(scores).forEach(([candidateLabel, score]) => {
      if (typeof score !== 'number' || !Number.isFinite(score) || score < CONFIG.confidenceThreshold) return;
      if (
        candidateLabel === 'scam / fraudulent scheme' ||
        candidateLabel === 'rage bait / toxic / hostile / dismissive negativity' ||
        candidateLabel === 'rage bait / outrage' ||
        candidateLabel === 'bot seeding / affiliate spam / fake review' ||
        candidateLabel === 'bot seeding / affiliate spam'
      ) {
        return;
      }
      if (candidateLabel === 'other / casual discussion' && (CONFIG.filterCasualEnabled === false || isActivity)) {
        return;
      }

      const def = TAXONOMY_CATALOG[candidateLabel];
      if (def && CONFIG[def.configKey] === false) {
        return;
      }

      let isCustom = false;
      let customMeta = null;
      if (Array.isArray(CONFIG.customLabels)) {
        const customFound = CONFIG.customLabels.find(
          (c) => (typeof c === 'string' ? c : c?.name)?.trim().toLowerCase() === candidateLabel?.trim().toLowerCase()
        );
        if (customFound) {
          const isEnabled = typeof customFound === 'object' ? customFound.enabled !== false : true;
          if (!isEnabled) return;
          isCustom = true;
          const displayName = typeof customFound === 'object' ? customFound.name : customFound;
          customMeta = {
            text: `🏷️ ${displayName}`,
            desc: `Custom label: ${displayName}`,
            bg: 'rgba(168, 85, 247, 0.18)',
            border: '#a855f7',
            color: '#c084fc',
          };
        }
      }

      const meta = BADGE_MAP[candidateLabel] || customMeta;
      if (meta) {
        eligibleBadges.push({ label: candidateLabel, score, meta, isCustom });
      }
    });

    eligibleBadges.sort((a, b) => b.score - a.score);
    const selectedBadges = eligibleBadges.slice(0, 4);

    if (selectedBadges.length > 0) {
      if (!countedTexts.has(item.text)) {
        countedTexts.add(item.text);
        postEl.setAttribute('data-jev-counted', 'true');
        selectedBadges.forEach(({ label, isCustom }) => {
          if (label === 'self-improvement / motivational') motivationalCount++;
          else if (label === 'meme / humor / satire') memeCount++;
          else if (label === 'deep dive / technical breakdown / industry insider') deepDiveCount++;
          else if (label === 'wholesome / positive') wholesomeCount++;
          else if (label === 'fearmongering / doom') doomCount++;
          else if (label === 'fomo / hype') fomoCount++;
          else if (label === 'other / casual discussion') casualCount++;
          else if (isCustom) customCount++;
        });
        updatePill();
      }

      // Remove any lingering uncontained badge right before textEl
      if (textEl.previousElementSibling && textEl.previousElementSibling.classList.contains('x-jev-badge')) {
        textEl.previousElementSibling.remove();
      }

      // Scope container search strictly to textEl's previous sibling to prevent leaking into child comments
      let container = (textEl.previousElementSibling && textEl.previousElementSibling.classList.contains('x-jev-badge-container'))
        ? textEl.previousElementSibling
        : null;
      if (!container) {
        container = document.createElement('div');
        container.className = 'x-jev-badge-container';
        parentContainer.insertBefore(container, textEl);
      }
      container.innerHTML = '';

      selectedBadges.forEach(({ label, score, meta }) => {
        const badge = document.createElement('div');
        badge.className = 'x-jev-badge';
        badge.setAttribute('data-jev-badge-category', label);
        badge.style.backgroundColor = meta.bg;
        badge.style.borderColor = meta.border;
        badge.style.color = meta.color;
        badge.title = `${meta.desc} (Confidence: ${Math.round(score * 100)}%)`;

        const textSpan = document.createElement('span');
        textSpan.textContent = meta.text;
        const confSpan = document.createElement('span');
        confSpan.className = 'x-jev-confidence';
        confSpan.textContent = `${Math.round(score * 100)}%`;

        badge.appendChild(textSpan);
        badge.appendChild(confSpan);
        container.appendChild(badge);
      });
    }
    const assignedLabels = selectedBadges.length > 0
      ? selectedBadges.map((b) => b.label)
      : [Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] || 'other / casual discussion'];
    checkAndApplyFocusCollapse(postEl, textEl, assignedLabels);
    postEl.setAttribute('data-jev-handled', 'true');
  }

  async function flushQueue() {
    if (queue.length === 0) return;

    const taxonomy = getActiveTaxonomy(CONFIG);
    if (!taxonomy.labels || taxonomy.labels.length <= 1) {
      const allBypassed = queue.splice(0);
      allBypassed.forEach((item) => {
        item.postEl.setAttribute('data-jev-bypassed', 'true');
      });
      return;
    }

    const currentBatch = queue.splice(0, 15);
    const uncachedIndices = [];
    const uncachedInputs = [];

    currentBatch.forEach((item, idx) => {
      if (textCache.has(item.text)) {
        renderClassification(item, textCache.get(item.text));
      } else {
        uncachedIndices.push(idx);
        uncachedInputs.push(item.text);
      }
    });

    if (uncachedInputs.length > 0) {
      const results = await callJevBatch(uncachedInputs);
      if (Array.isArray(results) && results.length > 0) {
        uncachedIndices.forEach((itemIdx, i) => {
          const item = currentBatch[itemIdx];
          const res = results[i];
          if (item && res) {
            textCache.set(item.text, res);
            renderClassification(item, res);
          } else if (item && item.postEl) {
            item.postEl.removeAttribute('data-jev-scanned');
            item.postEl.removeAttribute('data-jev-cmt-scanned');
          }
        });
        saveCache();
      } else {
        uncachedIndices.forEach((idx) => {
          const item = currentBatch[idx];
          if (item && item.postEl) {
            item.postEl.removeAttribute('data-jev-scanned');
            item.postEl.removeAttribute('data-jev-cmt-scanned');
          }
        });
      }
    }

    if (queue.length > 0) {
      debounceTimer = setTimeout(flushQueue, 80);
    }
  }

  // --- FACEBOOK REELS & POPUP SCANNER ---
  function scanFacebookReels() {
    if (getPlatform() !== 'facebook') return;
    if (!CONFIG.monkModeEnabled) return;

    // 1. Target Reels Pop-up / Modal Dialogs / Tahoe Video Player / Floating Miniplayer
    const dialogs = document.querySelectorAll(
      'div[role="dialog"], div[data-pagelet*="Tahoe"], div[data-pagelet*="FloatingVideo"]'
    );

    dialogs.forEach((dialog) => {
      const videos = dialog.querySelectorAll('video');
      if (videos.length === 0) return;

      const hasReelLink = dialog.querySelector('a[href*="/reel/"], a[href*="/reels/"], a[href*="/watch"]');
      const isReelUrl = window.location.pathname.includes('/reel') || window.location.pathname.includes('/watch');
      const isTahoeOrFloating = dialog.getAttribute('data-pagelet')?.includes('Tahoe') ||
                                dialog.getAttribute('data-pagelet')?.includes('FloatingVideo');

      if (hasReelLink || isReelUrl || isTahoeOrFloating || dialog.getAttribute('role') === 'dialog') {
        if (!dialog.hasAttribute('data-monk-reels-blocked')) {
          dialog.setAttribute('data-monk-reels-blocked', 'true');
        }

        // Pause & mute videos if not revealed
        if (!dialog.classList.contains('monk-revealed')) {
          videos.forEach((vid) => {
            try {
              vid.pause();
              vid.muted = true;
            } catch (e) {}
            if (!vid.dataset.monkHooked) {
              vid.dataset.monkHooked = 'true';
              vid.addEventListener('play', () => {
                if (!dialog.classList.contains('monk-revealed')) {
                  try {
                    vid.pause();
                    vid.muted = true;
                  } catch (e) {}
                }
              });
            }
          });
        }

        // Mount Overlay and Floating Re-blur Button
        if (!dialog.querySelector('.x-monk-reels-overlay')) {
          const overlay = document.createElement('div');
          overlay.className = 'x-monk-reels-overlay';
          overlay.innerHTML = `
            <div class="x-monk-reels-card">
              <div class="x-monk-reels-icon">🧘</div>
              <div class="x-monk-reels-title">Monk Mode: Blocked Facebook Reels Pop-up</div>
              <div class="x-monk-reels-desc">Short-form video has been paused and blurred to preserve focus.</div>
              <div class="x-monk-reels-actions">
                <button class="x-monk-btn-reveal">▶ Play video</button>
                <button class="x-monk-btn-close">✕ Close pop-up</button>
              </div>
            </div>
          `;

          const floatingReblur = document.createElement('button');
          floatingReblur.className = 'x-monk-re-blur-floating';
          floatingReblur.innerHTML = `<span>🧘</span><span>Hide Reels</span>`;
          floatingReblur.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            dialog.classList.remove('monk-revealed');
            videos.forEach((v) => {
              try {
                v.pause();
                v.muted = true;
              } catch (err) {}
            });
          };

          const revealBtn = overlay.querySelector('.x-monk-btn-reveal');
          revealBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            dialog.classList.add('monk-revealed');
            videos.forEach((v) => {
              try {
                v.muted = false;
                v.play();
              } catch (err) {}
            });
          };

          const closeBtn = overlay.querySelector('.x-monk-btn-close');
          closeBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const fbClose = dialog.querySelector(
              'div[aria-label*="Đóng" i], div[aria-label*="Close" i], div[role="button"][tabindex="0"]'
            );
            if (fbClose) {
              fbClose.click();
            }
            const esc = new KeyboardEvent('keydown', {
              key: 'Escape',
              code: 'Escape',
              keyCode: 27,
              which: 27,
              bubbles: true,
              cancelable: true,
            });
            document.dispatchEvent(esc);
            window.dispatchEvent(esc);
            dialog.dispatchEvent(esc);
          };

          const videoWrapper = dialog.querySelector('div:has(> video)') || videos[0]?.parentElement || dialog;
          videoWrapper.style.position = 'relative';
          videoWrapper.appendChild(overlay);
          videoWrapper.appendChild(floatingReblur);
        }
      }
    });

    // 2. Target Reels Trays / Carousels in Feed ("Reels và video ngắn" / "Thước phim")
    const reelLinks = document.querySelectorAll('a[href*="/reel/"], a[href*="/reels/"]');
    reelLinks.forEach((link) => {
      if (link.closest('[data-monk-reels-blocked="true"]')) return;

      let tray = link.closest('div[data-pagelet*="Reels"]') ||
                 link.closest('div[aria-label*="Reels" i]') ||
                 link.closest('div[aria-label*="Thước phim" i]') ||
                 link.closest('div[data-pagelet^="FeedUnit_"]');

      if (!tray) {
        let curr = link.parentElement;
        let depth = 0;
        while (curr && curr !== document.body && depth < 6) {
          if (curr.querySelectorAll('a[href*="/reel/"]').length >= 2) {
            tray = curr;
            break;
          }
          curr = curr.parentElement;
          depth++;
        }
      }

      if (tray && !tray.hasAttribute('data-monk-tray-handled')) {
        tray.setAttribute('data-monk-tray-handled', 'true');
        tray.setAttribute('data-monk-tray-blocked', 'true');

        tray.querySelectorAll('video').forEach((v) => {
          try { v.pause(); v.muted = true; } catch (e) {}
        });

        if (!tray.querySelector('.x-monk-tray-banner')) {
          const banner = document.createElement('div');
          banner.className = 'x-monk-tray-banner';
          banner.innerHTML = `
            <div class="x-monk-tray-content">
              <span>🧘</span>
              <div>
                <b>Monk Mode: Hidden Reels tray from feed</b>
                <div style="font-size:11px;opacity:0.85;margin-top:1px;">Maintain focus and prevent endless short-form video browsing.</div>
              </div>
            </div>
            <button class="x-monk-tray-toggle">Show Reels</button>
          `;

          const toggleBtn = banner.querySelector('.x-monk-tray-toggle');
          toggleBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isRevealed = tray.classList.toggle('monk-revealed');
            toggleBtn.textContent = isRevealed ? 'Hide Reels' : 'Show Reels';
          };

          tray.prepend(banner);
        }
      }
    });

    // 3. Standalone / Direct Reel URL (`facebook.com/reel/...`)
    if (window.location.pathname.startsWith('/reel/')) {
      const mainReel = document.querySelector('div[role="main"], div[data-pagelet="Tahoe"]');
      if (mainReel && !mainReel.hasAttribute('data-monk-reels-blocked')) {
        const vids = mainReel.querySelectorAll('video');
        if (vids.length > 0) {
          mainReel.setAttribute('data-monk-reels-blocked', 'true');
          vids.forEach((v) => {
            try { v.pause(); v.muted = true; } catch (e) {}
          });
          if (!mainReel.querySelector('.x-monk-reels-overlay')) {
            const overlay = document.createElement('div');
            overlay.className = 'x-monk-reels-overlay';
            overlay.innerHTML = `
              <div class="x-monk-reels-card">
                <div class="x-monk-reels-icon">🧘</div>
                <div class="x-monk-reels-title">Monk Mode: Blocked Facebook Reel</div>
                <div class="x-monk-reels-desc">Short-form video has been paused to preserve focus.</div>
                <div class="x-monk-reels-actions">
                  <button class="x-monk-btn-reveal">▶ Play video</button>
                </div>
              </div>
            `;
            const revealBtn = overlay.querySelector('.x-monk-btn-reveal');
            revealBtn.onclick = (e) => {
              e.preventDefault();
              mainReel.classList.add('monk-revealed');
              vids.forEach((v) => { try { v.muted = false; v.play(); } catch (err) {} });
            };
            const wrapper = mainReel.querySelector('div:has(> video)') || vids[0]?.parentElement || mainReel;
            wrapper.style.position = 'relative';
            wrapper.appendChild(overlay);
          }
        }
      }
    }
  }

  // --- INSTAGRAM REELS SCANNER ---
  function scanInstagramReels() {
    if (getPlatform() !== 'instagram') return;
    if (!CONFIG.monkModeEnabled && !CONFIG.blockReelsEnabled) return;

    if (window.location.pathname.includes('/reel')) {
      const mainEl = document.querySelector('main[role="main"]') || document.body;
      const videos = mainEl.querySelectorAll('video');
      if (videos.length > 0) {
        mainEl.setAttribute('data-monk-reels-blocked', 'true');
        if (!mainEl.classList.contains('monk-revealed')) {
          videos.forEach((vid) => {
            try { vid.pause(); vid.muted = true; } catch (e) {}
            if (!vid.dataset.monkHooked) {
              vid.dataset.monkHooked = 'true';
              vid.addEventListener('play', () => {
                if (!mainEl.classList.contains('monk-revealed')) {
                  try { vid.pause(); vid.muted = true; } catch (e) {}
                }
              });
            }
          });
        }

        if (!mainEl.querySelector('.x-monk-reels-overlay')) {
          const overlay = document.createElement('div');
          overlay.className = 'x-monk-reels-overlay';
          overlay.innerHTML = `
            <div class="x-monk-reels-card">
              <div class="x-monk-reels-icon">🧘</div>
              <div class="x-monk-reels-title">Monk Mode: Blocked Instagram Reel</div>
              <div class="x-monk-reels-desc">Short-form video has been paused and blurred to preserve focus.</div>
              <div class="x-monk-reels-actions">
                <button class="x-monk-btn-reveal">▶ Play Reel</button>
                <button class="x-monk-btn-home">🏠 Return to Home</button>
              </div>
            </div>
          `;
          const revealBtn = overlay.querySelector('.x-monk-btn-reveal');
          revealBtn.onclick = (e) => {
            e.preventDefault();
            mainEl.classList.add('monk-revealed');
            videos.forEach((v) => { try { v.muted = false; v.play(); } catch (err) {} });
          };
          const homeBtn = overlay.querySelector('.x-monk-btn-home');
          homeBtn.onclick = (e) => {
            e.preventDefault();
            window.location.href = 'https://www.instagram.com/';
          };
          const wrapper = mainEl.querySelector('div:has(> video)') || videos[0]?.parentElement || mainEl;
          wrapper.style.position = 'relative';
          wrapper.appendChild(overlay);
        }
      }
    }

    const dialogs = document.querySelectorAll('div[role="dialog"]');
    dialogs.forEach((dialog) => {
      const hasReel = dialog.querySelector('a[href*="/reel/"], a[href*="/reels/"]') ||
                      window.location.pathname.includes('/reel') ||
                      dialog.querySelector('video');
      const videos = dialog.querySelectorAll('video');
      if (hasReel && videos.length > 0) {
        if (!dialog.hasAttribute('data-monk-reels-blocked')) {
          dialog.setAttribute('data-monk-reels-blocked', 'true');
        }

        if (!dialog.classList.contains('monk-revealed')) {
          videos.forEach((vid) => {
            try { vid.pause(); vid.muted = true; } catch (e) {}
            if (!vid.dataset.monkHooked) {
              vid.dataset.monkHooked = 'true';
              vid.addEventListener('play', () => {
                if (!dialog.classList.contains('monk-revealed')) {
                  try { vid.pause(); vid.muted = true; } catch (e) {}
                }
              });
            }
          });
        }

        if (!dialog.querySelector('.x-monk-reels-overlay')) {
          const overlay = document.createElement('div');
          overlay.className = 'x-monk-reels-overlay';
          overlay.innerHTML = `
            <div class="x-monk-reels-card">
              <div class="x-monk-reels-icon">🧘</div>
              <div class="x-monk-reels-title">Monk Mode: Blocked Instagram Reel Pop-up</div>
              <div class="x-monk-reels-desc">Short-form video has been paused and blurred to preserve focus.</div>
              <div class="x-monk-reels-actions">
                <button class="x-monk-btn-reveal">▶ Play Reel</button>
                <button class="x-monk-btn-close">✕ Close pop-up</button>
              </div>
            </div>
          `;

          const floatingReblur = document.createElement('button');
          floatingReblur.className = 'x-monk-re-blur-floating';
          floatingReblur.innerHTML = `<span>🧘</span><span>Hide Reel</span>`;
          floatingReblur.onclick = (e) => {
            e.preventDefault();
            dialog.classList.remove('monk-revealed');
            videos.forEach((v) => { try { v.pause(); v.muted = true; } catch (err) {} });
          };

          const revealBtn = overlay.querySelector('.x-monk-btn-reveal');
          revealBtn.onclick = (e) => {
            e.preventDefault();
            dialog.classList.add('monk-revealed');
            videos.forEach((v) => { try { v.muted = false; v.play(); } catch (err) {} });
          };

          const closeBtn = overlay.querySelector('.x-monk-btn-close');
          closeBtn.onclick = (e) => {
            e.preventDefault();
            const closeSvg = dialog.querySelector('svg[aria-label*="Close" i], svg[aria-label*="Đóng" i]');
            if (closeSvg && closeSvg.closest('button, div[role="button"]')) {
              closeSvg.closest('button, div[role="button"]').click();
            } else {
              const esc = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true });
              document.dispatchEvent(esc);
              window.dispatchEvent(esc);
            }
          };

          const wrapper = dialog.querySelector('div:has(> video)') || videos[0]?.parentElement || dialog;
          wrapper.style.position = 'relative';
          wrapper.appendChild(overlay);
          wrapper.appendChild(floatingReblur);
        }
      }
    });

    document.querySelectorAll('article:not([data-monk-reels-handled])').forEach((article) => {
      const hasReel = article.querySelector('a[href*="/reel/"], a[href*="/reels/"]');
      const videos = article.querySelectorAll('video');
      if (hasReel && videos.length > 0) {
        article.setAttribute('data-monk-reels-handled', 'true');
        article.setAttribute('data-monk-reels-blocked', 'true');

        videos.forEach((vid) => {
          try { vid.pause(); vid.muted = true; } catch (e) {}
        });

        if (!article.querySelector('.x-monk-warning-box')) {
          const box = document.createElement('div');
          box.className = 'x-monk-warning-box';
          box.innerHTML = `
            <div class="x-monk-warning-text">
              <span>🧘</span>
              <div>
                <b>Monk Mode: Blocked Instagram Reel from feed.</b>
                <div style="font-size:10.5px;opacity:0.85;margin-top:1px;">Protect focus and prevent endless short-form video browsing.</div>
              </div>
            </div>
          `;
          const btn = document.createElement('button');
          btn.className = 'x-monk-reveal-btn';
          btn.textContent = 'Play Reel';
          btn.onclick = (e) => {
            e.preventDefault();
            const isRev = article.classList.toggle('monk-revealed');
            btn.textContent = isRev ? 'Hide Reel' : 'Play Reel';
            videos.forEach((v) => { try { if (isRev) { v.muted = false; v.play(); } else { v.muted = true; v.pause(); } } catch (err) {} });
          };
          box.appendChild(btn);
          const firstVid = videos[0];
          if (firstVid && firstVid.parentElement) {
            firstVid.parentElement.insertBefore(box, firstVid);
          } else {
            article.prepend(box);
          }
        }
      }
    });

    document.querySelectorAll('a[href*="/reel/"]:not([data-monk-explore-handled])').forEach((link) => {
      link.setAttribute('data-monk-explore-handled', 'true');
      const img = link.querySelector('img');
      const vid = link.querySelector('video');
      if (img) img.style.filter = 'blur(20px) grayscale(80%)';
      if (vid) {
        vid.style.filter = 'blur(20px) grayscale(80%)';
        try { vid.pause(); vid.muted = true; } catch (e) {}
      }
    });
  }

  // --- YOUTUBE SHORTS SCANNER ---
  function scanYouTubeShorts() {
    if (getPlatform() !== 'youtube') return;
    if (!CONFIG.monkModeEnabled && !CONFIG.blockReelsEnabled) return;

    if (window.location.pathname.startsWith('/shorts')) {
      const shortsContainer = document.querySelector('ytd-shorts, #shorts-container, ytd-reel-video-renderer[is-active]');
      const videos = document.querySelectorAll('ytd-shorts video, #shorts-player video, ytd-reel-video-renderer video');

      if (videos.length > 0) {
        videos.forEach((vid) => {
          try { vid.pause(); vid.muted = true; } catch (e) {}
          if (!vid.dataset.monkHooked) {
            vid.dataset.monkHooked = 'true';
            vid.addEventListener('play', () => {
              const parent = vid.closest('ytd-reel-video-renderer') || shortsContainer;
              if (!parent || !parent.classList.contains('monk-revealed')) {
                try { vid.pause(); vid.muted = true; } catch (e) {}
              }
            });
          }
        });
      }

      if (shortsContainer && !shortsContainer.hasAttribute('data-monk-reels-blocked')) {
        shortsContainer.setAttribute('data-monk-reels-blocked', 'true');

        if (!shortsContainer.querySelector('.x-monk-reels-overlay')) {
          const overlay = document.createElement('div');
          overlay.className = 'x-monk-reels-overlay';
          overlay.style.position = 'fixed';
          overlay.innerHTML = `
            <div class="x-monk-reels-card">
              <div class="x-monk-reels-icon">🧘</div>
              <div class="x-monk-reels-title">Monk Mode: Blocked YouTube Shorts</div>
              <div class="x-monk-reels-desc">Short-form video has been paused and blurred to preserve focus.</div>
              <div class="x-monk-reels-actions">
                <button class="x-monk-btn-reveal">▶ Play Shorts</button>
                <button class="x-monk-btn-home">🏠 Return to Home</button>
              </div>
            </div>
          `;

          const revealBtn = overlay.querySelector('.x-monk-btn-reveal');
          revealBtn.onclick = (e) => {
            e.preventDefault();
            shortsContainer.classList.add('monk-revealed');
            videos.forEach((v) => { try { v.muted = false; v.play(); } catch (err) {} });
          };

          const homeBtn = overlay.querySelector('.x-monk-btn-home');
          homeBtn.onclick = (e) => {
            e.preventDefault();
            window.location.href = 'https://www.youtube.com/';
          };

          shortsContainer.appendChild(overlay);
        }
      }
    }

    const shelves = document.querySelectorAll(
      'ytd-rich-shelf-renderer[is-shorts]:not([data-monk-tray-handled]), ytd-reel-shelf-renderer:not([data-monk-tray-handled]), ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts]):not([data-monk-tray-handled])'
    );

    shelves.forEach((shelf) => {
      shelf.setAttribute('data-monk-tray-handled', 'true');
      shelf.setAttribute('data-monk-tray-blocked', 'true');

      shelf.querySelectorAll('video').forEach((v) => {
        try { v.pause(); v.muted = true; } catch (e) {}
      });

      if (!shelf.querySelector('.x-monk-tray-banner')) {
        const banner = document.createElement('div');
        banner.className = 'x-monk-tray-banner';
        banner.innerHTML = `
          <div class="x-monk-tray-content">
            <span>🧘</span>
            <div>
              <b>Monk Mode: Hidden YouTube Shorts shelf from feed</b>
              <div style="font-size:11px;opacity:0.85;margin-top:1px;">Maintain focus and prevent endless short-form video browsing.</div>
            </div>
          </div>
          <button class="x-monk-tray-toggle">Show Shorts</button>
        `;

        const toggleBtn = banner.querySelector('.x-monk-tray-toggle');
        toggleBtn.onclick = (e) => {
          e.preventDefault();
          const isRevealed = shelf.classList.toggle('monk-revealed');
          toggleBtn.textContent = isRevealed ? 'Hide Shorts' : 'Show Shorts';
        };

        shelf.prepend(banner);
      }
    });
  }

  function scanFeed() {
    // 0. Synchronize active taxonomy & restore bypassed elements
    const activeTaxonomy = getActiveTaxonomy(CONFIG);
    if (activeTaxonomy.labels && activeTaxonomy.labels.length > 1) {
      document.querySelectorAll('[data-jev-bypassed="true"]').forEach((post) => {
        post.removeAttribute('data-jev-bypassed');
        post.removeAttribute('data-jev-scanned');
        post.removeAttribute('data-jev-cmt-scanned');
        post.removeAttribute('data-jev-handled');
      });
    }

    // Synchronize badge visibility
    document.querySelectorAll('.x-jev-badge').forEach((badge) => {
      const cat = badge.getAttribute('data-jev-badge-category');
      const def = TAXONOMY_CATALOG[cat];
      let isHidden = false;
      if ((def && CONFIG[def.configKey] === false) || (cat === 'other / casual discussion' && window.location.pathname.includes('/activity'))) {
        isHidden = true;
      } else if (Array.isArray(CONFIG.customLabels)) {
        const customFound = CONFIG.customLabels.find(
          (c) => (typeof c === 'string' ? c : c?.name)?.trim().toLowerCase() === cat?.trim().toLowerCase()
        );
        if (customFound && typeof customFound === 'object' && customFound.enabled === false) {
          isHidden = true;
        } else if (!customFound && !def && cat !== 'other / casual discussion') {
          isHidden = true;
        }
      }
      if (isHidden) {
        badge.classList.add('x-jev-hidden');
        badge.style.setProperty('display', 'none', 'important');
      } else {
        badge.classList.remove('x-jev-hidden');
        badge.style.removeProperty('display');
      }
    });

    const platform = getPlatform();

    if (platform === 'threads') {
      const candidates = new Set();
      document.querySelectorAll('div[data-pressable-container="true"], div[role="article"], article, div[data-testid*="post"], div[data-testid*="thread"], div[role="listitem"], div[data-testid*="activity"], div[data-testid*="cell"]').forEach((el) => {
        if (!el.hasAttribute('data-jev-scanned')) candidates.add(el);
      });
      document.querySelectorAll('a[href*="/post/"], a[href*="/t/"]').forEach((link) => {
        let container = link.closest('div[data-pressable-container="true"]') || link.closest('div[role="article"]') || link.closest('article');
        if (!container) {
          let curr = link.parentElement;
          let depth = 0;
          while (curr && curr !== document.body && depth < 5) {
            if (curr.querySelector('span[dir="auto"], div[dir="auto"]') && curr.querySelectorAll('svg').length >= 1) {
              container = curr;
              break;
            }
            curr = curr.parentElement;
            depth++;
          }
        }
        if (container && !container.hasAttribute('data-jev-scanned')) candidates.add(container);
      });

      const filteredCandidates = Array.from(candidates).filter((el) => {
        return !Array.from(candidates).some((other) => other !== el && el.contains(other));
      });

      filteredCandidates.forEach((cont) => {
        checkAndApplyMonkMode(cont, cont.innerText || '');

        const textEls = cont.querySelectorAll('span[dir="auto"], div[dir="auto"]');
        const candidateEls = [];

        textEls.forEach((el) => {
          if (el.closest('button') || el.closest('time') || isProfileOnlyLink(el) || el.classList.contains('x-jev-badge') || el.closest('.x-jev-badge-container')) return;
          let t = el.innerText.trim();
          t = t.replace(/\s*(Translate|Xem bản dịch)$/i, '').trim();
          if (t.length < 2) return;
          if (/^\d+(\.\d+)?(k|m|b)?\s*(likes?|replies?|views?|lượt thích|câu trả lời|bình luận|chia sẻ)?$/i.test(t)) return;
          if (/^(\d+\s*(s|m|h|d|w|y|giây|phút|giờ|ngày|tuần|tháng|năm)|just now|vừa xong)$/i.test(t)) return;
          if (/^(translate|xem bản dịch|reply|trả lời|like|thích|share|chia sẻ|follow|theo dõi|following|đang theo dõi|edited|đã chỉnh sửa)$/i.test(t)) return;
          if (/^@?[\w\.]+(\s+and\s+\d+\s+others)?(\s+\d+[smhdw])?$/i.test(t)) return;

          if (el.children.length > 5) return;

          candidateEls.push({ el, text: t });
        });

        if (candidateEls.length > 0) {
          let targetItem = candidateEls[candidateEls.length - 1];
          if (!window.location.pathname.includes('/activity')) {
            candidateEls.forEach((item) => {
              if (item.text.length > targetItem.text.length) targetItem = item;
            });
          }

          cont.setAttribute('data-jev-scanned', 'true');
          scannedCount++;
          updatePill();
          const cleanText = targetItem.text;
          if (textCache.has(cleanText)) {
            renderClassification({ postEl: cont, text: cleanText, textEl: targetItem.el }, textCache.get(cleanText));
          } else {
            queue.push({ postEl: cont, text: cleanText, textEl: targetItem.el });
          }
        }
      });
    } else if (platform === 'facebook') {
      // 1. Scan Facebook Reels, Pop-up video player, and Feed Trays
      scanFacebookReels();

      // 2. Scan standard feed units
      document.querySelectorAll('div[data-pagelet^="FeedUnit_"]:not([data-jev-scanned]):not(:has([role="article"])), div[role="article"]:not([data-jev-scanned]), div[role="feed"] > div:not([data-jev-scanned]):not(:has([data-pagelet])):not(:has([role="article"]))').forEach((post) => {
        checkAndApplyMonkMode(post, post.innerText || '');
        const msgEl = post.querySelector('div[data-ad-rendering-role="story_message"], div[data-ad-preview="message"]') ||
                      Array.from(post.querySelectorAll('div[dir="auto"], span[dir="auto"]')).find((el) => el.innerText.trim().length >= 10);
        if (msgEl) {
          let text = msgEl.innerText.trim();
          text = text.replace(/\s*(Translate|Xem bản dịch)$/i, '').trim();
          if (text.length >= 2) {
            post.setAttribute('data-jev-scanned', 'true');
            scannedCount++;
            updatePill();
            if (textCache.has(text)) {
              renderClassification({ postEl: post, text, textEl: msgEl }, textCache.get(text));
            } else {
              queue.push({ postEl: post, text, textEl: msgEl });
            }
          }
        }
      });
    } else if (platform === 'instagram') {
      scanInstagramReels();
    } else if (platform === 'youtube') {
      scanYouTubeShorts();
    } else if (platform === 'x') {
      document.querySelectorAll('article[data-testid="tweet"]:not([data-jev-scanned]), div[data-testid="cellInnerDiv"]:not(:has(article[data-testid="tweet"])):not([data-jev-scanned])').forEach((post) => {
        checkAndApplyMonkMode(post, post.innerText || '');
        const textEl = post.querySelector('div[data-testid="tweetText"]');
        if (textEl) {
          let text = textEl.innerText.trim();
          text = text.replace(/\s*(Translate|Xem bản dịch)$/i, '').trim();
          if (text.length >= 2) {
            post.setAttribute('data-jev-scanned', 'true');
            scannedCount++;
            updatePill();
            if (textCache.has(text)) {
              renderClassification({ postEl: post, text, textEl }, textCache.get(text));
            } else {
              queue.push({ postEl: post, text, textEl });
            }
          }
        }
      });
    }

    if (queue.length > 0) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(flushQueue, CONFIG.batchDebounceMs);
    }
  }

  const observer = new MutationObserver(() => scanFeed());
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
    scanFeed();
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, { childList: true, subtree: true });
      scanFeed();
    });
  }

  // Safety interval for Facebook, Instagram, YouTube
  if (['facebook', 'instagram', 'youtube'].includes(getPlatform())) {
    setInterval(() => {
      if (CONFIG.monkModeEnabled || CONFIG.blockReelsEnabled) {
        if (getPlatform() === 'facebook') scanFacebookReels();
        if (getPlatform() === 'instagram') scanInstagramReels();
        if (getPlatform() === 'youtube') scanYouTubeShorts();
      }
    }, 400);
  }

  window.addEventListener('popstate', () => {
    if (getPlatform() === 'facebook') scanFacebookReels();
    if (getPlatform() === 'instagram') scanInstagramReels();
    if (getPlatform() === 'youtube') scanYouTubeShorts();
  });

  if (getPlatform() === 'youtube') {
    window.addEventListener('yt-navigate-finish', () => scanYouTubeShorts());
  }

  // Safety heartbeat interval: keep pill alive & catch dynamic SPA updates
  setInterval(() => {
    initPill();
    scanFeed();
  }, 1500);

  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      scanFeed();
    }
  }, 500);
})();

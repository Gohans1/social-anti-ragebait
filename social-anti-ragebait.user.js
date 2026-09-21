// ==UserScript==
// @name         Social Shield for X (Twitter): AI Feed Focus Guard & Casual Triage
// @namespace    https://classifier.dev/
// @version      3.0.0
// @description  AI-powered feed focus guard for X: filter casual banter or custom topics, badge classified tweets, and summarize long threads on-demand with Gemini 3.5 Flash-Lite.
// @author       Antigravity
// @match        *://*.x.com/*
// @match        *://x.com/*
// @match        *://*.twitter.com/*
// @match        *://twitter.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      classifier.dev
// @connect      generativelanguage.googleapis.com
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const DEFAULT_GEMINI_API_KEY = 'AIzaSyCEUfHf2SiBsA5ZLDLHJMg_1bkjebeuVoo';
  const DEFAULT_GEMINI_PROMPT = 'Summarize the following social media post into exactly 3 concise, high-signal bullet points in the same language as the post (Vietnamese or English). No intro, no filler, strictly 3 bullet points starting with -:';

  const CONFIG = {
    apiEndpoint: 'https://classifier.dev',
    geminiApiKey: DEFAULT_GEMINI_API_KEY,
    geminiPrompt: DEFAULT_GEMINI_PROMPT,
    batchDebounceMs: 120,
    confidenceThreshold: 0.30,
    categoryActions: {
      casual: 'show',
    },
    filterCasualEnabled: true,
    customLabels: [],
    singleTagMode: false,
    focusModeEnabled: true,
    focusWhitelistTags: ['casual', 'custom'],
    hideFloatingPill: false,
  };

  try {
    const savedActions = localStorage.getItem('social_shield_category_actions');
    if (savedActions) {
      const parsed = JSON.parse(savedActions);
      CONFIG.categoryActions = { casual: parsed.casual || 'show' };
      const savedFocus = localStorage.getItem('social_shield_focus_mode');
      if (savedFocus !== null) CONFIG.focusModeEnabled = savedFocus === 'true';
    }

    let savedCustom = null;
    if (typeof GM_getValue !== 'undefined') {
      savedCustom = GM_getValue('social_shield_custom_labels', null);
    }
    if (savedCustom === null) {
      const raw = localStorage.getItem('social_shield_custom_labels');
      if (raw) {
        try { savedCustom = JSON.parse(raw); } catch (e) {}
      }
    }
    if (Array.isArray(savedCustom)) {
      CONFIG.customLabels = savedCustom;
    }

    let savedHidePill = null;
    if (typeof GM_getValue !== 'undefined') {
      savedHidePill = GM_getValue('social_shield_hide_pill', null);
    }
    if (savedHidePill === null) {
      savedHidePill = localStorage.getItem('social_shield_hide_pill');
    }
    if (savedHidePill !== null) {
      CONFIG.hideFloatingPill = savedHidePill === true || savedHidePill === 'true';
    }

    let savedSingleTag = null;
    if (typeof GM_getValue !== 'undefined') {
      savedSingleTag = GM_getValue('social_shield_single_tag_mode', null);
    }
    if (savedSingleTag === null) {
      savedSingleTag = localStorage.getItem('social_shield_single_tag_mode');
    }
    if (savedSingleTag !== null) {
      CONFIG.singleTagMode = savedSingleTag === true || savedSingleTag === 'true';
    }

    let savedThreshold = null;
    if (typeof GM_getValue !== 'undefined') {
      savedThreshold = GM_getValue('social_shield_threshold', null);
    }
    if (savedThreshold === null) {
      savedThreshold = localStorage.getItem('social_shield_threshold');
    }
    if (savedThreshold !== null && !isNaN(Number(savedThreshold))) {
      CONFIG.confidenceThreshold = Number(savedThreshold);
    }

    let savedApiKey = '';
    if (typeof GM_getValue !== 'undefined') {
      savedApiKey = GM_getValue('social_shield_gemini_api_key', '');
    } else {
      savedApiKey = localStorage.getItem('social_shield_gemini_api_key') || '';
    }
    if (savedApiKey) CONFIG.geminiApiKey = String(savedApiKey).trim();

    let savedPrompt = '';
    if (typeof GM_getValue !== 'undefined') {
      savedPrompt = GM_getValue('social_shield_gemini_prompt', '');
    } else {
      savedPrompt = localStorage.getItem('social_shield_gemini_prompt') || '';
    }
    if (savedPrompt) CONFIG.geminiPrompt = String(savedPrompt).trim();
  } catch (e) {}

  let scannedCount = 0;
  let focusCollapsedCount = 0;
  let casualCount = 0;
  let customCount = 0;

  function getPlatform() {
    return 'x';
  }

  const css = `
    .x-jev-badge-container {
      display: inline-flex !important;
      flex-wrap: wrap !important;
      align-items: center !important;
      gap: 4px !important;
      margin: 0 0 0 6px !important;
      width: auto !important;
      flex-shrink: 0 !important;
      box-sizing: border-box !important;
      position: relative !important;
      z-index: 10 !important;
      vertical-align: middle !important;
    }
    .x-jev-badge-container:not(.x-jev-header-container) {
      margin: 2px 0 6px 0 !important;
    }
    .x-jev-badge-container:empty,
    .x-jev-badge-container:not(:has(.x-jev-badge:not(.x-jev-hidden))):not(:has(.x-jev-summary-btn)) {
      display: none !important;
    }
    .x-jev-badge-container .x-jev-badge {
      margin: 0 !important;
    }
    .x-jev-badge {
      display: inline-flex !important;
      align-items: center !important;
      gap: 4.5px !important;
      padding: 1px 7px !important;
      border-radius: 4px !important;
      height: 18px !important;
      box-sizing: border-box !important;
      white-space: nowrap !important;
      flex-shrink: 0 !important;
      font-size: 11px !important;
      font-weight: 500 !important;
      letter-spacing: -0.01em !important;
      margin: 0 !important;
      border: 1px solid var(--badge-border, #262626) !important;
      background: var(--badge-bg, #000000) !important;
      color: var(--badge-color, #ededed) !important;
      width: fit-content !important;
      user-select: none !important;
      transition: border-color 0.15s ease, background-color 0.15s ease !important;
      cursor: help !important;
      line-height: 1 !important;
      z-index: 10 !important;
      position: relative !important;
      filter: none !important;
      opacity: 1 !important;
      pointer-events: auto !important;
      box-shadow: none !important;
      font-family: "Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    }
    .x-jev-badge:hover {
      border-color: #444444 !important;
      background: #0f0f0f !important;
    }
    .x-jev-badge.x-jev-hidden {
      display: none !important;
    }
    .x-jev-badge-dot {
      width: 6px !important;
      height: 6px !important;
      border-radius: 50% !important;
      background-color: var(--badge-dot, #94a3b8) !important;
      display: inline-block !important;
      flex-shrink: 0 !important;
    }
    body.x-jev-single-tag-mode .x-jev-badge-container .x-jev-badge:not(.x-jev-hidden) ~ .x-jev-badge:not(.x-jev-hidden) {
      display: none !important;
    }
    .x-jev-confidence {
      display: none !important;
      font-family: "Geist Mono", monospace !important;
      font-size: 10px !important;
      color: #888888 !important;
      font-weight: 500 !important;
      margin-left: 2px !important;
    }
    .x-jev-badge:hover .x-jev-confidence {
      display: inline !important;
    }
    .x-jev-focus-bar {
      background: #0a0a0a !important;
      border: 1px solid #222222 !important;
      border-radius: 6px !important;
      padding: 6px 12px !important;
      margin: 4px 0 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      font-size: 11.5px !important;
      color: #888888 !important;
      cursor: pointer !important;
      user-select: none !important;
      transition: border-color 0.15s ease !important;
      width: 100% !important;
      box-sizing: border-box !important;
      font-family: "Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    }
    .x-jev-focus-bar:hover {
      border-color: #444444 !important;
    }
    .x-jev-focus-info {
      display: flex !important;
      align-items: center !important;
      gap: 6px !important;
      font-weight: 500 !important;
    }
    .x-jev-focus-action {
      font-family: "Geist Mono", monospace !important;
      font-size: 10px !important;
      font-weight: 500 !important;
      color: #ededed !important;
      background: #141414 !important;
      border: 1px solid #262626 !important;
      padding: 2px 6px !important;
      border-radius: 4px !important;
    }
    .x-jev-focus-collapsed-content {
      display: none !important;
    }
    .x-jev-focus-expanded .x-jev-focus-collapsed-content {
      display: revert !important;
    }
    .x-jev-focus-expanded .x-jev-badge-container.x-jev-focus-collapsed-content,
    .x-jev-focus-expanded .x-jev-badge.x-jev-focus-collapsed-content:not(.x-jev-hidden) {
      display: inline-flex !important;
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
      background: rgba(0, 0, 0, 0.9) !important;
      color: #ededed !important;
      padding: 6px 14px !important;
      border-radius: 9999px !important;
      font-size: 11.5px !important;
      font-weight: 500 !important;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6) !important;
      backdrop-filter: blur(16px) !important;
      -webkit-backdrop-filter: blur(16px) !important;
      border: 1px solid #262626 !important;
      display: flex;
      align-items: center !important;
      gap: 8px !important;
      cursor: pointer !important;
      user-select: none !important;
      transition: border-color 0.15s ease !important;
      filter: none !important;
      opacity: 1 !important;
      pointer-events: auto !important;
      font-family: "Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
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
    .x-jev-floating-pill:hover {
      border-color: #444444 !important;
    }
    .x-jev-pill-close {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      margin-left: 6px !important;
      padding: 1px 4px !important;
      font-size: 11px !important;
      font-family: "Geist Mono", monospace !important;
      font-weight: 500 !important;
      color: #737373 !important;
      cursor: pointer !important;
      border-radius: 3px !important;
      background: transparent !important;
      transition: color 0.15s ease !important;
      user-select: none !important;
      z-index: 1000000 !important;
      pointer-events: auto !important;
    }
    .x-jev-pill-close:hover {
      color: #ffffff !important;
    }
    .x-jev-summary-btn {
      display: inline-flex !important;
      align-items: center !important;
      gap: 3.5px !important;
      padding: 1px 6.5px !important;
      border-radius: 4px !important;
      height: 18px !important;
      box-sizing: border-box !important;
      white-space: nowrap !important;
      flex-shrink: 0 !important;
      font-family: "Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      font-size: 10.5px !important;
      font-weight: 500 !important;
      letter-spacing: -0.01em !important;
      margin: 0 !important;
      border: 1px solid #262626 !important;
      background: #000000 !important;
      color: #a78bfa !important;
      width: fit-content !important;
      user-select: none !important;
      transition: all 0.15s ease !important;
      cursor: pointer !important;
      line-height: 1 !important;
      z-index: 10 !important;
      position: relative !important;
    }
    .x-jev-summary-btn:hover {
      border-color: #a78bfa !important;
      background: #0f0a1c !important;
      color: #c4b5fd !important;
    }
    .x-jev-summary-btn.x-jev-loading {
      opacity: 0.65 !important;
      cursor: wait !important;
      border-color: #555555 !important;
      color: #888888 !important;
    }
    .x-jev-summary-btn.x-jev-active {
      border-color: #a78bfa !important;
      background: #1e1338 !important;
      color: #ffffff !important;
    }
    .x-jev-summary-box {
      margin: 8px 0 10px 0 !important;
      padding: 10px 14px !important;
      background: #000000 !important;
      border: 1px solid #262626 !important;
      border-left: 3px solid #a78bfa !important;
      border-radius: 6px !important;
      font-family: "Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      font-size: 13px !important;
      line-height: 1.5 !important;
      color: #ededed !important;
      box-sizing: border-box !important;
      position: relative !important;
      z-index: 10 !important;
    }
    .x-jev-summary-box.x-jev-hidden {
      display: none !important;
    }
    .x-jev-summary-header {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      margin-bottom: 7px !important;
      padding-bottom: 5px !important;
      border-bottom: 1px solid #1f1f1f !important;
    }
    .x-jev-summary-title {
      display: inline-flex !important;
      align-items: center !important;
      gap: 5px !important;
      font-size: 11px !important;
      font-weight: 600 !important;
      color: #a78bfa !important;
      letter-spacing: -0.01em !important;
    }
    .x-jev-summary-badge {
      font-family: "Geist Mono", monospace !important;
      font-size: 9px !important;
      color: #71717a !important;
      background: #121212 !important;
      border: 1px solid #27272a !important;
      padding: 1px 4px !important;
      border-radius: 3px !important;
      margin-left: 4px !important;
    }
    .x-jev-summary-close {
      background: transparent !important;
      border: none !important;
      color: #737373 !important;
      font-size: 11px !important;
      font-family: "Geist Mono", monospace !important;
      cursor: pointer !important;
      padding: 2px 5px !important;
      border-radius: 3px !important;
      line-height: 1 !important;
      transition: all 0.15s ease !important;
    }
    .x-jev-summary-close:hover {
      color: #ffffff !important;
      background: #1f1f1f !important;
    }
    .x-jev-summary-list {
      margin: 0 !important;
      padding-left: 16px !important;
      list-style-type: disc !important;
    }
    .x-jev-summary-list li {
      margin-bottom: 4px !important;
      font-size: 12.5px !important;
      color: #d4d4d4 !important;
      line-height: 1.45 !important;
    }
    .x-jev-summary-list li:last-child {
      margin-bottom: 0 !important;
    }
    .x-jev-summary-error {
      font-size: 12px !important;
      color: #f87171 !important;
      display: flex !important;
      align-items: center !important;
      gap: 6px !important;
    }
  `;

  if (typeof GM_addStyle !== 'undefined') {
    GM_addStyle(css);
  } else {
    const styleEl = document.createElement('style');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  }

  const CACHE_KEY = `social_guardian_cache_v5_x`;
  const textCache = new Map();
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      Object.entries(parsed).forEach(([k, v]) => textCache.set(k, v));
    }
  } catch (e) {}

  function saveCacheToStorage() {
    try {
      const obj = {};
      const entries = Array.from(textCache.entries()).slice(-300);
      entries.forEach(([k, v]) => (obj[k] = v));
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(obj));
    } catch (e) {}
  }

  const COUNTED_KEY = `social_guardian_counted_v2_x`;
  const countedTexts = new Set();
  try {
    const rawCounted = sessionStorage.getItem(COUNTED_KEY);
    if (rawCounted) {
      JSON.parse(rawCounted).forEach((t) => countedTexts.add(t));
    }
  } catch (e) {}

  function saveCountedToStorage() {
    try {
      const arr = Array.from(countedTexts).slice(-500);
      sessionStorage.setItem(COUNTED_KEY, JSON.stringify(arr));
    } catch (e) {}
  }

  const TAXONOMY_CATALOG = {
    'other / casual discussion': {
      tagKey: 'casual',
      configKey: 'filterCasualEnabled',
      countKey: 'casualCount',
      badge: {
        text: 'Casual',
        desc: 'Daily chats & banter',
        bg: '#000000',
        border: '#262626',
        color: '#ededed',
        dotColor: '#94a3b8',
      },
      instruction: 'everyday personal chatter, news, generic talk, or any content that does not fit the other categories.',
    },
  };

  const CATCH_ALL_LABEL = 'other / casual discussion';
  const CATCH_ALL_INSTRUCTION = 'everyday personal chatter, news, generic talk, or any content that does not fit the other categories.';

  const BADGE_MAP = {
    'other / casual discussion': TAXONOMY_CATALOG['other / casual discussion'].badge,
  };

  function getActiveTaxonomy(cfg = {}) {
    const activeLabels = [];
    const instructionsList = [];

    if (Array.isArray(cfg?.customLabels)) {
      cfg.customLabels.forEach((c) => {
        const rawName = typeof c === 'string' ? c : c?.name;
        const action = typeof c === 'object' ? (c.action || (c.enabled === false ? 'off' : 'show')) : 'show';
        const enabled = action !== 'off';
        const name = rawName ? rawName.replace(/["\r\n\t]/g, '').slice(0, 40).trim() : '';
        const isDuplicate =
          !name ||
          name.toLowerCase() === CATCH_ALL_LABEL.toLowerCase() ||
          Boolean(TAXONOMY_CATALOG[name.toLowerCase()]) ||
          activeLabels.some((l) => l.toLowerCase() === name.toLowerCase());
        if (enabled && !isDuplicate) {
          activeLabels.push(name);
          const rawInstruct = typeof c === 'object' && c?.instruction ? String(c.instruction).replace(/[\r\n\t]/g, ' ').slice(0, 200).trim() : '';
          const instruction = rawInstruct || `content specifically discussing, focused on, or related to ${name}.`;
          instructionsList.push(`"${name}": ${/[.!?:]$/.test(instruction) ? instruction : instruction + '.'}`);
        }
      });
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

  const pill = document.createElement('div');
  pill.className = 'x-jev-floating-pill';
  const pillStats = document.createElement('span');
  pillStats.className = 'x-jev-pill-stats';
  const pillClose = document.createElement('span');
  pillClose.className = 'x-jev-pill-close';
  pillClose.title = 'Hide floating status pill';
  pillClose.textContent = '✕';
  pill.appendChild(pillStats);
  pill.appendChild(pillClose);

  document.addEventListener(
    'click',
    (e) => {
      if (e.target && e.target.closest && e.target.closest('.x-jev-pill-close')) {
        e.preventDefault();
        e.stopPropagation();
        CONFIG.hideFloatingPill = true;
        initPill();
        try {
          if (typeof GM_setValue !== 'undefined') GM_setValue('social_shield_hide_pill', true);
          localStorage.setItem('social_shield_hide_pill', 'true');
        } catch (err) {}
      }
    },
    true
  );

  function initPill() {
    if (document.body) {
      document.body.classList.toggle('x-jev-hide-pill', !!CONFIG.hideFloatingPill);
    }
    if (CONFIG.hideFloatingPill) {
      pill.setAttribute('data-hidden', 'true');
      pill.classList.add('x-jev-pill-hidden');
      pill.style.setProperty('display', 'none', 'important');
      return;
    }

    pill.removeAttribute('data-hidden');
    pill.classList.remove('x-jev-pill-hidden');
    pill.style.setProperty('display', 'flex', 'important');
    if (document.body && !document.contains(pill)) {
      document.body.appendChild(pill);
    }
  }

  function updatePill() {
    if (CONFIG.hideFloatingPill) {
      initPill();
      return;
    }
    initPill();
    const parts = [
      `X: <span style="color:#ededed; font-family:'Geist Mono',monospace;">ON</span>`,
      `Scanned: <span style="color:#ededed; font-family:'Geist Mono',monospace;">${scannedCount}</span>`,
    ];
    if (CONFIG.focusModeEnabled && focusCollapsedCount > 0) {
      parts.push(`<span class="x-jev-pill-focus-toggle" style="cursor:pointer;">Filtered: <span style="color:#ededed; font-family:'Geist Mono',monospace;">${focusCollapsedCount}</span></span>`);
    }
    if (casualCount > 0) {
      parts.push(`Casual: <span style="color:#888888; font-family:'Geist Mono',monospace;">${casualCount}</span>`);
    }
    if (customCount > 0) {
      parts.push(`Custom: <span style="color:#ededed; font-family:'Geist Mono',monospace;">${customCount}</span>`);
    }
    pillStats.innerHTML = parts.join(' | ');
  }

  updatePill();
  pill.addEventListener('click', (e) => {
    if (e.target.closest('.x-jev-pill-close')) return;
    CONFIG.focusModeEnabled = !CONFIG.focusModeEnabled;
    try {
      if (typeof GM_setValue !== 'undefined') GM_setValue('social_shield_focus_mode', CONFIG.focusModeEnabled);
      localStorage.setItem('social_shield_focus_mode', String(CONFIG.focusModeEnabled));
    } catch (err) {}
    updatePill();
    applyStateToDOM();
  });

  if (document.body) {
    initPill();
  } else {
    document.addEventListener('DOMContentLoaded', initPill);
  }

  function applyStateToDOM() {
    if (document.body) {
      document.body.classList.toggle('x-jev-hide-pill', !!CONFIG.hideFloatingPill);
      document.body.classList.toggle('x-jev-single-tag-mode', !!CONFIG.singleTagMode);
      document.body.classList.toggle('x-jev-no-focus', !CONFIG.focusModeEnabled);
    }
  }

  async function callJevBatch(inputs) {
    const taxonomy = getActiveTaxonomy(CONFIG);
    if (!taxonomy.labels || taxonomy.labels.length < 2) {
      return inputs.map(() => ({
        label: CATCH_ALL_LABEL,
        confidence: 1,
        scores: { [CATCH_ALL_LABEL]: 1 },
      }));
    }

    return new Promise((resolve) => {
      if (typeof GM_xmlhttpRequest !== 'undefined') {
        GM_xmlhttpRequest({
          method: 'POST',
          url: `${CONFIG.apiEndpoint}/`,
          headers: { 'Content-Type': 'application/json' },
          data: JSON.stringify({
            labels: taxonomy.labels,
            inputs: inputs,
            instructions: taxonomy.instructions,
            multi: true,
            max_labels: 5,
          }),
          onload: (res) => {
            try {
              const data = JSON.parse(res.responseText);
              resolve(data.results || []);
            } catch (e) {
              resolve([]);
            }
          },
          onerror: () => resolve([]),
        });
      } else {
        fetch(`${CONFIG.apiEndpoint}/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            labels: taxonomy.labels,
            inputs: inputs,
            instructions: taxonomy.instructions,
            multi: true,
            max_labels: 5,
          }),
        })
          .then((r) => r.json())
          .then((d) => resolve(d.results || []))
          .catch(() => resolve([]));
      }
    });
  }

  function getPostTagKey(label) {
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
    if (label === 'other / casual discussion') return 'Casual';
    return label || 'Other';
  }

  function isPostHidden(labels) {
    if (CONFIG.focusModeEnabled === false) return false;

    const labelList = Array.isArray(labels)
      ? labels
      : (typeof labels === 'string' ? labels.split('|') : []);
    if (labelList.length === 0) return false;

    return labelList.some((lbl) => {
      const tagKey = getPostTagKey(lbl);
      if (tagKey && CONFIG.categoryActions[tagKey] === 'hide') return true;

      if (Array.isArray(CONFIG.customLabels)) {
        const custom = CONFIG.customLabels.find(
          (c) => (typeof c === 'string' ? c : c?.name)?.trim().toLowerCase() === lbl?.trim().toLowerCase()
        );
        if (custom && typeof custom === 'object') {
          const action = custom.action || (custom.enabled === false ? 'off' : 'show');
          if (action === 'hide') return true;
        }
      }
      return false;
    });
  }

  function createFocusBar(postEl, textEl, labels) {
    const existingBar = postEl.querySelector('.x-jev-focus-bar');
    const labelList = Array.isArray(labels)
      ? labels
      : (typeof labels === 'string' ? labels.split('|') : []);
    const displayTag = labelList.map((l) => getDisplayLabelName(l)).join(', ') || 'Other';

    if (existingBar) {
      const boldTag = existingBar.querySelector('.x-jev-focus-info b');
      if (boldTag) boldTag.textContent = displayTag;
      return;
    }
    const parentContainer = textEl.parentElement;
    if (!parentContainer) return;

    const focusBar = document.createElement('div');
    focusBar.className = 'x-jev-focus-bar';

    const infoDiv = document.createElement('div');
    infoDiv.className = 'x-jev-focus-info';

    const iconSpan = document.createElement('span');
    iconSpan.style.display = 'inline-flex';
    iconSpan.style.alignItems = 'center';
    iconSpan.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>';

    const textSpan = document.createElement('span');
    textSpan.textContent = 'Filtered: ';

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
    if (isPostHidden(labels)) {
      const wasHidden = postEl.hasAttribute('data-jev-focus-offtag');
      postEl.setAttribute('data-jev-focus-offtag', 'true');
      textEl.classList.add('x-jev-focus-collapsed-content');
      postEl.querySelectorAll('img, video, .x-jev-badge, .x-jev-badge-container, .x-jev-summary-box').forEach((m) => {
        if (!m.closest('a[href*="/@"]')) m.classList.add('x-jev-focus-collapsed-content');
      });
      createFocusBar(postEl, textEl, labels);
      const bar = postEl.querySelector('.x-jev-focus-bar');
      if (bar) {
        bar.classList.remove('x-jev-hidden');
        bar.style.removeProperty('display');
      }
      if (!wasHidden) {
        focusCollapsedCount++;
        updatePill();
      }
    } else {
      postEl.removeAttribute('data-jev-focus-offtag');
      textEl.classList.remove('x-jev-focus-collapsed-content');
      postEl.querySelectorAll('.x-jev-focus-collapsed-content').forEach((m) => {
        m.classList.remove('x-jev-focus-collapsed-content');
      });
      const bar = postEl.querySelector('.x-jev-focus-bar');
      if (bar) {
        bar.classList.add('x-jev-hidden');
        bar.style.setProperty('display', 'none', 'important');
      }
      postEl.classList.remove('x-jev-focus-expanded');
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  const summaryCache = new Map();

  async function requestPostSummary(text) {
    if (summaryCache.has(text)) return summaryCache.get(text);
    return new Promise((resolve, reject) => {
      const apiKey = (CONFIG.geminiApiKey || DEFAULT_GEMINI_API_KEY).trim();
      const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent';
      const baseInstruction = (typeof CONFIG.geminiPrompt === 'string' && CONFIG.geminiPrompt.trim().length > 0)
        ? CONFIG.geminiPrompt.trim()
        : DEFAULT_GEMINI_PROMPT;
      const formattedInstruction = /[:.?!]$/.test(baseInstruction)
        ? baseInstruction
        : baseInstruction + ':';
      const prompt = formattedInstruction + '\n\n' + text.trim();
      const payload = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 250,
          temperature: 0.2,
        },
      };

      const handler = (resText) => {
        try {
          const data = JSON.parse(resText);
          const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const bullets = raw
            .split('\n')
            .map((line) => line.trim().replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '').trim())
            .filter((line) => line.length > 0)
            .slice(0, 3);
          if (bullets.length > 0) {
            summaryCache.set(text, bullets);
            if (summaryCache.size > 200) {
              const firstKey = summaryCache.keys().next().value;
              summaryCache.delete(firstKey);
            }
            resolve(bullets);
          } else {
            reject(new Error('No bullet summary generated'));
          }
        } catch (e) {
          reject(e);
        }
      };

      if (typeof GM_xmlhttpRequest !== 'undefined') {
        GM_xmlhttpRequest({
          method: 'POST',
          url: endpoint,
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          data: JSON.stringify(payload),
          onload: (r) => handler(r.responseText),
          onerror: (err) => reject(err),
        });
      } else {
        fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify(payload),
        })
          .then((r) => r.text())
          .then(handler)
          .catch(reject);
      }
    });
  }

  function renderSummaryBox(postEl, textEl, bullets, text) {
    let box = postEl.querySelector('.x-jev-summary-box');
    if (!box) {
      box = document.createElement('div');
      box.className = 'x-jev-summary-box';
      const parentContainer = textEl.parentElement || postEl;
      if (textEl.nextSibling) {
        parentContainer.insertBefore(box, textEl.nextSibling);
      } else {
        parentContainer.appendChild(box);
      }
    }
    box.classList.remove('x-jev-hidden');

    const contentHtml = (Array.isArray(bullets) && bullets.length > 0)
      ? `<ul class="x-jev-summary-list">${bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`
      : `<div class="x-jev-summary-error"><span>⚠️</span><span>Unable to generate 3-bullet summary.</span></div>`;

    box.innerHTML = `
      <div class="x-jev-summary-header">
        <div class="x-jev-summary-title">
          <span>✨</span>
          <span>Gemini 3.5 Flash-Lite</span>
          <span class="x-jev-summary-badge">3-Bullet TL;DR</span>
        </div>
        <button class="x-jev-summary-close" title="Close summary">✕</button>
      </div>
      ${contentHtml}
    `;

    const closeBtn = box.querySelector('.x-jev-summary-close');
    if (closeBtn) {
      closeBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        box.classList.add('x-jev-hidden');
        const btn = postEl.querySelector('.x-jev-summary-btn');
        if (btn) btn.classList.remove('x-jev-active');
      };
    }
  }

  function renderClassification(item, res) {
    const { postEl, textEl } = item;
    if (!textEl || !textEl.parentElement) return;

    if (postEl.hasAttribute('data-jev-handled')) return;
    if (!res || typeof res !== 'object') return;

    const scores = (typeof res.scores === 'object' && res.scores !== null)
      ? res.scores
      : (res.label ? { [res.label]: res.confidence || 0 } : {});
    const parentContainer = textEl.parentElement;

    const eligibleBadges = [];

    Object.entries(scores).forEach(([candidateLabel, score]) => {
      if (typeof score !== 'number' || !Number.isFinite(score) || score < CONFIG.confidenceThreshold) return;

      if (candidateLabel === 'other / casual discussion') {
        if (window.location.pathname.includes('/activity')) return;
        if (CONFIG.categoryActions && CONFIG.categoryActions.casual === 'off') return;
      }

      let isCustom = false;
      let customMeta = null;
      if (Array.isArray(CONFIG.customLabels)) {
        const customFound = CONFIG.customLabels.find(
          (c) => (typeof c === 'string' ? c : c?.name)?.trim().toLowerCase() === candidateLabel?.trim().toLowerCase()
        );
        if (customFound) {
          const action = typeof customFound === 'object' ? (customFound.action || (customFound.enabled === false ? 'off' : 'show')) : 'show';
          if (action === 'off') return;
          isCustom = true;
          const displayName = typeof customFound === 'object' ? customFound.name : customFound;
          customMeta = {
            text: displayName,
            desc: `Custom label: ${displayName}`,
            bg: '#000000',
            border: '#262626',
            color: '#ededed',
            dotColor: '#a78bfa',
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

    const hasEligibleBadges = selectedBadges.length > 0;
    const hasSummarizableText = typeof item.text === 'string' && item.text.trim().length >= 35;

    if (hasEligibleBadges || hasSummarizableText) {
      if (hasEligibleBadges && !countedTexts.has(item.text)) {
        countedTexts.add(item.text);
        saveCountedToStorage();
        postEl.setAttribute('data-jev-counted', 'true');

        selectedBadges.forEach(({ label, isCustom }) => {
          if (label === 'other / casual discussion') {
            casualCount++;
          } else if (isCustom) {
            customCount++;
          }
        });
        updatePill();
      }

      const userNameHeader = postEl.querySelector('div[data-testid="User-Name"]');
      const caretEl = postEl.querySelector('[data-testid="caret"]');
      let container = null;

      if (textEl.previousElementSibling && textEl.previousElementSibling.classList.contains('x-jev-badge')) {
        textEl.previousElementSibling.remove();
      }
      if ((caretEl || userNameHeader) && textEl.previousElementSibling && textEl.previousElementSibling.classList.contains('x-jev-badge-container')) {
        textEl.previousElementSibling.remove();
      }

      if (caretEl && caretEl.parentElement) {
        container = caretEl.parentElement.querySelector('.x-jev-badge-container');
        if (!container) {
          container = document.createElement('div');
          container.className = 'x-jev-badge-container x-jev-header-container';
          caretEl.parentElement.insertBefore(container, caretEl);
        }
      } else if (userNameHeader) {
        container = userNameHeader.querySelector('.x-jev-badge-container');
        if (!container) {
          container = document.createElement('div');
          container.className = 'x-jev-badge-container x-jev-header-container';
          userNameHeader.appendChild(container);
        }
      } else {
        container = (textEl.previousElementSibling && textEl.previousElementSibling.classList.contains('x-jev-badge-container'))
          ? textEl.previousElementSibling
          : null;
        if (!container) {
          container = document.createElement('div');
          container.className = 'x-jev-badge-container';
          parentContainer.insertBefore(container, textEl);
        }
      }
      container.innerHTML = '';

      if (hasEligibleBadges) {
        selectedBadges.forEach(({ label, score, meta }) => {
          const badge = document.createElement('div');
          badge.className = 'x-jev-badge';
          badge.setAttribute('data-jev-badge-category', label);
          badge.style.setProperty('--badge-bg', meta.bg || '#000000');
          badge.style.setProperty('--badge-border', meta.border || '#262626');
          badge.style.setProperty('--badge-color', meta.color || '#ededed');
          badge.style.setProperty('--badge-dot', meta.dotColor || '#94a3b8');
          badge.title = `${meta.desc || meta.text} (Confidence: ${Math.round(score * 100)}% • Jev AI)`;

          const dotSpan = document.createElement('span');
          dotSpan.className = 'x-jev-badge-dot';

          const textSpan = document.createElement('span');
          textSpan.className = 'x-jev-badge-text';
          textSpan.textContent = meta.text;

          const confSpan = document.createElement('span');
          confSpan.className = 'x-jev-confidence';
          confSpan.textContent = `${Math.round(score * 100)}%`;

          badge.appendChild(dotSpan);
          badge.appendChild(textSpan);
          badge.appendChild(confSpan);
          container.appendChild(badge);
        });
      }

      if (hasSummarizableText) {
        const summaryBtn = document.createElement('button');
        summaryBtn.type = 'button';
        summaryBtn.className = 'x-jev-summary-btn';
        summaryBtn.title = 'Summarize with Gemini 3.5 Flash-Lite (Google AI Studio)';
        summaryBtn.innerHTML = '<span>✨</span><span>TL;DR</span>';
        summaryBtn.onclick = async (e) => {
          e.preventDefault();
          e.stopPropagation();

          if (summaryBtn.classList.contains('x-jev-loading')) return;

          const existingBox = postEl.querySelector('.x-jev-summary-box');
          if (existingBox && !existingBox.classList.contains('x-jev-hidden')) {
            existingBox.classList.add('x-jev-hidden');
            summaryBtn.classList.remove('x-jev-active');
            return;
          }

          if (summaryCache.has(item.text)) {
            renderSummaryBox(postEl, textEl, summaryCache.get(item.text), item.text);
            summaryBtn.classList.add('x-jev-active');
            return;
          }

          summaryBtn.classList.add('x-jev-loading');
          summaryBtn.innerHTML = '<span>⏳</span><span>Summarizing...</span>';

          try {
            const bullets = await requestPostSummary(item.text);
            renderSummaryBox(postEl, textEl, bullets, item.text);
            summaryBtn.classList.remove('x-jev-loading');
            summaryBtn.classList.add('x-jev-active');
            summaryBtn.innerHTML = '<span>✨</span><span>TL;DR</span>';
          } catch (err) {
            summaryBtn.classList.remove('x-jev-loading');
            summaryBtn.innerHTML = '<span>⚠️</span><span>Failed</span>';
            setTimeout(() => {
              summaryBtn.innerHTML = '<span>✨</span><span>TL;DR</span>';
            }, 3000);
          }
        };
        container.appendChild(summaryBtn);
      }
    }
    const topEntry = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    const assignedLabels = selectedBadges.length > 0
      ? selectedBadges.map((b) => b.label)
      : (topEntry && topEntry[1] >= CONFIG.confidenceThreshold ? [topEntry[0]] : []);
    checkAndApplyFocusCollapse(postEl, textEl, assignedLabels);
    postEl.setAttribute('data-jev-handled', 'true');
  }

  async function flushQueue() {
    if (queue.length === 0) return;

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
          }
        });
        saveCacheToStorage();
      } else {
        uncachedIndices.forEach((idx) => {
          const item = currentBatch[idx];
          if (item && item.postEl) {
            item.postEl.removeAttribute('data-jev-scanned');
          }
        });
      }
    }

    if (queue.length > 0) {
      debounceTimer = setTimeout(flushQueue, 80);
    }
  }

  function scanFeed() {
    let newScanned = false;
    document.querySelectorAll('article[data-testid="tweet"]:not([data-jev-scanned]), div[data-testid="cellInnerDiv"]:not(:has(article[data-testid="tweet"])):not([data-jev-scanned])').forEach((post) => {
      const textEl = post.querySelector('div[data-testid="tweetText"]');
      if (textEl) {
        let text = textEl.innerText.trim();
        text = text.replace(/\s*(Translate|Xem bản dịch)$/i, '').trim();
        if (text.length >= 2) {
          post.setAttribute('data-jev-scanned', 'true');
          scannedCount++;
          newScanned = true;
          if (textCache.has(text)) {
            renderClassification({ postEl: post, text, textEl }, textCache.get(text));
          } else {
            queue.push({ postEl: post, text, textEl });
          }
        }
      }
    });

    if (newScanned) {
      updatePill();
    }

    if (queue.length > 0) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(flushQueue, CONFIG.batchDebounceMs);
    }
  }

  let scanTimer = null;
  function scheduleScan() {
    if (scanTimer) return;
    scanTimer = setTimeout(() => {
      scanFeed();
      scanTimer = null;
    }, 150);
  }

  const observer = new MutationObserver(() => scheduleScan());
  function initObserver() {
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
      scanFeed();
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.body, { childList: true, subtree: true });
        scanFeed();
      });
    }

    setInterval(() => {
      initPill();
      scheduleScan();
    }, 1500);

    let lastUrl = location.href;
    setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        scheduleScan();
      }
    }, 500);
  }

  initObserver();
  console.log(`[Social Shield] Active on X (${window.location.hostname}) 🛡️`);
})();

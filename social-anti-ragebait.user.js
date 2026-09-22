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
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @connect      classifier.dev
// @connect      generativelanguage.googleapis.com
// @connect      twimg.com
// @connect      pbs.twimg.com
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const DEFAULT_GEMINI_API_KEY = '';
  const DEFAULT_GEMINI_PROMPT = 'Summarize the following social media post into exactly 3 concise, high-signal bullet points in the same language as the post (Vietnamese or English). No intro, no filler, strictly 3 bullet points starting with -:';

  const CONFIG = {
    apiEndpoint: 'https://classifier.dev',
    geminiApiKey: DEFAULT_GEMINI_API_KEY,
    geminiPrompt: DEFAULT_GEMINI_PROMPT,
    batchDebounceMs: 35,
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

  if (typeof GM_registerMenuCommand !== 'undefined') {
    GM_registerMenuCommand('⚙️ Configure Gemini API Key (TL;DR)', () => {
      const current = CONFIG.geminiApiKey || '';
      const input = prompt('Enter your Google AI Studio Gemini API Key for TL;DR post summaries:', current);
      if (input !== null) {
        const trimmed = input.trim();
        CONFIG.geminiApiKey = trimmed;
        if (typeof GM_setValue !== 'undefined') {
          GM_setValue('social_shield_gemini_api_key', trimmed);
        }
        try { localStorage.setItem('social_shield_gemini_api_key', trimmed); } catch (e) {}
        alert(trimmed ? 'Gemini API Key saved!' : 'Gemini API Key cleared.');
      }
    });

    GM_registerMenuCommand('📝 Configure Gemini Summary Prompt', () => {
      const current = CONFIG.geminiPrompt || DEFAULT_GEMINI_PROMPT;
      const input = prompt('Enter your custom Gemini summarization prompt:', current);
      if (input !== null) {
        const trimmed = input.trim() || DEFAULT_GEMINI_PROMPT;
        CONFIG.geminiPrompt = trimmed;
        summaryCache.clear();
        if (typeof GM_setValue !== 'undefined') {
          GM_setValue('social_shield_gemini_prompt', trimmed);
          GM_deleteValue(SUMMARY_CACHE_KEY);
        }
        try {
          localStorage.setItem('social_shield_gemini_prompt', trimmed);
          localStorage.removeItem(SUMMARY_CACHE_KEY);
        } catch (e) {}
        alert('Gemini summary prompt updated! Cache cleared.');
      }
    });
  }

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
    .x-jev-badge-text {
      max-width: 140px !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
    }
    body.x-jev-single-tag-mode .x-jev-badge-container .x-jev-badge:not(.x-jev-hidden) ~ .x-jev-badge:not(.x-jev-hidden) {
      display: none !important;
    }
    .x-jev-confidence {
      display: inline !important;
      font-family: "Geist Mono", monospace !important;
      font-size: 10px !important;
      color: #737373 !important;
      font-weight: 500 !important;
      margin-left: 2px !important;
      letter-spacing: -0.01em !important;
      transition: color 0.15s ease !important;
    }
    .x-jev-badge:hover .x-jev-confidence {
      color: #ededed !important;
    }
    .x-jev-more-badge {
      display: none !important;
      align-items: center !important;
      justify-content: center !important;
      height: 18px !important;
      padding: 1px 5px !important;
      border-radius: 4px !important;
      box-sizing: border-box !important;
      font-family: "Geist Mono", monospace !important;
      font-size: 10px !important;
      font-weight: 500 !important;
      color: #737373 !important;
      background: #000000 !important;
      border: 1px solid #262626 !important;
      cursor: pointer !important;
      user-select: none !important;
      transition: all 0.15s ease !important;
      white-space: nowrap !important;
      flex-shrink: 0 !important;
      vertical-align: middle !important;
      line-height: 1 !important;
    }
    .x-jev-more-badge:hover {
      border-color: #444444 !important;
      color: #ededed !important;
      background: #0f0f0f !important;
    }
    body.x-jev-single-tag-mode .x-jev-more-badge {
      display: inline-flex !important;
    }
    .x-jev-popover {
      position: fixed !important;
      z-index: 10000000 !important;
      min-width: 220px !important;
      max-width: 280px !important;
      max-height: calc(100vh - 32px) !important;
      overflow-y: auto !important;
      background: rgba(0, 0, 0, 0.94) !important;
      backdrop-filter: blur(16px) !important;
      -webkit-backdrop-filter: blur(16px) !important;
      border: 1px solid #262626 !important;
      border-radius: 8px !important;
      padding: 10px 12px !important;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.06) !important;
      box-sizing: border-box !important;
      font-family: "Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      pointer-events: auto !important;
      opacity: 0 !important;
      visibility: hidden !important;
      transform: translateY(4px) !important;
      transition: opacity 0.15s ease, transform 0.15s ease, visibility 0.15s ease !important;
    }
    .x-jev-popover.x-jev-popover-visible {
      opacity: 1 !important;
      visibility: visible !important;
      transform: translateY(0) !important;
    }
    .x-jev-popover-header {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      padding-bottom: 7px !important;
      margin-bottom: 8px !important;
      border-bottom: 1px solid #1f1f1f !important;
    }
    .x-jev-popover-title {
      display: inline-flex !important;
      align-items: center !important;
      gap: 5px !important;
      font-size: 11px !important;
      font-weight: 600 !important;
      color: #ededed !important;
      letter-spacing: -0.01em !important;
    }
    .x-jev-popover-icon {
      color: #a78bfa !important;
      font-size: 11px !important;
    }
    .x-jev-popover-badge {
      font-family: "Geist Mono", monospace !important;
      font-size: 9px !important;
      color: #71717a !important;
      background: #121212 !important;
      border: 1px solid #27272a !important;
      padding: 1px 4px !important;
      border-radius: 3px !important;
    }
    .x-jev-popover-list {
      display: flex !important;
      flex-direction: column !important;
      gap: 7px !important;
    }
    .x-jev-popover-item {
      display: flex !important;
      flex-direction: column !important;
      gap: 3px !important;
    }
    .x-jev-popover-item-header {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      font-size: 11px !important;
      line-height: 1.2 !important;
    }
    .x-jev-popover-item-label {
      display: inline-flex !important;
      align-items: center !important;
      gap: 5px !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
      max-width: 180px !important;
    }
    .x-jev-popover-dot {
      width: 6px !important;
      height: 6px !important;
      border-radius: 50% !important;
      flex-shrink: 0 !important;
      display: inline-block !important;
    }
    .x-jev-popover-name {
      color: #d4d4d4 !important;
      font-weight: 500 !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
    }
    .x-jev-popover-top-tag {
      font-family: "Geist Mono", monospace !important;
      font-size: 8.5px !important;
      font-weight: 600 !important;
      color: #a78bfa !important;
      background: rgba(167, 139, 250, 0.12) !important;
      border: 1px solid rgba(167, 139, 250, 0.25) !important;
      padding: 0 3px !important;
      border-radius: 2px !important;
      line-height: 12px !important;
    }
    .x-jev-popover-percent {
      font-family: "Geist Mono", monospace !important;
      font-size: 10.5px !important;
      font-weight: 500 !important;
      color: #a1a1aa !important;
      font-variant-numeric: tabular-nums !important;
      flex-shrink: 0 !important;
      margin-left: 6px !important;
    }
    .x-jev-popover-bar-track {
      width: 100% !important;
      height: 3.5px !important;
      background: #18181b !important;
      border-radius: 2px !important;
      overflow: hidden !important;
    }
    .x-jev-popover-bar-fill {
      height: 100% !important;
      border-radius: 2px !important;
      transition: width 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
    }
    .x-jev-popover-footer {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      margin-top: 8px !important;
      padding-top: 6px !important;
      border-top: 1px solid #1a1a1a !important;
      font-size: 9.5px !important;
      color: #71717a !important;
      font-family: "Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    }
    .x-jev-popover-threshold {
      font-family: "Geist Mono", monospace !important;
      color: #52525b !important;
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
      padding: 12px 16px !important;
      background: #000000 !important;
      border: 1.5px solid #22c55e !important;
      border-radius: 6px !important;
      font-family: "Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      font-size: 18px !important;
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
      font-size: 13px !important;
      font-weight: 600 !important;
      color: #22c55e !important;
      letter-spacing: -0.01em !important;
    }
    .x-jev-summary-close {
      background: transparent !important;
      border: none !important;
      color: #737373 !important;
      font-size: 12px !important;
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
      padding-left: 20px !important;
      list-style-type: disc !important;
    }
    .x-jev-summary-list li {
      margin-bottom: 6px !important;
      font-size: 18px !important;
      color: #ededed !important;
      line-height: 1.5 !important;
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

  // Two-Tier Persistent Storage for Jev Classification (L1 RAM + L2 Storage)
  const JEV_CACHE_KEY = `social_guardian_jev_cache_v1`;
  const JEV_SIG_KEY = `social_guardian_jev_taxonomy_sig`;
  const MAX_JEV_CACHE_SIZE = 1500;
  const textCache = new Map();

  // Fast synchronous bootstrap from sessionStorage (0ms)
  try {
    const raw = sessionStorage.getItem(JEV_CACHE_KEY);
    const storedSig = sessionStorage.getItem(JEV_SIG_KEY);
    const currentSig = typeof getTaxonomySignature === 'function' ? getTaxonomySignature(CONFIG) : '';
    if (raw) {
      if (storedSig && currentSig && storedSig !== currentSig) {
        sessionStorage.removeItem(JEV_CACHE_KEY);
        sessionStorage.removeItem(JEV_SIG_KEY);
      } else {
        const parsed = JSON.parse(raw);
        Object.entries(parsed).forEach(([k, v]) => textCache.set(k, v));
      }
    }
  } catch (e) {}

  // Hydrate from L2 Persistent Storage across tabs & sessions with strict signature validation
  try {
    let l2Raw = null;
    let storedSig = null;
    if (typeof GM_getValue !== 'undefined') {
      l2Raw = GM_getValue(JEV_CACHE_KEY, null);
      storedSig = GM_getValue(JEV_SIG_KEY, null);
    }
    if (!l2Raw) {
      const localStr = localStorage.getItem(JEV_CACHE_KEY);
      if (localStr) l2Raw = JSON.parse(localStr);
      storedSig = localStorage.getItem(JEV_SIG_KEY);
    } else if (typeof l2Raw === 'string') {
      try { l2Raw = JSON.parse(l2Raw); } catch (e) {}
    }

    const currentSig = typeof getTaxonomySignature === 'function' ? getTaxonomySignature(CONFIG) : '';
    if (l2Raw && typeof l2Raw === 'object' && storedSig && storedSig === currentSig) {
      Object.entries(l2Raw)
        .slice(-MAX_JEV_CACHE_SIZE)
        .forEach(([k, v]) => {
          if (v && typeof v === 'object') {
            textCache.set(k, v);
          }
        });
    } else {
      // Stale or missing signature: clear everything
      textCache.clear();
      sessionStorage.removeItem(JEV_CACHE_KEY);
      sessionStorage.removeItem(JEV_SIG_KEY);
      try {
        if (typeof GM_deleteValue !== 'undefined') {
          GM_deleteValue(JEV_CACHE_KEY);
          GM_deleteValue(JEV_SIG_KEY);
        }
        if (typeof GM_setValue !== 'undefined') {
          GM_setValue(JEV_CACHE_KEY, null);
          GM_setValue(JEV_SIG_KEY, null);
        }
        localStorage.removeItem(JEV_CACHE_KEY);
        localStorage.removeItem(JEV_SIG_KEY);
      } catch (e) {}
    }
  } catch (e) {}

  let saveJevDebounceTimer = null;
  function saveCacheToStorage() {
    try {
      while (textCache.size > MAX_JEV_CACHE_SIZE) {
        const oldestKey = textCache.keys().next().value;
        textCache.delete(oldestKey);
      }
      const obj = {};
      textCache.forEach((v, k) => (obj[k] = v));
      sessionStorage.setItem(JEV_CACHE_KEY, JSON.stringify(obj));
      const sig = typeof getTaxonomySignature === 'function' ? getTaxonomySignature(CONFIG) : '';
      if (sig) sessionStorage.setItem(JEV_SIG_KEY, sig);

      // Debounced commit to L2 Persistent Storage to avoid I/O thrashing during active feed scrolling
      clearTimeout(saveJevDebounceTimer);
      saveJevDebounceTimer = setTimeout(() => {
        try {
          if (typeof GM_setValue !== 'undefined') {
            GM_setValue(JEV_CACHE_KEY, obj);
            GM_setValue(JEV_SIG_KEY, sig);
          } else {
            localStorage.setItem(JEV_CACHE_KEY, JSON.stringify(obj));
            localStorage.setItem(JEV_SIG_KEY, sig);
          }
        } catch (e) {}
      }, 600);
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

  function getTaxonomySignature(cfg = {}) {
    const tax = getActiveTaxonomy(cfg);
    const labelsStr = (tax.labels || []).slice().sort().join(',');
    return `${labelsStr}::${tax.instructions || ''}`;
  }

  function isElementInViewport(el) {
    if (!el || typeof el.getBoundingClientRect !== 'function') return false;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const vh = window.innerHeight || document.documentElement.clientHeight || 800;
    const vw = window.innerWidth || document.documentElement.clientWidth || 1200;
    return rect.bottom >= -150 && rect.top <= vh + 150 && rect.right >= 0 && rect.left <= vw;
  }

  const inFlightJevWaiters = new Map(); // text -> Array<{ postEl, textEl }>
  const MAX_CONCURRENT_BATCHES = 3;
  let activeBatches = 0;
  let jevCooldownUntil = 0;
  let queue = [];
  let queueStartTime = 0;
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
    'pointerdown',
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
      parts.push(`<span class="x-jev-pill-focus-toggle" title="Click to pause feed filtering" style="cursor:pointer;">Filtered: <span style="color:#ededed; font-family:'Geist Mono',monospace;">${focusCollapsedCount}</span></span>`);
    } else if (focusCollapsedCount > 0 && !CONFIG.focusModeEnabled) {
      parts.push(`<span class="x-jev-pill-focus-toggle" title="Click to resume feed filtering" style="cursor:pointer;opacity:0.6;">Filtered: <span style="color:#fb923c; font-family:'Geist Mono',monospace;">PAUSED</span></span>`);
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

    // Curated & Custom Badges State
    document.querySelectorAll('.x-jev-badge').forEach((badge) => {
      const cat = badge.getAttribute('data-jev-badge-category');
      const catLower = cat?.trim().toLowerCase();
      const def = TAXONOMY_CATALOG[cat] || (catLower ? TAXONOMY_CATALOG[catLower] : undefined);
      let isHidden = false;
      if (catLower === 'other / casual discussion' && window.location.pathname.includes('/activity')) {
        isHidden = true;
      } else if (def && CONFIG.categoryActions && def.tagKey) {
        isHidden = CONFIG.categoryActions[def.tagKey] === 'off';
      } else if (def && CONFIG[def.configKey] === false) {
        isHidden = true;
      } else if (Array.isArray(CONFIG.customLabels)) {
        const customFound = CONFIG.customLabels.find(
          (c) => (typeof c === 'string' ? c : c?.name)?.trim().toLowerCase() === catLower
        );
        if (customFound && typeof customFound === 'object') {
          const action = customFound.action || (customFound.enabled === false ? 'off' : 'show');
          if (action === 'off') isHidden = true;
        } else if (!customFound && !def && catLower !== 'other / casual discussion') {
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

    // Synchronize +N more badge visibility and count
    document.querySelectorAll('.x-jev-badge-container').forEach((container) => {
      const visibleBadges = container.querySelectorAll('.x-jev-badge:not(.x-jev-hidden)');
      const moreBadge = container.querySelector('.x-jev-more-badge');
      if (moreBadge) {
        const totalEligible = parseInt(container.dataset.jevEligibleCount, 10) || visibleBadges.length;
        const hiddenCount = container.querySelectorAll('.x-jev-badge.x-jev-hidden').length;
        const activeEligible = Math.max(0, totalEligible - hiddenCount);
        if (activeEligible > 1 && visibleBadges.length > 0) {
          moreBadge.textContent = `+${activeEligible - 1}`;
          moreBadge.title = `+${activeEligible - 1} more matching categories (hover to view all)`;
          moreBadge.style.removeProperty('display');
        } else {
          moreBadge.style.setProperty('display', 'none', 'important');
        }
      }
    });

    // Restore bypassed posts if taxonomy is enabled
    const activeTaxonomy = getActiveTaxonomy(CONFIG);
    if (activeTaxonomy.labels && activeTaxonomy.labels.length > 0) {
      let restoredCount = 0;
      document.querySelectorAll('[data-jev-bypassed="true"]').forEach((post) => {
        post.removeAttribute('data-jev-bypassed');
        post.removeAttribute('data-jev-scanned');
        post.removeAttribute('data-jev-handled');
        restoredCount++;
      });
      if (restoredCount > 0 && typeof scheduleScan === 'function') {
        scheduleScan();
      }
    }

    // Feed Content Filter & Focus Mode: Re-evaluate state on all classified posts
    document.querySelectorAll('[data-jev-assigned-label]').forEach((post) => {
      const assignedLabel = post.getAttribute('data-jev-assigned-label');
      const shouldHide = isPostHidden(assignedLabel);
      const bar = post.querySelector('.x-jev-focus-bar');
      const textEl = post.querySelector('[data-jev-tracked-text="true"]') || post.querySelector('span[dir="auto"], div[dir="auto"]');

      if (shouldHide) {
        post.setAttribute('data-jev-focus-offtag', 'true');
        if (textEl) textEl.classList.add('x-jev-focus-collapsed-content');
        post.querySelectorAll('img, video, .x-jev-badge, .x-jev-badge-container, .x-jev-summary-box').forEach((m) => {
          if (!m.closest('a[href*="/@"]') && !m.closest('[data-testid="Tweet-User-Avatar"]')) m.classList.add('x-jev-focus-collapsed-content');
        });
        if (!bar && textEl) {
          createFocusBar(post, textEl, assignedLabel);
        } else if (bar) {
          bar.classList.remove('x-jev-hidden');
          bar.style.removeProperty('display');
        }
      } else {
        post.removeAttribute('data-jev-focus-offtag');
        if (textEl) textEl.classList.remove('x-jev-focus-collapsed-content');
        post.querySelectorAll('.x-jev-focus-collapsed-content').forEach((m) => {
          m.classList.remove('x-jev-focus-collapsed-content');
        });
        if (bar) {
          bar.classList.add('x-jev-hidden');
          bar.style.setProperty('display', 'none', 'important');
        }
        post.classList.remove('x-jev-focus-expanded');
      }
    });
  }

  async function callJevBatch(inputs) {
    const taxonomy = getActiveTaxonomy(CONFIG);
    if (!taxonomy.labels || taxonomy.labels.length < 2) {
      const fallback = inputs.map(() => ({
        label: CATCH_ALL_LABEL,
        confidence: 1,
        scores: { [CATCH_ALL_LABEL]: 1 },
      }));
      fallback.status = 200;
      return fallback;
    }

    return new Promise((resolve) => {
      if (typeof GM_xmlhttpRequest !== 'undefined') {
        GM_xmlhttpRequest({
          method: 'POST',
          url: `${CONFIG.apiEndpoint}/`,
          headers: { 'Content-Type': 'application/json' },
          timeout: 25000,
          data: JSON.stringify({
            labels: taxonomy.labels,
            inputs: inputs,
            instructions: taxonomy.instructions,
          }),
          onload: (res) => {
            try {
              const data = JSON.parse(res.responseText);
              const results = data.results || [];
              results.status = res.status || 200;
              resolve(results);
            } catch (e) {
              const errArr = [];
              errArr.status = res.status || 500;
              resolve(errArr);
            }
          },
          onerror: (err) => {
            const errArr = [];
            errArr.status = err?.status || 500;
            resolve(errArr);
          },
          ontimeout: () => {
            const errArr = [];
            errArr.status = 408;
            resolve(errArr);
          },
        });
      } else {
        fetch(`${CONFIG.apiEndpoint}/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(25000) : undefined,
          body: JSON.stringify({
            labels: taxonomy.labels,
            inputs: inputs,
            instructions: taxonomy.instructions,
          }),
        })
          .then(async (r) => {
            if (!r.ok) {
              const errArr = [];
              errArr.status = r.status;
              return errArr;
            }
            const d = await r.json();
            const results = d.results || [];
            results.status = r.status;
            return results;
          })
          .then(resolve)
          .catch((err) => {
            const errArr = [];
            errArr.status = err?.name === 'TimeoutError' ? 408 : 500;
            resolve(errArr);
          });
      }
    });
  }

  function getPostTagKey(label) {
    if (!label || typeof label !== 'string' || !label.trim()) return null;
    const normalized = label.trim().toLowerCase();
    if (normalized === 'other / casual discussion') return 'casual';
    if (Array.isArray(CONFIG.customLabels)) {
      const isCustom = CONFIG.customLabels.some(
        (c) => (typeof c === 'string' ? c : c?.name)?.trim().toLowerCase() === normalized
      );
      if (isCustom) return 'custom';
    }
    return null;
  }

  function getDisplayLabelName(label) {
    if (label?.trim().toLowerCase() === 'other / casual discussion') return 'Casual';
    if (Array.isArray(CONFIG.customLabels)) {
      const found = CONFIG.customLabels.find(
        (c) => (typeof c === 'string' ? c : c?.name)?.trim().toLowerCase() === label?.trim().toLowerCase()
      );
      if (found) return typeof found === 'object' ? found.name : found;
    }
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
      if (tagKey && CONFIG.categoryActions?.[tagKey] === 'hide') return true;

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

  // --- GEMINI 3.5 FLASH-LITE POST SUMMARIZER (HYBRID 2-TIER CACHE + IN-FLIGHT DEDUPLICATION) ---
  const SUMMARY_CACHE_KEY = 'social_guardian_summary_cache_v1';
  const MAX_SUMMARY_CACHE_SIZE = 500;
  const summaryCache = new Map();
  const inFlightSummaries = new Map();

  // Hydrate L1 in-memory cache from L2 persistent storage (GM_getValue / localStorage)
  try {
    let raw = null;
    if (typeof GM_getValue !== 'undefined') {
      raw = GM_getValue(SUMMARY_CACHE_KEY, null);
    }
    if (!raw) {
      const localRaw = localStorage.getItem(SUMMARY_CACHE_KEY);
      if (localRaw) raw = JSON.parse(localRaw);
    } else if (typeof raw === 'string') {
      try { raw = JSON.parse(raw); } catch (e) {}
    }
    if (raw && typeof raw === 'object') {
      Object.entries(raw)
        .slice(-MAX_SUMMARY_CACHE_SIZE)
        .forEach(([k, v]) => {
          if (Array.isArray(v) && v.length > 0) {
            summaryCache.set(k, v);
          }
        });
    }
  } catch (e) {}

  function getSummaryFromStorage(text) {
    try {
      let raw = null;
      if (typeof GM_getValue !== 'undefined') {
        raw = GM_getValue(SUMMARY_CACHE_KEY, null);
      }
      if (!raw) {
        const localRaw = localStorage.getItem(SUMMARY_CACHE_KEY);
        if (localRaw) raw = JSON.parse(localRaw);
      } else if (typeof raw === 'string') {
        try { raw = JSON.parse(raw); } catch (e) {}
      }
      if (raw && typeof raw === 'object') {
        return raw[text] || null;
      }
    } catch (e) {}
    return null;
  }

  function saveSummaryCache(text, bullets) {
    summaryCache.delete(text);
    summaryCache.set(text, bullets);
    // True LRU eviction: evict oldest entry when size exceeds MAX_SUMMARY_CACHE_SIZE
    while (summaryCache.size > MAX_SUMMARY_CACHE_SIZE) {
      const oldestKey = summaryCache.keys().next().value;
      summaryCache.delete(oldestKey);
    }
    try {
      const obj = {};
      summaryCache.forEach((v, k) => (obj[k] = v));
      if (typeof GM_setValue !== 'undefined') {
        GM_setValue(SUMMARY_CACHE_KEY, obj);
      } else {
        localStorage.setItem(SUMMARY_CACHE_KEY, JSON.stringify(obj));
      }
    } catch (e) {}
  }

  function extractPostImages(postEl) {
    if (!postEl || !postEl.querySelectorAll) return [];
    const urls = [];
    const seen = new Set();

    // 1. Still photos (tweets and X articles)
    const imgs = Array.from(postEl.querySelectorAll('div[data-testid="tweetPhoto"] img, img[src*="pbs.twimg.com/media/"]'));
    for (const img of imgs) {
      let src = img.getAttribute ? (img.getAttribute('src') || img.src) : img.src;
      if (!src || src.startsWith('data:') || seen.has(src)) continue;
      if (src.includes('/emoji/') || src.includes('profile_images') || src.includes('profile_banners')) continue;
      seen.add(src);
      urls.push(src);
      if (urls.length >= 4) break;
    }

    // 2. Video / GIF poster thumbnails if slots remain
    if (urls.length < 4) {
      const videos = Array.from(postEl.querySelectorAll('div[data-testid="videoPlayer"] video, div[data-testid="videoComponent"] video, video[poster]'));
      for (const vid of videos) {
        let poster = vid.getAttribute ? (vid.getAttribute('poster') || vid.poster) : vid.poster;
        if (!poster || poster.startsWith('data:') || seen.has(poster)) continue;
        seen.add(poster);
        urls.push(poster);
        if (urls.length >= 4) break;
      }
    }

    return urls;
  }

  function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    const chunkSize = 8192;
    for (let i = 0; i < len; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
      binary += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binary);
  }

  async function fetchImageAsBase64(url) {
    let fetchUrl = url;
    if (typeof fetchUrl === 'string' && fetchUrl.includes('twimg.com')) {
      fetchUrl = fetchUrl.replace(/name=[a-zA-Z0-9]+/, 'name=small');
    }
    return new Promise((resolve) => {
      if (typeof GM_xmlhttpRequest !== 'undefined') {
        GM_xmlhttpRequest({
          method: 'GET',
          url: fetchUrl,
          responseType: 'arraybuffer',
          timeout: 6000,
          onload: (r) => {
            if (r.status >= 200 && r.status < 300 && r.response) {
              const rawMime = (r.responseHeaders && r.responseHeaders.match(/content-type:\s*([^\r\n;]+)/i)?.[1]) || 'image/jpeg';
              const mime = rawMime.trim().startsWith('image/') ? rawMime.trim() : 'image/jpeg';
              const base64 = arrayBufferToBase64(r.response);
              resolve(base64 ? { inlineData: { mimeType: mime, data: base64 } } : null);
            } else {
              resolve(null);
            }
          },
          onerror: () => resolve(null),
          ontimeout: () => resolve(null),
        });
      } else {
        fetch(fetchUrl, { signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined })
          .then(async (res) => {
            if (!res.ok) return null;
            const contentType = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
            const mime = contentType.startsWith('image/') ? contentType : 'image/jpeg';
            const buf = await res.arrayBuffer();
            const base64 = arrayBufferToBase64(buf);
            return base64 ? { inlineData: { mimeType: mime, data: base64 } } : null;
          })
          .then(resolve)
          .catch(() => resolve(null));
      }
    });
  }

  async function requestPostSummary(text, imageUrls = []) {
    const cacheKey = (Array.isArray(imageUrls) && imageUrls.length > 0)
      ? `${text}::imgs:${imageUrls.join(',')}`
      : text;

    // 1. Fast L1 Memory cache hit (0ms) - True LRU refresh to MRU
    if (summaryCache.has(cacheKey)) {
      const cached = summaryCache.get(cacheKey);
      summaryCache.delete(cacheKey);
      summaryCache.set(cacheKey, cached);
      return cached;
    }

    // 2. In-flight Request Deduplication: return existing pending promise
    if (inFlightSummaries.has(cacheKey)) {
      return inFlightSummaries.get(cacheKey);
    }

    const summaryPromise = (async () => {
      // 3. Fallback to L2 Persistent Storage across tab reloads
      const cachedBullets = getSummaryFromStorage(cacheKey);
      if (Array.isArray(cachedBullets) && cachedBullets.length > 0) {
        summaryCache.delete(cacheKey);
        summaryCache.set(cacheKey, cachedBullets);
        while (summaryCache.size > MAX_SUMMARY_CACHE_SIZE) {
          const oldestKey = summaryCache.keys().next().value;
          summaryCache.delete(oldestKey);
        }
        return cachedBullets;
      }

      // Fetch images if present
      const imageParts = [];
      if (Array.isArray(imageUrls) && imageUrls.length > 0) {
        try {
          const resolved = await Promise.all(imageUrls.slice(0, 3).map(fetchImageAsBase64));
          for (const imgPart of resolved) {
            if (imgPart) imageParts.push(imgPart);
          }
        } catch (e) {}
      }

      // 4. Perform Network Request via GM_xmlhttpRequest or fetch
      return new Promise((resolve, reject) => {
        const apiKey = (CONFIG.geminiApiKey || DEFAULT_GEMINI_API_KEY).trim();
        if (!apiKey) {
          reject(new Error('Google AI Studio API key missing. Please enter your API key in extension settings.'));
          return;
        }
        const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent';
        const baseInstruction = (typeof CONFIG.geminiPrompt === 'string' && CONFIG.geminiPrompt.trim().length > 0)
          ? CONFIG.geminiPrompt.trim()
          : DEFAULT_GEMINI_PROMPT;
        const formattedInstruction = /[:.?!]$/.test(baseInstruction)
          ? baseInstruction
          : baseInstruction + ':';
        const prompt = formattedInstruction + '\n\n' + text.trim();
        const payload = {
          contents: [{ role: 'user', parts: [{ text: prompt }, ...imageParts] }],
          generationConfig: {
            maxOutputTokens: 250,
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
              saveSummaryCache(cacheKey, bullets);
              resolve(bullets);
            } else {
              resolve([]);
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
            timeout: 20000,
            onload: (r) => {
              if (r.status >= 200 && r.status < 300) {
                handler(r.responseText);
              } else {
                try {
                  const errData = JSON.parse(r.responseText);
                  reject(new Error(errData?.error?.message || `HTTP ${r.status}: Summarization failed`));
                } catch (e) {
                  reject(new Error(`HTTP ${r.status}: Summarization failed`));
                }
              }
            },
            onerror: (err) => reject(err),
            ontimeout: () => reject(new Error('Summary request timed out')),
            onabort: () => reject(new Error('Summary request aborted')),
          });
        } else {
          fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey,
            },
            signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(20000) : undefined,
            body: JSON.stringify(payload),
          })
            .then(async (r) => {
              if (!r.ok) {
                const errText = await r.text();
                try {
                  const errData = JSON.parse(errText);
                  throw new Error(errData?.error?.message || `HTTP ${r.status}`);
                } catch (e) {
                  throw new Error(`HTTP ${r.status}`);
                }
              }
              return r.text();
            })
            .then(handler)
            .catch(reject);
        }
      });
    })();

    inFlightSummaries.set(cacheKey, summaryPromise);
    try {
      return await summaryPromise;
    } finally {
      inFlightSummaries.delete(cacheKey);
    }
  }

  const clean = (txt) => (txt || '').replace(/\s*(Translate|Xem bản dịch|Show more|Hiển thị thêm|Xem thêm)$/i, '').trim();

  const cleanCommunityNote = (txt) => {
    if (!txt) return '';
    const lines = txt.split('\n').map((l) => l.trim()).filter(Boolean);
    const filtered = lines.filter((line) => {
      if (/^(readers added context|context added by readers|độc giả đã thêm ngữ cảnh|ghi chú cộng đồng)/i.test(line)) {
        return false;
      }
      if (/^(do you find this helpful|rate (it|this note)|helpful\?|bạn có thấy (điều này|ghi chú)|đánh giá ghi chú)/i.test(line)) {
        return false;
      }
      return true;
    });
    return filtered.join('\n').trim();
  };

  function extractPostTextForJev(postEl, textEl) {
    if (!textEl && !postEl) return '';
    const parts = [];

    // 1. Repost / Retweet context (e.g. "X reposted")
    const socialContextEl = postEl.querySelector ? postEl.querySelector('[data-testid="socialContext"]') : null;
    if (socialContextEl && socialContextEl.innerText) {
      const contextText = clean(socialContextEl.innerText);
      if (contextText) parts.push(`[${contextText}]`);
    }

    // 2. Main post text
    const mainText = textEl && textEl.innerText ? clean(textEl.innerText) : '';
    if (mainText) parts.push(mainText);

    // 3. Quoted Tweet text & container detection
    const allTextEls = postEl.querySelectorAll ? Array.from(postEl.querySelectorAll('[data-testid="tweetText"]')) : [];
    let quoteContainer = null;
    let quotedTextPart = null;

    if (allTextEls.length > 1) {
      const quotedTextEls = allTextEls.filter((el) => el !== textEl);
      const quotedTexts = quotedTextEls
        .map((el) => clean(el.innerText))
        .filter((txt) => txt.length > 0 && txt !== mainText);

      if (quotedTexts.length > 0) {
        quotedTextPart = `[Quoted Post:\n${quotedTexts.join('\n---\n')}]`;
      }

      if (quotedTextEls[0]) {
        let curr = quotedTextEls[0];
        while (curr.parentElement && curr.parentElement !== postEl && (!textEl || !curr.parentElement.contains(textEl))) {
          curr = curr.parentElement;
        }
        quoteContainer = curr;
      }
    }

    if (!quoteContainer && postEl.querySelector) {
      quoteContainer = postEl.querySelector('[data-testid="quoteTweet"]');
    }

    // 4. Community Notes on Root Post & Quoted Post
    const noteEls = postEl.querySelectorAll
      ? Array.from(postEl.querySelectorAll('[data-testid="birdwatch-pivot"], [data-testid*="birdwatch"], [data-testid="community-note"]'))
      : [];

    let rootNotes = [];
    let quoteNotes = [];

    if (noteEls.length > 0) {
      const seenNotes = new Set();
      for (const noteEl of noteEls) {
        const rawNote = noteEl.innerText || noteEl.textContent || '';
        const cleanedNote = cleanCommunityNote(rawNote);
        if (!cleanedNote || seenNotes.has(cleanedNote)) continue;
        seenNotes.add(cleanedNote);

        const isQuoteNote = (quoteContainer && quoteContainer.contains(noteEl)) ||
          Boolean(noteEl.closest && noteEl.closest('[data-testid="quoteTweet"], [aria-label*="Quote" i]'));

        if (isQuoteNote) {
          quoteNotes.push(cleanedNote);
        } else {
          rootNotes.push(cleanedNote);
        }
      }
    }

    if (rootNotes.length > 0) {
      parts.push(`[Community Note on Post:\n${rootNotes.join('\n---\n')}]`);
    }
    if (quotedTextPart) {
      parts.push(quotedTextPart);
    }
    if (quoteNotes.length > 0) {
      parts.push(`[Community Note on Quoted Post:\n${quoteNotes.join('\n---\n')}]`);
    }

    const res = parts.join('\n\n').trim();
    return (res && res.length >= 2) ? res : (mainText || '');
  }

  async function expandAndExtractPostText(postEl, textEl, fallbackText) {
    if (!textEl && !postEl) return fallbackText || '';

    // Auto-expand "Show more" on long X posts if present
    const showMoreBtn = (postEl && postEl.querySelector('[data-testid="tweet-text-show-more-link"]')) ||
      (textEl && textEl.querySelector ? textEl.querySelector('[data-testid="tweet-text-show-more-link"]') : null);

    if (showMoreBtn) {
      try {
        showMoreBtn.click();
        // Wait up to 350ms for React virtual DOM expansion
        await new Promise((resolve) => {
          const startLen = (textEl ? textEl.textContent || '' : '').length;
          let settled = false;
          let observer = null;
          const done = () => {
            if (!settled) {
              settled = true;
              if (observer) observer.disconnect();
              resolve();
            }
          };
          const timer = setTimeout(done, 350);
          if (textEl && typeof MutationObserver !== 'undefined') {
            observer = new MutationObserver(() => {
              const currentLen = (textEl.textContent || '').length;
              if (!document.contains(showMoreBtn) || currentLen > startLen) {
                clearTimeout(timer);
                done();
              }
            });
            observer.observe(textEl, { childList: true, subtree: true, characterData: true });
          }
        });
      } catch (err) {
        console.warn('[Social Shield] Auto-expand Show more error:', err);
      }
    }

    let mainText = textEl && textEl.innerText ? clean(textEl.innerText) : '';
    if (!mainText && fallbackText) mainText = clean(fallbackText);

    if (postEl) {
      // Check if post is an X Long-form Article
      const articleTitleEl = postEl.querySelector ? (postEl.querySelector('[data-testid="twitter-article-title"]') || postEl.querySelector('h1')) : null;
      const articleBodyEl = postEl.querySelector ? postEl.querySelector('[data-testid="twitterArticleReadView"], [data-testid="twitter-article"]') : null;
      if (articleTitleEl || articleBodyEl) {
        const articleTitle = articleTitleEl ? clean(articleTitleEl.innerText) : '';
        const bodyParagraphs = [];
        const pEls = (articleBodyEl || postEl).querySelectorAll ? Array.from((articleBodyEl || postEl).querySelectorAll('p, div[dir="auto"]')) : [];
        for (const p of pEls) {
          if (p.closest && p.closest('button, [role="button"], nav')) continue;
          const pText = clean(p.innerText);
          if (pText && pText.length > 5 && pText !== articleTitle) {
            if (!bodyParagraphs.some((existing) => existing.includes(pText) || pText.includes(existing))) {
              bodyParagraphs.push(pText);
            }
          }
        }
        if (articleTitle || bodyParagraphs.length > 0) {
          let articleContent = [
            articleTitle ? `[Article Title: ${articleTitle}]` : '',
            ...bodyParagraphs,
          ].filter(Boolean).join('\n\n');
          if (articleContent.length > 35000) {
            articleContent = articleContent.slice(0, 35000) + '... [truncated]';
          }
          if (articleContent.length > mainText.length) {
            mainText = articleContent;
          }
        }
      }

      const parts = [];

      // 1. Repost / Retweet context (e.g., "X reposted")
      const socialContextEl = postEl.querySelector ? postEl.querySelector('[data-testid="socialContext"]') : null;
      if (socialContextEl && socialContextEl.innerText) {
        const contextText = clean(socialContextEl.innerText);
        if (contextText) {
          parts.push(`[${contextText}]`);
        }
      }

      // 2. Main post text
      if (mainText) {
        parts.push(mainText);
      }

      // 3. Quoted Tweet text & container detection
      const allTextEls = postEl.querySelectorAll ? Array.from(postEl.querySelectorAll('[data-testid="tweetText"]')) : [];
      let quoteContainer = null;
      let quotedTextPart = null;

      if (allTextEls.length > 1) {
        const quotedTextEls = allTextEls.filter((el) => el !== textEl);
        const quotedTexts = quotedTextEls
          .map((el) => clean(el.innerText))
          .filter((txt) => txt.length > 0 && txt !== mainText);

        if (quotedTexts.length > 0) {
          quotedTextPart = `[Quoted Post:\n${quotedTexts.join('\n---\n')}]`;
        }

        if (quotedTextEls[0]) {
          let curr = quotedTextEls[0];
          while (curr.parentElement && curr.parentElement !== postEl && (!textEl || !curr.parentElement.contains(textEl))) {
            curr = curr.parentElement;
          }
          quoteContainer = curr;
        }
      }

      if (!quoteContainer && postEl.querySelector) {
        quoteContainer = postEl.querySelector('[data-testid="quoteTweet"]');
      }

      // 4. Community Notes (Fact-checks / Birdwatch) on Root Post & Quoted Post
      const noteEls = postEl.querySelectorAll
        ? Array.from(postEl.querySelectorAll('[data-testid="birdwatch-pivot"], [data-testid*="birdwatch"], [data-testid="community-note"]'))
        : [];

      let rootNotes = [];
      let quoteNotes = [];

      if (noteEls.length > 0) {
        const seenNotes = new Set();
        for (const noteEl of noteEls) {
          const rawNote = noteEl.innerText || noteEl.textContent || '';
          const cleanedNote = cleanCommunityNote(rawNote);
          if (!cleanedNote || seenNotes.has(cleanedNote)) continue;
          seenNotes.add(cleanedNote);

          const isQuoteNote = (quoteContainer && quoteContainer.contains(noteEl)) ||
            Boolean(noteEl.closest && noteEl.closest('[data-testid="quoteTweet"], [aria-label*="Quote" i]'));

          if (isQuoteNote) {
            quoteNotes.push(cleanedNote);
          } else {
            rootNotes.push(cleanedNote);
          }
        }
      }

      if (rootNotes.length > 0) {
        parts.push(`[Community Note on Post:\n${rootNotes.join('\n---\n')}]`);
      }

      if (quotedTextPart) {
        parts.push(quotedTextPart);
      }

      if (quoteNotes.length > 0) {
        parts.push(`[Community Note on Quoted Post:\n${quoteNotes.join('\n---\n')}]`);
      }

      // 5. Video / GIF Media Context Note
      const hasVideo = postEl.querySelector && (
        postEl.querySelector('div[data-testid="videoPlayer"], div[data-testid="videoComponent"], video')
      );
      if (hasVideo) {
        const isGif = postEl.querySelector && (
          postEl.querySelector('[aria-label*="GIF" i], [data-testid="gifBadge"]') ||
          (typeof hasVideo.getAttribute === 'function' && hasVideo.getAttribute('aria-label')?.toLowerCase().includes('gif'))
        );
        if (isGif) {
          parts.push('[Media Note: Post includes an animated GIF. The provided image is its preview keyframe.]');
        } else {
          parts.push('[Media Note: Post includes a video clip. The provided image is its preview poster frame, not a standalone still photo.]');
        }
      }

      const combined = parts.join('\n\n').trim();
      return (combined && combined.length >= 2) ? combined : (fallbackText || '');
    }

    return (mainText && mainText.length >= 2) ? mainText : (fallbackText || '');
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

  function renderSummaryBox(postEl, textEl, bullets) {
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
      : `<div class="x-jev-summary-error"><span>⚠️</span><span>Unable to generate 3-bullet summary (content may be too brief or restricted by safety guidelines).</span></div>`;

    box.innerHTML = `
      <div class="x-jev-summary-header">
        <div class="x-jev-summary-title">
          <span>✨</span>
          <span>Gemini 3.5 Flash-Lite</span>
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

  // --- VERCEL-STYLED CONFIDENCE POPOVER MANAGER ---
  let popoverEl = null;
  let popoverHideTimer = null;
  let activeAnchor = null;

  function getOrCreatePopover() {
    if (!popoverEl || !document.contains(popoverEl)) {
      popoverEl = document.createElement('div');
      popoverEl.className = 'x-jev-popover';
      popoverEl.setAttribute('role', 'tooltip');
      popoverEl.addEventListener('mouseenter', () => {
        if (popoverHideTimer) {
          clearTimeout(popoverHideTimer);
          popoverHideTimer = null;
        }
      });
      popoverEl.addEventListener('mouseleave', () => {
        scheduleHidePopover(120);
      });
      document.body.appendChild(popoverEl);
    }
    return popoverEl;
  }

  function scheduleHidePopover(delay = 150) {
    if (popoverHideTimer) clearTimeout(popoverHideTimer);
    popoverHideTimer = setTimeout(() => {
      if (popoverEl) {
        popoverEl.classList.remove('x-jev-popover-visible');
      }
      activeAnchor = null;
    }, delay);
  }

  function updatePopoverPosition(anchorEl, popover) {
    if (!anchorEl || !popover) return;
    if (!document.contains(anchorEl)) {
      popover.classList.remove('x-jev-popover-visible');
      activeAnchor = null;
      return;
    }
    const rect = anchorEl.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = window.innerHeight;

    // If anchor is scrolled completely out of viewport, hide popover immediately
    if (rect.bottom < 0 || rect.top > viewportHeight || rect.right < 0 || rect.left > viewportWidth) {
      popover.classList.remove('x-jev-popover-visible');
      activeAnchor = null;
      return;
    }

    const popoverRect = popover.getBoundingClientRect();
    const margin = 8;

    let top = rect.top - popoverRect.height - margin;
    // If not enough room above, place below
    if (top < margin) {
      top = rect.bottom + margin;
    }
    // Bottom boundary clamp to prevent overflow
    if (top + popoverRect.height > viewportHeight - margin) {
      top = Math.max(margin, viewportHeight - popoverRect.height - margin);
    }

    let left = rect.left;
    if (left + popoverRect.width > viewportWidth - margin) {
      left = viewportWidth - popoverRect.width - margin;
    }
    if (left < margin) {
      left = margin;
    }

    popover.style.top = `${Math.round(top)}px`;
    popover.style.left = `${Math.round(left)}px`;
  }

  function showPopover(anchorEl, badgesList) {
    if (!badgesList || badgesList.length === 0) return;

    const activeThreshold = typeof CONFIG.confidenceThreshold === 'number' ? CONFIG.confidenceThreshold : 0.30;
    const currentBadges = badgesList
      .filter((item) => {
        if (!Number.isFinite(item.score)) return false;
        if (item.label === 'other / casual discussion') {
          if (window.location.pathname.includes('/activity')) return false;
          if (CONFIG.categoryActions && CONFIG.categoryActions.casual === 'off') return false;
          if (!CONFIG.categoryActions && CONFIG.filterCasualEnabled === false) return false;
        } else if (Array.isArray(CONFIG.customLabels)) {
          const custom = CONFIG.customLabels.find(
            (c) => (typeof c === 'string' ? c : c?.name)?.trim().toLowerCase() === item.label?.trim().toLowerCase()
          );
          if (custom && typeof custom === 'object' && (custom.action === 'off' || custom.enabled === false)) return false;
        }
        return true;
      })
      .slice(0, 4);

    if (currentBadges.length === 0) {
      scheduleHidePopover(0);
      return;
    }

    if (popoverHideTimer) {
      clearTimeout(popoverHideTimer);
      popoverHideTimer = null;
    }
    activeAnchor = anchorEl;
    const popover = getOrCreatePopover();

    const itemsHtml = currentBadges.map((item, index) => {
      const pct = Math.round((item.score || 0) * 100);
      const dotColor = item.meta?.dotColor || '#94a3b8';
      const labelText = item.meta?.text || item.label;
      const isTop = index === 0;
      return `
        <div class="x-jev-popover-item">
          <div class="x-jev-popover-item-header">
            <div class="x-jev-popover-item-label">
              <span class="x-jev-popover-dot" style="background-color: ${escapeHtml(dotColor)};"></span>
              <span class="x-jev-popover-name" title="${escapeHtml(labelText)}">${escapeHtml(labelText)}</span>
              ${isTop ? '<span class="x-jev-popover-top-tag">TOP</span>' : ''}
            </div>
            <span class="x-jev-popover-percent">${pct}%</span>
          </div>
          <div class="x-jev-popover-bar-track">
            <div class="x-jev-popover-bar-fill" style="width: ${pct}%; background-color: ${escapeHtml(dotColor)};"></div>
          </div>
        </div>
      `;
    }).join('');

    const footerHint = (document.body && document.body.classList.contains('x-jev-single-tag-mode'))
      ? 'Top match displayed on post'
      : 'Matching categories displayed on post';

    popover.innerHTML = `
      <div class="x-jev-popover-header">
        <div class="x-jev-popover-title">
          <span class="x-jev-popover-icon">✦</span>
          <span>Jev Classification</span>
        </div>
        <span class="x-jev-popover-badge">Zero-shot</span>
      </div>
      <div class="x-jev-popover-list">
        ${itemsHtml}
      </div>
      <div class="x-jev-popover-footer">
        <span>${footerHint}</span>
        <span class="x-jev-popover-threshold">Min: ${Math.round(activeThreshold * 100)}%</span>
      </div>
    `;

    popover.classList.add('x-jev-popover-visible');
    updatePopoverPosition(anchorEl, popover);
  }

  let scrollRafId = null;
  function schedulePopoverReposition() {
    if (!activeAnchor || !popoverEl || !popoverEl.classList.contains('x-jev-popover-visible')) return;
    if (scrollRafId) return;
    scrollRafId = requestAnimationFrame(() => {
      scrollRafId = null;
      if (activeAnchor && popoverEl && popoverEl.classList.contains('x-jev-popover-visible')) {
        updatePopoverPosition(activeAnchor, popoverEl);
      }
    });
  }
  window.addEventListener('scroll', schedulePopoverReposition, { capture: true, passive: true });
  window.addEventListener('resize', schedulePopoverReposition, { passive: true });

  function renderClassification(item, res) {
    const { postEl, textEl } = item;
    if (!textEl || !textEl.parentElement) return;

    if (postEl.hasAttribute('data-jev-handled')) return;
    if (!res || typeof res !== 'object') return;

    let scores = {};
    if (res && typeof res.scores === 'object' && res.scores !== null) {
      scores = { ...res.scores };
    } else if (Array.isArray(res?.labels)) {
      const validLabels = Array.from(new Set(res.labels.filter((lbl) => typeof lbl === 'string' && lbl.trim()).map((lbl) => lbl.trim())));
      if (validLabels.length === 1) {
        scores[validLabels[0]] = (typeof res.confidence === 'number' && Number.isFinite(res.confidence)) ? res.confidence : 1;
      } else if (validLabels.length > 1) {
        // Distribute calibrated confidence equally among valid labels to guarantee sum <= 1.0
        // Prevents corrupted/unscored multi-label fallbacks from inflating multiple categories to 100%
        const totalConf = (typeof res.confidence === 'number' && Number.isFinite(res.confidence) && res.confidence > 0 && res.confidence <= 1)
          ? res.confidence
          : 1;
        const equalShare = Math.round((totalConf / validLabels.length) * 100) / 100;
        validLabels.forEach((lbl, idx) => {
          scores[lbl] = idx === validLabels.length - 1
            ? Math.round((totalConf - equalShare * (validLabels.length - 1)) * 100) / 100
            : equalShare;
        });
      }
    } else if (typeof res?.label === 'string' && res.label.trim()) {
      scores[res.label.trim()] = (typeof res.confidence === 'number' && Number.isFinite(res.confidence)) ? res.confidence : 1;
    }

    // Guard against unnormalized or corrupt scores where multiple labels sum to > 1.0
    const scoreEntries = Object.entries(scores).filter(([, s]) => typeof s === 'number' && Number.isFinite(s) && s > 0);
    const totalScore = scoreEntries.reduce((acc, [, s]) => acc + s, 0);
    if (!res?.multi && totalScore > 1.02 && scoreEntries.length > 1) {
      scoreEntries.forEach(([k, s]) => {
        scores[k] = Math.round((s / totalScore) * 100) / 100;
      });
    } else if (scoreEntries.length === 1 && scoreEntries[0][1] > 1) {
      scores[scoreEntries[0][0]] = 1;
    }
    const parentContainer = textEl.parentElement;

    const allCandidateBadges = [];

    Object.entries(scores).forEach(([candidateLabel, score]) => {
      if (typeof score !== 'number' || !Number.isFinite(score) || score <= 0) return;

      if (candidateLabel.toLowerCase() === 'other / casual discussion') {
        if (window.location.pathname.includes('/activity')) return;
        if (CONFIG.categoryActions && CONFIG.categoryActions.casual === 'off') return;
        if (!CONFIG.categoryActions && CONFIG.filterCasualEnabled === false) return;
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

      const meta = BADGE_MAP[candidateLabel] || BADGE_MAP[candidateLabel.toLowerCase()] || customMeta;
      if (meta) {
        allCandidateBadges.push({ label: candidateLabel, score, meta, isCustom });
      }
    });

    allCandidateBadges.sort((a, b) => b.score - a.score);
    const eligibleBadges = allCandidateBadges.filter((b) => b.score >= CONFIG.confidenceThreshold);
    const selectedBadges = eligibleBadges.slice(0, 4);

    const hasEligibleBadges = selectedBadges.length > 0;
    const hasSummarizableText = typeof item.text === 'string' && item.text.trim().length > 0;

    if (hasEligibleBadges || hasSummarizableText) {
      if (hasEligibleBadges && !countedTexts.has(item.text)) {
        countedTexts.add(item.text);
        saveCountedToStorage();
        postEl.setAttribute('data-jev-counted', 'true');

        selectedBadges.forEach(({ label, isCustom }) => {
          if (label.toLowerCase() === 'other / casual discussion') {
            casualCount++;
          } else if (isCustom) {
            customCount++;
          }
        });
        updatePill();
      }

      const userNameHeader = postEl.querySelector('div[data-testid="User-Name"]');
      const caretEl = postEl.querySelector('[data-testid="caret"]');
      let targetParent = null;
      let targetBefore = null;

      if (caretEl && caretEl.parentElement) {
        targetParent = caretEl.parentElement;
        targetBefore = caretEl;
      } else if (userNameHeader) {
        targetParent = userNameHeader;
        targetBefore = null;
      } else {
        targetParent = parentContainer;
        targetBefore = textEl;
      }

      // Clean up legacy loose badge element
      if (textEl.previousElementSibling && textEl.previousElementSibling.classList.contains('x-jev-badge')) {
        textEl.previousElementSibling.remove();
      }

      // Remove any stale or duplicate containers on this post so exactly one container can exist
      const existingContainers = Array.from(postEl.querySelectorAll('.x-jev-badge-container'))
        .filter((el) => {
          const closestPost = el.closest('article[data-testid="tweet"], div[data-testid="cellInnerDiv"], [data-testid="twitterArticleReadView"], [data-testid="twitter-article"], article');
          return !closestPost || closestPost === postEl;
        });

      let container = existingContainers.find((el) => el.parentElement === targetParent);
      existingContainers.forEach((el) => {
        if (el !== container) el.remove();
      });

      if (!container) {
        container = document.createElement('div');
        container.className = targetParent === parentContainer
          ? 'x-jev-badge-container'
          : 'x-jev-badge-container x-jev-header-container';
        if (targetBefore) {
          targetParent.insertBefore(container, targetBefore);
        } else {
          targetParent.appendChild(container);
        }
      } else {
        container.className = targetParent === parentContainer
          ? 'x-jev-badge-container'
          : 'x-jev-badge-container x-jev-header-container';
        if (targetBefore && container.nextElementSibling !== targetBefore) {
          targetParent.insertBefore(container, targetBefore);
        }
      }
      container.innerHTML = '';
      container.dataset.jevEligibleCount = eligibleBadges.length;

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

          badge.addEventListener('mouseenter', () => showPopover(badge, allCandidateBadges));
          badge.addEventListener('mouseleave', () => scheduleHidePopover());

          container.appendChild(badge);
        });

        if (eligibleBadges.length > 1) {
          const moreBadge = document.createElement('span');
          moreBadge.className = 'x-jev-more-badge';
          moreBadge.textContent = `+${eligibleBadges.length - 1}`;
          moreBadge.title = `+${eligibleBadges.length - 1} more matching categories (hover to view all)`;
          moreBadge.addEventListener('mouseenter', () => showPopover(moreBadge, allCandidateBadges));
          moreBadge.addEventListener('mouseleave', () => scheduleHidePopover());
          moreBadge.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
          });
          container.appendChild(moreBadge);
        }
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

          summaryBtn.classList.add('x-jev-loading');

          // Automatically expand "Show more" if truncated, extracting full post text (with quote/repost)
          const targetText = await expandAndExtractPostText(postEl, textEl, item.text);
          if (targetText && targetText !== item.text) {
            item.text = targetText;
          }
          const targetImages = extractPostImages(postEl);
          const cacheKey = targetImages.length > 0 ? `${targetText}::imgs:${targetImages.join(',')}` : targetText;

          if (summaryCache.has(cacheKey)) {
            summaryBtn.classList.remove('x-jev-loading');
            const cached = summaryCache.get(cacheKey);
            summaryCache.delete(cacheKey);
            summaryCache.set(cacheKey, cached);
            renderSummaryBox(postEl, textEl, cached);
            summaryBtn.classList.add('x-jev-active');
            return;
          }

          let activeKey = (CONFIG.geminiApiKey || '').trim();
          if (!activeKey) {
            summaryBtn.classList.remove('x-jev-loading');
            const userKey = prompt('Please enter your Google AI Studio Gemini API Key for TL;DR post summaries:');
            if (userKey && userKey.trim()) {
              activeKey = userKey.trim();
              CONFIG.geminiApiKey = activeKey;
              if (typeof GM_setValue !== 'undefined') GM_setValue('social_shield_gemini_api_key', activeKey);
              try { localStorage.setItem('social_shield_gemini_api_key', activeKey); } catch (e) {}
              summaryBtn.classList.add('x-jev-loading');
            } else {
              summaryBtn.innerHTML = '<span>⚠️</span><span>Set API Key</span>';
              summaryBtn.title = 'Please configure your Gemini API Key via Tampermonkey menu command or click TL;DR again.';
              setTimeout(() => {
                summaryBtn.innerHTML = '<span>✨</span><span>TL;DR</span>';
                summaryBtn.title = 'Summarize with Gemini 3.5 Flash-Lite (Google AI Studio)';
              }, 3500);
              return;
            }
          }

          summaryBtn.innerHTML = '<span>⏳</span><span>Summarizing...</span>';

          try {
            const bullets = await requestPostSummary(targetText, targetImages);
            renderSummaryBox(postEl, textEl, bullets);
            summaryBtn.classList.remove('x-jev-loading');
            summaryBtn.classList.add('x-jev-active');
            summaryBtn.innerHTML = '<span>✨</span><span>TL;DR</span>';
          } catch (err) {
            summaryBtn.classList.remove('x-jev-loading');
            summaryBtn.innerHTML = '<span>⚠️</span><span>Failed</span>';
            summaryBtn.title = err?.message || 'Summarization failed';
            setTimeout(() => {
              summaryBtn.innerHTML = '<span>✨</span><span>TL;DR</span>';
              summaryBtn.title = 'Summarize with Gemini 3.5 Flash-Lite (Google AI Studio)';
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
    if (activeBatches >= MAX_CONCURRENT_BATCHES || queue.length === 0) return;

    // Circuit Breaker: pause queue processing during HTTP 429 rate limit cooldown
    if (Date.now() < jevCooldownUntil) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(flushQueue, 1000);
      return;
    }

    const taxonomy = getActiveTaxonomy(CONFIG);
    if (!taxonomy.labels || taxonomy.labels.length === 0) {
      const allBypassed = queue.splice(0);
      allBypassed.forEach((item) => {
        item.postEl.setAttribute('data-jev-bypassed', 'true');
      });
      return;
    }

    // Urgent Visible-First Micro-Batching:
    // If visible items are waiting in the queue, extract up to 8 visible posts for near-instant rendering.
    // Otherwise, take up to 30 offscreen posts for background pre-classification.
    let currentBatch;
    const firstVisibleIndex = queue.findIndex((item) => item.isVisible);
    if (firstVisibleIndex !== -1) {
      const visibleItems = [];
      const remainingQueue = [];
      for (let i = 0; i < queue.length; i++) {
        if (queue[i].isVisible && visibleItems.length < 8) {
          visibleItems.push(queue[i]);
        } else {
          remainingQueue.push(queue[i]);
        }
      }
      queue = remainingQueue;
      currentBatch = visibleItems;
    } else {
      currentBatch = queue.splice(0, 30);
    }

    if (!currentBatch || currentBatch.length === 0) return;

    activeBatches++;

    // Immediately trigger another batch if there are more items in queue and capacity remains!
    if (queue.length > 0 && activeBatches < MAX_CONCURRENT_BATCHES) {
      setTimeout(flushQueue, 0);
    }

    try {
      const uncachedInputs = [];

      currentBatch.forEach((item) => {
        if (textCache.has(item.text)) {
          // True LRU refresh to MRU
          const cached = textCache.get(item.text);
          textCache.delete(item.text);
          textCache.set(item.text, cached);
          renderClassification(item, cached);
        } else if (inFlightJevWaiters.has(item.text)) {
          // In-flight request in progress: register into waiter list (no busy spin-loop!)
          inFlightJevWaiters.get(item.text).push(item);
        } else {
          inFlightJevWaiters.set(item.text, [item]);
          uncachedInputs.push(item.text);
        }
      });

      if (uncachedInputs.length > 0) {
        try {
          const results = await callJevBatch(uncachedInputs);
          if (results?.status === 429) {
            console.warn('[Social Shield] ⚠️ Jev rate limit reached (HTTP 429). Circuit breaker cooldown for 10s.');
            jevCooldownUntil = Date.now() + 10000;
          }

          if (Array.isArray(results) && results.length > 0) {
            uncachedInputs.forEach((txt, i) => {
              const res = results[i];
              const waiters = inFlightJevWaiters.get(txt) || [];
              if (res) {
                textCache.delete(txt);
                textCache.set(txt, res);
                waiters.forEach((item) => renderClassification(item, res));
              } else {
                waiters.forEach((item) => {
                  if (item.postEl) item.postEl.removeAttribute('data-jev-scanned');
                });
              }
            });
            saveCacheToStorage();
          } else {
            uncachedInputs.forEach((txt) => {
              const waiters = inFlightJevWaiters.get(txt) || [];
              waiters.forEach((item) => {
                if (item.postEl) item.postEl.removeAttribute('data-jev-scanned');
              });
            });
          }
        } catch (err) {
          console.error('[Social Shield] Jev batch call rejected:', err);
          uncachedInputs.forEach((txt) => {
            const waiters = inFlightJevWaiters.get(txt) || [];
            waiters.forEach((item) => {
              if (item.postEl) item.postEl.removeAttribute('data-jev-scanned');
            });
          });
        } finally {
          uncachedInputs.forEach((txt) => inFlightJevWaiters.delete(txt));
        }
      }
    } finally {
      activeBatches = Math.max(0, activeBatches - 1);
      queueStartTime = 0;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = null;
      if (queue.length > 0 && activeBatches < MAX_CONCURRENT_BATCHES) {
        debounceTimer = setTimeout(flushQueue, 10);
      }
    }
  }

  function scanFeed() {
    let newScanned = false;
    const newVisible = [];
    const newOffscreen = [];

    const postSelector = [
      'article[data-testid="tweet"]:not([data-jev-scanned])',
      'div[data-testid="cellInnerDiv"]:not(:has(article[data-testid="tweet"])):not([data-jev-scanned])',
      '[data-testid="twitterArticleReadView"]:not([data-jev-scanned])',
      '[data-testid="twitter-article"]:not([data-jev-scanned])',
      'article:has([data-testid="twitter-article-title"]):not([data-jev-scanned])',
      'div[data-testid="primaryColumn"] article:not([data-jev-scanned])',
    ].join(', ');

    document.querySelectorAll(postSelector).forEach((post) => {
      // Prevent child elements from being scanned if parent article was already scanned
      if (post.closest && post.closest('[data-jev-scanned]') && post.closest('[data-jev-scanned]') !== post) {
        return;
      }

      let textEl = post.querySelector('div[data-testid="tweetText"]');
      let text = '';

      if (textEl) {
        text = extractPostTextForJev(post, textEl);
      } else {
        // Check for X Long-form Article
        const articleTitleEl = post.querySelector('[data-testid="twitter-article-title"]') || post.querySelector('h1');
        const articleBodyEl = post.querySelector('[data-testid="twitterArticleReadView"], [data-testid="twitter-article"]') ||
          (post.getAttribute && post.getAttribute('data-testid')?.includes('article') ? post : null);

        if (articleTitleEl || articleBodyEl) {
          textEl = articleTitleEl || articleBodyEl;
          const title = articleTitleEl ? articleTitleEl.innerText.trim() : '';
          const sampleParagraphs = [];
          const pEls = Array.from((articleBodyEl || post).querySelectorAll('p, div[dir="auto"]'));
          for (const p of pEls) {
            const pt = p.innerText.trim();
            if (pt && pt.length > 5 && pt !== title && !sampleParagraphs.includes(pt)) {
              sampleParagraphs.push(pt);
              if (sampleParagraphs.join(' ').length > 400) break;
            }
          }
          text = [title, ...sampleParagraphs].filter(Boolean).join('\n\n').trim();
        }
      }

      if (textEl && text.length >= 2) {
        post.setAttribute('data-jev-scanned', 'true');
        scannedCount++;
        newScanned = true;
        if (textCache.has(text)) {
          const cached = textCache.get(text);
          textCache.delete(text);
          textCache.set(text, cached);
          renderClassification({ postEl: post, text, textEl }, cached);
        } else if (inFlightJevWaiters.has(text)) {
          inFlightJevWaiters.get(text).push({ postEl: post, text, textEl });
        } else {
          const isVisible = isElementInViewport(post);
          if (isVisible) {
            newVisible.push({ postEl: post, text, textEl, isVisible: true });
          } else {
            newOffscreen.push({ postEl: post, text, textEl, isVisible: false });
          }
        }
      }
    });

    if (newVisible.length > 0) {
      // FIFO document order preserved for visible posts at the head of the queue
      queue.unshift(...newVisible);
    }
    if (newOffscreen.length > 0) {
      queue.push(...newOffscreen);
    }

    if (newScanned) {
      updatePill();
    }

    // Promote previously enqueued offscreen posts that have now entered the viewport
    if (queue.length > 0) {
      queue.forEach((item) => {
        if (!item.isVisible && isElementInViewport(item.postEl)) {
          item.isVisible = true;
        }
      });
    }

    if (queue.length > 0) {
      // Guard against timer churning during active HTTP 429 rate limit cooldown
      if (Date.now() < jevCooldownUntil) {
        if (!debounceTimer) {
          debounceTimer = setTimeout(flushQueue, Math.max(100, jevCooldownUntil - Date.now()));
        }
        return;
      }

      const now = Date.now();
      if (!queueStartTime) queueStartTime = now;
      const elapsed = now - queueStartTime;
      const hasVisible = queue.some((item) => item.isVisible);

      // Realtime Trigger Conditions:
      // 1. If visible posts are waiting and activeBatches < MAX_CONCURRENT_BATCHES -> flush immediately!
      // 2. If queue reached batch threshold (>= 10 items) -> flush immediately!
      // 3. If wait elapsed exceeded maxWait (35ms) -> flush immediately!
      if (activeBatches < MAX_CONCURRENT_BATCHES && (hasVisible || queue.length >= 10 || elapsed >= 35)) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
        queueStartTime = 0;
        flushQueue();
        return;
      }

      if (!debounceTimer && activeBatches < MAX_CONCURRENT_BATCHES) {
        const delay = Math.max(10, (CONFIG.batchDebounceMs || 35) - elapsed);
        debounceTimer = setTimeout(() => {
          debounceTimer = null;
          queueStartTime = 0;
          flushQueue();
        }, delay);
      }
    }
  }

  let scanRafId = null;
  function scheduleScan() {
    if (scanRafId) return;
    scanRafId = requestAnimationFrame(() => {
      scanRafId = null;
      scanFeed();
    });
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

    // Scroll listener: passive capture with requestAnimationFrame for instantaneous feed scanning
    window.addEventListener('scroll', scheduleScan, { capture: true, passive: true });

    setInterval(() => {
      initPill();
      scheduleScan();
    }, 1200);

    let lastUrl = location.href;
    setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        scheduleHidePopover(0);
        scheduleScan();
      }
    }, 500);
  }

  initObserver();
  console.log(`[Social Shield] Active on X (${window.location.hostname}) 🛡️`);
})();

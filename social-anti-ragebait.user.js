// ==UserScript==
// @name         Social Anti-Ragebait & Emotion Predictor (Threads, X, Facebook)
// @namespace    https://classifier.dev/
// @version      1.2.1
// @description  Predicts emotional intent & automatically blurs rage-bait posts on Threads (threads.com / threads.net), X (Twitter), and Facebook in English & Vietnamese using Jev
// @author       Antigravity
// @match        *://*.threads.com/*
// @match        *://threads.com/*
// @match        *://*.threads.net/*
// @match        *://threads.net/*
// @match        *://*.x.com/*
// @match        *://x.com/*
// @match        *://*.twitter.com/*
// @match        *://twitter.com/*
// @match        *://*.facebook.com/*
// @match        *://facebook.com/*
// @match        *://*.fb.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      classifier.dev
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // --- CONFIGURATION ---
  const CONFIG = {
    apiEndpoint: 'https://classifier.dev',
    batchDebounceMs: 120,
    blurThreshold: 0.50,
    autoBlurEnabled: true,
  };

  const LABELS = [
    'rage bait / outrage',
    'fearmongering / doom',
    'fomo / hype',
    'wholesome / positive',
    'informative / educational',
    'casual discussion / personal',
  ];

  const INSTRUCTIONS =
    'Classify the emotional hook or manipulation intended by the author. Detect intentional rage-bait, drama-farming, outrage, fearmongering, FOMO, wholesome, or informative content in Vietnamese, English, or any language.';

  const BADGE_MAP = {
    'rage bait / outrage': {
      text: '🚨 Rage Bait',
      desc: 'Engineered to provoke anger / outrage (Kích động phẫn nộ)',
      bg: 'rgba(239, 68, 68, 0.18)',
      border: '#ef4444',
      color: '#f87171',
      isRage: true,
    },
    'fearmongering / doom': {
      text: '⚠️ Doom / Fear',
      desc: 'Fearmongering / inducing anxiety (Gieo rắc sợ hãi / hoang mang)',
      bg: 'rgba(249, 115, 22, 0.18)',
      border: '#f97316',
      color: '#fb923c',
      isRage: false,
    },
    'fomo / hype': {
      text: '⚡ FOMO / Hype',
      desc: 'Sensationalized hype / fear of missing out (Thổi phồng giật gân)',
      bg: 'rgba(168, 85, 247, 0.18)',
      border: '#a855f7',
      color: '#c084fc',
      isRage: false,
    },
    'wholesome / positive': {
      text: '🌿 Wholesome',
      desc: 'Uplifting, entertaining, and positive (Tích cực, giải trí)',
      bg: 'rgba(16, 185, 129, 0.18)',
      border: '#10b981',
      color: '#34d399',
      isRage: false,
    },
    'informative / educational': {
      text: '💡 Informative',
      desc: 'Objective news / insightful knowledge (Thông tin, kiến thức)',
      bg: 'rgba(6, 182, 212, 0.18)',
      border: '#06b6d4',
      color: '#22d3ee',
      isRage: false,
    },
    'casual discussion / personal': {
      text: '💬 Discussion / Casual',
      desc: 'Personal thoughts / standard conversation (Thảo luận đời thường)',
      bg: 'rgba(100, 116, 139, 0.15)',
      border: '#64748b',
      color: '#94a3b8',
      isRage: false,
    },
  };

  const css = `
    .x-jev-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 9px;
      border-radius: 9999px;
      font-size: 11.5px;
      font-weight: 600;
      letter-spacing: 0.02em;
      margin: 4px 0 8px 0;
      border: 1px solid;
      width: fit-content;
      user-select: none;
      transition: all 0.2s ease;
      cursor: help;
      z-index: 10;
    }
    .x-jev-badge:hover {
      filter: brightness(1.15);
      transform: translateY(-1px);
    }
    .x-jev-confidence {
      font-size: 10px;
      opacity: 0.85;
      font-weight: 500;
    }
    .x-jev-blurred-content,
    [data-jev-rage="true"]:not(.x-jev-revealed) [data-jev-content="true"],
    [data-jev-rage="true"]:not(.x-jev-revealed) img:not([alt*="avatar"]):not([alt*="profile"]):not([src*="profile_images"]),
    [data-jev-rage="true"]:not(.x-jev-revealed) video {
      filter: blur(14px) !important;
      opacity: 0.18 !important;
      user-select: none !important;
      pointer-events: none !important;
      transition: filter 0.2s ease, opacity 0.2s ease !important;
    }
    .x-jev-revealed .x-jev-blurred-content,
    .x-jev-revealed [data-jev-content="true"],
    .x-jev-revealed img,
    .x-jev-revealed video,
    .x-jev-unblurred {
      filter: none !important;
      opacity: 1 !important;
      user-select: auto !important;
      pointer-events: auto !important;
    }
    .x-jev-warning-box {
      background: rgba(239, 68, 68, 0.12);
      border: 1px dashed rgba(239, 68, 68, 0.5);
      border-radius: 10px;
      padding: 8px 12px;
      margin: 6px 0 8px 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 12.5px;
      color: #fca5a5;
      width: 100%;
      box-sizing: border-box;
    }
    .x-jev-reveal-btn {
      background: rgba(239, 68, 68, 0.35);
      border: 1px solid rgba(239, 68, 68, 0.7);
      color: #fff;
      padding: 4px 10px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 11.5px;
      font-weight: 600;
      white-space: nowrap;
    }
    .x-jev-reveal-btn:hover {
      background: rgba(239, 68, 68, 0.55);
    }
    .x-jev-floating-pill {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 999999;
      background: rgba(15, 23, 42, 0.9);
      color: #e2e8f0;
      padding: 8px 14px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255,255,255,0.1);
      cursor: pointer;
      user-select: none;
      transition: all 0.2s ease;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .x-jev-floating-pill:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 24px rgba(0,0,0,0.5);
    }
  `;

  if (typeof GM_addStyle !== 'undefined') {
    GM_addStyle(css);
  } else {
    const styleEl = document.createElement('style');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  }

  // --- PLATFORM DETECTION ---
  function getPlatform() {
    const host = window.location.hostname.toLowerCase();
    if (host.includes('threads.net') || host.includes('threads.com')) return 'threads';
    if (host.includes('facebook.com') || host.includes('fb.com')) return 'facebook';
    return 'x';
  }

  // Synchronous session cache
  const CACHE_KEY = `x_jev_userjs_cache_${getPlatform()}`;
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
      const entries = Array.from(textCache.entries()).slice(-250);
      entries.forEach(([k, v]) => (obj[k] = v));
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(obj));
    } catch (e) {}
  }

  let blockedCount = 0;
  const pill = document.createElement('div');
  pill.className = 'x-jev-floating-pill';
  function updatePill() {
    const pName = getPlatform().toUpperCase();
    pill.innerHTML = `🛡️ ${pName} Anti-Rage: <span style="color:${CONFIG.autoBlurEnabled ? '#4ade80' : '#94a3b8'}">${CONFIG.autoBlurEnabled ? 'ON' : 'OFF'}</span> | Blocked: <span style="color:#f87171">${blockedCount}</span>`;
  }
  updatePill();
  pill.title = 'Click to toggle auto-blur on this platform';
  pill.addEventListener('click', () => {
    CONFIG.autoBlurEnabled = !CONFIG.autoBlurEnabled;
    updatePill();
    document.querySelectorAll('[data-jev-rage="true"]').forEach((post) => {
      const warning = post.querySelector('.x-jev-warning-box');
      if (CONFIG.autoBlurEnabled) {
        post.classList.remove('x-jev-revealed');
        if (warning) warning.style.display = 'flex';
      } else {
        post.classList.add('x-jev-revealed');
        if (warning) warning.style.display = 'none';
      }
    });
  });

  function initPill() {
    if (document.body && !document.querySelector('.x-jev-floating-pill')) {
      document.body.appendChild(pill);
    }
  }
  if (document.body) {
    initPill();
  } else {
    document.addEventListener('DOMContentLoaded', initPill);
  }

  let queue = [];
  let debounceTimer = null;

  function callJevBatch(inputs) {
    return new Promise((resolve) => {
      const payload = JSON.stringify({
        labels: LABELS,
        inputs: inputs,
        instructions: INSTRUCTIONS,
      });

      const sendReq =
        typeof GM_xmlhttpRequest !== 'undefined'
          ? GM_xmlhttpRequest
          : function (opts) {
              fetch(opts.url, {
                method: opts.method,
                headers: opts.headers,
                body: opts.data,
              })
                .then((res) => res.json())
                .then((data) => opts.onload({ responseText: JSON.stringify(data) }))
                .catch((err) => opts.onerror(err));
            };

      sendReq({
        method: 'POST',
        url: CONFIG.apiEndpoint,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'social-anti-ragebait/1.2.1',
        },
        data: payload,
        onload: function (response) {
          try {
            const data = JSON.parse(response.responseText);
            resolve(data.results || []);
          } catch (e) {
            console.error('[Anti-Ragebait] Parse error:', e);
            resolve([]);
          }
        },
        onerror: function (err) {
          console.error('[Anti-Ragebait] Network error:', err);
          resolve([]);
        },
      });
    });
  }

  function renderClassification(item, res) {
    const { postEl, textEl } = item;
    if (!textEl || !textEl.parentElement) return;
    if (postEl.querySelector('.x-jev-badge')) return;

    const label = res.label;
    const confidence = res.confidence || 0;
    const meta = BADGE_MAP[label] || BADGE_MAP['casual discussion / personal'];

    const badge = document.createElement('div');
    badge.className = 'x-jev-badge';
    badge.style.backgroundColor = meta.bg;
    badge.style.borderColor = meta.border;
    badge.style.color = meta.color;
    badge.title = `${meta.desc} (Confidence: ${Math.round(confidence * 100)}%)`;

    const pct = Math.round(confidence * 100);
    badge.innerHTML = `<span>${meta.text}</span><span class="x-jev-confidence">${pct}%</span>`;

    const parentContainer = textEl.parentElement;
    parentContainer.insertBefore(badge, textEl);

    if (meta.isRage && confidence >= CONFIG.blurThreshold) {
      postEl.setAttribute('data-jev-rage', 'true');
      blockedCount++;
      updatePill();

      textEl.setAttribute('data-jev-content', 'true');
      const contentWrapper = textEl.closest('div[dir="auto"]')?.parentElement || textEl.parentElement;
      if (contentWrapper) {
        contentWrapper.setAttribute('data-jev-content', 'true');
      }

      if (!postEl.querySelector('.x-jev-warning-box')) {
        const warningBox = document.createElement('div');
        warningBox.className = 'x-jev-warning-box';
        warningBox.innerHTML = `
          <span>🛡️ <b>Rage Bait Warning:</b> This post is engineered to provoke anger and farm drama.</span>
        `;

        const revealBtn = document.createElement('button');
        revealBtn.className = 'x-jev-reveal-btn';
        revealBtn.textContent = 'Reveal post';
        revealBtn.onclick = (e) => {
          e.stopPropagation();
          const isRevealed = postEl.classList.toggle('x-jev-revealed');
          revealBtn.textContent = isRevealed ? 'Re-blur' : 'Reveal post';
        };

        warningBox.appendChild(revealBtn);
        parentContainer.insertBefore(warningBox, badge);
      }

      if (CONFIG.autoBlurEnabled) {
        postEl.classList.remove('x-jev-revealed');
      } else {
        postEl.classList.add('x-jev-revealed');
      }
    }
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
      results.forEach((res, i) => {
        const item = currentBatch[uncachedIndices[i]];
        if (item && res) {
          textCache.set(item.text, res);
          renderClassification(item, res);
        }
      });
      saveCache();
    }

    if (queue.length > 0) {
      debounceTimer = setTimeout(flushQueue, 80);
    }
  }

  function scanPosts() {
    const platform = getPlatform();

    if (platform === 'threads') {
      const postContainers = new Set();

      document.querySelectorAll('div[data-pressable-container="true"], article').forEach((el) => {
        if (!el.hasAttribute('data-jev-scanned')) postContainers.add(el);
      });

      document.querySelectorAll('a[href*="/post/"]').forEach((link) => {
        let container = link.closest('div[data-pressable-container="true"]') || link.closest('article');
        if (!container) {
          let curr = link.parentElement;
          let depth = 0;
          while (curr && curr !== document.body && depth < 8) {
            const svgs = curr.querySelectorAll('svg').length;
            const hasText = curr.querySelector('span[dir="auto"], div[dir="auto"]');
            if (svgs >= 2 && hasText) {
              container = curr;
              break;
            }
            curr = curr.parentElement;
            depth++;
          }
        }
        if (container && !container.hasAttribute('data-jev-scanned')) {
          postContainers.add(container);
        }
      });

      postContainers.forEach((post) => {
        const textEls = post.querySelectorAll('span[dir="auto"], div[dir="auto"]');
        let longestTextEl = null;
        let maxLen = 0;

        textEls.forEach((el) => {
          if (el.closest('button') || el.closest('time') || el.classList.contains('x-jev-badge')) return;
          const t = el.innerText.trim();

          if (t.length < 15) return;
          if (/^\d+(\.\d+)?(k|m)?\s*(likes?|replies?|views?|lượt thích|câu trả lời|bình luận|chia sẻ)$/i.test(t)) return;
          if (/^(\d+\s*(s|m|h|d|w|giây|phút|giờ|ngày|tuần)|just now|vừa xong)$/i.test(t)) return;

          if (t.length > maxLen) {
            maxLen = t.length;
            longestTextEl = el;
          }
        });

        if (longestTextEl && maxLen >= 15) {
          post.setAttribute('data-jev-scanned', 'true');
          const cleanText = longestTextEl.innerText.trim();
          if (textCache.has(cleanText)) {
            renderClassification({ postEl: post, text: cleanText, textEl: longestTextEl }, textCache.get(cleanText));
          } else {
            queue.push({ postEl: post, text: cleanText, textEl: longestTextEl });
          }
        }
      });
    } else if (platform === 'x') {
      document.querySelectorAll('article[data-testid="tweet"]:not([data-jev-scanned])').forEach((post) => {
        const textEl = post.querySelector('div[data-testid="tweetText"]');
        if (textEl) {
          const text = textEl.innerText.trim();
          if (text.length >= 15) {
            post.setAttribute('data-jev-scanned', 'true');
            if (textCache.has(text)) {
              renderClassification({ postEl: post, text, textEl }, textCache.get(text));
            } else {
              queue.push({ postEl: post, text, textEl });
            }
          }
        }
      });
    } else if (platform === 'facebook') {
      document.querySelectorAll('div[data-pagelet^="FeedUnit_"]:not([data-jev-scanned]), div[role="article"]:not([data-jev-scanned])').forEach((post) => {
        const msgEl = post.querySelector('div[data-ad-rendering-role="story_message"], div[data-ad-preview="message"]') ||
                      Array.from(post.querySelectorAll('div[dir="auto"]')).find((el) => el.innerText.trim().length >= 25);
        if (msgEl) {
          const text = msgEl.innerText.trim();
          if (text.length >= 15) {
            post.setAttribute('data-jev-scanned', 'true');
            if (textCache.has(text)) {
              renderClassification({ postEl: post, text, textEl: msgEl }, textCache.get(text));
            } else {
              queue.push({ postEl: post, text, textEl: msgEl });
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

  const observer = new MutationObserver(() => scanPosts());

  function initObserver() {
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
      scanPosts();
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.body, { childList: true, subtree: true });
        scanPosts();
      });
    }
  }

  initObserver();
  console.log(`[Social Anti-Ragebait Userscript] Active on ${getPlatform().toUpperCase()} (${window.location.hostname}) 🛡️`);
})();

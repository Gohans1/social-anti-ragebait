// ==UserScript==
// @name         Social Anti-Ragebait & Emotion Predictor (X, Threads, Facebook)
// @namespace    https://classifier.dev/
// @version      1.1.0
// @description  Predicts emotional intent & automatically blurs rage-bait posts on X (Twitter), Threads, and Facebook in English & Vietnamese using Jev
// @author       Antigravity
// @match        https://x.com/*
// @match        https://twitter.com/*
// @match        https://threads.net/*
// @match        https://www.threads.net/*
// @match        https://facebook.com/*
// @match        https://www.facebook.com/*
// @match        https://web.facebook.com/*
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
    batchDebounceMs: 350,
    blurThreshold: 0.65,
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
    .x-jev-blurred-content {
      filter: blur(9px) !important;
      opacity: 0.25 !important;
      user-select: none !important;
      pointer-events: none !important;
      transition: filter 0.25s ease, opacity 0.25s ease !important;
    }
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
      margin: 6px 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 12.5px;
      color: #fca5a5;
    }
    .x-jev-reveal-btn {
      background: rgba(239, 68, 68, 0.25);
      border: 1px solid rgba(239, 68, 68, 0.6);
      color: #fff;
      padding: 4px 10px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 11.5px;
      font-weight: 600;
      transition: background 0.2s;
    }
    .x-jev-reveal-btn:hover {
      background: rgba(239, 68, 68, 0.45);
    }
    .x-jev-floating-pill {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      background: rgba(15, 23, 42, 0.88);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #e2e8f0;
      padding: 8px 14px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      box-shadow: 0 8px 24px rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .x-jev-floating-pill:hover {
      transform: scale(1.03);
      border-color: rgba(239, 68, 68, 0.6);
    }
  `;

  if (typeof GM_addStyle !== 'undefined') {
    GM_addStyle(css);
  } else {
    const s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
  }

  const textCache = new Map();
  let queue = [];
  let debounceTimer = null;
  let blockedCount = 0;

  function getPlatform() {
    const host = window.location.hostname;
    if (host.includes('threads.net')) return 'threads';
    if (host.includes('facebook.com')) return 'facebook';
    return 'x';
  }

  const pill = document.createElement('div');
  pill.className = 'x-jev-floating-pill';
  function updatePill() {
    const platform = getPlatform().toUpperCase();
    pill.innerHTML = `🛡️ ${platform} Anti-Ragebait: <span style="color:${CONFIG.autoBlurEnabled ? '#4ade80' : '#94a3b8'}">${CONFIG.autoBlurEnabled ? 'ON' : 'OFF'}</span> | Blocked: <span style="color:#f87171">${blockedCount}</span>`;
  }
  updatePill();
  pill.title = 'Click to toggle Rage Bait auto-blur on this page';
  pill.addEventListener('click', () => {
    CONFIG.autoBlurEnabled = !CONFIG.autoBlurEnabled;
    updatePill();
    document.querySelectorAll('[data-jev-rage="true"]').forEach((post) => {
      const content = post.querySelector('[data-jev-content]');
      const warning = post.querySelector('.x-jev-warning-box');
      if (CONFIG.autoBlurEnabled) {
        content?.classList.add('x-jev-blurred-content');
        if (warning) warning.style.display = 'flex';
      } else {
        content?.classList.remove('x-jev-blurred-content');
        if (warning) warning.style.display = 'none';
      }
    });
  });
  document.body.appendChild(pill);

  async function callJevBatch(inputs) {
    const payload = JSON.stringify({
      labels: LABELS,
      inputs: inputs,
      instructions: INSTRUCTIONS,
    });

    return new Promise((resolve) => {
      const sendReq = typeof GM_xmlhttpRequest !== 'undefined'
        ? GM_xmlhttpRequest
        : (opts) => {
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
          'User-Agent': 'social-anti-ragebait/1.0',
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
        textEl.classList.toggle('x-jev-blurred-content');
        revealBtn.textContent = textEl.classList.contains('x-jev-blurred-content')
          ? 'Reveal post'
          : 'Re-blur';
      };

      warningBox.appendChild(revealBtn);
      parentContainer.insertBefore(warningBox, textEl);

      if (CONFIG.autoBlurEnabled) {
        textEl.classList.add('x-jev-blurred-content');
      } else {
        warningBox.style.display = 'none';
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
    }

    if (queue.length > 0) {
      debounceTimer = setTimeout(flushQueue, 200);
    }
  }

  function scanPosts() {
    const platform = getPlatform();

    if (platform === 'x') {
      document.querySelectorAll('article[data-testid="tweet"]:not([data-jev-scanned])').forEach((post) => {
        post.setAttribute('data-jev-scanned', 'true');
        const textEl = post.querySelector('div[data-testid="tweetText"]');
        if (textEl) {
          const text = textEl.innerText.trim();
          if (text.length >= 15) queue.push({ postEl: post, text, textEl });
        }
      });
    } else if (platform === 'threads') {
      document.querySelectorAll('div[data-pressable-container="true"]:not([data-jev-scanned]), article:not([data-jev-scanned])').forEach((post) => {
        post.setAttribute('data-jev-scanned', 'true');
        const textEls = post.querySelectorAll('span[dir="auto"], div[dir="auto"]');
        let longestTextEl = null;
        let maxLen = 0;
        textEls.forEach((el) => {
          const t = el.innerText.trim();
          if (t.length > maxLen && !/^\d+(\.\d+)?(k|m)?\s*(likes?|replies?|views?)$/i.test(t)) {
            maxLen = t.length;
            longestTextEl = el;
          }
        });
        if (longestTextEl && maxLen >= 15) {
          queue.push({ postEl: post, text: longestTextEl.innerText.trim(), textEl: longestTextEl });
        }
      });
    } else if (platform === 'facebook') {
      document.querySelectorAll('div[data-pagelet^="FeedUnit_"]:not([data-jev-scanned]), div[role="article"]:not([data-jev-scanned])').forEach((post) => {
        post.setAttribute('data-jev-scanned', 'true');
        const msgEl = post.querySelector('div[data-ad-rendering-role="story_message"], div[data-ad-preview="message"]') ||
                      Array.from(post.querySelectorAll('div[dir="auto"]')).find(el => el.innerText.trim().length >= 25);
        if (msgEl) {
          const text = msgEl.innerText.trim();
          if (text.length >= 15) {
            queue.push({ postEl: post, text, textEl: msgEl });
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
  observer.observe(document.body, { childList: true, subtree: true });

  scanPosts();
})();

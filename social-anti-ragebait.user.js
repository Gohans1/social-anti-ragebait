// ==UserScript==
// @name         Social Shield All-in-One: Anti-Ragebait, Anti-Scam, Anti-Seeding
// @namespace    https://classifier.dev/
// @version      2.0.0
// @description  Tự động làm mờ rage-bait, chặn bài viết lừa đảo, và thu gọn comment seeding trên Threads, Facebook, X bằng Jev AI
// @author       Antigravity
// @match        *://*.threads.com/*
// @match        *://threads.com/*
// @match        *://*.threads.net/*
// @match        *://threads.net/*
// @match        *://*.facebook.com/*
// @match        *://facebook.com/*
// @match        *://*.fb.com/*
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
    confidenceThreshold: 0.50,
    autoBlurRageEnabled: true,
    blockScamsEnabled: true,
    collapseSeedingEnabled: true,
  };

  let blockedRageCount = 0;
  let blockedScamCount = 0;
  let cleanedSeedingCount = 0;

  function getPlatform() {
    const host = window.location.hostname.toLowerCase();
    if (host.includes('threads.net') || host.includes('threads.com')) return 'threads';
    if (host.includes('facebook.com') || host.includes('fb.com')) return 'facebook';
    return 'x';
  }

  const css = `
    .x-jev-badge {
      display: inline-flex !important;
      align-items: center !important;
      gap: 6px !important;
      padding: 3px 10px !important;
      border-radius: 9999px !important;
      font-size: 11.5px !important;
      font-weight: 600 !important;
      margin: 4px 0 8px 0 !important;
      border: 1px solid !important;
      width: fit-content !important;
      user-select: none !important;
      cursor: help !important;
      z-index: 10 !important;
    }
    [data-jev-rage="true"]:not(.x-jev-revealed) [data-jev-blur-item="true"],
    [data-jev-scam="true"]:not(.x-jev-revealed) [data-jev-blur-item="true"],
    .x-jev-blurred-content {
      filter: blur(14px) !important;
      opacity: 0.15 !important;
      user-select: none !important;
      pointer-events: none !important;
      transition: filter 0.2s ease, opacity 0.2s ease !important;
    }
    .x-jev-revealed [data-jev-blur-item="true"],
    .x-jev-revealed .x-jev-blurred-content {
      filter: none !important;
      opacity: 1 !important;
      user-select: auto !important;
      pointer-events: auto !important;
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
      z-index: 99 !important;
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
      z-index: 99 !important;
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
      white-space: nowrap !important;
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
      user-select: none !important;
      width: 100% !important;
      box-sizing: border-box !important;
    }
    .x-jev-collapsed-body {
      display: none !important;
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
  `;

  if (typeof GM_addStyle !== 'undefined') {
    GM_addStyle(css);
  } else {
    const s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
  }

  const CACHE_KEY = `social_shield_userjs_cache_${getPlatform()}`;
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

  const LABELS = [
    'scam / fraudulent scheme',
    'rage bait / outrage',
    'bot seeding / affiliate spam / fake review',
    'fearmongering / doom',
    'fomo / hype',
    'wholesome / positive',
    'informative / educational',
    'casual discussion / personal',
  ];

  const INSTRUCTIONS =
    'Classify the content into: online scam/financial trap, intentional rage-bait/outrage/drama, bot seeding/affiliate manipulation/fake praise, fearmongering, fomo/hype, wholesome, informative, or casual discussion in Vietnamese or English.';

  let queue = [];
  let debounceTimer = null;

  const pill = document.createElement('div');
  pill.className = 'x-jev-floating-pill';
  function updatePill() {
    const pName = getPlatform().toUpperCase();
    pill.innerHTML = `🛡️ ${pName} Shield: <span style="color:#4ade80">ON</span> | 🚨 Rage: <span style="color:#f87171">${blockedRageCount}</span> | 🛑 Scam: <span style="color:#fb923c">${blockedScamCount}</span> | 🧹 Seeding: <span style="color:#c084fc">${cleanedSeedingCount}</span>`;
  }
  updatePill();
  pill.addEventListener('click', () => {
    const allOn = CONFIG.autoBlurRageEnabled || CONFIG.blockScamsEnabled || CONFIG.collapseSeedingEnabled;
    CONFIG.autoBlurRageEnabled = !allOn;
    CONFIG.blockScamsEnabled = !allOn;
    CONFIG.collapseSeedingEnabled = !allOn;
    updatePill();
  });

  if (document.body) {
    document.body.appendChild(pill);
  } else {
    document.addEventListener('DOMContentLoaded', () => document.body.appendChild(pill));
  }

  function callJevBatch(inputs) {
    return new Promise((resolve) => {
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
          'User-Agent': 'social-shield-userjs/2.0',
        },
        data: JSON.stringify({
          labels: LABELS,
          inputs: inputs,
          instructions: INSTRUCTIONS,
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

  function renderClassification(item, res) {
    const { postEl, textEl } = item;
    if (!textEl || !textEl.parentElement) return;
    if (postEl.hasAttribute('data-jev-handled')) return;

    const label = res.label;
    const confidence = res.confidence || 0;
    const parentContainer = textEl.parentElement;

    // 1. SCAM
    if (label === 'scam / fraudulent scheme' && confidence >= CONFIG.confidenceThreshold) {
      postEl.setAttribute('data-jev-handled', 'true');
      postEl.setAttribute('data-jev-scam', 'true');
      blockedScamCount++;
      updatePill();

      textEl.setAttribute('data-jev-blur-item', 'true');
      postEl.querySelectorAll('img, video').forEach((m) => {
        if (!m.closest('a[href*="/@"]')) m.setAttribute('data-jev-blur-item', 'true');
      });

      if (!postEl.querySelector('.x-jev-scam-box')) {
        const box = document.createElement('div');
        box.className = 'x-jev-scam-box';
        const pct = Math.round(confidence * 100);
        box.innerHTML = `
          <div>
            <b>🛑 Cảnh báo Lừa đảo / Bẫy tài chính (${pct}%):</b>
            <div style="font-size:11px;opacity:0.9;">Dấu hiệu: Hứa hẹn thu nhập bất thường, lùa gà crypto.</div>
          </div>
        `;
        const btn = document.createElement('button');
        btn.className = 'x-jev-reveal-btn';
        btn.textContent = 'Xem bài viết';
        btn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const isRevealed = postEl.classList.toggle('x-jev-revealed');
          btn.textContent = isRevealed ? 'Ẩn lại' : 'Xem bài viết';
        };
        box.appendChild(btn);
        parentContainer.insertBefore(box, textEl);
      }
      return;
    }

    // 2. RAGE BAIT
    if (label === 'rage bait / outrage' && confidence >= CONFIG.confidenceThreshold) {
      postEl.setAttribute('data-jev-handled', 'true');
      postEl.setAttribute('data-jev-rage', 'true');
      blockedRageCount++;
      updatePill();

      textEl.setAttribute('data-jev-blur-item', 'true');
      postEl.querySelectorAll('img, video').forEach((m) => {
        if (!m.closest('a[href*="/@"]')) m.setAttribute('data-jev-blur-item', 'true');
      });

      if (!postEl.querySelector('.x-jev-warning-box')) {
        const box = document.createElement('div');
        box.className = 'x-jev-warning-box';
        const pct = Math.round(confidence * 100);
        box.innerHTML = `<span>🛡️ <b>Rage Bait Warning (${pct}%):</b> Bài viết gây war đã bị làm mờ.</span>`;
        const btn = document.createElement('button');
        btn.className = 'x-jev-reveal-btn';
        btn.textContent = 'Reveal post';
        btn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const isRevealed = postEl.classList.toggle('x-jev-revealed');
          btn.textContent = isRevealed ? 'Re-blur' : 'Reveal post';
        };
        box.appendChild(btn);
        parentContainer.insertBefore(box, textEl);
      }
      return;
    }

    // 3. SEEDING
    if (label === 'bot seeding / affiliate spam / fake review' && confidence >= CONFIG.confidenceThreshold) {
      postEl.setAttribute('data-jev-handled', 'true');
      postEl.setAttribute('data-jev-seeding', 'true');
      cleanedSeedingCount++;
      updatePill();

      textEl.setAttribute('data-jev-seeding-content', 'true');
      if (!postEl.querySelector('.x-jev-seeding-collapsed')) {
        const bar = document.createElement('div');
        bar.className = 'x-jev-seeding-collapsed';
        const pct = Math.round(confidence * 100);
        bar.innerHTML = `
          <div>🧹 Đã thu gọn bình luận nghi vấn <b>Seeding / Clone</b> (${pct}%)</div>
          <span style="font-size:11px;font-weight:700;">Xem nội dung ▾</span>
        `;
        bar.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const isCollapsed = textEl.classList.toggle('x-jev-collapsed-body');
          bar.querySelector('span').textContent = isCollapsed ? 'Xem nội dung ▾' : 'Thu gọn ▴';
        };
        parentContainer.insertBefore(bar, textEl);
        if (CONFIG.collapseSeedingEnabled) {
          textEl.classList.add('x-jev-collapsed-body');
        }
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

  function scanFeed() {
    const platform = getPlatform();

    if (platform === 'threads') {
      const candidates = new Set();
      document.querySelectorAll('div[data-pressable-container="true"], article').forEach((el) => {
        if (!el.hasAttribute('data-jev-scanned')) candidates.add(el);
      });
      document.querySelectorAll('a[href*="/post/"]').forEach((link) => {
        let container = link.closest('div[data-pressable-container="true"]') || link.closest('article');
        if (!container) {
          let curr = link.parentElement;
          let depth = 0;
          while (curr && curr !== document.body && depth < 8) {
            if (curr.querySelectorAll('svg').length >= 2 && curr.querySelector('span[dir="auto"], div[dir="auto"]')) {
              container = curr;
              break;
            }
            curr = curr.parentElement;
            depth++;
          }
        }
        if (container && !container.hasAttribute('data-jev-scanned')) candidates.add(container);
      });

      candidates.forEach((cont) => {
        const textEls = cont.querySelectorAll('span[dir="auto"], div[dir="auto"]');
        let bestEl = null;
        let maxLen = 0;
        textEls.forEach((el) => {
          if (el.closest('button') || el.closest('time')) return;
          const t = el.innerText.trim();
          if (t.length < 15) return;
          if (/^\d+(\.\d+)?(k|m)?\s*(likes?|replies?|views?|lượt thích|câu trả lời|bình luận|chia sẻ)$/i.test(t)) return;
          if (/^(\d+\s*(s|m|h|d|w|giây|phút|giờ|ngày|tuần)|just now|vừa xong)$/i.test(t)) return;
          if (t.length > maxLen) {
            maxLen = t.length;
            bestEl = el;
          }
        });
        if (bestEl && maxLen >= 15) {
          cont.setAttribute('data-jev-scanned', 'true');
          const cleanText = bestEl.innerText.trim();
          if (textCache.has(cleanText)) {
            renderClassification({ postEl: cont, text: cleanText, textEl: bestEl }, textCache.get(cleanText));
          } else {
            queue.push({ postEl: cont, text: cleanText, textEl: bestEl });
          }
        }
      });
    } else if (platform === 'facebook') {
      document.querySelectorAll('div[data-pagelet^="FeedUnit_"]:not([data-jev-scanned]), div[role="article"]:not([data-jev-scanned])').forEach((post) => {
        const msgEl = post.querySelector('div[data-ad-rendering-role="story_message"], div[data-ad-preview="message"]') ||
                      Array.from(post.querySelectorAll('div[dir="auto"], span[dir="auto"]')).find((el) => el.innerText.trim().length >= 20);
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
})();

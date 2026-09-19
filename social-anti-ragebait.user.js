// ==UserScript==
// @name         Social Shield All-in-One: Anti-Rage, Anti-Scam, Universal Reels & Monk Mode
// @namespace    https://classifier.dev/
// @version      2.3.0
// @description  Tự động làm mờ rage-bait, chặn bài lừa đảo, thu gọn seeding và kích hoạt Monk Mode chặn ảnh/video phụ nữ & Reels/Shorts trên Instagram, YouTube, Facebook, Threads, X
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
    confidenceThreshold: 0.50,
    monkModeEnabled: true,
    blockReelsEnabled: true,
    autoBlurRageEnabled: true,
    blockScamsEnabled: true,
    collapseSeedingEnabled: true,
  };

  let monkModeBlockedCount = 0;
  let blockedRageCount = 0;
  let blockedScamCount = 0;
  let cleanedSeedingCount = 0;

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
    [data-monk-blocked="true"]:not(.monk-revealed) img:not([alt*="avatar"]):not([alt*="profile"]):not([src*="profile_images"]),
    [data-monk-blocked="true"]:not(.monk-revealed) video {
      filter: blur(28px) grayscale(60%) !important;
      opacity: 0.1 !important;
      user-select: none !important;
      pointer-events: none !important;
      transition: filter 0.25s ease, opacity 0.25s ease !important;
    }
    .monk-revealed img,
    .monk-revealed video {
      filter: none !important;
      opacity: 1 !important;
      user-select: auto !important;
      pointer-events: auto !important;
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
    [data-jev-rage="true"]:not(.x-jev-revealed) [data-jev-blur-item="true"],
    [data-jev-scam="true"]:not(.x-jev-revealed) [data-jev-blur-item="true"],
    .x-jev-blurred-content {
      filter: blur(14px) !important;
      opacity: 0.15 !important;
      user-select: none !important;
      pointer-events: none !important;
    }
    .x-jev-revealed [data-jev-blur-item="true"] {
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

  const CACHE_KEY = `social_shield_userjs_cache_v3_${getPlatform()}`;
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
    'goon baiting / thirst trap / seductive woman media',
    'rage bait / toxic / hostile / dismissive negativity',
    'bot seeding / affiliate spam / fake review',
    'fearmongering / doom',
    'fomo / hype',
    'wholesome / positive',
    'informative / educational',
    'casual discussion / personal',
  ];

  const INSTRUCTIONS =
    'Classify content into: online scam/financial trap, goon baiting/thirst trap/seductive suggestive female content/OnlyFans funnel, rage-bait/toxic insults/hostile cynicism/dismissive negativity (e.g. "Vô bổ", "Rác rưởi", "Xàm", "Đồ ngu", "Nhảm"), bot seeding/affiliate manipulation/fake praise, fearmongering, fomo, wholesome, informative, or casual discussion in Vietnamese or English.';

  let queue = [];
  let debounceTimer = null;

  const pill = document.createElement('div');
  pill.className = 'x-jev-floating-pill';
  function updatePill() {
    const pName = getPlatform().toUpperCase();
    pill.innerHTML = `🛡️ ${pName}: <span style="color:#4ade80">ON</span> | 🧘 Monk: <span style="color:#38bdf8">${monkModeBlockedCount}</span> | 🚨 Rage: <span style="color:#f87171">${blockedRageCount}</span> | 🛑 Scam: <span style="color:#fb923c">${blockedScamCount}</span> | 🧹 Seed: <span style="color:#c084fc">${cleanedSeedingCount}</span>`;
  }
  updatePill();
  pill.addEventListener('click', () => {
    const allOn = CONFIG.monkModeEnabled || CONFIG.autoBlurRageEnabled || CONFIG.blockScamsEnabled || CONFIG.collapseSeedingEnabled;
    CONFIG.monkModeEnabled = !allOn;
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
        detectedReason = 'Ảnh/Video phụ nữ (Meta AI Alt-Tag)';
      }
    });

    if (!hasWomenMedia && WOMEN_OR_GOONBAIT_REGEX.test(text)) {
      hasWomenMedia = true;
      detectedReason = 'Goon-baiting / Thirst trap';
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
            <b>🧘 Monk Mode: Đã che ảnh/video để giữ tập trung tuyệt đối.</b>
            <div style="font-size:10.5px;opacity:0.9;">${detectedReason}</div>
          </div>
        `;
        const btn = document.createElement('button');
        btn.className = 'x-monk-reveal-btn';
        btn.textContent = 'Xem ảnh';
        btn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const isRevealed = postEl.classList.toggle('monk-revealed');
          btn.textContent = isRevealed ? 'Ẩn lại' : 'Xem ảnh';
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

    checkAndApplyMonkMode(postEl, item.text);
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

    // 2. GOON BAITING
    if (label === 'goon baiting / thirst trap / seductive woman media' && confidence >= CONFIG.confidenceThreshold) {
      checkAndApplyMonkMode(postEl, item.text);
      postEl.setAttribute('data-jev-handled', 'true');
      return;
    }

    // 3. RAGE BAIT / TOXIC NEGATIVITY
    if (
      (label === 'rage bait / toxic / hostile / dismissive negativity' || label === 'rage bait / outrage') &&
      confidence >= CONFIG.confidenceThreshold
    ) {
      postEl.setAttribute('data-jev-handled', 'true');
      postEl.setAttribute('data-jev-rage', 'true');
      blockedRageCount++;
      updatePill();

      // Remove any lingering badges
      postEl.querySelectorAll('.x-jev-badge').forEach((b) => b.remove());

      textEl.setAttribute('data-jev-blur-item', 'true');
      postEl.querySelectorAll('img, video').forEach((m) => {
        if (!m.closest('a[href*="/@"]')) m.setAttribute('data-jev-blur-item', 'true');
      });

      if (!postEl.querySelector('.x-jev-warning-box')) {
        const box = document.createElement('div');
        box.className = 'x-jev-warning-box';
        const pct = Math.round(confidence * 100);
        box.innerHTML = `<span>🛡️ <b>Rage Bait / Toxic Warning (${pct}%):</b> Bình luận tiêu cực / công kích đã bị làm mờ.</span>`;
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

    // 4. SEEDING
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
              <div class="x-monk-reels-title">Monk Mode: Đã chặn Pop-up Reels Facebook</div>
              <div class="x-monk-reels-desc">Thước phim ngắn đã được tạm dừng và làm mờ để bảo vệ sự tập trung tuyệt đối.</div>
              <div class="x-monk-reels-actions">
                <button class="x-monk-btn-reveal">▶ Xem video</button>
                <button class="x-monk-btn-close">✕ Đóng pop-up</button>
              </div>
            </div>
          `;

          const floatingReblur = document.createElement('button');
          floatingReblur.className = 'x-monk-re-blur-floating';
          floatingReblur.innerHTML = `<span>🧘</span><span>Ẩn lại Reels</span>`;
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
                <b>Monk Mode: Đã ẩn khu vực Thước phim (Reels) trên Bảng tin</b>
                <div style="font-size:11px;opacity:0.85;margin-top:1px;">Duy trì sự tập trung, chống nghiện lướt video ngắn và dopamine độc hại.</div>
              </div>
            </div>
            <button class="x-monk-tray-toggle">Xem Reels</button>
          `;

          const toggleBtn = banner.querySelector('.x-monk-tray-toggle');
          toggleBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isRevealed = tray.classList.toggle('monk-revealed');
            toggleBtn.textContent = isRevealed ? 'Ẩn lại' : 'Xem Reels';
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
                <div class="x-monk-reels-title">Monk Mode: Đã chặn Reels Facebook</div>
                <div class="x-monk-reels-desc">Thước phim ngắn đã được tạm dừng để bảo vệ sự tập trung tuyệt đối.</div>
                <div class="x-monk-reels-actions">
                  <button class="x-monk-btn-reveal">▶ Xem video</button>
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
              <div class="x-monk-reels-title">Monk Mode: Đã chặn Instagram Reel</div>
              <div class="x-monk-reels-desc">Thước phim ngắn đã được tạm dừng và làm mờ để bảo vệ sự tập trung tuyệt đối.</div>
              <div class="x-monk-reels-actions">
                <button class="x-monk-btn-reveal">▶ Xem Reel</button>
                <button class="x-monk-btn-home">🏠 Về Trang chủ</button>
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
              <div class="x-monk-reels-title">Monk Mode: Đã chặn Pop-up Reel Instagram</div>
              <div class="x-monk-reels-desc">Thước phim ngắn đã được tạm dừng và làm mờ để bảo vệ sự tập trung.</div>
              <div class="x-monk-reels-actions">
                <button class="x-monk-btn-reveal">▶ Xem Reel</button>
                <button class="x-monk-btn-close">✕ Đóng pop-up</button>
              </div>
            </div>
          `;

          const floatingReblur = document.createElement('button');
          floatingReblur.className = 'x-monk-re-blur-floating';
          floatingReblur.innerHTML = `<span>🧘</span><span>Ẩn lại Reel</span>`;
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
                <b>Monk Mode: Đã chặn Instagram Reel trên Bảng tin.</b>
                <div style="font-size:10.5px;opacity:0.85;margin-top:1px;">Bảo vệ sự tập trung, chống nghiện lướt clip ngắn.</div>
              </div>
            </div>
          `;
          const btn = document.createElement('button');
          btn.className = 'x-monk-reveal-btn';
          btn.textContent = 'Xem Reel';
          btn.onclick = (e) => {
            e.preventDefault();
            const isRev = article.classList.toggle('monk-revealed');
            btn.textContent = isRev ? 'Ẩn lại' : 'Xem Reel';
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
              <div class="x-monk-reels-title">Monk Mode: Đã chặn YouTube Shorts</div>
              <div class="x-monk-reels-desc">Video ngắn đã được tạm dừng và làm mờ để bảo vệ sự tập trung tuyệt đối.</div>
              <div class="x-monk-reels-actions">
                <button class="x-monk-btn-reveal">▶ Xem Shorts</button>
                <button class="x-monk-btn-home">🏠 Về Trang chủ</button>
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
              <b>Monk Mode: Đã ẩn khu vực YouTube Shorts trên Bảng tin</b>
              <div style="font-size:11px;opacity:0.85;margin-top:1px;">Duy trì sự tập trung, chống nghiện lướt video ngắn.</div>
            </div>
          </div>
          <button class="x-monk-tray-toggle">Xem Shorts</button>
        `;

        const toggleBtn = banner.querySelector('.x-monk-tray-toggle');
        toggleBtn.onclick = (e) => {
          e.preventDefault();
          const isRevealed = shelf.classList.toggle('monk-revealed');
          toggleBtn.textContent = isRevealed ? 'Ẩn lại' : 'Xem Shorts';
        };

        shelf.prepend(banner);
      }
    });
  }

  function scanFeed() {
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

      candidates.forEach((cont) => {
        checkAndApplyMonkMode(cont, cont.innerText || '');

        const textEls = cont.querySelectorAll('span[dir="auto"], div[dir="auto"]');
        let bestEl = null;
        let maxLen = 0;
        textEls.forEach((el) => {
          if (el.closest('button') || el.closest('time') || el.closest('a[href*="/@"]') || el.classList.contains('x-jev-badge')) return;
          let t = el.innerText.trim();
          t = t.replace(/\s*(Translate|Xem bản dịch)$/i, '').trim();
          if (t.length < 2) return;
          if (/^\d+(\.\d+)?(k|m|b)?\s*(likes?|replies?|views?|lượt thích|câu trả lời|bình luận|chia sẻ)?$/i.test(t)) return;
          if (/^(\d+\s*(s|m|h|d|w|y|giây|phút|giờ|ngày|tuần|tháng|năm)|just now|vừa xong)$/i.test(t)) return;
          if (/^(translate|xem bản dịch|reply|trả lời|like|thích|share|chia sẻ|follow|theo dõi|following|đang theo dõi|edited|đã chỉnh sửa)$/i.test(t)) return;

          if (el.children.length > 3) return;

          if (t.length > maxLen) {
            maxLen = t.length;
            bestEl = el;
          }
        });
        if (bestEl && maxLen >= 2) {
          cont.setAttribute('data-jev-scanned', 'true');
          let cleanText = bestEl.innerText.trim();
          cleanText = cleanText.replace(/\s*(Translate|Xem bản dịch)$/i, '').trim();
          if (textCache.has(cleanText)) {
            renderClassification({ postEl: cont, text: cleanText, textEl: bestEl }, textCache.get(cleanText));
          } else {
            queue.push({ postEl: cont, text: cleanText, textEl: bestEl });
          }
        }
      });
    } else if (platform === 'facebook') {
      // 1. Scan Facebook Reels, Pop-up video player, and Feed Trays
      scanFacebookReels();

      // 2. Scan standard feed units
      document.querySelectorAll('div[data-pagelet^="FeedUnit_"]:not([data-jev-scanned]), div[role="article"]:not([data-jev-scanned]), div[role="feed"] > div:not([data-jev-scanned])').forEach((post) => {
        checkAndApplyMonkMode(post, post.innerText || '');
        const msgEl = post.querySelector('div[data-ad-rendering-role="story_message"], div[data-ad-preview="message"]') ||
                      Array.from(post.querySelectorAll('div[dir="auto"], span[dir="auto"]')).find((el) => el.innerText.trim().length >= 10);
        if (msgEl) {
          let text = msgEl.innerText.trim();
          text = text.replace(/\s*(Translate|Xem bản dịch)$/i, '').trim();
          if (text.length >= 2) {
            post.setAttribute('data-jev-scanned', 'true');
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
      document.querySelectorAll('article[data-testid="tweet"]:not([data-jev-scanned]), div[data-testid="cellInnerDiv"]:not([data-jev-scanned])').forEach((post) => {
        checkAndApplyMonkMode(post, post.innerText || '');
        const textEl = post.querySelector('div[data-testid="tweetText"]');
        if (textEl) {
          let text = textEl.innerText.trim();
          text = text.replace(/\s*(Translate|Xem bản dịch)$/i, '').trim();
          if (text.length >= 2) {
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
    if (document.body && !document.querySelector('.x-jev-floating-pill')) {
      document.body.appendChild(pill);
    }
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

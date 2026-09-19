// Universal Social Anti-Ragebait (Threads, X, Facebook) Powered by Jev
(function () {
  'use strict';

  let config = {
    apiEndpoint: 'https://classifier.dev',
    batchDebounceMs: 120, // Fast batching for instant response
    blurThreshold: 0.50,  // Any post where Rage Bait is majority prediction is blurred
    autoBlurEnabled: true,
  };

  let blockedCount = 0;

  // Detect Active Platform (Threads.com, Threads.net, X, Facebook)
  function getPlatform() {
    const host = window.location.hostname.toLowerCase();
    if (host.includes('threads.net') || host.includes('threads.com')) return 'threads';
    if (host.includes('facebook.com') || host.includes('fb.com')) return 'facebook';
    return 'x';
  }

  // Synchronous persistent cache across reloads/new tabs within the session
  const CACHE_KEY = `x_jev_cache_${getPlatform()}`;
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
      const entries = Array.from(textCache.entries()).slice(-250);
      entries.forEach(([k, v]) => (obj[k] = v));
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(obj));
    } catch (e) {}
  }

  // Load saved extension settings
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['autoBlurEnabled', 'blurThreshold', 'blockedCount'], (res) => {
      if (typeof res.autoBlurEnabled === 'boolean') {
        config.autoBlurEnabled = res.autoBlurEnabled;
      } else {
        chrome.storage.local.set({ autoBlurEnabled: true, blurThreshold: 0.50 });
      }
      if (typeof res.blurThreshold === 'number') {
        config.blurThreshold = res.blurThreshold;
      }
      if (typeof res.blockedCount === 'number') {
        blockedCount = res.blockedCount;
      }
      updatePill();
      applyCurrentStateToDOM();
    });

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'UPDATE_CONFIG') {
        config.autoBlurEnabled = request.config.autoBlurEnabled;
        config.blurThreshold = request.config.blurThreshold;
        updatePill();
        applyCurrentStateToDOM();
        sendResponse({ status: 'ok' });
      }
    });
  }

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
      desc: 'Engineered to provoke anger / outrage (Kích động phẫn nộ / câu war)',
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
      desc: 'Uplifting, entertaining, and positive (Tích cực, giải trí, thư giãn)',
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
      desc: 'Personal thoughts / standard conversation (Thảo luận bình thường)',
      bg: 'rgba(100, 116, 139, 0.15)',
      border: '#64748b',
      color: '#94a3b8',
      isRage: false,
    },
  };

  let queue = [];
  let debounceTimer = null;

  // Floating Status Pill UI
  const pill = document.createElement('div');
  pill.className = 'x-jev-floating-pill';
  function updatePill() {
    const platform = getPlatform().toUpperCase();
    pill.innerHTML = `🛡️ ${platform} Anti-Rage: <span style="color:${config.autoBlurEnabled ? '#4ade80' : '#94a3b8'}">${config.autoBlurEnabled ? 'ON' : 'OFF'}</span> | Blocked: <span style="color:#f87171">${blockedCount}</span>`;
  }
  updatePill();
  pill.title = 'Click to toggle Rage Bait auto-blur on this page';
  pill.addEventListener('click', () => {
    config.autoBlurEnabled = !config.autoBlurEnabled;
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ autoBlurEnabled: config.autoBlurEnabled });
    }
    updatePill();
    applyCurrentStateToDOM();
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

  function applyCurrentStateToDOM() {
    document.querySelectorAll('[data-jev-rage="true"]').forEach((post) => {
      const warning = post.querySelector('.x-jev-warning-box');
      if (config.autoBlurEnabled) {
        post.classList.remove('x-jev-revealed');
        if (warning) warning.style.display = 'flex';
      } else {
        post.classList.add('x-jev-revealed');
        if (warning) warning.style.display = 'none';
      }
    });
  }

  // Call Jev API: Route via background service worker to bypass page CSP on Threads/Facebook
  async function callJevBatch(inputs) {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      return new Promise((resolve) => {
        try {
          chrome.runtime.sendMessage(
            {
              type: 'CLASSIFY_BATCH',
              payload: {
                labels: LABELS,
                inputs: inputs,
                instructions: INSTRUCTIONS,
              },
            },
            (response) => {
              if (chrome.runtime.lastError) {
                console.warn('[Anti-Ragebait] Extension background worker error, falling back:', chrome.runtime.lastError.message);
                directFetch(inputs).then(resolve);
              } else if (response && response.success) {
                resolve(response.results || []);
              } else {
                console.warn('[Anti-Ragebait] Background classify failed:', response?.error);
                directFetch(inputs).then(resolve);
              }
            }
          );
        } catch (e) {
          console.warn('[Anti-Ragebait] SendMessage exception:', e);
          directFetch(inputs).then(resolve);
        }
      });
    }
    return directFetch(inputs);
  }

  // Direct fetch fallback
  async function directFetch(inputs) {
    try {
      const res = await fetch(config.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'social-anti-ragebait/1.2',
        },
        body: JSON.stringify({
          labels: LABELS,
          inputs: inputs,
          instructions: INSTRUCTIONS,
        }),
      });
      const data = await res.json();
      return data.results || [];
    } catch (e) {
      console.warn('[Anti-Ragebait] Direct fetch failed (CSP restriction on this domain):', e);
      return [];
    }
  }

  function renderClassification(item, res) {
    const { postEl, textEl } = item;
    if (!textEl || !textEl.parentElement) return;

    // Prevent duplicate badges
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

    // If classified as Rage Bait and meets sensitivity threshold
    if (meta.isRage && confidence >= config.blurThreshold) {
      postEl.setAttribute('data-jev-rage', 'true');
      blockedCount++;
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ blockedCount });
      }
      updatePill();

      // Mark text & parent container for comprehensive content blur (text + images)
      textEl.setAttribute('data-jev-content', 'true');
      const contentWrapper = textEl.closest('div[dir="auto"]')?.parentElement || textEl.parentElement;
      if (contentWrapper) {
        contentWrapper.setAttribute('data-jev-content', 'true');
      }

      if (!postEl.querySelector('.x-jev-warning-box')) {
        const warningBox = document.createElement('div');
        warningBox.className = 'x-jev-warning-box';
        warningBox.innerHTML = `
          <span class="x-jev-warning-text">🛡️ <b>Rage Bait Warning:</b> This post is engineered to provoke anger and farm drama.</span>
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
        // Place warning box right above badge
        parentContainer.insertBefore(warningBox, badge);
      }

      if (config.autoBlurEnabled) {
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
      saveCacheToStorage();
    }

    if (queue.length > 0) {
      debounceTimer = setTimeout(flushQueue, 80);
    }
  }

  // --- MULTI-PLATFORM SCANNER (THREADS.COM / THREADS.NET, X, FACEBOOK) ---
  function scanPosts() {
    const platform = getPlatform();

    if (platform === 'threads') {
      // Threads (threads.com & threads.net)
      const postContainers = new Set();

      // Selector 1: Containers marked by Threads pressable or article tags
      document.querySelectorAll('div[data-pressable-container="true"], article').forEach((el) => {
        if (!el.hasAttribute('data-jev-scanned')) postContainers.add(el);
      });

      // Selector 2: Anchor links pointing to /post/ permalinks
      document.querySelectorAll('a[href*="/post/"]').forEach((link) => {
        let container = link.closest('div[data-pressable-container="true"]') || link.closest('article');
        if (!container) {
          // Walk up to find post card container with action buttons and text
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

          // Skip metrics, handles, timestamps
          if (t.length < 15) return;
          if (/^\d+(\.\d+)?(k|m)?\s*(likes?|replies?|views?|lượt thích|câu trả lời|bình luận|chia sẻ)$/i.test(t)) return;
          if (/^(\d+\s*(s|m|h|d|w|giây|phút|giờ|ngày|tuần)|just now|vừa xong)$/i.test(t)) return;

          if (t.length > maxLen) {
            maxLen = t.length;
            longestTextEl = el;
          }
        });

        // ONLY mark scanned if we actually extracted substantive text
        if (longestTextEl && maxLen >= 15) {
          post.setAttribute('data-jev-scanned', 'true');
          const cleanText = longestTextEl.innerText.trim();

          // Check instant cache immediately
          if (textCache.has(cleanText)) {
            renderClassification({ postEl: post, text: cleanText, textEl: longestTextEl }, textCache.get(cleanText));
          } else {
            queue.push({ postEl: post, text: cleanText, textEl: longestTextEl });
          }
        }
      });
    } else if (platform === 'x') {
      // X (Twitter)
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
      // Facebook Feed & Groups
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
      debounceTimer = setTimeout(flushQueue, config.batchDebounceMs);
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
  console.log(`[Social Anti-Ragebait] Active on ${getPlatform().toUpperCase()} (${window.location.hostname}) with Jev model 🛡️`);
})();

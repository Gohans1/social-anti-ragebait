// Universal Social Anti-Ragebait (X, Threads, Facebook) Powered by Jev
(function () {
  'use strict';

  let config = {
    apiEndpoint: 'https://classifier.dev',
    batchDebounceMs: 350,
    blurThreshold: 0.65,
    autoBlurEnabled: true,
  };

  let blockedCount = 0;

  // Load saved settings
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['autoBlurEnabled', 'blurThreshold', 'blockedCount'], (res) => {
      if (typeof res.autoBlurEnabled === 'boolean') config.autoBlurEnabled = res.autoBlurEnabled;
      if (typeof res.blurThreshold === 'number') config.blurThreshold = res.blurThreshold;
      if (typeof res.blockedCount === 'number') blockedCount = res.blockedCount;
      updatePill();
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

  const textCache = new Map();
  let queue = [];
  let debounceTimer = null;

  // Detect Active Platform
  function getPlatform() {
    const host = window.location.hostname;
    if (host.includes('threads.net')) return 'threads';
    if (host.includes('facebook.com')) return 'facebook';
    return 'x';
  }

  // Floating Status Pill UI
  const pill = document.createElement('div');
  pill.className = 'x-jev-floating-pill';
  function updatePill() {
    const platform = getPlatform().toUpperCase();
    pill.innerHTML = `🛡️ ${platform} Anti-Ragebait: <span style="color:${config.autoBlurEnabled ? '#4ade80' : '#94a3b8'}">${config.autoBlurEnabled ? 'ON' : 'OFF'}</span> | Blocked: <span style="color:#f87171">${blockedCount}</span>`;
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
  document.body.appendChild(pill);

  function applyCurrentStateToDOM() {
    document.querySelectorAll('[data-jev-rage="true"]').forEach((post) => {
      const content = post.querySelector('[data-jev-content]');
      const warning = post.querySelector('.x-jev-warning-box');
      if (config.autoBlurEnabled) {
        content?.classList.add('x-jev-blurred-content');
        if (warning) warning.style.display = 'flex';
      } else {
        content?.classList.remove('x-jev-blurred-content');
        if (warning) warning.style.display = 'none';
      }
    });
  }

  // Call Jev API
  async function callJevBatch(inputs) {
    try {
      const res = await fetch(config.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'social-anti-ragebait/1.0',
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
      console.warn('[Anti-Ragebait] Jev fetch error:', e);
      return [];
    }
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

    if (meta.isRage && confidence >= config.blurThreshold) {
      postEl.setAttribute('data-jev-rage', 'true');
      blockedCount++;
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ blockedCount });
      }
      updatePill();

      textEl.setAttribute('data-jev-content', 'true');

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
        textEl.classList.toggle('x-jev-blurred-content');
        revealBtn.textContent = textEl.classList.contains('x-jev-blurred-content')
          ? 'Reveal post'
          : 'Re-blur';
      };

      warningBox.appendChild(revealBtn);
      parentContainer.insertBefore(warningBox, textEl);

      if (config.autoBlurEnabled) {
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

  // --- MULTI-PLATFORM SCANNER (X, THREADS, FACEBOOK) ---
  function scanPosts() {
    const platform = getPlatform();

    if (platform === 'x') {
      // X (Twitter)
      document.querySelectorAll('article[data-testid="tweet"]:not([data-jev-scanned])').forEach((post) => {
        post.setAttribute('data-jev-scanned', 'true');
        const textEl = post.querySelector('div[data-testid="tweetText"]');
        if (textEl) {
          const text = textEl.innerText.trim();
          if (text.length >= 15) queue.push({ postEl: post, text, textEl });
        }
      });
    } else if (platform === 'threads') {
      // Threads (Instagram Threads)
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
      // Facebook News Feed & Groups
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
      debounceTimer = setTimeout(flushQueue, config.batchDebounceMs);
    }
  }

  const observer = new MutationObserver(() => scanPosts());
  observer.observe(document.body, { childList: true, subtree: true });

  scanPosts();
  console.log(`[Social Anti-Ragebait] Active on ${getPlatform().toUpperCase()} with multilingual Jev model 🛡️`);
})();

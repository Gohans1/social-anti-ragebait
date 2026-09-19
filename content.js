// Universal Social Shield (Threads, Facebook, X) - Anti-Rage, Anti-Scam, Anti-Seeding, Monk Mode
// Powered by Jev Zero-shot AI (classifier.dev) & Client-side Vision Metadata
(function () {
  'use strict';

  let config = {
    apiEndpoint: 'https://classifier.dev',
    batchDebounceMs: 120,
    confidenceThreshold: 0.50,
    monkModeEnabled: true,       // Hardcore Monk Mode: Block all photos/videos with women & goon-bait
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
    return 'x';
  }

  // Regex pattern matching women visual tags in Meta/X alt-text and captions
  const WOMEN_OR_GOONBAIT_REGEX =
    /(\b(woman|women|girl|girls|female|lady|ladies|bikini|cleavage|swimwear|selfie|thirst\s*trap|goon|gooning|onlyfans|fansly)\b|phụ nữ|con gái|cô gái|gái xinh|nữ sinh|hot girl|mặc hở|khoe thân|áo tắm|nội y|gái|mlem)/i;

  // Fast synchronous session cache (0ms instant response on reload)
  const CACHE_KEY = `social_guardian_cache_${getPlatform()}`;
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

  // Load saved settings from Chrome Storage
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(
      [
        'monkModeEnabled',
        'autoBlurRageEnabled',
        'blockScamsEnabled',
        'collapseSeedingEnabled',
        'confidenceThreshold',
        'monkModeBlockedCount',
        'blockedRageCount',
        'blockedScamCount',
        'cleanedSeedingCount',
      ],
      (res) => {
        if (typeof res.monkModeEnabled === 'boolean') config.monkModeEnabled = res.monkModeEnabled;
        if (typeof res.autoBlurRageEnabled === 'boolean') config.autoBlurRageEnabled = res.autoBlurRageEnabled;
        if (typeof res.blockScamsEnabled === 'boolean') config.blockScamsEnabled = res.blockScamsEnabled;
        if (typeof res.collapseSeedingEnabled === 'boolean') config.collapseSeedingEnabled = res.collapseSeedingEnabled;
        if (typeof res.confidenceThreshold === 'number') config.confidenceThreshold = res.confidenceThreshold;

        if (typeof res.monkModeBlockedCount === 'number') monkModeBlockedCount = res.monkModeBlockedCount;
        if (typeof res.blockedRageCount === 'number') blockedRageCount = res.blockedRageCount;
        if (typeof res.blockedScamCount === 'number') blockedScamCount = res.blockedScamCount;
        if (typeof res.cleanedSeedingCount === 'number') cleanedSeedingCount = res.cleanedSeedingCount;

        updatePill();
        applyStateToDOM();
      }
    );

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'UPDATE_CONFIG') {
        config.monkModeEnabled = request.config.monkModeEnabled;
        config.autoBlurRageEnabled = request.config.autoBlurRageEnabled;
        config.blockScamsEnabled = request.config.blockScamsEnabled;
        config.collapseSeedingEnabled = request.config.collapseSeedingEnabled;
        config.confidenceThreshold = request.config.confidenceThreshold;
        updatePill();
        applyStateToDOM();
        sendResponse({ status: 'ok' });
      }
    });
  }

  const LABELS = [
    'scam / fraudulent scheme',
    'goon baiting / thirst trap / seductive woman media',
    'rage bait / outrage',
    'bot seeding / affiliate spam / fake review',
    'fearmongering / doom',
    'fomo / hype',
    'wholesome / positive',
    'informative / educational',
    'casual discussion / personal',
  ];

  const INSTRUCTIONS =
    'Classify the content into: online scam/financial trap (fake remote CTV, crypto Ponzi, gambling), goon baiting/thirst trap/seductive suggestive female content/OnlyFans funnel, intentional rage-bait/outrage/drama, bot seeding/affiliate manipulation/fake praise, fearmongering, fomo, wholesome, informative, or casual discussion in Vietnamese or English.';

  const BADGE_MAP = {
    'scam / fraudulent scheme': {
      text: '🛑 Lừa đảo / Bẫy tài chính',
      desc: 'Online fraud, fake remote job, crypto Ponzi, or financial trap',
      bg: 'rgba(220, 38, 38, 0.2)',
      border: '#dc2626',
      color: '#f87171',
    },
    'goon baiting / thirst trap / seductive woman media': {
      text: '🔞 Thirst Trap / Goon-bait',
      desc: 'Suggestive content, thirst trap, or onlyfans funnel',
      bg: 'rgba(236, 72, 153, 0.2)',
      border: '#ec4899',
      color: '#f472b6',
    },
    'rage bait / outrage': {
      text: '🚨 Rage Bait',
      desc: 'Engineered to provoke anger / outrage (Kích động phẫn nộ / câu war)',
      bg: 'rgba(239, 68, 68, 0.18)',
      border: '#ef4444',
      color: '#f87171',
    },
    'bot seeding / affiliate spam / fake review': {
      text: '🧹 Seeding / Clone',
      desc: 'Bot farming, fake praise, affiliate trap, or clone seeding',
      bg: 'rgba(168, 85, 247, 0.18)',
      border: '#a855f7',
      color: '#c084fc',
    },
    'fearmongering / doom': {
      text: '⚠️ Doom / Fear',
      desc: 'Fearmongering / inducing anxiety (Gieo rắc sợ hãi / hoang mang)',
      bg: 'rgba(249, 115, 22, 0.18)',
      border: '#f97316',
      color: '#fb923c',
    },
    'fomo / hype': {
      text: '⚡ FOMO / Hype',
      desc: 'Sensationalized hype / fear of missing out (Thổi phồng giật gân)',
      bg: 'rgba(234, 179, 8, 0.18)',
      border: '#eab308',
      color: '#fde047',
    },
    'wholesome / positive': {
      text: '🌿 Wholesome',
      desc: 'Uplifting, entertaining, and positive (Tích cực, giải trí)',
      bg: 'rgba(16, 185, 129, 0.18)',
      border: '#10b981',
      color: '#34d399',
    },
    'informative / educational': {
      text: '💡 Informative',
      desc: 'Objective news / insightful knowledge (Thông tin, kiến thức)',
      bg: 'rgba(6, 182, 212, 0.18)',
      border: '#06b6d4',
      color: '#22d3ee',
    },
    'casual discussion / personal': {
      text: '💬 Discussion / Casual',
      desc: 'Personal thoughts / standard conversation (Thảo luận bình thường)',
      bg: 'rgba(100, 116, 139, 0.15)',
      border: '#64748b',
      color: '#94a3b8',
    },
  };

  let queue = [];
  let debounceTimer = null;

  // Unified Floating Status Pill UI
  const pill = document.createElement('div');
  pill.className = 'x-jev-floating-pill';
  function updatePill() {
    const pName = getPlatform().toUpperCase();
    pill.innerHTML = `🛡️ ${pName}: <span style="color:#4ade80">ON</span> | 🧘 Monk: <span style="color:#38bdf8">${monkModeBlockedCount}</span> | 🚨 Rage: <span style="color:#f87171">${blockedRageCount}</span> | 🛑 Scam: <span style="color:#fb923c">${blockedScamCount}</span> | 🧹 Seed: <span style="color:#c084fc">${cleanedSeedingCount}</span>`;
  }
  updatePill();
  pill.title = 'Social Shield: All-in-One Protection (Click to toggle master state)';
  pill.addEventListener('click', () => {
    const allOn = config.monkModeEnabled || config.autoBlurRageEnabled || config.blockScamsEnabled || config.collapseSeedingEnabled;
    config.monkModeEnabled = !allOn;
    config.autoBlurRageEnabled = !allOn;
    config.blockScamsEnabled = !allOn;
    config.collapseSeedingEnabled = !allOn;

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        monkModeEnabled: config.monkModeEnabled,
        autoBlurRageEnabled: config.autoBlurRageEnabled,
        blockScamsEnabled: config.blockScamsEnabled,
        collapseSeedingEnabled: config.collapseSeedingEnabled,
      });
    }
    updatePill();
    applyStateToDOM();
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

  function applyStateToDOM() {
    // 1. Monk Mode State
    document.querySelectorAll('[data-monk-blocked="true"]').forEach((post) => {
      const box = post.querySelector('.x-monk-warning-box');
      if (config.monkModeEnabled) {
        post.classList.remove('monk-revealed');
        if (box) box.style.display = 'flex';
      } else {
        post.classList.add('monk-revealed');
        if (box) box.style.display = 'none';
      }
    });

    // 2. Rage Bait state
    document.querySelectorAll('[data-jev-rage="true"]').forEach((post) => {
      const warning = post.querySelector('.x-jev-warning-box');
      if (config.autoBlurRageEnabled) {
        post.classList.remove('x-jev-revealed');
        if (warning) warning.style.display = 'flex';
      } else {
        post.classList.add('x-jev-revealed');
        if (warning) warning.style.display = 'none';
      }
    });

    // 3. Scam state
    document.querySelectorAll('[data-jev-scam="true"]').forEach((post) => {
      const scamBox = post.querySelector('.x-jev-scam-box');
      if (config.blockScamsEnabled) {
        post.classList.remove('x-jev-revealed');
        if (scamBox) scamBox.style.display = 'flex';
      } else {
        post.classList.add('x-jev-revealed');
        if (scamBox) scamBox.style.display = 'none';
      }
    });

    // 4. Seeding collapse state
    document.querySelectorAll('[data-jev-seeding="true"]').forEach((post) => {
      const bar = post.querySelector('.x-jev-seeding-collapsed');
      const content = post.querySelector('[data-jev-seeding-content]');
      if (config.collapseSeedingEnabled) {
        if (bar) bar.style.display = 'flex';
        if (content) content.classList.add('x-jev-collapsed-body');
      } else {
        if (bar) bar.style.display = 'none';
        if (content) content.classList.remove('x-jev-collapsed-body');
      }
    });
  }

  // --- HARDCORE MONK MODE: CLIENT-SIDE INSTANT MEDIA SCANNER ---
  // Inspects non-avatar images & videos for Meta AI accessibility alt-tags and captions
  function checkAndApplyMonkMode(postEl, text) {
    if (!config.monkModeEnabled) return false;
    if (postEl.hasAttribute('data-monk-blocked')) return true;

    const mediaList = postEl.querySelectorAll('img, video');
    if (mediaList.length === 0) return false;

    let hasWomenMedia = false;
    let detectedReason = '';

    // Check media alt tags and aria labels
    mediaList.forEach((media) => {
      const isAvatar = (media.closest('a[href*="/@"]') && (media.width < 50 || media.height < 50)) ||
                       media.alt?.toLowerCase().includes('avatar') ||
                       media.alt?.toLowerCase().includes('profile') ||
                       media.src?.includes('profile_images');
      if (isAvatar) return;

      const altText = (media.alt || '') + ' ' + (media.getAttribute('aria-label') || '') + ' ' + (media.title || '');
      if (WOMEN_OR_GOONBAIT_REGEX.test(altText)) {
        hasWomenMedia = true;
        detectedReason = 'Ảnh/Video phụ nữ (Meta AI Alt-Tag)';
      }
    });

    // Also check if text caption has strong goon-bait signals
    if (!hasWomenMedia && WOMEN_OR_GOONBAIT_REGEX.test(text)) {
      hasWomenMedia = true;
      detectedReason = 'Nội dung Goon-baiting / Thirst trap';
    }

    if (hasWomenMedia) {
      postEl.setAttribute('data-monk-blocked', 'true');
      monkModeBlockedCount++;
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ monkModeBlockedCount });
      }
      updatePill();

      // Create Monk Mode Warning Bar
      if (!postEl.querySelector('.x-monk-warning-box')) {
        const box = document.createElement('div');
        box.className = 'x-monk-warning-box';
        box.innerHTML = `
          <div class="x-monk-warning-text">
            <span>🧘</span>
            <div>
              <b>Monk Mode: Đã che ảnh/video để giữ tập trung tuyệt đối.</b>
              <div style="font-size:10.5px;font-weight:400;opacity:0.9;margin-top:1px;">${detectedReason}</div>
            </div>
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

        // Insert at the top of media or before first image
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

  // Call Jev API: Route via background service worker to bypass page CSP
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
                directFetch(inputs).then(resolve);
              } else if (response && response.success) {
                resolve(response.results || []);
              } else {
                directFetch(inputs).then(resolve);
              }
            }
          );
        } catch (e) {
          directFetch(inputs).then(resolve);
        }
      });
    }
    return directFetch(inputs);
  }

  async function directFetch(inputs) {
    try {
      const res = await fetch(config.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'social-shield-suite/2.0',
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
      return [];
    }
  }

  // Unified Rendering Logic
  function renderClassification(item, res) {
    const { postEl, textEl } = item;
    if (!textEl || !textEl.parentElement) return;

    // Check Monk Mode first
    checkAndApplyMonkMode(postEl, item.text);

    if (postEl.hasAttribute('data-jev-handled')) return;

    const label = res.label;
    const confidence = res.confidence || 0;
    const parentContainer = textEl.parentElement;

    // --- PRIORITY 1: SCAM / FRAUDULENT SCHEME ---
    if (label === 'scam / fraudulent scheme' && confidence >= config.confidenceThreshold) {
      postEl.setAttribute('data-jev-handled', 'true');
      postEl.setAttribute('data-jev-scam', 'true');
      blockedScamCount++;
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ blockedScamCount });
      }
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
          <div class="x-jev-scam-text">
            <span>🛑</span>
            <div>
              <b>Cảnh báo Lừa đảo / Bẫy tài chính (${pct}%):</b>
              <div style="font-size:11px;font-weight:400;opacity:0.9;margin-top:2px;">Dấu hiệu: Hứa hẹn thu nhập bất thường, lùa gà crypto hoặc kéo nhóm kín.</div>
            </div>
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

      if (config.blockScamsEnabled) {
        postEl.classList.remove('x-jev-revealed');
      } else {
        postEl.classList.add('x-jev-revealed');
      }
      return;
    }

    // --- PRIORITY 2: GOON BAITING / THIRST TRAP VIA JEV ---
    if (label === 'goon baiting / thirst trap / seductive woman media' && confidence >= config.confidenceThreshold) {
      checkAndApplyMonkMode(postEl, item.text);
      postEl.setAttribute('data-jev-handled', 'true');
      return;
    }

    // --- PRIORITY 3: RAGE BAIT / OUTRAGE ---
    if (label === 'rage bait / outrage' && confidence >= config.confidenceThreshold) {
      postEl.setAttribute('data-jev-handled', 'true');
      postEl.setAttribute('data-jev-rage', 'true');
      blockedRageCount++;
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ blockedRageCount });
      }
      updatePill();

      textEl.setAttribute('data-jev-blur-item', 'true');
      postEl.querySelectorAll('img, video').forEach((m) => {
        if (!m.closest('a[href*="/@"]')) m.setAttribute('data-jev-blur-item', 'true');
      });

      if (!postEl.querySelector('.x-jev-warning-box')) {
        const warningBox = document.createElement('div');
        warningBox.className = 'x-jev-warning-box';
        const pct = Math.round(confidence * 100);
        warningBox.innerHTML = `
          <span class="x-jev-warning-text">🛡️ <b>Rage Bait Warning (${pct}%):</b> Bài viết gây war / kích động đã bị làm mờ.</span>
        `;

        const revealBtn = document.createElement('button');
        revealBtn.className = 'x-jev-reveal-btn';
        revealBtn.textContent = 'Reveal post';
        revealBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const isRevealed = postEl.classList.toggle('x-jev-revealed');
          revealBtn.textContent = isRevealed ? 'Re-blur' : 'Reveal post';
        };

        warningBox.appendChild(revealBtn);
        parentContainer.insertBefore(warningBox, textEl);
      }

      if (config.autoBlurRageEnabled) {
        postEl.classList.remove('x-jev-revealed');
      } else {
        postEl.classList.add('x-jev-revealed');
      }
      return;
    }

    // --- PRIORITY 4: BOT SEEDING / AFFILIATE SPAM / FAKE REVIEW ---
    if (label === 'bot seeding / affiliate spam / fake review' && confidence >= config.confidenceThreshold) {
      postEl.setAttribute('data-jev-handled', 'true');
      postEl.setAttribute('data-jev-seeding', 'true');
      cleanedSeedingCount++;
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ cleanedSeedingCount });
      }
      updatePill();

      textEl.setAttribute('data-jev-seeding-content', 'true');

      if (!postEl.querySelector('.x-jev-seeding-collapsed')) {
        const bar = document.createElement('div');
        bar.className = 'x-jev-seeding-collapsed';
        const pct = Math.round(confidence * 100);
        bar.innerHTML = `
          <div class="x-jev-seeding-label">
            <span>🧹</span>
            <span>Đã thu gọn bình luận nghi vấn <b>Seeding / Clone</b> (${pct}%)</span>
          </div>
          <span class="x-jev-expand-icon">Xem nội dung ▾</span>
        `;

        bar.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const isCollapsed = textEl.classList.toggle('x-jev-collapsed-body');
          bar.querySelector('.x-jev-expand-icon').textContent = isCollapsed ? 'Xem nội dung ▾' : 'Thu gọn ▴';
        };

        parentContainer.insertBefore(bar, textEl);

        if (config.collapseSeedingEnabled) {
          textEl.classList.add('x-jev-collapsed-body');
        }
      }
      return;
    }

    // --- PRIORITY 5: INFORMATIVE / WHOLESOME / CASUAL / DOOM / FOMO BADGE ---
    const meta = BADGE_MAP[label] || BADGE_MAP['casual discussion / personal'];
    if (!postEl.querySelector('.x-jev-badge')) {
      const badge = document.createElement('div');
      badge.className = 'x-jev-badge';
      badge.style.backgroundColor = meta.bg;
      badge.style.borderColor = meta.border;
      badge.style.color = meta.color;
      badge.title = `${meta.desc} (Confidence: ${Math.round(confidence * 100)}%)`;

      const pct = Math.round(confidence * 100);
      badge.innerHTML = `<span>${meta.text}</span><span class="x-jev-confidence">${pct}%</span>`;
      parentContainer.insertBefore(badge, textEl);
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

  // Scanner for Posts & Comments
  function scanFeed() {
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
            if (curr.querySelectorAll('svg').length >= 2 && curr.querySelector('span[dir="auto"], div[dir="auto"]')) {
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
        // Fast instant client-side check for Monk Mode on any images before waiting for text
        checkAndApplyMonkMode(post, post.innerText || '');

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
    } else if (platform === 'facebook') {
      document.querySelectorAll('div[data-pagelet^="FeedUnit_"]:not([data-jev-scanned]), div[role="article"]:not([data-jev-scanned]), div[role="feed"] > div:not([data-jev-scanned])').forEach((post) => {
        checkAndApplyMonkMode(post, post.innerText || '');

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

      // Individual comments
      document.querySelectorAll('div[aria-label*="bình luận"], div[aria-label*="Comment"], ul > li div[dir="auto"]:not([data-jev-scanned])').forEach((cmt) => {
        const t = cmt.innerText.trim();
        if (t.length >= 15 && !cmt.closest('[data-jev-scanned]')) {
          cmt.setAttribute('data-jev-scanned', 'true');
          if (textCache.has(t)) {
            renderClassification({ postEl: cmt, text: t, textEl: cmt }, textCache.get(t));
          } else {
            queue.push({ postEl: cmt, text: t, textEl: cmt });
          }
        }
      });
    } else if (platform === 'x') {
      document.querySelectorAll('article[data-testid="tweet"]:not([data-jev-scanned])').forEach((post) => {
        checkAndApplyMonkMode(post, post.innerText || '');

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
      debounceTimer = setTimeout(flushQueue, config.batchDebounceMs);
    }
  }

  const observer = new MutationObserver(() => scanFeed());
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
  }

  initObserver();
  console.log(`[Social Shield + Monk Mode] Active on ${getPlatform().toUpperCase()} (${window.location.hostname}) 🛡️`);
})();

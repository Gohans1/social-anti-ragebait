// Universal Social Shield (Threads, Facebook, X) - Anti-Rage, Anti-Scam, Anti-Seeding, Monk Mode
// Powered by Jev Zero-shot AI (classifier.dev) & Client-side Vision Metadata
(function () {
  'use strict';

  let config = {
    apiEndpoint: 'https://classifier.dev/',
    batchDebounceMs: 120,
    confidenceThreshold: 0.30,
    filterMotivationalEnabled: true,
    filterMemeEnabled: true,
    filterDeepDiveEnabled: true,
    filterWholesomeEnabled: true,
    filterDoomEnabled: true,
    filterFomoEnabled: true,
    filterCasualEnabled: true,
    monkModeEnabled: true,       // Hardcore Monk Mode: Block all photos/videos with women & goon-bait
    blockReelsEnabled: true,     // Block Reels pop-ups & short videos on Facebook
    autoBlurRageEnabled: true,
    blockScamsEnabled: true,
    collapseSeedingEnabled: true,
    hideFloatingPill: false,
    customLabels: [],
  };

  let scannedCount = 0;
  let monkModeBlockedCount = 0;
  let blockedRageCount = 0;
  let blockedScamCount = 0;
  let cleanedSeedingCount = 0;
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

  // Regex pattern matching women visual tags in Meta/X alt-text and captions
  const WOMEN_OR_GOONBAIT_REGEX =
    /(\b(woman|women|girl|girls|female|lady|ladies|bikini|cleavage|swimwear|selfie|thirst\s*trap|goon|gooning|onlyfans|fansly)\b|phụ nữ|con gái|cô gái|gái xinh|nữ sinh|hot girl|mặc hở|khoe thân|áo tắm|nội y|gái|mlem)/i;

  // Fast synchronous session cache (0ms instant response on reload)
  const CACHE_KEY = `social_guardian_cache_v4_${getPlatform()}`;
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

  const COUNTED_KEY = `social_guardian_counted_v1_${getPlatform()}`;
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

  // Load saved settings from Chrome Storage
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(
      [
        'filterMotivationalEnabled',
        'filterMemeEnabled',
        'filterDeepDiveEnabled',
        'filterWholesomeEnabled',
        'filterDoomEnabled',
        'filterFomoEnabled',
        'filterCasualEnabled',
        'customLabels',
        'monkModeEnabled',
        'blockReelsEnabled',
        'autoBlurRageEnabled',
        'blockScamsEnabled',
        'collapseSeedingEnabled',
        'hideFloatingPill',
        'confidenceThreshold',
        'monkModeBlockedCount',
        'blockedRageCount',
        'blockedScamCount',
        'cleanedSeedingCount',
        'motivationalCount',
        'memeCount',
        'deepDiveCount',
        'wholesomeCount',
        'doomCount',
        'fomoCount',
        'casualCount',
        'customCount',
      ],
      (res) => {
        if (typeof res.filterMotivationalEnabled === 'boolean') config.filterMotivationalEnabled = res.filterMotivationalEnabled;
        if (typeof res.filterMemeEnabled === 'boolean') config.filterMemeEnabled = res.filterMemeEnabled;
        if (typeof res.filterDeepDiveEnabled === 'boolean') config.filterDeepDiveEnabled = res.filterDeepDiveEnabled;
        if (typeof res.filterWholesomeEnabled === 'boolean') config.filterWholesomeEnabled = res.filterWholesomeEnabled;
        if (typeof res.filterDoomEnabled === 'boolean') config.filterDoomEnabled = res.filterDoomEnabled;
        if (typeof res.filterFomoEnabled === 'boolean') config.filterFomoEnabled = res.filterFomoEnabled;
        if (typeof res.filterCasualEnabled === 'boolean') config.filterCasualEnabled = res.filterCasualEnabled;
        if (Array.isArray(res.customLabels)) config.customLabels = res.customLabels;
        if (typeof res.monkModeEnabled === 'boolean') config.monkModeEnabled = res.monkModeEnabled;
        if (typeof res.blockReelsEnabled === 'boolean') config.blockReelsEnabled = res.blockReelsEnabled;
        if (typeof res.autoBlurRageEnabled === 'boolean') config.autoBlurRageEnabled = res.autoBlurRageEnabled;
        if (typeof res.blockScamsEnabled === 'boolean') config.blockScamsEnabled = res.blockScamsEnabled;
        if (typeof res.collapseSeedingEnabled === 'boolean') config.collapseSeedingEnabled = res.collapseSeedingEnabled;
        if (typeof res.hideFloatingPill === 'boolean') config.hideFloatingPill = res.hideFloatingPill;
        if (typeof res.confidenceThreshold === 'number') {
          config.confidenceThreshold = res.confidenceThreshold;
        }

        if (typeof res.monkModeBlockedCount === 'number') monkModeBlockedCount = res.monkModeBlockedCount;
        if (typeof res.blockedRageCount === 'number') blockedRageCount = res.blockedRageCount;
        if (typeof res.blockedScamCount === 'number') blockedScamCount = res.blockedScamCount;
        if (typeof res.cleanedSeedingCount === 'number') cleanedSeedingCount = res.cleanedSeedingCount;
        if (typeof res.motivationalCount === 'number') motivationalCount = res.motivationalCount;
        if (typeof res.memeCount === 'number') memeCount = res.memeCount;
        if (typeof res.deepDiveCount === 'number') deepDiveCount = res.deepDiveCount;
        if (typeof res.wholesomeCount === 'number') wholesomeCount = res.wholesomeCount;
        if (typeof res.doomCount === 'number') doomCount = res.doomCount;
        if (typeof res.fomoCount === 'number') fomoCount = res.fomoCount;
        if (typeof res.casualCount === 'number') casualCount = res.casualCount;
        if (typeof res.customCount === 'number') customCount = res.customCount;

        updatePill();
        applyStateToDOM();
      }
    );

    const TAXONOMY_KEYS = [
      'filterMotivationalEnabled',
      'filterMemeEnabled',
      'filterDeepDiveEnabled',
      'filterWholesomeEnabled',
      'filterDoomEnabled',
      'filterFomoEnabled',
      'filterCasualEnabled',
      'customLabels',
      'autoBlurRageEnabled',
      'blockScamsEnabled',
      'collapseSeedingEnabled',
      'confidenceThreshold',
    ];

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'UPDATE_CONFIG') {
        let taxonomyChanged = false;
        TAXONOMY_KEYS.forEach((key) => {
          if (key === 'customLabels') {
            if (Array.isArray(request.config.customLabels) && JSON.stringify(request.config.customLabels) !== JSON.stringify(config.customLabels)) {
              taxonomyChanged = true;
            }
          } else if (request.config[key] !== undefined && request.config[key] !== config[key]) {
            taxonomyChanged = true;
          }
        });

        if (typeof request.config.filterMotivationalEnabled === 'boolean') config.filterMotivationalEnabled = request.config.filterMotivationalEnabled;
        if (typeof request.config.filterMemeEnabled === 'boolean') config.filterMemeEnabled = request.config.filterMemeEnabled;
        if (typeof request.config.filterDeepDiveEnabled === 'boolean') config.filterDeepDiveEnabled = request.config.filterDeepDiveEnabled;
        if (typeof request.config.filterWholesomeEnabled === 'boolean') config.filterWholesomeEnabled = request.config.filterWholesomeEnabled;
        if (typeof request.config.filterDoomEnabled === 'boolean') config.filterDoomEnabled = request.config.filterDoomEnabled;
        if (typeof request.config.filterFomoEnabled === 'boolean') config.filterFomoEnabled = request.config.filterFomoEnabled;
        if (typeof request.config.filterCasualEnabled === 'boolean') config.filterCasualEnabled = request.config.filterCasualEnabled;
        if (Array.isArray(request.config.customLabels)) config.customLabels = request.config.customLabels;
        config.monkModeEnabled = request.config.monkModeEnabled;
        if (typeof request.config.blockReelsEnabled === 'boolean') config.blockReelsEnabled = request.config.blockReelsEnabled;
        config.autoBlurRageEnabled = request.config.autoBlurRageEnabled;
        config.blockScamsEnabled = request.config.blockScamsEnabled;
        config.collapseSeedingEnabled = request.config.collapseSeedingEnabled;
        if (typeof request.config.hideFloatingPill === 'boolean') config.hideFloatingPill = request.config.hideFloatingPill;
        config.confidenceThreshold = request.config.confidenceThreshold;

        if (taxonomyChanged) {
          textCache.clear();
          saveCacheToStorage();
        }
        updatePill();
        applyStateToDOM();
        sendResponse({ status: 'ok' });
      } else if (request.type === 'RESET_STATS') {
        motivationalCount = 0;
        memeCount = 0;
        deepDiveCount = 0;
        wholesomeCount = 0;
        doomCount = 0;
        fomoCount = 0;
        casualCount = 0;
        customCount = 0;
        monkModeBlockedCount = 0;
        blockedRageCount = 0;
        blockedScamCount = 0;
        cleanedSeedingCount = 0;
        countedTexts.clear();
        saveCountedToStorage();
        updatePill();
        sendResponse({ status: 'ok' });
      }
    });

    if (chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        let configChanged = false;
        let taxonomyChanged = false;
        [
          'filterMotivationalEnabled',
          'filterMemeEnabled',
          'filterDeepDiveEnabled',
          'filterWholesomeEnabled',
          'filterDoomEnabled',
          'filterFomoEnabled',
          'filterCasualEnabled',
          'customLabels',
          'monkModeEnabled',
          'blockReelsEnabled',
          'autoBlurRageEnabled',
          'blockScamsEnabled',
          'collapseSeedingEnabled',
          'confidenceThreshold',
          'hideFloatingPill',
        ].forEach((key) => {
          if (changes[key]) {
            if (key === 'customLabels') {
              if (JSON.stringify(changes.customLabels.newValue) !== JSON.stringify(config.customLabels)) {
                taxonomyChanged = true;
              }
              config.customLabels = changes.customLabels.newValue || [];
            } else {
              if (TAXONOMY_KEYS.includes(key) && changes[key].newValue !== config[key]) {
                taxonomyChanged = true;
              }
              config[key] = changes[key].newValue;
            }
            configChanged = true;
          }
        });

        if (changes.motivationalCount) motivationalCount = changes.motivationalCount.newValue || 0;
        if (changes.memeCount) memeCount = changes.memeCount.newValue || 0;
        if (changes.deepDiveCount) deepDiveCount = changes.deepDiveCount.newValue || 0;
        if (changes.wholesomeCount) wholesomeCount = changes.wholesomeCount.newValue || 0;
        if (changes.doomCount) doomCount = changes.doomCount.newValue || 0;
        if (changes.fomoCount) fomoCount = changes.fomoCount.newValue || 0;
        if (changes.casualCount) casualCount = changes.casualCount.newValue || 0;
        if (changes.customCount) customCount = changes.customCount.newValue || 0;
        if (changes.monkModeBlockedCount) monkModeBlockedCount = changes.monkModeBlockedCount.newValue || 0;
        if (changes.blockedRageCount) blockedRageCount = changes.blockedRageCount.newValue || 0;
        if (changes.blockedScamCount) blockedScamCount = changes.blockedScamCount.newValue || 0;
        if (changes.cleanedSeedingCount) cleanedSeedingCount = changes.cleanedSeedingCount.newValue || 0;

        if (taxonomyChanged) {
          textCache.clear();
          saveCacheToStorage();
        }
        if (configChanged) {
          applyStateToDOM();
        }

        updatePill();
      });
    }
  }

  const TAXONOMY_CATALOG = {
    'self-improvement / motivational': {
      configKey: 'filterMotivationalEnabled',
      instruction: 'personal growth, discipline, fitness, productivity lessons, inspiring mindsets, self-help, stoicism.',
      badge: {
        text: '🌱 Động lực / Mindset',
        desc: 'Personal growth, productivity, and constructive mindset (Phát triển bản thân, động lực)',
        bg: 'rgba(245, 158, 11, 0.18)',
        border: '#f59e0b',
        color: '#fbbf24',
      },
    },
    'meme / humor / satire': {
      configKey: 'filterMemeEnabled',
      instruction: 'lighthearted jokes, funny memes, sarcastic humor, parody, troll posts.',
      badge: {
        text: '🎭 Meme / Giải trí',
        desc: 'Humor, memes, satire, and playful wit (Hài hước, ảnh chế, troll vui)',
        bg: 'rgba(236, 72, 153, 0.18)',
        border: '#ec4899',
        color: '#f472b6',
      },
    },
    'deep dive / technical breakdown / industry insider': {
      configKey: 'filterDeepDiveEnabled',
      instruction: 'in-depth technical threads, architectural teardowns, insider industry analysis, comprehensive teardowns of complex problems.',
      badge: {
        text: '🔬 Mổ xẻ / Deep Dive',
        desc: 'Detailed domain teardown, insider analysis, or technical deep dive (Phân tích chuyên sâu)',
        bg: 'rgba(99, 102, 241, 0.2)',
        border: '#6366f1',
        color: '#818cf8',
      },
    },
    'wholesome / positive': {
      configKey: 'filterWholesomeEnabled',
      instruction: 'uplifting, heartwarming, kind, peaceful, constructive positive stories, wholesome moments.',
      badge: {
        text: '🌿 Wholesome / Tích cực',
        desc: 'Uplifting, heartwarming, and constructive positive content (Ấm áp, tích cực)',
        bg: 'rgba(16, 185, 129, 0.18)',
        border: '#10b981',
        color: '#34d399',
      },
    },
    'fearmongering / doom': {
      configKey: 'filterDoomEnabled',
      instruction: 'alarming, sensationalized bad news, apocalyptic anxiety, catastrophic predictions, fearmongering.',
      badge: {
        text: '⚠️ Doom / Gieo rắc sợ hãi',
        desc: 'Sensationalized bad news, existential threat, or doom anxiety (Gieo rắc sợ hãi / bi quan)',
        bg: 'rgba(249, 115, 22, 0.18)',
        border: '#f97316',
        color: '#fb923c',
      },
    },
    'fomo / hype': {
      configKey: 'filterFomoEnabled',
      countKey: 'fomoCount',
      badge: {
        text: '⚡ FOMO / Hype',
        desc: 'Hyperbolic hype, get-rich-quick claims (Lùa gà, thổi phồng ảo)',
        bg: 'rgba(234, 179, 8, 0.15)',
        border: '#eab308',
        color: '#fde047',
      },
      instruction: 'exaggerated breakthrough hype, urgency inducing claims, overnight wealth promises, or artificial urgency.',
    },
    'other / casual discussion': {
      configKey: 'filterCasualEnabled',
      countKey: 'casualCount',
      badge: {
        text: '💬 Thảo luận / Khác',
        desc: 'Everyday casual talk or general post (Thảo luận bình thường)',
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

  // Unified Floating Status Pill UI
  const pill = document.createElement('div');
  pill.className = 'x-jev-floating-pill';

  function initPill() {
    if (config.hideFloatingPill) {
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

    pill.removeAttribute('data-hidden');
    pill.classList.remove('x-jev-pill-hidden');
    pill.style.setProperty('display', 'flex', 'important');
    if (document.body && !document.contains(pill)) {
      document.body.appendChild(pill);
    }
  }

  function updatePill() {
    if (config.hideFloatingPill) {
      initPill();
      return;
    }
    initPill();
    const pName = getPlatform().toUpperCase();
    const parts = [
      `🛡️ ${pName}: <span style="color:#4ade80">ON</span>`,
      `👁️ Quét: <span style="color:#a5f3fc">${scannedCount}</span>`,
    ];
    if (config.autoBlurRageEnabled) {
      parts.push(`🚨 Rage: <span style="color:#f87171">${blockedRageCount}</span>`);
    }
    if (config.filterMotivationalEnabled !== false) {
      parts.push(`🌱 Động lực: <span style="color:#fbbf24">${motivationalCount}</span>`);
    }
    if (config.filterMemeEnabled !== false) {
      parts.push(`🎭 Meme: <span style="color:#f472b6">${memeCount}</span>`);
    }
    if (config.filterDeepDiveEnabled !== false) {
      parts.push(`🔬 Deep Dive: <span style="color:#818cf8">${deepDiveCount}</span>`);
    }
    if (config.filterWholesomeEnabled !== false && wholesomeCount > 0) {
      parts.push(`🌿 Wholesome: <span style="color:#34d399">${wholesomeCount}</span>`);
    }
    if (config.filterDoomEnabled !== false && doomCount > 0) {
      parts.push(`⚠️ Doom: <span style="color:#fb923c">${doomCount}</span>`);
    }
    if (config.filterFomoEnabled !== false && fomoCount > 0) {
      parts.push(`⚡ FOMO: <span style="color:#fde047">${fomoCount}</span>`);
    }
    if (config.filterCasualEnabled !== false && casualCount > 0) {
      parts.push(`💬 Thảo luận: <span style="color:#94a3b8">${casualCount}</span>`);
    }
    const hasActiveCustom = Array.isArray(config.customLabels) && config.customLabels.some((c) => (c && typeof c === 'object' ? c.enabled !== false : Boolean(c)));
    if (hasActiveCustom && customCount > 0) {
      parts.push(`🏷️ Custom: <span style="color:#c084fc">${customCount}</span>`);
    }
    pill.innerHTML = parts.join(' | ') + ` <span class="x-jev-pill-close" title="Ẩn thanh trạng thái nổi này (bật lại trong popup)">✕</span>`;
    const closeBtn = pill.querySelector('.x-jev-pill-close');
    if (closeBtn) {
      closeBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        config.hideFloatingPill = true;
        initPill();
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ hideFloatingPill: true });
        }
      };
    }
  }

  updatePill();
  pill.title = 'Social Shield: All-in-One Protection (Click to toggle master state)';
  pill.addEventListener('click', (e) => {
    if (e.target.closest('.x-jev-pill-close')) return;
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

  if (document.body) {
    initPill();
  } else {
    document.addEventListener('DOMContentLoaded', initPill);
  }

  function applyStateToDOM() {
    // 0. Facebook Reels & Video Popups State
    document.querySelectorAll('[data-monk-reels-blocked="true"]').forEach((dialog) => {
      const overlay = dialog.querySelector('.x-monk-reels-overlay');
      if (config.monkModeEnabled || config.blockReelsEnabled) {
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
      if (config.monkModeEnabled || config.blockReelsEnabled) {
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

    // 5. Curated & Custom Badges State
    document.querySelectorAll('.x-jev-badge').forEach((badge) => {
      const cat = badge.getAttribute('data-jev-badge-category');
      const def = TAXONOMY_CATALOG[cat];
      let isHidden = false;
      if ((def && config[def.configKey] === false) || (cat === 'other / casual discussion' && window.location.pathname.includes('/activity'))) {
        isHidden = true;
      } else if (Array.isArray(config.customLabels)) {
        const customFound = config.customLabels.find(
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

    // 6. Restore bypassed posts if taxonomy is enabled
    const activeTaxonomy = getActiveTaxonomy(config);
    if (activeTaxonomy.labels && activeTaxonomy.labels.length > 1) {
      let restoredCount = 0;
      document.querySelectorAll('[data-jev-bypassed="true"]').forEach((post) => {
        post.removeAttribute('data-jev-bypassed');
        post.removeAttribute('data-jev-scanned');
        post.removeAttribute('data-jev-cmt-scanned');
        post.removeAttribute('data-jev-handled');
        restoredCount++;
      });
      if (restoredCount > 0 && typeof scheduleScan === 'function') {
        scheduleScan();
      }
    }
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
  // Call Jev API: Route via background service worker to bypass page CSP
  async function callJevBatch(inputs) {
    const taxonomy = getActiveTaxonomy(config);
    if (!taxonomy.labels || taxonomy.labels.length <= 1) {
      return inputs.map(() => ({ label: CATCH_ALL_LABEL, confidence: 1 }));
    }

    console.log(`[Social Shield] 📡 Gửi ${inputs.length} mẫu text lên Jev AI (active labels: ${taxonomy.labels.length})...`);
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      return new Promise((resolve) => {
        try {
          chrome.runtime.sendMessage(
            {
              type: 'CLASSIFY_BATCH',
              payload: {
                labels: taxonomy.labels,
                inputs: inputs,
                instructions: taxonomy.instructions,
              },
            },
            (response) => {
              if (chrome.runtime.lastError) {
                console.warn('[Social Shield] Worker error, direct fetch fallback:', chrome.runtime.lastError.message);
                directFetch(inputs, taxonomy).then(resolve);
              } else if (response && response.success) {
                console.log(`[Social Shield] ✅ Nhận kết quả Jev cho ${response.results?.length} items.`);
                resolve(response.results || []);
              } else {
                directFetch(inputs, taxonomy).then(resolve);
              }
            }
          );
        } catch (e) {
          directFetch(inputs, taxonomy).then(resolve);
        }
      });
    }
    return directFetch(inputs, taxonomy);
  }

  async function directFetch(inputs, activeTax) {
    try {
      const tax = activeTax || getActiveTaxonomy(config);
      if (!tax.labels || tax.labels.length <= 1) {
        return inputs.map(() => ({ label: CATCH_ALL_LABEL, confidence: 1 }));
      }
      const res = await fetch(config.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          labels: tax.labels,
          inputs: inputs,
          instructions: tax.instructions,
          multi: true,
          max_labels: 5,
        }),
      });
      const data = await res.json();
      return data.results || [];
    } catch (e) {
      return [];
    }
  }

  function isProfileOnlyLink(el) {
    if (!el) return false;
    const a = el.closest('a[href*="/@"]');
    if (!a) return false;
    const href = a.getAttribute('href') || '';
    // If href contains /post/ or /t/, it links to post content, NOT a user profile link!
    return !href.includes('/post/') && !href.includes('/t/');
  }

  // Unified Rendering Logic
  function renderClassification(item, res) {
    const { postEl, textEl } = item;
    if (!textEl || !textEl.parentElement) return;

    // Check Monk Mode first
    checkAndApplyMonkMode(postEl, item.text);

    if (postEl.hasAttribute('data-jev-handled')) return;
    if (!res || typeof res !== 'object') return;

    const scores = (typeof res.scores === 'object' && res.scores !== null)
      ? res.scores
      : (res.label ? { [res.label]: res.confidence || 0 } : {});
    const parentContainer = textEl.parentElement;

    const matchedLabels = Object.entries(scores)
      .filter(([, s]) => typeof s === 'number' && Number.isFinite(s) && s >= config.confidenceThreshold)
      .map(([l, s]) => `${l} (${Math.round(s * 100)}%)`);
    console.log(`[Social Shield 🔍] "${item.text.slice(0, 35)}..." => ${matchedLabels.join(', ') || 'no match'}`);

    // --- PRIORITY 1: SCAM / FRAUDULENT SCHEME ---
    const rawScam = scores['scam / fraudulent scheme'];
    const scamScore = typeof rawScam === 'number' && Number.isFinite(rawScam) ? rawScam : 0;
    if (scamScore >= config.confidenceThreshold) {
      postEl.setAttribute('data-jev-handled', 'true');
      postEl.setAttribute('data-jev-scam', 'true');
      console.info(`[Social Shield 🛑 CHẶN SCAM]`, item.text);
      blockedScamCount++;
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ blockedScamCount });
      }
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

    // --- PRIORITY 2: RAGE BAIT / TOXIC / DISMISSIVE NEGATIVITY ---
    const rawRage =
      scores['rage bait / toxic / hostile / dismissive negativity'] || scores['rage bait / outrage'];
    const rageScore = typeof rawRage === 'number' && Number.isFinite(rawRage) ? rawRage : 0;
    if (rageScore >= config.confidenceThreshold) {
      postEl.setAttribute('data-jev-handled', 'true');
      postEl.setAttribute('data-jev-rage', 'true');
      console.info(`[Social Shield 🚨 CHẶN RAGE BAIT / TOXIC]`, item.text);
      blockedRageCount++;
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ blockedRageCount });
      }
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
      postEl.querySelectorAll('img, video').forEach((m) => {
        if (!isProfileOnlyLink(m)) m.setAttribute('data-jev-blur-item', 'true');
      });

      if (!postEl.querySelector('.x-jev-warning-box')) {
        const warningBox = document.createElement('div');
        warningBox.className = 'x-jev-warning-box';
        const pct = Math.round(rageScore * 100);
        warningBox.innerHTML = `
          <span class="x-jev-warning-text">🛡️ <b>Rage / Toxic Warning (${pct}%):</b> Bài viết / bình luận tiêu cực, công kích, vô bổ đã bị làm mờ.</span>
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

    // --- PRIORITY 3: BOT SEEDING / AFFILIATE SPAM / FAKE REVIEW ---
    const rawSeeding =
      scores['bot seeding / affiliate spam / fake review'] || scores['bot seeding / affiliate spam'];
    const seedingScore = typeof rawSeeding === 'number' && Number.isFinite(rawSeeding) ? rawSeeding : 0;
    if (seedingScore >= config.confidenceThreshold) {
      postEl.setAttribute('data-jev-handled', 'true');
      postEl.setAttribute('data-jev-seeding', 'true');
      console.info(`[Social Shield 🧹 THU GỌN SEEDING]`, item.text);
      cleanedSeedingCount++;
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ cleanedSeedingCount });
      }
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

    // --- PRIORITY 4: MULTI-TAG CONTENT BADGES ---
    const isActivity = window.location.pathname.includes('/activity');
    const eligibleBadges = [];

    Object.entries(scores).forEach(([candidateLabel, score]) => {
      if (typeof score !== 'number' || !Number.isFinite(score) || score < config.confidenceThreshold) return;
      if (
        candidateLabel === 'scam / fraudulent scheme' ||
        candidateLabel === 'rage bait / toxic / hostile / dismissive negativity' ||
        candidateLabel === 'rage bait / outrage' ||
        candidateLabel === 'bot seeding / affiliate spam / fake review' ||
        candidateLabel === 'bot seeding / affiliate spam'
      ) {
        return;
      }
      if (candidateLabel === 'other / casual discussion' && (config.filterCasualEnabled === false || isActivity)) {
        return;
      }

      const def = TAXONOMY_CATALOG[candidateLabel];
      if (def && config[def.configKey] === false) {
        return;
      }

      let isCustom = false;
      let customMeta = null;
      if (Array.isArray(config.customLabels)) {
        const customFound = config.customLabels.find(
          (c) => (typeof c === 'string' ? c : c?.name)?.trim().toLowerCase() === candidateLabel?.trim().toLowerCase()
        );
        if (customFound) {
          const isEnabled = typeof customFound === 'object' ? customFound.enabled !== false : true;
          if (!isEnabled) return;
          isCustom = true;
          const displayName = typeof customFound === 'object' ? customFound.name : customFound;
          customMeta = {
            text: `🏷️ ${displayName}`,
            desc: `Nhãn tùy chỉnh: ${displayName}`,
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

    // Sort by score descending and cap to top 4 badges
    eligibleBadges.sort((a, b) => b.score - a.score);
    const selectedBadges = eligibleBadges.slice(0, 4);

    if (selectedBadges.length > 0) {
      if (!countedTexts.has(item.text)) {
        countedTexts.add(item.text);
        saveCountedToStorage();
        postEl.setAttribute('data-jev-counted', 'true');

        let storageUpdates = {};
        selectedBadges.forEach(({ label, isCustom }) => {
          if (label === 'self-improvement / motivational') {
            motivationalCount++;
            storageUpdates.motivationalCount = motivationalCount;
          } else if (label === 'meme / humor / satire') {
            memeCount++;
            storageUpdates.memeCount = memeCount;
          } else if (label === 'deep dive / technical breakdown / industry insider') {
            deepDiveCount++;
            storageUpdates.deepDiveCount = deepDiveCount;
          } else if (label === 'wholesome / positive') {
            wholesomeCount++;
            storageUpdates.wholesomeCount = wholesomeCount;
          } else if (label === 'fearmongering / doom') {
            doomCount++;
            storageUpdates.doomCount = doomCount;
          } else if (label === 'fomo / hype') {
            fomoCount++;
            storageUpdates.fomoCount = fomoCount;
          } else if (label === 'other / casual discussion') {
            casualCount++;
            storageUpdates.casualCount = casualCount;
          } else if (isCustom) {
            customCount++;
            storageUpdates.customCount = customCount;
          }
        });

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local && Object.keys(storageUpdates).length > 0) {
          chrome.storage.local.set(storageUpdates);
        }
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

    postEl.setAttribute('data-jev-handled', 'true');
  }

  async function flushQueue() {
    if (queue.length === 0) return;

    const taxonomy = getActiveTaxonomy(config);
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
        saveCacheToStorage();
      } else {
        // Clear data-jev-scanned and data-jev-cmt-scanned on failure so posts can be retried on next scroll
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

  // --- FACEBOOK REELS & VIDEO POPUPS / TRAYS SCANNER ---
  function scanFacebookReels() {
    if (getPlatform() !== 'facebook') return;
    if (!config.monkModeEnabled && !config.blockReelsEnabled) return;

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
          monkModeBlockedCount++;
          if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ monkModeBlockedCount });
          }
          updatePill();
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
        monkModeBlockedCount++;
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ monkModeBlockedCount });
        }
        updatePill();

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
    if (!config.monkModeEnabled && !config.blockReelsEnabled) return;

    // 1. Direct Reels Page (`instagram.com/reels/` or `instagram.com/reel/...`)
    if (window.location.pathname.includes('/reel')) {
      const mainEl = document.querySelector('main[role="main"]') || document.body;
      const videos = mainEl.querySelectorAll('video');
      if (videos.length > 0) {
        mainEl.setAttribute('data-monk-reels-blocked', 'true');
        if (!mainEl.hasAttribute('data-monk-reels-counted')) {
          mainEl.setAttribute('data-monk-reels-counted', 'true');
          monkModeBlockedCount++;
          if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ monkModeBlockedCount });
          }
          updatePill();
        }

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

    // 2. Modal Dialogs (`role="dialog"` containing reel link or video)
    const dialogs = document.querySelectorAll('div[role="dialog"]');
    dialogs.forEach((dialog) => {
      const hasReel = dialog.querySelector('a[href*="/reel/"], a[href*="/reels/"]') ||
                      window.location.pathname.includes('/reel') ||
                      dialog.querySelector('video');
      const videos = dialog.querySelectorAll('video');
      if (hasReel && videos.length > 0) {
        if (!dialog.hasAttribute('data-monk-reels-blocked')) {
          dialog.setAttribute('data-monk-reels-blocked', 'true');
          monkModeBlockedCount++;
          if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ monkModeBlockedCount });
          }
          updatePill();
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

    // 3. In-Feed Reels / Clips (`article:has(video)` with reel link or clip)
    document.querySelectorAll('article:not([data-monk-reels-handled])').forEach((article) => {
      const hasReel = article.querySelector('a[href*="/reel/"], a[href*="/reels/"]');
      const videos = article.querySelectorAll('video');
      if (hasReel && videos.length > 0) {
        article.setAttribute('data-monk-reels-handled', 'true');
        article.setAttribute('data-monk-reels-blocked', 'true');
        monkModeBlockedCount++;
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ monkModeBlockedCount });
        }
        updatePill();

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

    // 4. Explore Grid Items (`a[href*="/reel/"]`)
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
    if (!config.monkModeEnabled && !config.blockReelsEnabled) return;

    // 1. Direct / Standalone YouTube Shorts (`youtube.com/shorts/...`)
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
        monkModeBlockedCount++;
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ monkModeBlockedCount });
        }
        updatePill();

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

    // 2. Feed Shorts Shelves (`ytd-rich-shelf-renderer[is-shorts]`, `ytd-reel-shelf-renderer`)
    const shelves = document.querySelectorAll(
      'ytd-rich-shelf-renderer[is-shorts]:not([data-monk-tray-handled]), ytd-reel-shelf-renderer:not([data-monk-tray-handled]), ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts]):not([data-monk-tray-handled])'
    );

    shelves.forEach((shelf) => {
      shelf.setAttribute('data-monk-tray-handled', 'true');
      shelf.setAttribute('data-monk-tray-blocked', 'true');
      monkModeBlockedCount++;
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ monkModeBlockedCount });
      }
      updatePill();

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

  // Scanner for Posts & Comments
  function scanFeed() {
    const platform = getPlatform();

    if (platform === 'threads') {
      const postContainers = new Set();
      document.querySelectorAll('div[data-pressable-container="true"], div[role="article"], article, div[data-testid*="post"], div[data-testid*="thread"]').forEach((el) => {
        if (!el.hasAttribute('data-jev-scanned')) postContainers.add(el);
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
        if (container && !container.hasAttribute('data-jev-scanned')) {
          postContainers.add(container);
        }
      });

      postContainers.forEach((post) => {
        // Fast instant client-side check for Monk Mode on any images before waiting for text
        checkAndApplyMonkMode(post, post.innerText || '');

        const textEls = post.querySelectorAll('span[dir="auto"], div[dir="auto"]');
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
          // On Activity notifications with quoted text + reply: the incoming reply is the LAST element!
          // On regular posts: pick the longest text candidate.
          let targetItem = candidateEls[candidateEls.length - 1];
          if (!window.location.pathname.includes('/activity')) {
            candidateEls.forEach((item) => {
              if (item.text.length > targetItem.text.length) targetItem = item;
            });
          }

          post.setAttribute('data-jev-scanned', 'true');
          scannedCount++;
          updatePill();
          const cleanText = targetItem.text;
          if (textCache.has(cleanText)) {
            renderClassification({ postEl: post, text: cleanText, textEl: targetItem.el }, textCache.get(cleanText));
          } else {
            queue.push({ postEl: post, text: cleanText, textEl: targetItem.el });
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

      // Individual comments
      document.querySelectorAll('div[aria-label*="bình luận"]:not([data-jev-cmt-scanned]), div[aria-label*="Comment"]:not([data-jev-cmt-scanned]), ul > li div[dir="auto"]:not([data-jev-cmt-scanned])').forEach((cmt) => {
        if (cmt.closest('.x-jev-seeding-collapsed') || cmt.closest('.x-jev-scam-box') || cmt.closest('.x-jev-warning-box')) return;
        let t = cmt.innerText.trim();
        t = t.replace(/\s*(Translate|Xem bản dịch)$/i, '').trim();
        if (t.length >= 2 && t.length <= 600) {
          cmt.setAttribute('data-jev-cmt-scanned', 'true');
          scannedCount++;
          updatePill();
          if (textCache.has(t)) {
            renderClassification({ postEl: cmt, text: t, textEl: cmt }, textCache.get(t));
          } else {
            queue.push({ postEl: cmt, text: t, textEl: cmt });
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
      console.log(`[Social Shield] 🔎 Tìm thấy ${queue.length} bài mới trên ${platform.toUpperCase()} cần gửi Jev.`);
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(flushQueue, config.batchDebounceMs);
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

    // Safety interval for Video/Reels/Shorts on Facebook, Instagram, YouTube
    if (['facebook', 'instagram', 'youtube'].includes(getPlatform())) {
      setInterval(() => {
        if (config.monkModeEnabled || config.blockReelsEnabled) {
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

    // Safety heartbeat interval: keep pill alive against React hydration & catch missed feed updates
    setInterval(() => {
      initPill();
      scheduleScan();
    }, 1500);

    // Watch for SPA URL changes (Threads, X, Facebook)
    let lastUrl = location.href;
    setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        scheduleScan();
      }
    }, 500);
  }

  initObserver();
  console.log(`[Social Shield + Monk Mode] Active on ${getPlatform().toUpperCase()} (${window.location.hostname}) 🛡️`);
})();

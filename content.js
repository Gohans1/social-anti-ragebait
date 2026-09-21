// Social Shield for X (Twitter) - AI Content Filtering & Feed Focus Guard
// Powered by Jev Zero-shot AI (classifier.dev) & Gemini 3.5 Flash-Lite
(function () {
  'use strict';

  const DEFAULT_GEMINI_API_KEY = 'AIzaSyCEUfHf2SiBsA5ZLDLHJMg_1bkjebeuVoo';
  const DEFAULT_GEMINI_PROMPT = 'Summarize the following social media post into exactly 3 concise, high-signal bullet points in the same language as the post (Vietnamese or English). No intro, no filler, strictly 3 bullet points starting with -:';

  let config = {
    apiEndpoint: 'https://classifier.dev/',
    geminiApiKey: DEFAULT_GEMINI_API_KEY,
    geminiPrompt: DEFAULT_GEMINI_PROMPT,
    batchDebounceMs: 120,
    confidenceThreshold: 0.30,
    categoryActions: {
      casual: 'show',
    },
    filterCasualEnabled: true,
    focusModeEnabled: true,
    focusWhitelistTags: ['casual', 'custom'],
    hideFloatingPill: false,
    singleTagMode: false,
    customLabels: [],
  };

  let scannedCount = 0;
  let saveScannedDebounceTimer = null;
  let casualCount = 0;
  let customCount = 0;
  let focusCollapsedCount = 0;

  function getPlatform() {
    return 'x';
  }

  // Fast synchronous session cache (0ms instant response on reload)
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

  // Load saved settings from Chrome Storage
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(
      [
        'categoryActions',
        'filterCasualEnabled',
        'customLabels',
        'hideFloatingPill',
        'singleTagMode',
        'confidenceThreshold',
        'casualCount',
        'customCount',
        'focusModeEnabled',
        'focusWhitelistTags',
        'focusCollapsedCount',
        'scannedCount',
        'geminiApiKey',
        'geminiPrompt',
      ],
      (res) => {
        if (typeof res.geminiApiKey === 'string' && res.geminiApiKey.trim().length > 0) {
          config.geminiApiKey = res.geminiApiKey.trim();
        } else {
          config.geminiApiKey = DEFAULT_GEMINI_API_KEY;
        }
        if (typeof res.geminiPrompt === 'string' && res.geminiPrompt.trim().length > 0) {
          config.geminiPrompt = res.geminiPrompt.trim();
        } else {
          config.geminiPrompt = DEFAULT_GEMINI_PROMPT;
        }
        if (res.categoryActions && typeof res.categoryActions === 'object') {
          config.categoryActions = {
            casual: res.categoryActions.casual || 'show',
          };
          if (typeof res.focusModeEnabled === 'boolean') config.focusModeEnabled = res.focusModeEnabled;
        } else {
          config.categoryActions = {
            casual: res.filterCasualEnabled === false ? 'off' : 'show',
          };
          config.focusModeEnabled = config.categoryActions.casual === 'hide';
        }
        if (Array.isArray(res.customLabels)) config.customLabels = res.customLabels;
        if (Array.isArray(res.focusWhitelistTags)) config.focusWhitelistTags = res.focusWhitelistTags;
        if (typeof res.hideFloatingPill === 'boolean') config.hideFloatingPill = res.hideFloatingPill;
        if (typeof res.singleTagMode === 'boolean') config.singleTagMode = res.singleTagMode;
        if (typeof res.confidenceThreshold === 'number') {
          config.confidenceThreshold = res.confidenceThreshold;
        }

        if (typeof res.casualCount === 'number') casualCount = res.casualCount;
        if (typeof res.customCount === 'number') customCount = res.customCount;
        if (typeof res.focusCollapsedCount === 'number') focusCollapsedCount = res.focusCollapsedCount;
        if (typeof res.scannedCount === 'number') scannedCount = res.scannedCount;

        updatePill();
        applyStateToDOM();
      }
    );

    const TAXONOMY_KEYS = [
      'categoryActions',
      'filterCasualEnabled',
      'customLabels',
    ];

    function isTaxonomyPayloadAltered(oldCfg, newCfg) {
      const oldCasualOff = (oldCfg?.categoryActions?.casual || 'show') === 'off';
      const newCasualOff = (newCfg?.categoryActions?.casual || 'show') === 'off';
      if (oldCasualOff !== newCasualOff) return true;

      const oldCustomActive = (Array.isArray(oldCfg?.customLabels) ? oldCfg.customLabels : [])
        .filter((c) => (typeof c === 'object' ? (c.action || (c.enabled === false ? 'off' : 'show')) : 'show') !== 'off')
        .map((c) => ({
          name: (typeof c === 'string' ? c : c?.name)?.trim().toLowerCase(),
          instruction: typeof c === 'object' && c?.instruction ? String(c.instruction).replace(/[\r\n\t]/g, ' ').slice(0, 200).trim() : '',
        }));
      const newCustomActive = (Array.isArray(newCfg?.customLabels) ? newCfg.customLabels : [])
        .filter((c) => (typeof c === 'object' ? (c.action || (c.enabled === false ? 'off' : 'show')) : 'show') !== 'off')
        .map((c) => ({
          name: (typeof c === 'string' ? c : c?.name)?.trim().toLowerCase(),
          instruction: typeof c === 'object' && c?.instruction ? String(c.instruction).replace(/[\r\n\t]/g, ' ').slice(0, 200).trim() : '',
        }));
      return JSON.stringify(oldCustomActive) !== JSON.stringify(newCustomActive);
    }

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'UPDATE_CONFIG') {
        let taxonomyChanged = false;
        if (request.config.categoryActions || request.config.customLabels) {
          if (isTaxonomyPayloadAltered(config, request.config)) {
            taxonomyChanged = true;
          }
        }
        TAXONOMY_KEYS.forEach((key) => {
          if (key === 'categoryActions' || key === 'customLabels') return;
          if (request.config[key] !== undefined && request.config[key] !== config[key]) {
            taxonomyChanged = true;
          }
        });

        if (request.config.categoryActions && typeof request.config.categoryActions === 'object') {
          config.categoryActions = { ...config.categoryActions, ...request.config.categoryActions };
        }
        if (typeof request.config.filterCasualEnabled === 'boolean') config.filterCasualEnabled = request.config.filterCasualEnabled;
        if (Array.isArray(request.config.customLabels)) config.customLabels = request.config.customLabels;
        if (typeof request.config.focusModeEnabled === 'boolean') config.focusModeEnabled = request.config.focusModeEnabled;
        if (Array.isArray(request.config.focusWhitelistTags)) config.focusWhitelistTags = request.config.focusWhitelistTags;
        if (typeof request.config.hideFloatingPill === 'boolean') config.hideFloatingPill = request.config.hideFloatingPill;
        if (typeof request.config.singleTagMode === 'boolean') config.singleTagMode = request.config.singleTagMode;
        if (typeof request.config.geminiApiKey === 'string') config.geminiApiKey = request.config.geminiApiKey.trim();
        if (typeof request.config.geminiPrompt === 'string') {
          const newPrompt = request.config.geminiPrompt.trim();
          if (newPrompt !== config.geminiPrompt) {
            config.geminiPrompt = newPrompt;
            summaryCache.clear();
          }
        }
        if (typeof request.config.confidenceThreshold === 'number') config.confidenceThreshold = request.config.confidenceThreshold;

        if (taxonomyChanged) {
          textCache.clear();
          saveCacheToStorage();
        }
        updatePill();
        applyStateToDOM();
        sendResponse({ status: 'ok' });
      } else if (request.type === 'RESET_STATS') {
        casualCount = 0;
        customCount = 0;
        focusCollapsedCount = 0;
        scannedCount = 0;
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ scannedCount: 0 });
        }
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
          'categoryActions',
          'filterCasualEnabled',
          'customLabels',
          'focusModeEnabled',
          'focusWhitelistTags',
          'confidenceThreshold',
          'hideFloatingPill',
          'singleTagMode',
          'geminiApiKey',
          'geminiPrompt',
        ].forEach((key) => {
          if (changes[key]) {
            if (key === 'categoryActions') {
              const simCfg = { ...config, categoryActions: changes.categoryActions.newValue || {} };
              if (isTaxonomyPayloadAltered(config, simCfg)) {
                taxonomyChanged = true;
              }
              config.categoryActions = { ...config.categoryActions, ...(changes.categoryActions.newValue || {}) };
            } else if (key === 'customLabels') {
              const simCfg = { ...config, customLabels: changes.customLabels.newValue || [] };
              if (isTaxonomyPayloadAltered(config, simCfg)) {
                taxonomyChanged = true;
              }
              config.customLabels = changes.customLabels.newValue || [];
            } else if (key === 'geminiPrompt') {
              const newPrompt = (changes.geminiPrompt.newValue || '').trim() || DEFAULT_GEMINI_PROMPT;
              if (newPrompt !== config.geminiPrompt) {
                config.geminiPrompt = newPrompt;
                summaryCache.clear();
              }
            } else {
              if (TAXONOMY_KEYS.includes(key) && changes[key].newValue !== config[key]) {
                taxonomyChanged = true;
              }
              config[key] = changes[key].newValue;
            }
            configChanged = true;
          }
        });

        if (changes.casualCount) casualCount = changes.casualCount.newValue || 0;
        if (changes.customCount) customCount = changes.customCount.newValue || 0;
        if (changes.focusCollapsedCount) focusCollapsedCount = changes.focusCollapsedCount.newValue || 0;

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

  // Unified Floating Status Pill UI
  const pill = document.createElement('div');
  pill.className = 'x-jev-floating-pill';
  const pillStats = document.createElement('span');
  pillStats.className = 'x-jev-pill-stats';
  const pillClose = document.createElement('span');
  pillClose.className = 'x-jev-pill-close';
  pillClose.title = 'Hide floating status pill (re-enable in popup)';
  pillClose.textContent = '✕';
  pill.appendChild(pillStats);
  pill.appendChild(pillClose);

  // Capture phase listeners so React / framework can NEVER swallow close click
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (e.target && e.target.closest && e.target.closest('.x-jev-pill-close')) {
        e.preventDefault();
        e.stopPropagation();
        config.hideFloatingPill = true;
        initPill();
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ hideFloatingPill: true });
        }
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
        config.hideFloatingPill = true;
        initPill();
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ hideFloatingPill: true });
        }
      }
    },
    true
  );

  function initPill() {
    if (document.body) {
      document.body.classList.toggle('x-jev-hide-pill', !!config.hideFloatingPill);
    }
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
    const parts = [
      `X: <span style="color:#ededed; font-family:'Geist Mono',monospace;">ON</span>`,
      `Scanned: <span style="color:#ededed; font-family:'Geist Mono',monospace;">${scannedCount}</span>`,
    ];
    if (config.focusModeEnabled && focusCollapsedCount > 0) {
      parts.push(`<span class="x-jev-pill-focus-toggle" title="Click to pause feed filtering" style="cursor:pointer;">Filtered: <span style="color:#ededed; font-family:'Geist Mono',monospace;">${focusCollapsedCount}</span></span>`);
    } else if (focusCollapsedCount > 0 && !config.focusModeEnabled) {
      parts.push(`<span class="x-jev-pill-focus-toggle" title="Click to resume feed filtering" style="cursor:pointer;opacity:0.6;">Filtered: <span style="color:#fb923c; font-family:'Geist Mono',monospace;">PAUSED</span></span>`);
    }
    if ((config.categoryActions?.casual || (config.filterCasualEnabled ? 'show' : 'off')) !== 'off' && casualCount > 0) {
      parts.push(`Casual: <span style="color:#888888; font-family:'Geist Mono',monospace;">${casualCount}</span>`);
    }
    const hasActiveCustom = Array.isArray(config.customLabels) && config.customLabels.some((c) => (typeof c === 'object' ? (c.action || (c.enabled === false ? 'off' : 'show')) : 'show') !== 'off');
    if (hasActiveCustom && customCount > 0) {
      parts.push(`Custom: <span style="color:#ededed; font-family:'Geist Mono',monospace;">${customCount}</span>`);
    }
    pillStats.innerHTML = parts.join(' | ');
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      if (saveScannedDebounceTimer) clearTimeout(saveScannedDebounceTimer);
      saveScannedDebounceTimer = setTimeout(() => {
        chrome.storage.local.set({ scannedCount });
      }, 500);
    }
  }

  updatePill();
  pill.title = 'Social Shield: Feed Focus Guard (Click to toggle filter pause)';
  pill.addEventListener('click', (e) => {
    if (e.target.closest('.x-jev-pill-close')) return;
    config.focusModeEnabled = !config.focusModeEnabled;
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ focusModeEnabled: config.focusModeEnabled });
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
    if (document.body) {
      document.body.classList.toggle('x-jev-hide-pill', !!config.hideFloatingPill);
      document.body.classList.toggle('x-jev-single-tag-mode', !!config.singleTagMode);
      const hasAnyHide = config.focusModeEnabled !== false && (
        (config.categoryActions && Object.values(config.categoryActions).includes('hide')) ||
        (Array.isArray(config.customLabels) && config.customLabels.some((c) => (typeof c === 'object' && c.action === 'hide'))) ||
        (!config.categoryActions && !!config.focusModeEnabled)
      );
      document.body.classList.toggle('x-jev-no-focus', !hasAnyHide);
    }

    // Curated & Custom Badges State
    document.querySelectorAll('.x-jev-badge').forEach((badge) => {
      const cat = badge.getAttribute('data-jev-badge-category');
      const def = TAXONOMY_CATALOG[cat];
      let isHidden = false;
      if (cat === 'other / casual discussion' && window.location.pathname.includes('/activity')) {
        isHidden = true;
      } else if (def && config.categoryActions && def.tagKey) {
        isHidden = config.categoryActions[def.tagKey] === 'off';
      } else if (def && config[def.configKey] === false) {
        isHidden = true;
      } else if (Array.isArray(config.customLabels)) {
        const customFound = config.customLabels.find(
          (c) => (typeof c === 'string' ? c : c?.name)?.trim().toLowerCase() === cat?.trim().toLowerCase()
        );
        if (customFound && typeof customFound === 'object') {
          const action = customFound.action || (customFound.enabled === false ? 'off' : 'show');
          if (action === 'off') isHidden = true;
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

    // Restore bypassed posts if taxonomy is enabled
    const activeTaxonomy = getActiveTaxonomy(config);
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

  // Call Jev API: Route via background service worker to bypass page CSP
  async function callJevBatch(inputs) {
    const taxonomy = getActiveTaxonomy(config);
    if (!taxonomy.labels || taxonomy.labels.length < 2) {
      return inputs.map(() => ({
        label: CATCH_ALL_LABEL,
        confidence: 1,
        scores: { [CATCH_ALL_LABEL]: 1 },
      }));
    }

    console.log(`[Social Shield] 📡 Sending ${inputs.length} text samples to Jev AI (active labels: ${taxonomy.labels.length})...`);
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
                console.log(`[Social Shield] ✅ Received Jev results for ${response.results?.length} items.`);
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
      if (!tax.labels || tax.labels.length < 2) {
        return inputs.map(() => ({
          label: CATCH_ALL_LABEL,
          confidence: 1,
          scores: { [CATCH_ALL_LABEL]: 1 },
        }));
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

  function getPostTagKey(label) {
    if (label === 'other / casual discussion') return 'casual';
    if (Array.isArray(config.customLabels)) {
      const isCustom = config.customLabels.some(
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
    if (config.focusModeEnabled === false) return false;

    const labelList = Array.isArray(labels)
      ? labels
      : (typeof labels === 'string' ? labels.split('|') : []);
    if (labelList.length === 0) return false;

    if (config.categoryActions && typeof config.categoryActions === 'object') {
      return labelList.some((lbl) => {
        const tagKey = getPostTagKey(lbl);
        if (tagKey && config.categoryActions[tagKey] === 'hide') return true;

        if (Array.isArray(config.customLabels)) {
          const custom = config.customLabels.find(
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

    return false;
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
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ focusCollapsedCount });
        }
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

  // --- GEMINI 3.5 FLASH-LITE POST SUMMARIZER ---
  const summaryCache = new Map();

  async function requestPostSummary(text) {
    if (summaryCache.has(text)) return summaryCache.get(text);
    return new Promise((resolve, reject) => {
      const apiKey = (config.geminiApiKey || DEFAULT_GEMINI_API_KEY).trim();
      if (!apiKey) {
        reject(new Error('Google AI Studio API key missing. Please enter your API key in extension settings.'));
        return;
      }
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage(
          {
            type: 'SUMMARIZE_POST',
            payload: {
              text: text,
              apiKey: apiKey,
              prompt: (config.geminiPrompt || DEFAULT_GEMINI_PROMPT).trim(),
            },
          },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message || 'Background service worker unavailable'));
            } else if (response && response.success) {
              const bullets = response.bullets || [];
              if (bullets.length > 0) {
                summaryCache.set(text, bullets);
                if (summaryCache.size > 200) {
                  const firstKey = summaryCache.keys().next().value;
                  summaryCache.delete(firstKey);
                }
              }
              resolve(bullets);
            } else {
              reject(new Error(response?.error || 'Summarization failed'));
            }
          }
        );
      } else {
        reject(new Error('Extension runtime unavailable'));
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
      : `<div class="x-jev-summary-error"><span>⚠️</span><span>Unable to generate 3-bullet summary (content may be too brief or restricted by safety guidelines).</span></div>`;

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

  // Unified Rendering Logic
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
      if (typeof score !== 'number' || !Number.isFinite(score) || score < config.confidenceThreshold) return;

      if (candidateLabel === 'other / casual discussion') {
        if (window.location.pathname.includes('/activity')) return;
        if (config.categoryActions && config.categoryActions.casual === 'off') return;
        if (!config.categoryActions && config.filterCasualEnabled === false) return;
      }

      let isCustom = false;
      let customMeta = null;
      if (Array.isArray(config.customLabels)) {
        const customFound = config.customLabels.find(
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

        let storageUpdates = {};
        selectedBadges.forEach(({ label, isCustom }) => {
          if (label === 'other / casual discussion') {
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

      // Find optimal injection point: preferably inline in author header row
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

          const activeKey = (config.geminiApiKey || DEFAULT_GEMINI_API_KEY).trim();
          if (!activeKey) {
            summaryBtn.innerHTML = '<span>⚠️</span><span>Set API Key</span>';
            summaryBtn.title = 'Please configure your Gemini API Key in the Social Shield extension popup.';
            setTimeout(() => {
              summaryBtn.innerHTML = '<span>✨</span><span>TL;DR</span>';
              summaryBtn.title = 'Summarize with Gemini 3.5 Flash-Lite (Google AI Studio)';
            }, 3500);
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
            console.error('[Social Shield] Summary failed:', err);
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
      : (topEntry && topEntry[1] >= config.confidenceThreshold ? [topEntry[0]] : []);
    checkAndApplyFocusCollapse(postEl, textEl, assignedLabels);
    postEl.setAttribute('data-jev-handled', 'true');
  }

  async function flushQueue() {
    if (queue.length === 0) return;

    const taxonomy = getActiveTaxonomy(config);
    if (!taxonomy.labels || taxonomy.labels.length === 0) {
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

  // Scanner for Posts on X
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
      console.log(`[Social Shield] 🔎 Found ${queue.length} new tweets on X to classify.`);
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

    // Safety heartbeat interval: keep pill alive against React hydration & catch missed feed updates
    setInterval(() => {
      initPill();
      scheduleScan();
    }, 1500);

    // Watch for SPA URL changes on X
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

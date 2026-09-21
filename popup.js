// Popup script for Social Shield All-in-One + Monk Mode
document.addEventListener('DOMContentLoaded', () => {
  const DEFAULT_CATEGORY_ACTIONS = {
    motivational: 'show',
    meme: 'show',
    deepdive: 'show',
    wholesome: 'show',
    doom: 'hide',
    fomo: 'hide',
    casual: 'show',
  };

  const DEFAULT_GEMINI_API_KEY = 'AIzaSyCEUfHf2SiBsA5ZLDLHJMg_1bkjebeuVoo';

  let categoryActions = { ...DEFAULT_CATEGORY_ACTIONS };
  let customLabels = [];
  let focusModeEnabled = true;
  let currentScannedCount = 0;

  const monkModeToggle = document.getElementById('monkModeToggle');
  const blockReelsToggle = document.getElementById('blockReelsToggle');
  const autoBlurRageToggle = document.getElementById('autoBlurRageToggle');
  const blockScamsToggle = document.getElementById('blockScamsToggle');
  const collapseSeedingToggle = document.getElementById('collapseSeedingToggle');
  const hideFloatingPillToggle = document.getElementById('hideFloatingPillToggle');
  const singleTagModeToggle = document.getElementById('singleTagModeToggle');
  const geminiApiKeyInput = document.getElementById('geminiApiKeyInput');
  const thresholdRange = document.getElementById('thresholdRange');
  const thresholdVal = document.getElementById('thresholdVal');

  const motivationalCounter = document.getElementById('motivationalCounter');
  const memeCounter = document.getElementById('memeCounter');
  const deepDiveCounter = document.getElementById('deepDiveCounter');
  const rageCounter = document.getElementById('rageCounter');
  const scamCounter = document.getElementById('scamCounter');
  const monkCounter = document.getElementById('monkCounter');
  const wholesomeCounter = document.getElementById('wholesomeCounter');
  const doomCounter = document.getElementById('doomCounter');
  const fomoCounter = document.getElementById('fomoCounter');
  const casualCounter = document.getElementById('casualCounter');
  const customCounter = document.getElementById('customCounter');
  const focusCounter = document.getElementById('focusCounter');
  const resetStats = document.getElementById('resetStats');

  const customLabelInput = document.getElementById('customLabelInput');
  const addCustomLabelBtn = document.getElementById('addCustomLabelBtn');
  const customLabelsContainer = document.getElementById('customLabelsContainer');

  const heroScannedCount = document.getElementById('heroScannedCount');
  const heroFilteredCount = document.getElementById('heroFilteredCount');
  const heroThreatsCount = document.getElementById('heroThreatsCount');
  const headerStatusBadge = document.getElementById('headerStatusBadge');
  const headerStatusText = document.getElementById('headerStatusText');

  function initActivePlatform() {
    if (!chrome.tabs || !chrome.tabs.query) {
      if (headerStatusBadge) {
        headerStatusBadge.classList.remove('standby');
        headerStatusBadge.classList.add('active');
      }
      if (headerStatusText) headerStatusText.textContent = 'Active';
      return;
    }
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs && tabs[0];
      const url = activeTab ? activeTab.url : '';
      let platform = null;

      if (url) {
        try {
          const host = new URL(url).hostname.toLowerCase();
          if (host.includes('twitter.com') || host.includes('x.com')) platform = 'X';
          else if (host.includes('facebook.com') || host.includes('fb.com')) platform = 'Facebook';
          else if (host.includes('instagram.com')) platform = 'Instagram';
          else if (host.includes('threads.net') || host.includes('threads.com')) platform = 'Threads';
          else if (host.includes('youtube.com')) platform = 'YouTube';
        } catch (e) {}
      }

      if (platform) {
        if (headerStatusBadge) {
          headerStatusBadge.classList.remove('standby');
          headerStatusBadge.classList.add('active');
        }
        if (headerStatusText) headerStatusText.textContent = `Active on ${platform}`;
      } else {
        if (headerStatusBadge) {
          headerStatusBadge.classList.remove('active');
          headerStatusBadge.classList.add('standby');
        }
        if (headerStatusText) headerStatusText.textContent = 'Standby';
      }
    });
  }

  function updateHeroStats(data = {}) {
    if (typeof data.scannedCount === 'number') {
      currentScannedCount = data.scannedCount;
    }
    let scanned = currentScannedCount;
    if (scanned === 0) {
      const motivational = parseInt(motivationalCounter?.textContent || '0', 10) || 0;
      const meme = parseInt(memeCounter?.textContent || '0', 10) || 0;
      const deepdive = parseInt(deepDiveCounter?.textContent || '0', 10) || 0;
      const wholesome = parseInt(wholesomeCounter?.textContent || '0', 10) || 0;
      const doom = parseInt(doomCounter?.textContent || '0', 10) || 0;
      const fomo = parseInt(fomoCounter?.textContent || '0', 10) || 0;
      const casual = parseInt(casualCounter?.textContent || '0', 10) || 0;
      const custom = parseInt(customCounter?.textContent || '0', 10) || 0;
      const rage = parseInt(rageCounter?.textContent || '0', 10) || 0;
      const scam = parseInt(scamCounter?.textContent || '0', 10) || 0;
      const monk = parseInt(monkCounter?.textContent || '0', 10) || 0;
      scanned = motivational + meme + deepdive + wholesome + doom + fomo + casual + custom + rage + scam + monk;
    }

    const filtered = typeof data.focusCollapsedCount === 'number'
      ? data.focusCollapsedCount
      : (parseInt(focusCounter?.textContent || '0', 10) || 0);

    const rageVal = typeof data.blockedRageCount === 'number'
      ? data.blockedRageCount
      : (parseInt(rageCounter?.textContent || '0', 10) || 0);
    const scamVal = typeof data.blockedScamCount === 'number'
      ? data.blockedScamCount
      : (parseInt(scamCounter?.textContent || '0', 10) || 0);
    const monkVal = typeof data.monkModeBlockedCount === 'number'
      ? data.monkModeBlockedCount
      : (parseInt(monkCounter?.textContent || '0', 10) || 0);
    const threats = rageVal + scamVal + monkVal;

    if (heroScannedCount) heroScannedCount.textContent = scanned;
    if (heroFilteredCount) heroFilteredCount.textContent = filtered;
    if (heroThreatsCount) heroThreatsCount.textContent = threats;
  }

  function updateSegmentedControlUI(containerEl, activeAction) {
    if (!containerEl) return;
    containerEl.querySelectorAll('.segment-btn').forEach((btn) => {
      const action = btn.getAttribute('data-action');
      if (action === activeAction) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  function renderCustomLabels() {
    if (!customLabelsContainer) return;
    customLabelsContainer.innerHTML = '';
    if (customLabels.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.style.fontSize = '10.5px';
      emptyMsg.style.color = '#737373';
      emptyMsg.style.fontFamily = "'Geist Mono', monospace";
      emptyMsg.textContent = 'No custom labels added';
      customLabelsContainer.appendChild(emptyMsg);
      return;
    }

    customLabels.forEach((item, index) => {
      const chip = document.createElement('div');
      chip.className = 'custom-label-chip';

      const name = typeof item === 'string' ? item : item?.name || '';
      const action = typeof item === 'object' && item?.action
        ? item.action
        : (typeof item === 'object' && item?.enabled === false ? 'off' : 'show');

      const labelText = document.createElement('span');
      labelText.className = 'chip-name';
      labelText.textContent = name;
      labelText.title = name;

      const actionsDiv = document.createElement('div');
      actionsDiv.style.display = 'flex';
      actionsDiv.style.alignItems = 'center';
      actionsDiv.style.gap = '6px';

      const segCtrl = document.createElement('div');
      segCtrl.className = 'segmented-control';

      ['show', 'hide', 'off'].forEach((act) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `segment-btn${act === action ? ' active' : ''}`;
        btn.setAttribute('data-action', act);
        btn.textContent = act.charAt(0).toUpperCase() + act.slice(1);
        btn.addEventListener('click', () => {
          const currentItem = customLabels[index];
          const labelName = typeof currentItem === 'string' ? currentItem : (currentItem?.name || name);
          customLabels[index] = { name: labelName, action: act };
          updateSegmentedControlUI(segCtrl, act);
          focusModeEnabled = Object.values(categoryActions).includes('hide') || customLabels.some((c) => c.action === 'hide');
          saveAndNotify();
        });
        segCtrl.appendChild(btn);
      });

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'remove-btn';
      removeBtn.textContent = '✕';
      removeBtn.setAttribute('aria-label', `Remove label ${name}`);
      removeBtn.title = 'Remove this label';
      removeBtn.addEventListener('click', () => {
        customLabels.splice(index, 1);
        focusModeEnabled = Object.values(categoryActions).includes('hide') || customLabels.some((c) => c.action === 'hide');
        renderCustomLabels();
        saveAndNotify();
      });

      actionsDiv.appendChild(segCtrl);
      actionsDiv.appendChild(removeBtn);

      chip.appendChild(labelText);
      chip.appendChild(actionsDiv);
      customLabelsContainer.appendChild(chip);
    });
  }

  const BUILTIN_KEYS = [
    'self-improvement / motivational', 'motivational',
    'meme / humor / satire', 'meme',
    'deep dive / technical breakdown / industry insider', 'deepdive', 'teardown',
    'wholesome / positive', 'wholesome',
    'fearmongering / doom', 'doom',
    'fomo / hype', 'fomo',
    'other / casual discussion', 'casual',
    'rage bait / toxic / hostile / dismissive negativity', 'rage',
    'scam / fraudulent scheme', 'scam',
    'bot seeding / affiliate spam / fake review', 'seeding',
  ];

  function handleAddCustomLabel() {
    if (!customLabelInput) return;
    let val = customLabelInput.value.replace(/["\r\n\t]/g, '').slice(0, 40).trim();
    if (!val || BUILTIN_KEYS.some((k) => k.toLowerCase() === val.toLowerCase())) {
      customLabelInput.value = '';
      return;
    }
    const exists = customLabels.some(
      (c) => (typeof c === 'string' ? c : c?.name || '').trim().toLowerCase() === val.toLowerCase()
    );
    if (!exists) {
      customLabels.push({ name: val, action: 'show' });
      customLabelInput.value = '';
      renderCustomLabels();
      saveAndNotify();
    } else {
      customLabelInput.value = '';
    }
  }

  if (addCustomLabelBtn) addCustomLabelBtn.addEventListener('click', handleAddCustomLabel);
  if (customLabelInput) {
    customLabelInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddCustomLabel();
      }
    });
  }

  // Setup category segmented controls
  document.querySelectorAll('.segmented-control[data-category]').forEach((ctrl) => {
    const cat = ctrl.getAttribute('data-category');
    ctrl.querySelectorAll('.segment-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-action');
        categoryActions[cat] = action;
        updateSegmentedControlUI(ctrl, action);
        focusModeEnabled = Object.values(categoryActions).includes('hide') || customLabels.some((c) => c.action === 'hide');
        saveAndNotify();
      });
    });
  });

  // Load saved settings
  chrome.storage.local.get(
    [
      'categoryActions',
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
      'singleTagMode',
      'confidenceThreshold',
      'motivationalCount',
      'memeCount',
      'deepDiveCount',
      'blockedRageCount',
      'blockedScamCount',
      'monkModeBlockedCount',
      'wholesomeCount',
      'doomCount',
      'fomoCount',
      'casualCount',
      'customCount',
      'focusModeEnabled',
      'focusWhitelistTags',
      'focusCollapsedCount',
      'scannedCount',
      'geminiApiKey',
    ],
    (res) => {
      initActivePlatform();
      if (res && res.categoryActions && typeof res.categoryActions === 'object') {
        categoryActions = { ...DEFAULT_CATEGORY_ACTIONS, ...res.categoryActions };
        if (typeof res.focusModeEnabled === 'boolean') {
          focusModeEnabled = res.focusModeEnabled;
        }
      } else {
        // Migrate legacy settings
        const isLegacyFocus = res.focusModeEnabled === true && Array.isArray(res.focusWhitelistTags);
        const legacyKeep = isLegacyFocus ? res.focusWhitelistTags : ['motivational', 'meme', 'deepdive', 'wholesome', 'casual'];

        categoryActions = {
          motivational: res.filterMotivationalEnabled === false ? 'off' : (isLegacyFocus && !legacyKeep.includes('motivational') ? 'hide' : 'show'),
          meme: res.filterMemeEnabled === false ? 'off' : (isLegacyFocus && !legacyKeep.includes('meme') ? 'hide' : 'show'),
          deepdive: res.filterDeepDiveEnabled === false ? 'off' : (isLegacyFocus && !legacyKeep.includes('deepdive') ? 'hide' : 'show'),
          wholesome: res.filterWholesomeEnabled === false ? 'off' : (isLegacyFocus && !legacyKeep.includes('wholesome') ? 'hide' : 'show'),
          doom: res.filterDoomEnabled === false ? 'off' : (isLegacyFocus && legacyKeep.includes('doom') ? 'show' : 'hide'),
          fomo: res.filterFomoEnabled === false ? 'off' : (isLegacyFocus && legacyKeep.includes('fomo') ? 'show' : 'hide'),
          casual: res.filterCasualEnabled === false ? 'off' : (isLegacyFocus && !legacyKeep.includes('casual') ? 'hide' : 'show'),
        };
      }

      // Update segmented controls UI
      document.querySelectorAll('.segmented-control[data-category]').forEach((ctrl) => {
        const cat = ctrl.getAttribute('data-category');
        if (categoryActions[cat]) {
          updateSegmentedControlUI(ctrl, categoryActions[cat]);
        }
      });

      if (Array.isArray(res.customLabels)) {
        customLabels = res.customLabels
          .map((c) => {
            if (typeof c === 'string') return { name: c.trim(), action: 'show' };
            return {
              name: (c?.name || '').trim(),
              action: c?.action || (c?.enabled === false ? 'off' : 'show'),
            };
          })
          .filter((c) => c.name);
      }
      renderCustomLabels();

      if (monkModeToggle) {
        monkModeToggle.checked = typeof res.monkModeEnabled === 'boolean' ? res.monkModeEnabled : true;
      }
      if (blockReelsToggle) {
        blockReelsToggle.checked = typeof res.blockReelsEnabled === 'boolean' ? res.blockReelsEnabled : true;
      }
      if (autoBlurRageToggle) {
        autoBlurRageToggle.checked = typeof res.autoBlurRageEnabled === 'boolean' ? res.autoBlurRageEnabled : true;
      }
      if (blockScamsToggle) {
        blockScamsToggle.checked = typeof res.blockScamsEnabled === 'boolean' ? res.blockScamsEnabled : true;
      }
      if (collapseSeedingToggle) {
        collapseSeedingToggle.checked = typeof res.collapseSeedingEnabled === 'boolean' ? res.collapseSeedingEnabled : true;
      }
      if (hideFloatingPillToggle && typeof res.hideFloatingPill === 'boolean') {
        hideFloatingPillToggle.checked = res.hideFloatingPill;
      }
      if (singleTagModeToggle && typeof res.singleTagMode === 'boolean') {
        singleTagModeToggle.checked = res.singleTagMode;
      }
      if (geminiApiKeyInput) {
        geminiApiKeyInput.value = (typeof res.geminiApiKey === 'string' && res.geminiApiKey.trim().length > 0)
          ? res.geminiApiKey
          : DEFAULT_GEMINI_API_KEY;
      }
      if (typeof res.confidenceThreshold === 'number') {
        thresholdRange.value = Math.round(res.confidenceThreshold * 100);
        thresholdVal.textContent = `${thresholdRange.value}%`;
      }

      // Counters
      if (typeof res.motivationalCount === 'number' && motivationalCounter) motivationalCounter.textContent = res.motivationalCount;
      if (typeof res.memeCount === 'number' && memeCounter) memeCounter.textContent = res.memeCount;
      if (typeof res.deepDiveCount === 'number' && deepDiveCounter) deepDiveCounter.textContent = res.deepDiveCount;
      if (typeof res.blockedRageCount === 'number' && rageCounter) rageCounter.textContent = res.blockedRageCount;
      if (typeof res.blockedScamCount === 'number' && scamCounter) scamCounter.textContent = res.blockedScamCount;
      if (typeof res.monkModeBlockedCount === 'number' && monkCounter) monkCounter.textContent = res.monkModeBlockedCount;
      if (typeof res.wholesomeCount === 'number' && wholesomeCounter) wholesomeCounter.textContent = res.wholesomeCount;
      if (typeof res.doomCount === 'number' && doomCounter) doomCounter.textContent = res.doomCount;
      if (typeof res.fomoCount === 'number' && fomoCounter) fomoCounter.textContent = res.fomoCount;
      if (typeof res.casualCount === 'number' && casualCounter) casualCounter.textContent = res.casualCount;
      if (typeof res.customCount === 'number' && customCounter) customCounter.textContent = res.customCount;
      if (typeof res.focusCollapsedCount === 'number' && focusCounter) focusCounter.textContent = res.focusCollapsedCount;

      updateHeroStats(res);
    }
  );

  function saveAndNotify() {
    focusModeEnabled = Object.values(categoryActions).includes('hide') || customLabels.some((c) => (c.action || (c.enabled === false ? 'off' : 'show')) === 'hide');
    const config = {
      categoryActions: categoryActions,
      customLabels: customLabels,

      // Sync legacy properties for backward compatibility
      filterMotivationalEnabled: categoryActions.motivational !== 'off',
      filterMemeEnabled: categoryActions.meme !== 'off',
      filterDeepDiveEnabled: categoryActions.deepdive !== 'off',
      filterWholesomeEnabled: categoryActions.wholesome !== 'off',
      filterDoomEnabled: categoryActions.doom !== 'off',
      filterFomoEnabled: categoryActions.fomo !== 'off',
      filterCasualEnabled: categoryActions.casual !== 'off',
      focusModeEnabled: focusModeEnabled,
      focusWhitelistTags: [
        ...Object.entries(categoryActions).filter(([, v]) => v === 'show').map(([k]) => k),
        ...(customLabels.some((c) => (c.action || (c.enabled === false ? 'off' : 'show')) === 'show') ? ['custom'] : []),
      ],

      monkModeEnabled: monkModeToggle.checked,
      blockReelsEnabled: blockReelsToggle.checked,
      autoBlurRageEnabled: autoBlurRageToggle.checked,
      blockScamsEnabled: blockScamsToggle.checked,
      collapseSeedingEnabled: collapseSeedingToggle.checked,
      hideFloatingPill: hideFloatingPillToggle.checked,
      singleTagMode: singleTagModeToggle ? singleTagModeToggle.checked : false,
      geminiApiKey: (geminiApiKeyInput && geminiApiKeyInput.value.trim().length > 0)
        ? geminiApiKeyInput.value.trim()
        : DEFAULT_GEMINI_API_KEY,
      confidenceThreshold: parseInt(thresholdRange.value, 10) / 100,
    };

    chrome.storage.local.set(config);

    // Broadcast config to all active tabs
    chrome.tabs.query({}, (tabs) => {
      if (tabs) {
        tabs.forEach((tab) => {
          chrome.tabs.sendMessage(tab.id, {
            type: 'UPDATE_CONFIG',
            config: config,
          }).catch(() => {});
        });
      }
    });
  }

  monkModeToggle.addEventListener('change', saveAndNotify);
  blockReelsToggle.addEventListener('change', saveAndNotify);
  autoBlurRageToggle.addEventListener('change', saveAndNotify);
  blockScamsToggle.addEventListener('change', saveAndNotify);
  collapseSeedingToggle.addEventListener('change', saveAndNotify);
  hideFloatingPillToggle.addEventListener('change', saveAndNotify);
  if (singleTagModeToggle) singleTagModeToggle.addEventListener('change', saveAndNotify);
  if (geminiApiKeyInput) {
    geminiApiKeyInput.addEventListener('change', saveAndNotify);
    geminiApiKeyInput.addEventListener('blur', saveAndNotify);
  }

  thresholdRange.addEventListener('input', () => {
    thresholdVal.textContent = `${thresholdRange.value}%`;
  });
  thresholdRange.addEventListener('change', saveAndNotify);

  resetStats.addEventListener('click', () => {
    chrome.storage.local.set({
      motivationalCount: 0,
      memeCount: 0,
      deepDiveCount: 0,
      monkModeBlockedCount: 0,
      blockedRageCount: 0,
      blockedScamCount: 0,
      cleanedSeedingCount: 0,
      wholesomeCount: 0,
      doomCount: 0,
      fomoCount: 0,
      casualCount: 0,
      customCount: 0,
      focusCollapsedCount: 0,
      scannedCount: 0,
    });
    if (motivationalCounter) motivationalCounter.textContent = '0';
    if (memeCounter) memeCounter.textContent = '0';
    if (deepDiveCounter) deepDiveCounter.textContent = '0';
    if (rageCounter) rageCounter.textContent = '0';
    if (scamCounter) scamCounter.textContent = '0';
    if (monkCounter) monkCounter.textContent = '0';
    if (wholesomeCounter) wholesomeCounter.textContent = '0';
    if (doomCounter) doomCounter.textContent = '0';
    if (fomoCounter) fomoCounter.textContent = '0';
    if (casualCounter) casualCounter.textContent = '0';
    if (customCounter) customCounter.textContent = '0';
    if (focusCounter) focusCounter.textContent = '0';
    updateHeroStats({ scannedCount: 0, focusCollapsedCount: 0, blockedRageCount: 0, blockedScamCount: 0, monkModeBlockedCount: 0 });

    chrome.tabs.query({}, (tabs) => {
      if (tabs) {
        tabs.forEach((tab) => {
          chrome.tabs.sendMessage(tab.id, { type: 'RESET_STATS' }).catch(() => {});
        });
      }
    });
  });

  if (chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.motivationalCount && motivationalCounter) motivationalCounter.textContent = changes.motivationalCount.newValue || 0;
      if (changes.memeCount && memeCounter) memeCounter.textContent = changes.memeCount.newValue || 0;
      if (changes.deepDiveCount && deepDiveCounter) deepDiveCounter.textContent = changes.deepDiveCount.newValue || 0;
      if (changes.blockedRageCount && rageCounter) rageCounter.textContent = changes.blockedRageCount.newValue || 0;
      if (changes.blockedScamCount && scamCounter) scamCounter.textContent = changes.blockedScamCount.newValue || 0;
      if (changes.monkModeBlockedCount && monkCounter) monkCounter.textContent = changes.monkModeBlockedCount.newValue || 0;
      if (changes.wholesomeCount && wholesomeCounter) wholesomeCounter.textContent = changes.wholesomeCount.newValue || 0;
      if (changes.doomCount && doomCounter) doomCounter.textContent = changes.doomCount.newValue || 0;
      if (changes.fomoCount && fomoCounter) fomoCounter.textContent = changes.fomoCount.newValue || 0;
      if (changes.casualCount && casualCounter) casualCounter.textContent = changes.casualCount.newValue || 0;
      if (changes.customCount && customCounter) customCounter.textContent = changes.customCount.newValue || 0;
      if (changes.focusCollapsedCount && focusCounter) focusCounter.textContent = changes.focusCollapsedCount.newValue || 0;
      if (changes.geminiApiKey && geminiApiKeyInput) {
        geminiApiKeyInput.value = changes.geminiApiKey.newValue || '';
      }
      if (changes.scannedCount) {
        currentScannedCount = changes.scannedCount.newValue || 0;
      }
      if (
        changes.scannedCount ||
        changes.focusCollapsedCount ||
        changes.blockedRageCount ||
        changes.blockedScamCount ||
        changes.monkModeBlockedCount ||
        changes.motivationalCount ||
        changes.memeCount ||
        changes.deepDiveCount ||
        changes.wholesomeCount ||
        changes.doomCount ||
        changes.fomoCount ||
        changes.casualCount ||
        changes.customCount
      ) {
        updateHeroStats();
      }
      if (changes.categoryActions && changes.categoryActions.newValue) {
        categoryActions = { ...DEFAULT_CATEGORY_ACTIONS, ...changes.categoryActions.newValue };
        document.querySelectorAll('.segmented-control[data-category]').forEach((ctrl) => {
          const cat = ctrl.getAttribute('data-category');
          if (categoryActions[cat]) {
            updateSegmentedControlUI(ctrl, categoryActions[cat]);
          }
        });
      }
      if (changes.singleTagMode && singleTagModeToggle && typeof changes.singleTagMode.newValue === 'boolean') {
        singleTagModeToggle.checked = changes.singleTagMode.newValue;
      }
      if (changes.customLabels && Array.isArray(changes.customLabels.newValue)) {
        customLabels = changes.customLabels.newValue
          .map((c) => {
            if (typeof c === 'string') return { name: c.trim(), action: 'show' };
            return {
              name: (c?.name || '').trim(),
              action: c?.action || (c?.enabled === false ? 'off' : 'show'),
            };
          })
          .filter((c) => c.name);
        renderCustomLabels();
      }
    });
  }
});

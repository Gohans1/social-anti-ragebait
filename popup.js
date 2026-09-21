// Popup script for Social Shield (X / Twitter)
document.addEventListener('DOMContentLoaded', () => {
  const DEFAULT_CATEGORY_ACTIONS = {
    casual: 'show',
  };

  const DEFAULT_GEMINI_API_KEY = 'AIzaSyCEUfHf2SiBsA5ZLDLHJMg_1bkjebeuVoo';
  const DEFAULT_GEMINI_PROMPT = 'Summarize the following social media post into exactly 3 concise, high-signal bullet points in the same language as the post (Vietnamese or English). No intro, no filler, strictly 3 bullet points starting with -:';

  let categoryActions = { ...DEFAULT_CATEGORY_ACTIONS };
  let customLabels = [];
  let focusModeEnabled = true;
  let currentScannedCount = 0;
  let savedGeminiApiKey = DEFAULT_GEMINI_API_KEY;
  let savedGeminiPrompt = DEFAULT_GEMINI_PROMPT;

  const hideFloatingPillToggle = document.getElementById('hideFloatingPillToggle');
  const singleTagModeToggle = document.getElementById('singleTagModeToggle');
  const geminiApiKeyInput = document.getElementById('geminiApiKeyInput');
  const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
  const geminiPromptInput = document.getElementById('geminiPromptInput');
  const savePromptBtn = document.getElementById('savePromptBtn');
  const resetPromptBtn = document.getElementById('resetPromptBtn');
  const thresholdRange = document.getElementById('thresholdRange');
  const thresholdVal = document.getElementById('thresholdVal');

  const casualCounter = document.getElementById('casualCounter');
  const customCounter = document.getElementById('customCounter');
  const focusCounter = document.getElementById('focusCounter');
  const resetStats = document.getElementById('resetStats');

  const customLabelInput = document.getElementById('customLabelInput');
  const customInstructInput = document.getElementById('customInstructInput');
  const addCustomLabelBtn = document.getElementById('addCustomLabelBtn');
  const customLabelsContainer = document.getElementById('customLabelsContainer');

  const heroScannedCount = document.getElementById('heroScannedCount');
  const heroCasualCount = document.getElementById('heroCasualCount');
  const heroFilteredCount = document.getElementById('heroFilteredCount');
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
      let isX = false;

      if (url) {
        try {
          const host = new URL(url).hostname.toLowerCase();
          if (host.includes('twitter.com') || host.includes('x.com')) isX = true;
        } catch (e) {}
      }

      if (isX) {
        if (headerStatusBadge) {
          headerStatusBadge.classList.remove('standby');
          headerStatusBadge.classList.add('active');
        }
        if (headerStatusText) headerStatusText.textContent = 'Active on X';
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
      const casual = parseInt(casualCounter?.textContent || '0', 10) || 0;
      const custom = parseInt(customCounter?.textContent || '0', 10) || 0;
      scanned = casual + custom;
    }

    const casual = typeof data.casualCount === 'number'
      ? data.casualCount
      : (parseInt(casualCounter?.textContent || '0', 10) || 0);

    const filtered = typeof data.focusCollapsedCount === 'number'
      ? data.focusCollapsedCount
      : (parseInt(focusCounter?.textContent || '0', 10) || 0);

    if (heroScannedCount) heroScannedCount.textContent = scanned;
    if (heroCasualCount) heroCasualCount.textContent = casual;
    if (heroFilteredCount) heroFilteredCount.textContent = filtered;
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
      const instruction = typeof item === 'object' && typeof item?.instruction === 'string' ? item.instruction.trim() : '';

      const chipInfo = document.createElement('div');
      chipInfo.className = 'chip-info';

      const labelText = document.createElement('span');
      labelText.className = 'chip-name';
      labelText.textContent = name;
      labelText.title = name;
      chipInfo.appendChild(labelText);

      const instructText = document.createElement('span');
      instructText.className = `chip-instruct${instruction ? ' custom' : ''}`;
      instructText.textContent = instruction ? `↳ ${instruction}` : '↳ auto criteria';
      instructText.title = instruction ? `Criteria: ${instruction}` : 'Using default template criteria';
      chipInfo.appendChild(instructText);

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
          const labelInstruct = typeof currentItem === 'object' && currentItem?.instruction ? currentItem.instruction : '';
          customLabels[index] = { name: labelName, action: act, instruction: labelInstruct };
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

      chip.appendChild(chipInfo);
      chip.appendChild(actionsDiv);
      customLabelsContainer.appendChild(chip);
    });
  }

  const BUILTIN_KEYS = [
    'other / casual discussion', 'casual',
  ];

  function handleAddCustomLabel() {
    if (!customLabelInput) return;
    let val = customLabelInput.value.replace(/["\r\n\t]/g, '').slice(0, 40).trim();
    if (!val || BUILTIN_KEYS.some((k) => k.toLowerCase() === val.toLowerCase())) {
      customLabelInput.value = '';
      if (customInstructInput) customInstructInput.value = '';
      return;
    }
    const instructVal = customInstructInput
      ? customInstructInput.value.replace(/[\r\n\t]/g, ' ').slice(0, 200).trim()
      : '';
    const existsIndex = customLabels.findIndex(
      (c) => (typeof c === 'string' ? c : c?.name || '').trim().toLowerCase() === val.toLowerCase()
    );
    if (existsIndex === -1) {
      customLabels.push({ name: val, action: 'show', instruction: instructVal });
      customLabelInput.value = '';
      if (customInstructInput) customInstructInput.value = '';
      renderCustomLabels();
      saveAndNotify();
    } else {
      const existing = customLabels[existsIndex];
      const existingAction = typeof existing === 'object' && existing?.action ? existing.action : 'show';
      customLabels[existsIndex] = { name: val, action: existingAction, instruction: instructVal };
      renderCustomLabels();
      saveAndNotify();
      customLabelInput.value = '';
      if (customInstructInput) customInstructInput.value = '';
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
  if (customInstructInput) {
    customInstructInput.addEventListener('keydown', (e) => {
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
      initActivePlatform();
      if (res && res.categoryActions && typeof res.categoryActions === 'object') {
        categoryActions = {
          casual: res.categoryActions.casual || DEFAULT_CATEGORY_ACTIONS.casual,
        };
        if (typeof res.focusModeEnabled === 'boolean') {
          focusModeEnabled = res.focusModeEnabled;
        }
      } else {
        categoryActions = {
          casual: res.filterCasualEnabled === false ? 'off' : 'show',
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
            if (typeof c === 'string') return { name: c.trim(), action: 'show', instruction: '' };
            return {
              name: (c?.name || '').trim(),
              action: c?.action || (c?.enabled === false ? 'off' : 'show'),
              instruction: typeof c === 'object' && typeof c?.instruction === 'string'
                ? c.instruction.replace(/[\r\n\t]/g, ' ').slice(0, 200).trim()
                : '',
            };
          })
          .filter((c) => c.name);
      }
      renderCustomLabels();

      if (hideFloatingPillToggle && typeof res.hideFloatingPill === 'boolean') {
        hideFloatingPillToggle.checked = res.hideFloatingPill;
      }
      if (singleTagModeToggle && typeof res.singleTagMode === 'boolean') {
        singleTagModeToggle.checked = res.singleTagMode;
      }
      if (geminiApiKeyInput) {
        savedGeminiApiKey = (typeof res.geminiApiKey === 'string' && res.geminiApiKey.trim().length > 0)
          ? res.geminiApiKey.trim()
          : DEFAULT_GEMINI_API_KEY;
        geminiApiKeyInput.value = savedGeminiApiKey;
        if (saveApiKeyBtn) saveApiKeyBtn.disabled = true;
      }
      if (geminiPromptInput) {
        savedGeminiPrompt = (typeof res.geminiPrompt === 'string' && res.geminiPrompt.trim().length > 0)
          ? res.geminiPrompt.trim()
          : DEFAULT_GEMINI_PROMPT;
        geminiPromptInput.value = savedGeminiPrompt;
        if (savePromptBtn) savePromptBtn.disabled = true;
      }
      if (typeof res.confidenceThreshold === 'number') {
        thresholdRange.value = Math.round(res.confidenceThreshold * 100);
        thresholdVal.textContent = `${thresholdRange.value}%`;
      }

      // Counters
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
      filterCasualEnabled: categoryActions.casual !== 'off',
      focusModeEnabled: focusModeEnabled,
      focusWhitelistTags: [
        ...(categoryActions.casual === 'show' ? ['casual'] : []),
        ...(customLabels.some((c) => (c.action || (c.enabled === false ? 'off' : 'show')) === 'show') ? ['custom'] : []),
      ],
      hideFloatingPill: hideFloatingPillToggle ? hideFloatingPillToggle.checked : false,
      singleTagMode: singleTagModeToggle ? singleTagModeToggle.checked : false,
      geminiApiKey: savedGeminiApiKey,
      geminiPrompt: savedGeminiPrompt,
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

  if (hideFloatingPillToggle) hideFloatingPillToggle.addEventListener('change', saveAndNotify);
  if (singleTagModeToggle) singleTagModeToggle.addEventListener('change', saveAndNotify);

  // Dirty-checked Gemini API Key Save Button
  if (geminiApiKeyInput && saveApiKeyBtn) {
    const checkApiKeyDirty = () => {
      const currentVal = geminiApiKeyInput.value.trim();
      saveApiKeyBtn.disabled = (currentVal === savedGeminiApiKey);
    };

    geminiApiKeyInput.addEventListener('input', checkApiKeyDirty);

    saveApiKeyBtn.addEventListener('click', () => {
      if (saveApiKeyBtn.disabled) return;
      const newKey = geminiApiKeyInput.value.trim() || DEFAULT_GEMINI_API_KEY;
      savedGeminiApiKey = newKey;
      geminiApiKeyInput.value = newKey;
      saveApiKeyBtn.disabled = true;

      const originalText = 'Save';
      saveApiKeyBtn.textContent = 'Saved ✓';
      setTimeout(() => {
        saveApiKeyBtn.textContent = originalText;
      }, 1500);

      saveAndNotify();
    });
  }

  // Dirty-checked Gemini System Prompt Save Button
  if (geminiPromptInput && savePromptBtn) {
    const checkPromptDirty = () => {
      const currentVal = geminiPromptInput.value.trim();
      savePromptBtn.disabled = (currentVal === savedGeminiPrompt);
    };

    geminiPromptInput.addEventListener('input', checkPromptDirty);

    savePromptBtn.addEventListener('click', () => {
      if (savePromptBtn.disabled) return;
      const newPrompt = geminiPromptInput.value.trim() || DEFAULT_GEMINI_PROMPT;
      savedGeminiPrompt = newPrompt;
      geminiPromptInput.value = newPrompt;
      savePromptBtn.disabled = true;

      const originalText = 'Save';
      savePromptBtn.textContent = 'Saved ✓';
      setTimeout(() => {
        savePromptBtn.textContent = originalText;
      }, 1500);

      saveAndNotify();
    });

    if (resetPromptBtn) {
      resetPromptBtn.addEventListener('click', () => {
        geminiPromptInput.value = DEFAULT_GEMINI_PROMPT;
        checkPromptDirty();
      });
    }
  }

  thresholdRange.addEventListener('input', () => {
    thresholdVal.textContent = `${thresholdRange.value}%`;
  });
  thresholdRange.addEventListener('change', saveAndNotify);

  resetStats.addEventListener('click', () => {
    chrome.storage.local.set({
      casualCount: 0,
      customCount: 0,
      focusCollapsedCount: 0,
      scannedCount: 0,
    });
    if (casualCounter) casualCounter.textContent = '0';
    if (customCounter) customCounter.textContent = '0';
    if (focusCounter) focusCounter.textContent = '0';
    updateHeroStats({ scannedCount: 0, focusCollapsedCount: 0, customCount: 0 });

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
      if (changes.casualCount && casualCounter) casualCounter.textContent = changes.casualCount.newValue || 0;
      if (changes.customCount && customCounter) customCounter.textContent = changes.customCount.newValue || 0;
      if (changes.focusCollapsedCount && focusCounter) focusCounter.textContent = changes.focusCollapsedCount.newValue || 0;
      if (changes.geminiApiKey && geminiApiKeyInput && document.activeElement !== geminiApiKeyInput) {
        savedGeminiApiKey = (changes.geminiApiKey.newValue || '').trim() || DEFAULT_GEMINI_API_KEY;
        geminiApiKeyInput.value = savedGeminiApiKey;
        if (saveApiKeyBtn) saveApiKeyBtn.disabled = true;
      }
      if (changes.geminiPrompt && geminiPromptInput && document.activeElement !== geminiPromptInput) {
        savedGeminiPrompt = (changes.geminiPrompt.newValue || '').trim() || DEFAULT_GEMINI_PROMPT;
        geminiPromptInput.value = savedGeminiPrompt;
        if (savePromptBtn) savePromptBtn.disabled = true;
      }
      if (changes.scannedCount) {
        currentScannedCount = changes.scannedCount.newValue || 0;
      }
      if (
        changes.scannedCount ||
        changes.focusCollapsedCount ||
        changes.casualCount ||
        changes.customCount
      ) {
        updateHeroStats();
      }
      if (changes.categoryActions && changes.categoryActions.newValue) {
        categoryActions = {
          casual: changes.categoryActions.newValue.casual || DEFAULT_CATEGORY_ACTIONS.casual,
        };
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
            if (typeof c === 'string') return { name: c.trim(), action: 'show', instruction: '' };
            return {
              name: (c?.name || '').trim(),
              action: c?.action || (c?.enabled === false ? 'off' : 'show'),
              instruction: typeof c === 'object' && typeof c?.instruction === 'string'
                ? c.instruction.replace(/[\r\n\t]/g, ' ').slice(0, 200).trim()
                : '',
            };
          })
          .filter((c) => c.name);
        renderCustomLabels();
      }
    });
  }
});

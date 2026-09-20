// Popup script for Social Shield All-in-One + Monk Mode
document.addEventListener('DOMContentLoaded', () => {
  const filterMotivationalToggle = document.getElementById('filterMotivationalToggle');
  const filterMemeToggle = document.getElementById('filterMemeToggle');
  const filterDeepDiveToggle = document.getElementById('filterDeepDiveToggle');
  const filterWholesomeToggle = document.getElementById('filterWholesomeToggle');
  const filterDoomToggle = document.getElementById('filterDoomToggle');
  const filterFomoToggle = document.getElementById('filterFomoToggle');
  const filterCasualToggle = document.getElementById('filterCasualToggle');
  const monkModeToggle = document.getElementById('monkModeToggle');
  const blockReelsToggle = document.getElementById('blockReelsToggle');
  const autoBlurRageToggle = document.getElementById('autoBlurRageToggle');
  const blockScamsToggle = document.getElementById('blockScamsToggle');
  const collapseSeedingToggle = document.getElementById('collapseSeedingToggle');
  const hideFloatingPillToggle = document.getElementById('hideFloatingPillToggle');
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
  const resetStats = document.getElementById('resetStats');

  const focusModeToggle = document.getElementById('focusModeToggle');
  const focusTagSelection = document.getElementById('focusTagSelection');
  const focusTagMotivational = document.getElementById('focusTagMotivational');
  const focusTagMeme = document.getElementById('focusTagMeme');
  const focusTagDeepDive = document.getElementById('focusTagDeepDive');
  const focusTagWholesome = document.getElementById('focusTagWholesome');
  const focusTagCasual = document.getElementById('focusTagCasual');
  const focusTagDoom = document.getElementById('focusTagDoom');
  const focusTagFomo = document.getElementById('focusTagFomo');
  const focusTagCustom = document.getElementById('focusTagCustom');
  const focusCounter = document.getElementById('focusCounter');

  const customLabelInput = document.getElementById('customLabelInput');
  const addCustomLabelBtn = document.getElementById('addCustomLabelBtn');
  const customLabelsContainer = document.getElementById('customLabelsContainer');

  function getFocusWhitelistTags() {
    const tags = [];
    if (focusTagMotivational && focusTagMotivational.checked) tags.push('motivational');
    if (focusTagMeme && focusTagMeme.checked) tags.push('meme');
    if (focusTagDeepDive && focusTagDeepDive.checked) tags.push('deepdive');
    if (focusTagWholesome && focusTagWholesome.checked) tags.push('wholesome');
    if (focusTagCasual && focusTagCasual.checked) tags.push('casual');
    if (focusTagDoom && focusTagDoom.checked) tags.push('doom');
    if (focusTagFomo && focusTagFomo.checked) tags.push('fomo');
    if (focusTagCustom && focusTagCustom.checked) tags.push('custom');
    return tags;
  }

  function updateFocusUI(enabled) {
    if (focusTagSelection) {
      focusTagSelection.style.opacity = enabled ? '1' : '0.4';
      focusTagSelection.style.pointerEvents = enabled ? 'auto' : 'none';
    }
  }

  let customLabels = [];

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
      const enabled = typeof item === 'string' ? true : item?.enabled !== false;

      const labelText = document.createElement('span');
      labelText.style.color = '#ededed';
      labelText.style.fontWeight = '500';
      labelText.style.fontSize = '11px';
      labelText.style.fontFamily = "'Geist', sans-serif";
      labelText.textContent = `🏷️ ${name}`;

      const actions = document.createElement('div');
      actions.style.display = 'flex';
      actions.style.alignItems = 'center';
      actions.style.gap = '8px';

      const switchLabel = document.createElement('label');
      switchLabel.className = 'switch-mini';

      const toggleInput = document.createElement('input');
      toggleInput.type = 'checkbox';
      toggleInput.className = 'custom-toggle';
      toggleInput.checked = enabled;
      toggleInput.addEventListener('change', () => {
        if (typeof customLabels[index] === 'string') {
          customLabels[index] = { name: customLabels[index], enabled: toggleInput.checked };
        } else {
          customLabels[index].enabled = toggleInput.checked;
        }
        saveAndNotify();
      });

      const sliderSpan = document.createElement('span');
      sliderSpan.className = 'slider';

      switchLabel.appendChild(toggleInput);
      switchLabel.appendChild(sliderSpan);

      const removeBtn = document.createElement('span');
      removeBtn.className = 'remove-btn';
      removeBtn.textContent = '✕';
      removeBtn.title = 'Remove this label';
      removeBtn.addEventListener('click', () => {
        customLabels.splice(index, 1);
        renderCustomLabels();
        saveAndNotify();
      });

      actions.appendChild(switchLabel);
      actions.appendChild(removeBtn);

      chip.appendChild(labelText);
      chip.appendChild(actions);

      customLabelsContainer.appendChild(chip);
    });
  }

  const BUILTIN_KEYS = [
    'self-improvement / motivational',
    'meme / humor / satire',
    'deep dive / technical breakdown / industry insider',
    'wholesome / positive',
    'fearmongering / doom',
    'fomo / hype',
    'other / casual discussion',
    'rage bait / toxic / hostile / dismissive negativity',
    'scam / fraudulent scheme',
    'bot seeding / affiliate spam / fake review',
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
      customLabels.push({ name: val, enabled: true });
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

  // Load saved settings
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
    ],
    (res) => {
      if (Array.isArray(res.customLabels)) {
        customLabels = res.customLabels
          .map((c) => (typeof c === 'string' ? { name: c.trim(), enabled: true } : { name: (c?.name || '').trim(), enabled: c?.enabled !== false }))
          .filter((c) => c.name);
      }
      renderCustomLabels();

      if (typeof res.focusModeEnabled === 'boolean' && focusModeToggle) {
        focusModeToggle.checked = res.focusModeEnabled;
      }
      updateFocusUI(focusModeToggle ? focusModeToggle.checked : false);

      const savedTags = Array.isArray(res.focusWhitelistTags)
        ? res.focusWhitelistTags
        : ['motivational', 'meme', 'deepdive', 'wholesome', 'custom'];

      if (focusTagMotivational) focusTagMotivational.checked = savedTags.includes('motivational');
      if (focusTagMeme) focusTagMeme.checked = savedTags.includes('meme');
      if (focusTagDeepDive) focusTagDeepDive.checked = savedTags.includes('deepdive');
      if (focusTagWholesome) focusTagWholesome.checked = savedTags.includes('wholesome');
      if (focusTagCasual) focusTagCasual.checked = savedTags.includes('casual');
      if (focusTagDoom) focusTagDoom.checked = savedTags.includes('doom');
      if (focusTagFomo) focusTagFomo.checked = savedTags.includes('fomo');
      if (focusTagCustom) focusTagCustom.checked = savedTags.includes('custom');

      if (typeof res.focusCollapsedCount === 'number' && focusCounter) {
        focusCounter.textContent = res.focusCollapsedCount;
      }
      if (typeof res.filterMotivationalEnabled === 'boolean' && filterMotivationalToggle) {
        filterMotivationalToggle.checked = res.filterMotivationalEnabled;
      }
      if (typeof res.filterMemeEnabled === 'boolean' && filterMemeToggle) {
        filterMemeToggle.checked = res.filterMemeEnabled;
      }
      if (typeof res.filterDeepDiveEnabled === 'boolean' && filterDeepDiveToggle) {
        filterDeepDiveToggle.checked = res.filterDeepDiveEnabled;
      }
      if (typeof res.filterWholesomeEnabled === 'boolean' && filterWholesomeToggle) {
        filterWholesomeToggle.checked = res.filterWholesomeEnabled;
      }
      if (typeof res.filterDoomEnabled === 'boolean' && filterDoomToggle) {
        filterDoomToggle.checked = res.filterDoomEnabled;
      }
      if (typeof res.filterFomoEnabled === 'boolean' && filterFomoToggle) {
        filterFomoToggle.checked = res.filterFomoEnabled;
      }
      if (typeof res.filterCasualEnabled === 'boolean' && filterCasualToggle) {
        filterCasualToggle.checked = res.filterCasualEnabled;
      }
      if (typeof res.monkModeEnabled === 'boolean') {
        monkModeToggle.checked = res.monkModeEnabled;
      }
      if (typeof res.blockReelsEnabled === 'boolean') {
        blockReelsToggle.checked = res.blockReelsEnabled;
      }
      if (typeof res.autoBlurRageEnabled === 'boolean') {
        autoBlurRageToggle.checked = res.autoBlurRageEnabled;
      }
      if (typeof res.blockScamsEnabled === 'boolean') {
        blockScamsToggle.checked = res.blockScamsEnabled;
      }
      if (typeof res.collapseSeedingEnabled === 'boolean') {
        collapseSeedingToggle.checked = res.collapseSeedingEnabled;
      }
      if (typeof res.hideFloatingPill === 'boolean') {
        hideFloatingPillToggle.checked = res.hideFloatingPill;
      }
      if (typeof res.confidenceThreshold === 'number') {
        thresholdRange.value = Math.round(res.confidenceThreshold * 100);
        thresholdVal.textContent = `${thresholdRange.value}%`;
      }

      if (typeof res.motivationalCount === 'number' && motivationalCounter) {
        motivationalCounter.textContent = res.motivationalCount;
      }
      if (typeof res.memeCount === 'number' && memeCounter) {
        memeCounter.textContent = res.memeCount;
      }
      if (typeof res.deepDiveCount === 'number' && deepDiveCounter) {
        deepDiveCounter.textContent = res.deepDiveCount;
      }
      if (typeof res.blockedRageCount === 'number' && rageCounter) {
        rageCounter.textContent = res.blockedRageCount;
      }
      if (typeof res.blockedScamCount === 'number' && scamCounter) {
        scamCounter.textContent = res.blockedScamCount;
      }
      if (typeof res.monkModeBlockedCount === 'number' && monkCounter) {
        monkCounter.textContent = res.monkModeBlockedCount;
      }
      if (typeof res.wholesomeCount === 'number' && wholesomeCounter) {
        wholesomeCounter.textContent = res.wholesomeCount;
      }
      if (typeof res.doomCount === 'number' && doomCounter) {
        doomCounter.textContent = res.doomCount;
      }
      if (typeof res.fomoCount === 'number' && fomoCounter) {
        fomoCounter.textContent = res.fomoCount;
      }
      if (typeof res.casualCount === 'number' && casualCounter) {
        casualCounter.textContent = res.casualCount;
      }
      if (typeof res.customCount === 'number' && customCounter) {
        customCounter.textContent = res.customCount;
      }
    }
  );

  function saveAndNotify() {
    const config = {
      filterMotivationalEnabled: filterMotivationalToggle ? filterMotivationalToggle.checked : true,
      filterMemeEnabled: filterMemeToggle ? filterMemeToggle.checked : true,
      filterDeepDiveEnabled: filterDeepDiveToggle ? filterDeepDiveToggle.checked : true,
      filterWholesomeEnabled: filterWholesomeToggle ? filterWholesomeToggle.checked : true,
      filterDoomEnabled: filterDoomToggle ? filterDoomToggle.checked : true,
      filterFomoEnabled: filterFomoToggle ? filterFomoToggle.checked : true,
      filterCasualEnabled: filterCasualToggle ? filterCasualToggle.checked : true,
      customLabels: customLabels,
      focusModeEnabled: focusModeToggle ? focusModeToggle.checked : false,
      focusWhitelistTags: getFocusWhitelistTags(),
      monkModeEnabled: monkModeToggle.checked,
      blockReelsEnabled: blockReelsToggle.checked,
      autoBlurRageEnabled: autoBlurRageToggle.checked,
      blockScamsEnabled: blockScamsToggle.checked,
      collapseSeedingEnabled: collapseSeedingToggle.checked,
      hideFloatingPill: hideFloatingPillToggle.checked,
      confidenceThreshold: parseInt(thresholdRange.value, 10) / 100,
    };

    updateFocusUI(config.focusModeEnabled);

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

  if (focusModeToggle) focusModeToggle.addEventListener('change', saveAndNotify);
  [
    focusTagMotivational,
    focusTagMeme,
    focusTagDeepDive,
    focusTagWholesome,
    focusTagCasual,
    focusTagDoom,
    focusTagFomo,
    focusTagCustom,
  ].forEach((chk) => {
    if (chk) chk.addEventListener('change', saveAndNotify);
  });

  if (filterMotivationalToggle) filterMotivationalToggle.addEventListener('change', saveAndNotify);
  if (filterMemeToggle) filterMemeToggle.addEventListener('change', saveAndNotify);
  if (filterDeepDiveToggle) filterDeepDiveToggle.addEventListener('change', saveAndNotify);
  if (filterWholesomeToggle) filterWholesomeToggle.addEventListener('change', saveAndNotify);
  if (filterDoomToggle) filterDoomToggle.addEventListener('change', saveAndNotify);
  if (filterFomoToggle) filterFomoToggle.addEventListener('change', saveAndNotify);
  if (filterCasualToggle) filterCasualToggle.addEventListener('change', saveAndNotify);
  monkModeToggle.addEventListener('change', saveAndNotify);
  blockReelsToggle.addEventListener('change', saveAndNotify);
  autoBlurRageToggle.addEventListener('change', saveAndNotify);
  blockScamsToggle.addEventListener('change', saveAndNotify);
  collapseSeedingToggle.addEventListener('change', saveAndNotify);
  hideFloatingPillToggle.addEventListener('change', saveAndNotify);

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
      if (changes.motivationalCount && motivationalCounter) {
        motivationalCounter.textContent = changes.motivationalCount.newValue || 0;
      }
      if (changes.memeCount && memeCounter) {
        memeCounter.textContent = changes.memeCount.newValue || 0;
      }
      if (changes.deepDiveCount && deepDiveCounter) {
        deepDiveCounter.textContent = changes.deepDiveCount.newValue || 0;
      }
      if (changes.blockedRageCount && rageCounter) {
        rageCounter.textContent = changes.blockedRageCount.newValue || 0;
      }
      if (changes.blockedScamCount && scamCounter) {
        scamCounter.textContent = changes.blockedScamCount.newValue || 0;
      }
      if (changes.monkModeBlockedCount && monkCounter) {
        monkCounter.textContent = changes.monkModeBlockedCount.newValue || 0;
      }
      if (changes.wholesomeCount && wholesomeCounter) {
        wholesomeCounter.textContent = changes.wholesomeCount.newValue || 0;
      }
      if (changes.doomCount && doomCounter) {
        doomCounter.textContent = changes.doomCount.newValue || 0;
      }
      if (changes.fomoCount && fomoCounter) {
        fomoCounter.textContent = changes.fomoCount.newValue || 0;
      }
      if (changes.casualCount && casualCounter) {
        casualCounter.textContent = changes.casualCount.newValue || 0;
      }
      if (changes.customCount && customCounter) {
        customCounter.textContent = changes.customCount.newValue || 0;
      }
      if (changes.focusCollapsedCount && focusCounter) {
        focusCounter.textContent = changes.focusCollapsedCount.newValue || 0;
      }
      if (changes.customLabels && Array.isArray(changes.customLabels.newValue)) {
        customLabels = changes.customLabels.newValue
          .map((c) => (typeof c === 'string' ? { name: c.trim(), enabled: true } : { name: (c?.name || '').trim(), enabled: c?.enabled !== false }))
          .filter((c) => c.name);
        renderCustomLabels();
      }
    });
  }
});

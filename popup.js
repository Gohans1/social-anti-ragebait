// Popup script for Social Shield All-in-One + Monk Mode
document.addEventListener('DOMContentLoaded', () => {
  const filterMotivationalToggle = document.getElementById('filterMotivationalToggle');
  const filterMemeToggle = document.getElementById('filterMemeToggle');
  const filterDeepDiveToggle = document.getElementById('filterDeepDiveToggle');
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
  const resetStats = document.getElementById('resetStats');

  // Load saved settings
  chrome.storage.local.get(
    [
      'filterMotivationalEnabled',
      'filterMemeEnabled',
      'filterDeepDiveEnabled',
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
    ],
    (res) => {
      if (typeof res.filterMotivationalEnabled === 'boolean' && filterMotivationalToggle) {
        filterMotivationalToggle.checked = res.filterMotivationalEnabled;
      }
      if (typeof res.filterMemeEnabled === 'boolean' && filterMemeToggle) {
        filterMemeToggle.checked = res.filterMemeEnabled;
      }
      if (typeof res.filterDeepDiveEnabled === 'boolean' && filterDeepDiveToggle) {
        filterDeepDiveToggle.checked = res.filterDeepDiveEnabled;
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
    }
  );

  function saveAndNotify() {
    const config = {
      filterMotivationalEnabled: filterMotivationalToggle ? filterMotivationalToggle.checked : true,
      filterMemeEnabled: filterMemeToggle ? filterMemeToggle.checked : true,
      filterDeepDiveEnabled: filterDeepDiveToggle ? filterDeepDiveToggle.checked : true,
      monkModeEnabled: monkModeToggle.checked,
      blockReelsEnabled: blockReelsToggle.checked,
      autoBlurRageEnabled: autoBlurRageToggle.checked,
      blockScamsEnabled: blockScamsToggle.checked,
      collapseSeedingEnabled: collapseSeedingToggle.checked,
      hideFloatingPill: hideFloatingPillToggle.checked,
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

  if (filterMotivationalToggle) filterMotivationalToggle.addEventListener('change', saveAndNotify);
  if (filterMemeToggle) filterMemeToggle.addEventListener('change', saveAndNotify);
  if (filterDeepDiveToggle) filterDeepDiveToggle.addEventListener('change', saveAndNotify);
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
    });
    if (motivationalCounter) motivationalCounter.textContent = '0';
    if (memeCounter) memeCounter.textContent = '0';
    if (deepDiveCounter) deepDiveCounter.textContent = '0';
    if (rageCounter) rageCounter.textContent = '0';
    if (scamCounter) scamCounter.textContent = '0';
    if (monkCounter) monkCounter.textContent = '0';

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
    });
  }
});

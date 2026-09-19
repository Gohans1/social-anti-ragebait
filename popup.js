// Popup script for Social Shield All-in-One + Monk Mode
document.addEventListener('DOMContentLoaded', () => {
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
  const monkCounter = document.getElementById('monkCounter');
  const resetStats = document.getElementById('resetStats');

  // Load saved settings
  chrome.storage.local.get(
    [
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
      'monkModeBlockedCount',
    ],
    (res) => {
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
      if (typeof res.monkModeBlockedCount === 'number' && monkCounter) {
        monkCounter.textContent = res.monkModeBlockedCount;
      }
    }
  );

  function saveAndNotify() {
    const config = {
      monkModeEnabled: monkModeToggle.checked,
      blockReelsEnabled: blockReelsToggle.checked,
      autoBlurRageEnabled: autoBlurRageToggle.checked,
      blockScamsEnabled: blockScamsToggle.checked,
      collapseSeedingEnabled: collapseSeedingToggle.checked,
      hideFloatingPill: hideFloatingPillToggle.checked,
      confidenceThreshold: parseInt(thresholdRange.value, 10) / 100,
    };

    chrome.storage.local.set(config);

    // Broadcast config to all active tabs on Threads, Facebook, X
    const targetUrlPatterns = [
      '*://*.threads.net/*',
      '*://threads.net/*',
      '*://*.threads.com/*',
      '*://threads.com/*',
      '*://*.x.com/*',
      '*://x.com/*',
      '*://*.twitter.com/*',
      '*://twitter.com/*',
      '*://*.facebook.com/*',
      '*://facebook.com/*',
      '*://*.fb.com/*',
      '*://*.instagram.com/*',
      '*://instagram.com/*',
      '*://*.youtube.com/*',
      '*://youtube.com/*',
    ];

    // Broadcast config to all tabs
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
      if (changes.monkModeBlockedCount && monkCounter) {
        monkCounter.textContent = changes.monkModeBlockedCount.newValue || 0;
      }
    });
  }
});

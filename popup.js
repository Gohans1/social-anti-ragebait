// Popup script for Social Shield All-in-One + Monk Mode
document.addEventListener('DOMContentLoaded', () => {
  const monkModeToggle = document.getElementById('monkModeToggle');
  const blockReelsToggle = document.getElementById('blockReelsToggle');
  const autoBlurRageToggle = document.getElementById('autoBlurRageToggle');
  const blockScamsToggle = document.getElementById('blockScamsToggle');
  const collapseSeedingToggle = document.getElementById('collapseSeedingToggle');
  const thresholdRange = document.getElementById('thresholdRange');
  const thresholdVal = document.getElementById('thresholdVal');

  const monkCounter = document.getElementById('monkCounter');
  const rageCounter = document.getElementById('rageCounter');
  const scamCounter = document.getElementById('scamCounter');
  const seedingCounter = document.getElementById('seedingCounter');
  const resetStats = document.getElementById('resetStats');

  // Load saved settings
  chrome.storage.local.get(
    [
      'monkModeEnabled',
      'blockReelsEnabled',
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
      if (typeof res.confidenceThreshold === 'number') {
        thresholdRange.value = Math.round(res.confidenceThreshold * 100);
        thresholdVal.textContent = `${thresholdRange.value}%`;
      }

      if (typeof res.monkModeBlockedCount === 'number') {
        monkCounter.textContent = res.monkModeBlockedCount;
      }
      if (typeof res.blockedRageCount === 'number') {
        rageCounter.textContent = res.blockedRageCount;
      }
      if (typeof res.blockedScamCount === 'number') {
        scamCounter.textContent = res.blockedScamCount;
      }
      if (typeof res.cleanedSeedingCount === 'number') {
        seedingCounter.textContent = res.cleanedSeedingCount;
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
    ];

    chrome.tabs.query({ url: targetUrlPatterns }, (tabs) => {
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

  thresholdRange.addEventListener('input', () => {
    thresholdVal.textContent = `${thresholdRange.value}%`;
  });

  thresholdRange.addEventListener('change', saveAndNotify);

  resetStats.addEventListener('click', () => {
    chrome.storage.local.set({
      monkModeBlockedCount: 0,
      blockedRageCount: 0,
      blockedScamCount: 0,
      cleanedSeedingCount: 0,
    });
    monkCounter.textContent = '0';
    rageCounter.textContent = '0';
    scamCounter.textContent = '0';
    seedingCounter.textContent = '0';
  });
});

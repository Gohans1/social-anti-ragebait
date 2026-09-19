// Popup script for settings
document.addEventListener('DOMContentLoaded', () => {
  const autoBlurToggle = document.getElementById('autoBlurToggle');
  const thresholdRange = document.getElementById('thresholdRange');
  const thresholdVal = document.getElementById('thresholdVal');
  const blockedCounter = document.getElementById('blockedCounter');
  const resetStats = document.getElementById('resetStats');

  // Load settings
  chrome.storage.local.get(['autoBlurEnabled', 'blurThreshold', 'blockedCount'], (res) => {
    if (typeof res.autoBlurEnabled === 'boolean') {
      autoBlurToggle.checked = res.autoBlurEnabled;
    }
    if (typeof res.blurThreshold === 'number') {
      thresholdRange.value = Math.round(res.blurThreshold * 100);
      thresholdVal.textContent = `${thresholdRange.value}%`;
    }
    if (typeof res.blockedCount === 'number') {
      blockedCounter.textContent = res.blockedCount;
    }
  });

  function saveAndNotify() {
    const config = {
      autoBlurEnabled: autoBlurToggle.checked,
      blurThreshold: parseInt(thresholdRange.value, 10) / 100,
    };

    chrome.storage.local.set(config);

    // Send message to all tabs
    chrome.tabs.query({ url: ['https://x.com/*', 'https://twitter.com/*'] }, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, {
          type: 'UPDATE_CONFIG',
          config: config,
        }).catch(() => {});
      });
    });
  }

  autoBlurToggle.addEventListener('change', saveAndNotify);

  thresholdRange.addEventListener('input', () => {
    thresholdVal.textContent = `${thresholdRange.value}%`;
  });

  thresholdRange.addEventListener('change', saveAndNotify);

  resetStats.addEventListener('click', () => {
    chrome.storage.local.set({ blockedCount: 0 });
    blockedCounter.textContent = '0';
  });
});

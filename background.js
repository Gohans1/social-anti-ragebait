// Background Service Worker for Social Anti-Ragebait
// Handles network requests to classifier.dev in extension background context,
// completely bypassing page Content Security Policy (CSP) on Threads, Facebook, and X.

const API_ENDPOINT = 'https://classifier.dev/';

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Social Anti-Ragebait] Extension installed / updated.');
  // Set default confidence threshold in storage if not already set
  chrome.storage.local.get(['confidenceThreshold'], (res) => {
    if (typeof res.confidenceThreshold !== 'number') {
      chrome.storage.local.set({ confidenceThreshold: 0.30 });
    }
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'CLASSIFY_BATCH') {
    const { inputs, labels, instructions } = request.payload || {};

    if (!inputs || !Array.isArray(inputs) || inputs.length === 0) {
      sendResponse({ success: true, results: [] });
      return false;
    }

    console.log(`[Anti-Ragebait Background] 📡 Đang gửi ${inputs.length} mẫu text lên Jev (classifier.dev)...`);

    fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        labels: labels,
        inputs: inputs,
        instructions: instructions,
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const errText = await response.text();
          console.error(`[Anti-Ragebait Background] Jev API HTTP Error ${response.status}:`, errText);
          throw new Error(`HTTP ${response.status}: ${errText}`);
        }
        return response.json();
      })
      .then((data) => {
        console.log(`[Anti-Ragebait Background] ✅ Jev đã trả về kết quả cho ${data.results?.length} items.`);
        sendResponse({ success: true, results: data.results || [] });
      })
      .catch((error) => {
        console.error('[Anti-Ragebait Background] Fetch error:', error);
        sendResponse({ success: false, error: error.message, results: [] });
      });

    // Return true to keep the message channel open for asynchronous sendResponse
    return true;
  }
});

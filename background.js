// Background Service Worker for Social Anti-Ragebait
// Handles network requests to classifier.dev in extension background context,
// completely bypassing page Content Security Policy (CSP) on Threads, Facebook, and X.

const API_ENDPOINT = 'https://classifier.dev';

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Social Anti-Ragebait] Extension installed / updated.');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'CLASSIFY_BATCH') {
    const { inputs, labels, instructions } = request.payload || {};

    if (!inputs || !Array.isArray(inputs) || inputs.length === 0) {
      sendResponse({ success: true, results: [] });
      return false;
    }

    fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'social-anti-ragebait-extension/1.2',
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
          throw new Error(`HTTP ${response.status}: ${errText}`);
        }
        return response.json();
      })
      .then((data) => {
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

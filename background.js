// Background Service Worker for Social Anti-Ragebait
// Handles network requests to classifier.dev in extension background context,
// completely bypassing page Content Security Policy (CSP) on Threads, Facebook, and X.

const API_ENDPOINT = 'https://classifier.dev/';
const DEFAULT_GEMINI_API_KEY = '';
const DEFAULT_GEMINI_PROMPT = 'Summarize the following social media post into exactly 3 concise, high-signal bullet points in the same language as the post (Vietnamese or English). No intro, no filler, strictly 3 bullet points starting with -:';

let jevCooldownUntil = 0;

function setupSidePanel() {
  if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error('[Social Shield] Error setting side panel behavior:', error));
  }
}

// Ensure side panel behavior persists across installations and runtime reloads
setupSidePanel();

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Social Anti-Ragebait] Extension installed / updated.');
  setupSidePanel();
  // Set default confidence threshold, Gemini API Key and prompt in storage if not already set
  chrome.storage.local.get(['confidenceThreshold', 'geminiApiKey', 'geminiPrompt'], (res) => {
    if (typeof res.confidenceThreshold !== 'number') {
      chrome.storage.local.set({ confidenceThreshold: 0.30 });
    }
    if (typeof res.geminiApiKey !== 'string') {
      chrome.storage.local.set({ geminiApiKey: '' });
    }
    if (!res.geminiPrompt || typeof res.geminiPrompt !== 'string' || !res.geminiPrompt.trim()) {
      chrome.storage.local.set({ geminiPrompt: DEFAULT_GEMINI_PROMPT });
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

    if (Date.now() < jevCooldownUntil) {
      sendResponse({ success: false, status: 429, error: 'Jev rate limit cooldown active', results: [] });
      return false;
    }

    console.log(`[Anti-Ragebait Background] 📡 Sending ${inputs.length} text samples to Jev (classifier.dev)...`);

    fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(25000),
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
          const err = new Error(`HTTP ${response.status}: ${errText}`);
          err.status = response.status;
          if (response.status === 429) {
            jevCooldownUntil = Date.now() + 10000;
          }
          throw err;
        }
        return response.json();
      })
      .then((data) => {
        console.log(`[Anti-Ragebait Background] ✅ Jev returned results for ${data.results?.length} items.`);
        sendResponse({ success: true, results: data.results || [] });
      })
      .catch((error) => {
        console.error('[Anti-Ragebait Background] Fetch error:', error);
        if (error.status === 429) {
          jevCooldownUntil = Date.now() + 10000;
        }
        sendResponse({ success: false, error: error.message, status: error.status || 500, results: [] });
      });

    // Return true to keep the message channel open for asynchronous sendResponse
    return true;
  }

  if (request.type === 'SUMMARIZE_POST') {
    const { text, imageUrls, apiKey, prompt: requestPrompt } = request.payload || {};

    function arrayBufferToBase64(buffer) {
      let binary = '';
      const bytes = new Uint8Array(buffer);
      const len = bytes.byteLength;
      const chunkSize = 8192;
      for (let i = 0; i < len; i += chunkSize) {
        const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
        binary += String.fromCharCode.apply(null, chunk);
      }
      return btoa(binary);
    }

    const doSummarize = async (key, systemPrompt) => {
      if (!key) {
        sendResponse({
          success: false,
          error: 'Google AI Studio API key missing. Please enter your API key in extension settings.',
        });
        return;
      }

      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        sendResponse({ success: false, error: 'Empty text to summarize' });
        return;
      }

      const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent';
      const baseInstruction = (typeof systemPrompt === 'string' && systemPrompt.trim().length > 0)
        ? systemPrompt.trim()
        : DEFAULT_GEMINI_PROMPT;
      const formattedInstruction = /[:.?!]$/.test(baseInstruction)
        ? baseInstruction
        : baseInstruction + ':';
      const prompt = formattedInstruction + '\n\n' + text.trim();

      const parts = [{ text: prompt }];

      if (Array.isArray(imageUrls) && imageUrls.length > 0) {
        const imagePartPromises = imageUrls.slice(0, 3).map(async (url) => {
          try {
            let fetchUrl = url;
            if (typeof fetchUrl === 'string' && fetchUrl.includes('twimg.com')) {
              fetchUrl = fetchUrl.replace(/name=[a-zA-Z0-9]+/, 'name=small');
            }
            const res = await fetch(fetchUrl, { signal: AbortSignal.timeout(6000) });
            if (!res.ok) return null;
            const contentType = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
            const mimeType = contentType.startsWith('image/') ? contentType : 'image/jpeg';
            const buffer = await res.arrayBuffer();
            const base64Data = arrayBufferToBase64(buffer);
            if (!base64Data) return null;
            return {
              inlineData: {
                mimeType: mimeType,
                data: base64Data,
              },
            };
          } catch (e) {
            console.warn('[Gemini Background] Failed to fetch post image:', url, e);
            return null;
          }
        });

        try {
          const resolvedImages = await Promise.all(imagePartPromises);
          for (const imgPart of resolvedImages) {
            if (imgPart) parts.push(imgPart);
          }
        } catch (e) {
          console.warn('[Gemini Background] Error processing image parts:', e);
        }
      }

      fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': key,
        },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
          contents: [{
            parts: parts,
          }],
          generationConfig: {
            maxOutputTokens: 250,
          },
        }),
      })
        .then(async (response) => {
          if (!response.ok) {
            const errText = await response.text();
            console.error(`[Gemini Background] HTTP Error ${response.status}:`, errText);
            let errMsg = `HTTP ${response.status}: ${errText}`;
            try {
              const errData = JSON.parse(errText);
              if (errData?.error?.message) errMsg = errData.error.message;
            } catch (e) {}
            throw new Error(errMsg);
          }
          return response.json();
        })
        .then((data) => {
          const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const bullets = rawText
            .split('\n')
            .map((line) => line.trim().replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '').trim())
            .filter((line) => line.length > 0)
            .slice(0, 3);

          sendResponse({ success: true, bullets, rawText });
        })
        .catch((error) => {
          console.error('[Gemini Background] Fetch error:', error);
          sendResponse({ success: false, error: error.message });
        });
    };

    chrome.storage.local.get(['geminiApiKey', 'geminiPrompt'], (storageRes) => {
      const finalKey = (apiKey && typeof apiKey === 'string' && apiKey.trim().length > 0)
        ? apiKey.trim()
        : ((typeof storageRes?.geminiApiKey === 'string' && storageRes.geminiApiKey.trim())
          ? storageRes.geminiApiKey.trim()
          : DEFAULT_GEMINI_API_KEY);

      const finalPrompt = (requestPrompt && typeof requestPrompt === 'string' && requestPrompt.trim().length > 0)
        ? requestPrompt.trim()
        : ((typeof storageRes?.geminiPrompt === 'string' && storageRes.geminiPrompt.trim())
          ? storageRes.geminiPrompt.trim()
          : DEFAULT_GEMINI_PROMPT);

      doSummarize(finalKey, finalPrompt);
    });

    return true;
  }
});

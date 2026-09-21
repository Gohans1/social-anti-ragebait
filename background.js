// Background Service Worker for Social Anti-Ragebait
// Handles network requests to classifier.dev in extension background context,
// completely bypassing page Content Security Policy (CSP) on Threads, Facebook, and X.

const API_ENDPOINT = 'https://classifier.dev/';
const DEFAULT_GEMINI_API_KEY = 'AIzaSyCEUfHf2SiBsA5ZLDLHJMg_1bkjebeuVoo';
const DEFAULT_GEMINI_PROMPT = 'Summarize the following social media post into exactly 3 concise, high-signal bullet points in the same language as the post (Vietnamese or English). No intro, no filler, strictly 3 bullet points starting with -:';

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Social Anti-Ragebait] Extension installed / updated.');
  // Set default confidence threshold, Gemini API Key and prompt in storage if not already set
  chrome.storage.local.get(['confidenceThreshold', 'geminiApiKey', 'geminiPrompt'], (res) => {
    if (typeof res.confidenceThreshold !== 'number') {
      chrome.storage.local.set({ confidenceThreshold: 0.30 });
    }
    if (!res.geminiApiKey || typeof res.geminiApiKey !== 'string' || !res.geminiApiKey.trim()) {
      chrome.storage.local.set({ geminiApiKey: DEFAULT_GEMINI_API_KEY });
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

    console.log(`[Anti-Ragebait Background] 📡 Sending ${inputs.length} text samples to Jev (classifier.dev)...`);

    fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        labels: labels,
        inputs: inputs,
        instructions: instructions,
        multi: true,
        max_labels: 5,
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
        console.log(`[Anti-Ragebait Background] ✅ Jev returned results for ${data.results?.length} items.`);
        sendResponse({ success: true, results: data.results || [] });
      })
      .catch((error) => {
        console.error('[Anti-Ragebait Background] Fetch error:', error);
        sendResponse({ success: false, error: error.message, results: [] });
      });

    // Return true to keep the message channel open for asynchronous sendResponse
    return true;
  }

  if (request.type === 'SUMMARIZE_POST') {
    const { text, apiKey, prompt: requestPrompt } = request.payload || {};

    const doSummarize = (key, systemPrompt) => {
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
      const formattedInstruction = baseInstruction.endsWith(':')
        ? baseInstruction
        : baseInstruction + ':';
      const prompt = formattedInstruction + '\n\n' + text.trim();

      fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': key,
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }],
          }],
          generationConfig: {
            maxOutputTokens: 250,
            temperature: 0.2,
          },
        }),
      })
        .then(async (response) => {
          if (!response.ok) {
            const errText = await response.text();
            console.error(`[Gemini Background] HTTP Error ${response.status}:`, errText);
            throw new Error(`HTTP ${response.status}: ${errText}`);
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

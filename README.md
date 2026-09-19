# 🛡️ Social Anti-Ragebait & Emotion Predictor

> Automatically detect, classify, and blur outrage-inducing posts and drama on **X (Twitter)**, **Threads**, and **Facebook** in real time — powered by the **Jev Zero-Shot Decision Model** ([classifier.dev](https://classifier.dev)).

English & Tiếng Việt supported natively out-of-the-box.

---

## 🌟 Key Features

* **Real-time Emotional Intent Tagging**: Identifies what an author is trying to make you feel before you read:
  - 🚨 **Rage Bait**: Engineered to provoke anger, outrage, or drama farming.
  - ⚠️ **Doom / Fear**: Fearmongering, panic inducing, sensationalized disaster warnings.
  - ⚡ **FOMO / Hype**: Unrealistic hype, fear of missing out, greed traps.
  - 🌿 **Wholesome**: Uplifting, positive, entertaining content.
  - 💡 **Informative**: Educational insights, objective facts, tutorial guides.
  - 💬 **Discussion / Casual**: Everyday personal thoughts and neutral conversations.
* **Auto-Blur for Rage Bait**: Posts flagged as Rage Bait (confidence $\ge 65\%$) are automatically blurred with a clean warning banner and a one-click *"Reveal post"* toggle.
* **Multi-Platform Support**: Works seamlessly on **𝕏 (Twitter)**, **🧵 Threads (`threads.com` & `threads.net`)**, and **📘 Facebook (`facebook.com`)**.
* **Multilingual Out-of-the-Box**: Tested and validated on English and Vietnamese internet culture (drama, *"phốt"*, chửi bới, giật tít, toxic replies).
* **Zero API Key & Zero Signup**: Direct inference via `classifier.dev` (Jev fast-tier model) in ~250ms with zero server cost or user tracking.
* **Floating Control Widget**: Interactive on-screen widget displaying real-time ON/OFF state and a counter of blocked toxic posts.

---

## 🚀 Installation

You can install this tool either as a **Chrome Extension** or a **Tampermonkey Userscript**.

### Option 1: Chrome Extension (Recommended)

1. Clone or download this repository.
2. Open Google Chrome (or Brave / Edge) and navigate to `chrome://extensions`.
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked** and select the folder containing this repository.
5. Visit [threads.com](https://threads.com), [threads.net](https://threads.net), [x.com](https://x.com), or [facebook.com](https://facebook.com) to enjoy a ragebait-free feed!

### Option 2: Tampermonkey Userscript

1. Install the [Tampermonkey](https://www.tampermonkey.net/) extension for your browser.
2. Create a new userscript and copy the contents of [`social-anti-ragebait.user.js`](./social-anti-ragebait.user.js).
3. Save (`Ctrl + S`), then reload your social media feed.

---

## 🧠 Model & Performance Benchmark

This tool uses the **Jev** decision model from [classifier.dev](https://classifier.dev):

* **Architecture**: Zero-shot calibrated probability classifier.
* **Latency**: ~250ms round-trip batch inference.
* **Accuracy on emotional intent**:
  - Outrage & Drama detection: **98% confidence** on empirical test sets.
  - Fearmongering & Fake news: **92% confidence**.
  - Educational / Informative: **99% confidence**.

---

## 📄 License

MIT License. Feel free to use, modify, and distribute.

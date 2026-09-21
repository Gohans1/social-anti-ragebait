# Changelog

All notable changes to the **Social Shield: AI Anti-Rage & Focus Guard** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.5.0] - 2026-09-21

### Added
- **Custom Label Criteria & Instruction Editor**: Users can now define explicit prompt instructions/criteria per custom label in the extension popup UI.
- **Strict Auto-Fallback**: Custom labels with empty instructions automatically fall back to the calibrated default template (`content specifically discussing, focused on, or related to ${name}.`), ensuring 100% backward-compatibility.
- **Criteria Badge Indicator**: Custom label chips render a Geist Mono subtitle (`↳ <criteria>`) with cyan highlight for customized rules or auto-criteria indicator.
- **Minimalist Geometric Social Shield Iconography**: Replaced legacy red/white icon with high-contrast chiseled monochrome shield icons across all extension resolutions (16px, 48px, 128px) and popup header.

### Fixed
- **Storage Hydration Mapping**: Fixed custom labels storage load in `popup.js` (`chrome.storage.local.get` and `chrome.storage.onChanged`) to strictly preserve `instruction` attributes across popup reloads and prevent silent data loss.
- **Taxonomy Payload Alter Detection**: Updated `isTaxonomyPayloadAltered` in `content.js` to track instruction changes, ensuring accurate classifier cache invalidation and immediate re-scoring.
- **Label Re-submission Update**: Submitting an existing custom label now safely updates or clears its instruction without duplicate chip creation.

---

## [2.4.0] - 2026-09-21

### Added
- **On-Demand Gemini 3.5 Flash-Lite Summarizer**: Click a dedicated "TL;DR" button on any post to generate a 3-bullet high-signal summary directly in the feed using Google AI Studio.
- **Custom System Prompt Configuration**: Extension popup UI now includes an editable system prompt textarea for the Gemini summarizer with Geist Mono typography.
- **Dirty-Checking Save Button**: Save button remains disabled until actual changes are made, preventing accidental overwrites and providing visual `Saved ✓` confirmation.
- **Reset to Default Prompt**: Quick one-click reset button restores the recommended default 3-bullet summarizer prompt.
- **Userscript Parity**: Full support for custom Gemini prompts and summarization in Tampermonkey/Violentmonkey via `GM_getValue` and `localStorage`.

### Changed
- **Punctuation-Aware Prompt Formatting**: System instructions ending with terminal punctuation (`:`, `.`, `!`, `?`) are preserved naturally without appending redundant colons.
- **Vercel Dark Theme Polish**: Seamless dark theme styling with subtle borders, hover transitions, and accessible disabled states.

### Fixed
- **Config Broadcast Flag Safety**: Partial configuration updates in `UPDATE_CONFIG` now strictly type-guard all protective flags, preventing rage blurring and Monk Mode from being disabled on prompt saves.
- **Summary Cache Invalidation**: Modifying the Gemini system prompt now automatically clears in-memory post summary caches so updated instructions take effect immediately without a page refresh.
- **Popup Typing Race Condition**: Incoming external storage sync events no longer overwrite the prompt textarea while the user is actively typing.

---

## [2.3.0] - 2026-09-20

### Added
- Curated 7-category taxonomy with 3-state filter rules (`show`, `hide`, `off`).
- Inline Header Pill badges with platform-adaptive color dots.
- Anti-scam, anti-rage auto-blur, and Universal Monk Mode.

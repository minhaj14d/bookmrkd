# bookmrkd Privacy Policy

**Effective:** 8 June 2026  
**Extension version:** 2.0.0  
**Developer:** [Minhajul Abedin](https://github.com/minhaj14d)  
**Contact:** [GitHub Issues](https://github.com/minhaj14d/bookmrkd/issues)

bookmrkd is a local-first bookmark maintenance assistant for Firefox and Chromium-based browsers. Your data stays on your device by default. Optional features may contact third-party services **only when you turn them on** and provide credentials where required.

---

## What we collect

**Nothing is sent to bookmrkd servers.** There is no bookmrkd backend, no accounts, no analytics, and no advertising trackers.

---

## Local storage (default)

| Data | Where | Purpose |
|------|--------|---------|
| Saved library bookmarks (URL, title, tags, favicon URL, timestamps) | IndexedDB on your device | Popup save, Library search, export/import |
| Smart Collection Assistant feedback (accept/reject/ignore) | IndexedDB on your device | Local learning for suggestions |
| Extension settings (AI provider choice, rules, optional API keys) | `browser.storage` on your device | Preferences |
| Optional Raindrop OAuth tokens & collection map | `browser.storage` on your device | Raindrop integration when connected |

---

## Browser bookmarks (AI Suggestions & Advanced)

When you run analysis or organize:

- The extension reads your **browser bookmark tree** and/or **HTML files you import**.
- Suggestions are shown for your approval; **nothing is changed automatically** unless you approve an action.
- Approved moves apply only to the source you selected (browser bookmarks or Raindrop).

---

## Optional: local AI (MiniLM embeddings)

If you choose **Local embeddings (MiniLM)**:

- The model may be downloaded from **Hugging Face** (`huggingface.co`) and cached on your device.
- Inference runs locally in the extension; bookmark text is not sent to bookmrkd or to Hugging Face for inference after the model is cached.

---

## Optional: cloud AI (Gemini / OpenAI)

If you add an API key and select **Google Gemini** or **OpenAI**:

- Bookmark **titles and URLs** (and similar short text needed for classification) may be sent to that provider’s API.
- Your full library is not bulk-uploaded; requests are limited to what each feature needs.
- That provider’s privacy policy applies to that traffic.
- You can avoid this entirely by using **Local rules** or **Local embeddings**.

---

## Optional: Raindrop.io

If you connect Raindrop:

- OAuth uses Mozilla **`identity`** / browser auth to obtain tokens stored locally.
- The extension calls **Raindrop’s API** to read collections/bookmarks and to apply moves/tags **you approve**.
- Raindrop’s privacy policy applies to data stored in your Raindrop account.

---

## Advanced — bulk organize & export

Optional tools read bookmarks or imported HTML, dedupe/categorize locally, and produce **export files** (HTML/JSON/report). Live bookmarks are not overwritten unless you import an export yourself.

---

## What we do not do

- We do not sell your data.
- We do not run analytics, crash reporting, or external logging.
- We do not upload your library except when **you** enable optional third-party features above.
- We do not sync your library to bookmrkd servers.

---

## Changes

Material changes to this policy will be reflected in this file and in the in-extension privacy page shipped with new releases.

---

## License

bookmrkd is licensed under [GPL-3.0](https://github.com/minhaj14d/bookmrkd/blob/main/LICENSE).

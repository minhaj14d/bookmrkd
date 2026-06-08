# Firefox Add-ons (AMO) listing — bookmrkd v2.0.0

Copy/paste into the [Developer Hub](https://addons.mozilla.org/developers/) submission form.

| Field | Value |
|-------|--------|
| **Developer** | Minhajul Abedin |
| **License** | GPL-3.0 |
| **Gecko ID** | `bookmrkd@minhaj14d.github.io` |
| **Distribution** | **On this site** (public on addons.mozilla.org) |
| **Category** | Productivity |
| **Homepage** | https://github.com/minhaj14d/bookmrkd |
| **Support / issues** | https://github.com/minhaj14d/bookmrkd/issues |
| **Privacy policy** | https://github.com/minhaj14d/bookmrkd/blob/main/docs/PRIVACY.md |

---

## Add-on name

```
bookmrkd — Bookmark Library
```

---

## Summary (250 characters max)

```
Save and tag tabs in a local library. AI suggests folder improvements — you approve every change. Offline by default; optional MiniLM or your own API keys. No analytics.
```

*(167 characters)*

---

## Description

```
bookmrkd is a local-first bookmark assistant for Firefox. It helps you save, find, and maintain bookmarks without auto-deletes or a required cloud account.

POPUP — SAVE & TAG
• Save the current page with editable title and tags
• Recent saves at a glance; open the full library from settings

LIBRARY — LOCAL BY DEFAULT
• Search by title, URL, tags, and domain
• Export/import JSON backup
• Stored in IndexedDB on your device

AI SUGGESTIONS
• Health score for your bookmark folders
• Move, duplicate, and cleanup suggestions with confidence and reasoning
• Approve, reject, or ignore each item — nothing changes until you approve
• Default: offline local rules; optional on-device MiniLM embeddings

ADVANCED (OPTIONAL)
• Bulk dedupe and categorize browser bookmarks or imported HTML
• Export organized Netscape HTML; summary report
• Optional Gemini assist with your own API key (title + URL only)

PRIVACY
• No analytics, no telemetry, no data selling
• Optional cloud AI only when you add your own API keys
• Open source (GPL-3.0): github.com/minhaj14d/bookmrkd
```

---

## Tags / keywords (AMO)

```
bookmarks, productivity, organize, tags, library, AI, duplicates, local-first, privacy, search
```

---

## Single purpose

```
Save, search, and maintain browser bookmarks and a local tagged library, with optional AI-assisted suggestions the user approves before applying.
```

---

## Screenshots (upload from `screenshots/`)

Upload in this order with these captions:

| File | Caption (AMO) |
|------|----------------|
| `screenshots/bookmrkd_1.png` | **Save from any page** — Popup to save the current tab with tags; library stays on your device. |
| `screenshots/bookmrkd_2.png` | **Local library** — Search, filter, export/import JSON; bookmarks stored locally. |
| `screenshots/bookmrkd_3.png` | **AI suggestions** — Folder health score and improvement ideas; approve before anything changes. |
| `screenshots/bookmrkd_4.png` | **Advanced tools** — Optional bulk organize, dedupe, and export; offline by default. |

**Before upload:** Re-capture screenshots 3 and 4 after rebuilding the extension so they do not show developer-only text (`.env`, test tokens) or visible API keys.

---

## Permission & host justification (for reviewers)

| Permission / host | Why bookmrkd needs it |
|-------------------|----------------------|
| `bookmarks` | Read the bookmark tree for analysis; write moves only after explicit user approval |
| `storage` | Save settings, optional user API keys, and local suggestion feedback |
| `tabs` | Read active tab title/URL when saving to the library |
| `contextMenus` | “Save to bookmrkd” on web pages |
| `downloads` | Save exported HTML/JSON backup files |
| `identity` | Optional third-party OAuth (only when Raindrop integration is enabled in a build) |
| `generativelanguage.googleapis.com` | Optional Gemini — user-supplied API key; title + URL only |
| `api.openai.com` | Optional OpenAI — user-supplied API key |
| `huggingface.co` | Optional local MiniLM model download |
| `cdn.jsdelivr.net` | Transformers.js runtime for optional local embeddings |
| `api.raindrop.io` / `raindrop.io` | Optional Raindrop API when user connects an account |

---

## Data collection & privacy (AMO questionnaire)

| Question | Answer |
|----------|--------|
| Collect or transmit personal data? | **Only if the user enables optional cloud AI** (their own Gemini/OpenAI key). Default usage is local-only. |
| Analytics / tracking? | **No** |
| Selling user data? | **No** |
| Account required? | **No** |
| What may leave the device (optional)? | Bookmark title + URL to Google/OpenAI when user enables Online AI |
| Where is data stored? | IndexedDB and browser storage on the user's device |

---

## Notes to reviewer

```
Thank you for reviewing bookmrkd.

QUICK TEST (no API keys)
1. Install the signed add-on.
2. Open Options (toolbar → extension settings).
3. Library tab — works offline; save a page from the popup first.
4. AI Suggestions — data source “Browser bookmarks”, provider “Local rules (offline)”, click “Analyze bookmarks”.
5. Approve/Reject suggestions — browser bookmarks change only on Approve.

OPTIONAL (not required for review)
• “Local embeddings (MiniLM)” downloads a model from huggingface.co on first use (~25 MB).
• Advanced → “Online (Gemini)” sends title+URL only when the user adds their own API key.

No telemetry, no analytics SDKs, no bookmrkd backend.

Source: https://github.com/minhaj14d/bookmrkd (GPL-3.0)
Build: cd extension && npm ci && npm run build:firefox
```

---

## Upload artifact

```bash
cd extension
npm ci
npm run build:firefox
npm run lint:firefox
npm run pack
```

Submit `release/bookmrkd-v2.0.0-firefox.zip` → **On this site**.

**Public release:** Build without Raindrop secrets in `.env`. Do not ship `VITE_RAINDROP_TEST_TOKEN` or committed API keys in screenshots.

---

## After approval

- Keep Gecko ID `bookmrkd@minhaj14d.github.io` for all updates.
- Bump `VERSION` + `npm run version:sync` before each new submission.

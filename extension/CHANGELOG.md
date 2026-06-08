# Changelog

## [1.0.0] — 2026-05-18

**Production release.** bookmrkd is ready for portfolio use and Chrome Web Store submission.

**Developer:** Minhajul Abedin · [github.com/minhaj14d](https://github.com/minhaj14d) · **License:** GPL-3.0

### Added
- **`privacy.html`** — full privacy policy (Offline/Online, Gemini, storage)
- **`STORE_LISTING.md`** — Web Store copy, permissions justification, screenshot notes
- **`LICENSE`** — GPL-3.0
- **`RELEASE.md`** + `npm run pack` — ZIP for GitHub Releases; CRX pack guide

### Changed
- Extension-only repo: removed orphan `requirements-bookmarks.txt`
- Store-facing description in `manifest.json`
- Settings link to privacy policy

### Includes (since v0.1.0)
- Offline/Online modes, Gemini free-tier Online assist
- 22+ built-in categorization rules + legacy classifier
- Fuzzy dedupe, HTML import/export, report tab
- Web Worker for 2,500+ bookmarks
- Custom rules export/import/merge, CI, semver tags

## [0.3.0] — 2026-05-18

### Added
- **Web Worker** for libraries with 2,500+ bookmarks (organize off UI thread)
- Custom rules **merged** with built-in `rules.json` instead of replacing them

### Changed
- `legacy-classify.js` is now an ES module (enables worker + removes popup script tag)

## [0.2.0] — 2026-05-18

### Added
- **Custom rules export/import** — export JSON, import file, load built-in template (Settings)
- `CONTRIBUTING.md` for contributors

### Changed
- **Chunked categorization** — large libraries yield to the UI during organize (`forEachChunked`)
- `organizeBookmarks` is async (popup awaits)

### Fixed
- Settings **Offline/Online** toggle: `aria-pressed`, arrow-key focus between segments
- `validate.mjs` checks `VERSION` matches manifest, package, and `lib/version.js`

## [0.1.1] — 2026-05-18

### Added
- GitHub Actions CI (`validate.mjs` + TypeScript check)
- `npm run version:sync` — keeps `VERSION`, manifest, and `lib/version.js` aligned

### Fixed
- Stale CHANGELOG note claiming “no in-extension AI”

## [0.1.0] — 2026-05-18

### Added
- Git repository baseline and semver discipline (`VERSION`, tags)
- Version utility `lib/version.js`

### Changed
- Manifest and package version aligned to **0.1.0** (repo release numbering starts here)
- Prior in-extension history (1.1.0–1.3.2) documented below as pre-semver iterations

---

## Pre-semver history (extension-only, no Git tags)

## [1.3.2] — 2026-05-18

### Changed
- **Online mode: Gemini only** — removed paid providers (OpenAI, Claude, OpenRouter, DeepSeek) and non–free-tier models
- Settings highlight **Google Gemini as recommended** with free API key from AI Studio
- Default model: **Gemini 2.0 Flash** (free tier)

## [1.3.1] — 2026-05-18

### Added
- **22 built-in categorization rules** — social, shopping, news, streaming, gaming, email/cloud, learning, dev, AI tools, travel, health, and more (`lib/rules.json`)
- Popup **Offline / Online** status pill (replaces “rules only” / “ai · provider”)

### Changed
- Settings mode toggle labels: **Offline** / **Online**

## [1.3.0] — 2026-05-18

### Added
- **AI providers**: Google Gemini (incl. 2.5 Flash preview), OpenAI, Anthropic Claude, OpenRouter, DeepSeek
- In-page **help text** for organization mode, fuzzy dedupe, bookmark source, export/report, custom rules
- Default fuzzy dedupe preference in Settings (synced with popup checkbox)

### Changed
- `host_permissions` for Anthropic, OpenRouter, DeepSeek APIs
- Popup badge shows provider label when AI mode is on

## [1.2.0] — 2026-05-18

### Added
- **MarkMind-style Settings** — source picker, AI mode toggle, API keys, privacy & danger zone
- **Rules only** vs **Use AI** (Gemini / OpenAI) with in-extension categorization
- HTML import stored in browser; **Start organizing** opens the popup
- Mode badge on popup (`rules only` / `ai · gemini`)

## [1.1.0] — 2026-05-18

### Fixed
- Missing `popup.css` link (popup was unstyled)
- Fuzzy dedupe similarity (LCS ratio vs broken char-walk)
- Regex rules crashing analysis (try/catch per condition)
- Analysis race when toggling fuzzy or re-running
- `loadRulesConfig` fetch/JSON failures
- Download helper (`lastError`, longer blob URL lifetime)
- `Math.min(...huge array)` stack risk in relevance scoring
- Invalid `motion.*` HTML typos in options

### Added
- **Import HTML** tab with drag-and-drop Netscape export parsing
- Terminal-style UI (tokens, monospace, amber accent)
- Loading bar, empty state, retry, collapsible dedupe log
- Dedicated `report.html` via sessionStorage
- `BUG_REPORT.md`, `REFACTOR_PLAN.md`, `scripts/validate.mjs`
- Options: reset rules, storage error feedback

### Changed
- Removed unused Gemini `host_permissions`
- Manual **run analysis** (no auto-run on open)
- Service worker simplified (no ES module type)
- Version bump to 1.1.0

### Known limitations (historical — 1.1.0)
- In-extension AI was added in 1.2.0+ (Gemini Online mode)
- Does not write back to `chrome.bookmarks` tree (export/import workflow)
- Very large libraries (50k+) may need a Web Worker (future)

# Changelog

All notable changes to **bookmrkd** are documented here. Version numbers follow [SemVer](https://semver.org/). This project adheres to [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.1.0] - 2026-05-22

### Added

- **Library-first UX** — save current tab from popup with title edit, tag chips, and auto-suggested tags (domain + title keywords).
- **IndexedDB storage** (`bookmrkd_v1`) — canonical bookmark library with URL normalization dedupe, domain index, and schema version flag in `chrome.storage.local`.
- **Options → Library** — search (title, URL, tags), filter by tags and domain, edit tags, delete, export/import JSON backup.
- **Context menu** — “Save to bookmrkd” on pages.
- **React + TypeScript UI** — popup and options built with React 18; storage and capture logic in TypeScript.
- **Vite 6 + `@crxjs/vite-plugin` 2.4** — production build outputs loadable **`extension/dist/`** (no longer load raw source tree).
- **Sync adapter stub** (`src/storage/sync-adapter.ts`) — documents v1.2 Supabase sync; not enabled.
- **About tab** — privacy link, cloud sync placeholder for v1.2.

### Changed

- **Positioning** — from “semantic bookmark organizer” popup to “privacy-first bookmark library”; bulk organize moved to **Options → Advanced**.
- **Manifest** — added `contextMenus` permission; updated name/description for v1.1.
- **README** — portfolio structure: Problem, Solution, Architecture, Tech stack, Privacy, Install, Roadmap.
- **Privacy policy** — documents IndexedDB library, Advanced organize/AI, and deferred cloud sync.
- **CI / release** — `npm run build` before validate; pack zips **`dist/`**; version sync targets `src/manifest.json` and `src/lib/version.ts`.
- **Dependencies** — `@crxjs/vite-plugin@2.4.0`, `vite@6.4.2`, `@vitejs/plugin-react@4.7.0`; `rollup@2.80.0` override for clean `npm audit`.

### Preserved (Advanced)

- Bulk Chrome bookmark **dedupe**, rules engine, fuzzy dedupe, Netscape HTML **export**, summary **report**, optional **Gemini** assist — under **Options → Advanced** (same pipeline, relocated to `src/features/organize/`).
- Web Worker path for 2,500+ bookmarks (`organize-worker` via Vite `?worker` import).
- Settings keys: `bookmrkd_settings`, `customRules`, `bookmrkd_apiKeys`, HTML import storage.

### Removed

- Root-level MV3 entry files (`popup.html/js`, `options.html/js`, `background.js`, root `manifest.json`) — replaced by `src/` + Vite build.
- `extension/lib/` at repo root — moved under `src/features/organize/` and `src/lib/`.

### Fixed

- `sync-version` no longer fails when versions already match `VERSION` (idempotent sync).

### Install / dev notes

```bash
cd extension && npm ci && npm run build
# Chrome → Load unpacked → extension/dist
```

---

## [1.0.0] - 2026-05-18

### Added

- Chrome MV3 extension: exact + fuzzy dedupe, 22+ categorization rules, legacy host classifier.
- Offline-first organize; optional Gemini (title + URL only) in Online mode.
- Netscape HTML export and markdown report; custom rules JSON.
- Web Worker for large libraries (2,500+ bookmarks).
- GitHub Actions CI (validate, typecheck) and release ZIP on tag.
- GPL-3.0, root README with screenshots, `VERSION` file + sync scripts.

[1.1.0]: https://github.com/minhaj14d/bookmrkd/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/minhaj14d/bookmrkd/releases/tag/v1.0.0

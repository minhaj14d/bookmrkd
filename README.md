# bookmrkd

<p align="center">
  <img src="extension/icons/conversion.png" width="96" height="96" alt="bookmrkd icon" />
</p>

<p align="center">
  <strong>Semantic Bookmark Organizer</strong><br />
  Dedupe, categorize, and export bookmarks — offline-first, optional Gemini AI.
</p>

<p align="center">
  <a href="https://github.com/minhaj14d/bookmrkd/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-GPL--3.0-blue.svg" alt="GPL-3.0" /></a>
  <a href="https://github.com/minhaj14d/bookmrkd/releases"><img src="https://img.shields.io/github/v/release/minhaj14d/bookmrkd?label=release" alt="release" /></a>
  <img src="https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4?logo=googlechrome&logoColor=white" alt="MV3" />
</p>

<p align="center">
  <strong>Minhajul Abedin</strong> · <a href="https://github.com/minhaj14d">github.com/minhaj14d</a>
</p>

---

## Overview

**bookmrkd** cleans bookmark libraries: exact and fuzzy dedupe, folder categorization (social, work, learning, dev, …), relevance scoring, and Netscape HTML export for Chrome import. Nothing is deleted until you import the file yourself.

| Mode | Behavior |
|------|----------|
| **Offline** | All processing on your device. No API key. |
| **Online** | Local rules first; optional **Google Gemini** (free API tier) for hard cases. Only title + URL batches are sent. |

## Features

- Exact + fuzzy URL/title dedupe  
- 22+ built-in rules + custom JSON (merged with built-ins)  
- Legacy host classifier (50+ patterns)  
- Web Worker for 2,500+ bookmarks  
- Export HTML + summary report  
- Privacy page: `extension/privacy.html`  

## Install

### Load unpacked (development)

```bash
git clone https://github.com/minhaj14d/bookmrkd.git
cd bookmrkd/extension
npm ci
```

Chrome → **Extensions** → **Developer mode** → **Load unpacked** → select the `extension` folder.

### From a release ZIP

1. [Releases](https://github.com/minhaj14d/bookmrkd/releases) → download `bookmrkd-v1.0.0-extension.zip`  
2. Extract → **Load unpacked** → extracted folder  

### Pack `.crx` (optional)

1. `chrome://extensions` → **Developer mode** → **Pack extension**  
2. Root directory: this repo’s `extension` folder  
3. First pack: leave private key empty (Chrome creates `.pem` + `.crx`). **Keep `.pem` private.**  
4. Updates: pack again with the same `.pem`  

### First use

1. Open bookmrkd → **Settings** (gear)  
2. **Offline** or **Online** ([Gemini key](https://aistudio.google.com/apikey) if Online)  
3. **Run analysis** → **Export HTML** → Bookmark Manager → **Import bookmarks**  

## Build release ZIP

```bash
cd extension
npm ci
npm run pack
```

Creates `release/bookmrkd-v1.0.0-extension.zip` (version from `/VERSION`).

## Development

```bash
cd extension
npm run lint
npm run typecheck
npm run version:sync   # after editing ../VERSION
```

## Structure

```
bookmrkd/
├── extension/     # Chrome MV3 extension (load this folder)
├── VERSION
├── LICENSE        # GPL-3.0
└── README.md
```

## License

Copyright © 2026 **Minhajul Abedin**. Licensed under [GPL-3.0](LICENSE).

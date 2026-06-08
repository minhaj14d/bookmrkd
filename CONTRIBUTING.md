# Contributing to bookmrkd

**Maintainer:** [Minhajul Abedin](https://github.com/minhaj14d)  
**License:** GPL-3.0 — contributions are accepted under the same license.

## Setup

```bash
cd extension
npm ci
npm run lint
npm run typecheck
```

## Version bumps

1. Edit `/VERSION` at the repo root (semver).
2. Run `npm run version:sync` inside `extension/`.
3. Add an entry to `extension/CHANGELOG.md`.
4. Commit and tag: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat(extension): …`
- `fix(organizer): …`
- `docs: …`
- `chore(release): …`

See `COMMIT_STRATEGY.md` for examples.

## Pull requests

- Keep changes focused; one concern per PR when possible.
- CI must pass (`.github/workflows/extension-ci.yml`).
- Do not commit `.env` or API keys.
- Load the extension unpacked from `extension/` and smoke-test analyze + export.

## Code map

| Area | Path |
|------|------|
| Pipeline | `extension/lib/organizer.js` |
| Rules | `extension/lib/rules.json`, `rules-loader.js` |
| AI | `extension/lib/ai-categorize.js`, `ai-providers.js` |
| UI | `popup.*`, `options.*`, `report.*` |

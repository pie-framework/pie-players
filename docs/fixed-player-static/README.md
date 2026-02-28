# Preloaded static packages (configs + CI/CD publishing)

This repo supports publishing **pre-bundled static packages** from in-repo “element combination” configs.

Each config in `configs/fixed-player-static/*.json` represents a fixed set of PIE elements (package + version). CI/CD publishes a corresponding `@pie-players/pie-fixed-player-static` version for that combination.

## What gets published

Package name:

- `@pie-players/pie-fixed-player-static`

Version shape:

- `<loaderVersion>-<hash>.<iteration>`
- Example: `1.0.1-a3f8b2c.2`

Where:

- `loaderVersion`: defaults to the current `packages/item-player/package.json` version (overrideable via CLI)
- `hash`: deterministic hash of the element combination (sorted list of `@pie-element/*@version`)
- `iteration`: monotonic counter for **rebuilding the same element combination** (bugfix rebuilds, packaging fixes, etc.)

## How configs work

Configs live in:

- `configs/fixed-player-static/*.json`

Format:

- Either an array of `{ package, version, tag? }`, or an object `{ elements: [...] }`

The builder reads only `package` + `version` to produce the element combination.

## Local usage

From repo root:

```bash
bun run cli pie-packages:fixed-player-build-package \
  --elements-file configs/fixed-player-static/example.json
```

Build + generate a browser test project:

```bash
bun run cli pie-packages:fixed-player-build-and-test-package \
  --elements-file configs/fixed-player-static/example.json \
  --generate-test-project
```

## CI/CD behavior (main branch)

Workflow:

- `.github/workflows/publish-fixed-player-static.yml`

When you push/merge to `main`:

1. **If config files changed** (`configs/fixed-player-static/*.json`):
   - CI publishes only those changed configs.
   - New/changed element combinations produce a new `<hash>` and publish with `.1` (first iteration).
2. **If preloaded pipeline/CLI/build plumbing changed** (e.g. `packages/item-player/`, `tools/cli/`, `packages/players-shared/`):
   - CI republishes **all configs**.
   - This triggers a **new `.iteration`** for each existing `<hash>` (bugfix rebuilds without changing the element combination).

This behavior is implemented by:

- `scripts/fixed-player-static/publish-changed.mjs`

## Adding / changing / deleting a configuration

### Add a new configuration

1. Add a new file: `configs/fixed-player-static/<name>.json`
2. Commit + merge to `main`
3. CI publishes the corresponding `@pie-players/pie-fixed-player-static@<loaderVersion>-<hash>.1`

### Change a configuration (element version changes)

1. Edit the JSON (change/add/remove elements or versions)
2. Commit + merge to `main`
3. CI publishes a **new hash**, i.e. a new version series for that combination.

### Delete a configuration

1. Delete the JSON file and merge to `main`
2. CI stops publishing that combination going forward

Note: existing npm versions remain published (npm does not support “delete a version” in the general case).

## Secrets / required setup

Publishing requires `NPM_TOKEN` in GitHub Actions secrets:

- See `docs/NPM_TOKEN_SETUP.md`

## Runtime usage

Use published static bundles with the unified runtime element:

```html
<pie-item-player strategy="preloaded"></pie-item-player>
```



# Publish Compatibility Matrix

This document defines compatibility expectations for npm-published packages in this monorepo.

## Compatibility Tiers

### Tier A: Node-safe ESM libraries

Packages in this tier are expected to be safe to load in plain Node.js (no browser globals required at import time), while also being usable in browser bundlers.

- `@pie-players/pie-calculator`
- `@pie-players/pie-calculator-desmos`
- `@pie-players/pie-tts`
- `@pie-players/tts-client-server`
- `@pie-players/tts-server-core`
- `@pie-players/tts-server-google`
- `@pie-players/tts-server-polly`
- `@pie-players/math-renderer-core`
- `@pie-players/math-renderer-katex`
- `@pie-players/math-renderer-mathjax`

### Tier B: Browser-first web component/runtime packages

Packages in this tier are expected to target browsers and may require DOM/browser globals (`customElements`, `window`, `document`) at runtime or import time.

- Item/assessment/section players
- Author player and print player
- Tool packages and toolbars
- UI-focused shared/component packages

These packages are valid npm dependencies in Node projects for bundling, but direct runtime execution in plain Node.js is not guaranteed.

### Tier C: Node-only tooling packages

Packages intended primarily for Node.js CLIs/tooling.

- `@pie-players/pie-players-cli`

## External Package Selection Guide

Use this quick guide when integrating PIE Players outside this monorepo:

- **Legacy PIE IIFE pipelines**: start with `@pie-players/pie-iife-player`.
- **Modern ESM/browser integrations**: start with `@pie-players/pie-esm-player`.
- **Single-request packaged payloads**: use `@pie-players/pie-inline-player`.
- **Fixed, pre-bundled element sets**: use `@pie-players/pie-fixed-player`.
- **Section/assessment orchestration**: use `@pie-players/pie-section-player` and `@pie-players/pie-assessment-toolkit`.
- **Pure service/provider integrations** (Node-safe): prefer Tier A packages.

## Source Export Policy

Default policy is to publish **compiled `dist/` exports** for JS/TS runtime entry points.

Source exports are allowed only for packages that intentionally publish Svelte component entrypoints for framework consumers:

- `@pie-players/pie-assessment-player`
- `@pie-players/pie-assessment-toolkit`
- `@pie-players/pie-calculator-mathjs`
- `@pie-players/pie-players-shared`
- `@pie-players/pie-section-player`

Additional constraints:

- Source exports are explicitly contract-bound to a reviewed list of paths (not just package-level allowlisting).
- New `./src/*` exports must be treated as API-surface changes and reviewed like semver-sensitive public API changes.
- Prefer compiled `dist/` exports by default for runtime/library entrypoints.
- External consumers should treat these source entrypoints as **Svelte toolchain contracts**. They are supported, but narrower and more semver-sensitive than compiled root entries.

The enforcement script `scripts/check-source-exports.mjs` verifies this policy, including per-package source export path contracts.

## Dependency Declaration Policy

The dependency policy separates runtime imports from development-only imports:

- Runtime/package code must import from `dependencies`, `peerDependencies`, or `optionalDependencies`.
- `devDependencies` are only valid for development-only contexts (tests, specs, stories, config files, local scripts).
- Script binaries referenced in `package.json` scripts must be declared in that workspace package (to avoid hoist-reliant behavior).

The enforcement script `scripts/check-deps.mjs` verifies these constraints.

## CDN / Dynamic ESM Notes

- Root package entries are ESM and suitable for dynamic loading flows.
- Packages with source-based Svelte/TS subpath exports are intentionally optimized for Svelte-aware toolchains; CDN transpilers may vary by endpoint.
- For browser runtime loading via CDN (`unpkg`/`jsdelivr`/esm.sh), prefer compiled root entries in `dist/` when available.

# Library Packaging Strategy (NodeJS Reliability First)

This document captures a packaging direction for `@pie-players/*` that minimizes
consumer breakage in NodeJS and app-bundler `node_modules` workflows. Direct
browser standalone variants are explicitly deferred for a follow-up iteration.

## Problem Summary

Current player packages (notably `pie-section-player` and `pie-item-player`) are
published as chunked ESM with internal dynamic imports and hashed chunk names.
That works, but can be fragile when consumed through third-party optimizer layers
(`optimizeDeps`, prebundlers, lockfile churn, stale cache state).

Observed symptom class:

- host app starts failing without source changes
- runtime errors point to missing `node_modules/.vite/deps/module-*.js` URLs
- consumers must clear caches/restart dev servers to recover

That recovery path is not an acceptable library contract.

## Packaging Goals

1. Consumer apps should not need cache-clearing rituals.
2. Published entrypoints must be stable and explicit.
3. Browser-only packages are clearly separated from Node-safe packages.
4. Standalone browser variants are deferred until Node reliability is stable.
5. Custom-element registration must be race-safe under HMR/concurrent import paths.

## Recommended Artifact Model

Publish one reliable default artifact model for this phase:

1. **Bundler/Node-consumer default entry (`.` export)**
   - ESM intended for app bundlers and NodeJS module resolution.
   - Deterministic filenames for emitted files.
   - Avoid hidden internal chunk renaming across equivalent builds.

Standalone browser entry (`./standalone`) is deferred and tracked as future
work after NodeJS reliability goals are met.

## Export Surface Recommendation

For package `@pie-players/pie-section-player`, shape exports like:

```json
{
  "exports": {
    ".": {
      "types": "./dist/types/index.d.ts",
      "import": "./dist/pie-section-player.js"
    },
    "./components/section-player-splitpane-element": {
      "types": "./dist/types/index.d.ts",
      "import": "./dist/pie-section-player.js"
    }
  }
}
```

Notes:

- Keep component subpaths mapped to documented stable entries only.
- Do not expose private internal chunk files as part of contract.

## Build Output Guidance

### Bundler variant

- Keep ESM output.
- Prefer deterministic output naming, for example:
  - `entryFileNames: "[name].js"`
  - `chunkFileNames: "chunks/[name].js"`
- Keep sourcemaps optional by release mode.
- Avoid hashing for published library internals unless strictly required.

### Standalone variant (deferred)

- Do not add `./standalone` in this implementation pass.
- Revisit after NodeJS reliability checks and consumer import fixtures are stable.

## Versioning and Compatibility

- Keep current fixed-versioning policy across publishable packages.
- If both variants are in one package, versioning stays unchanged.
- If separate `-standalone` packages are introduced, keep lockstep versions.

## Consumer Guidance (current scope)

- Default recommendation for app bundlers:
  - `import "@pie-players/pie-section-player";`
- NodeJS service recommendation:
  - import only Node-safe packages (for example `@pie-players/pie-assessment-toolkit`, `@pie-players/pie-context`, `@pie-players/pie-players-shared`)
- Browser-only packages (`pie-item-player`, `pie-section-player`) must stay out of plain Node runtime imports.

## Publish Gate Additions

Add/extend release checks to validate Node reliability:

1. **Tarball contract check**
   - ensure all declared export targets exist in packed tarball
2. **Node consumer smoke**
   - import selected package specifiers from `node_modules` in plain Node
   - verify browser-only package boundaries still fail as expected
3. **No hidden-hash contract drift**
   - fail build if exported paths unexpectedly include random hash-only filenames
4. **Custom-element define safety**
   - fail build if source files use direct `customElements.define(...)` outside approved wrappers
   - require shared race-safe registration helper for hand-written registration code

## Incremental Rollout Plan

Phase 1 (pilot):

- implement deterministic artifact naming for `pie-section-player`
- document Node-safe vs browser-only guidance
- add Node consumer smoke checks for pilot package dependencies

Phase 2:

- apply same deterministic model to `pie-item-player`
- evaluate related tool packages that currently emit split internal chunks

Phase 3:

- standardize build helper(s) so package configs are consistent
- enforce with lint/check scripts

## Decision Record

Why this direction:

- preserves efficiency for standard bundler consumers
- prioritizes reliable NodeJS imports from published package contracts
- aligns package contract with common JS library publishing patterns

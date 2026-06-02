# Library Packaging Strategy (NodeJS Reliability First)

This document captures the current packaging contract for `@pie-players/*`
packages that need to behave predictably in NodeJS and app-bundler
`node_modules` workflows.

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

## Artifact Model

Publish one reliable default artifact model:

1. **Bundler/Node-consumer default entry (`.` export)**
   - ESM intended for app bundlers and NodeJS module resolution.
   - Deterministic filenames for emitted files.
   - Avoid hidden internal chunk renaming across equivalent builds.

Standalone browser entrypoints are not part of the current public contract.

## Export Surface

For package `@pie-players/pie-section-player`, exports follow this shape:

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

### Standalone variant

- Do not add `./standalone` entries unless the package explicitly documents and
  tests that browser-file contract.

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

## Publish Gates

Release checks validate Node reliability:

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

## Decision Record

Why this direction:

- preserves efficiency for standard bundler consumers
- prioritizes reliable NodeJS imports from published package contracts
- aligns package contract with common JS library publishing patterns

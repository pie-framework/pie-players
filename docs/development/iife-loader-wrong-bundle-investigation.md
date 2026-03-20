# IIFE Loader Wrong-Bundle Investigation

## Problem Summary

In downstream apps (notably `../element-QuizEngineFixedPlayer`), we intermittently see runtime failures where an item requests one PIE package (for example `@pie-element/ebsr`) but the loaded IIFE module only exposes a different package set (for example `@pie-element/multiple-choice`).

Typical error:

- `Error loading elements (iife-load): Package "@pie-element/ebsr" not found in IIFE bundle. Available: @pie-element/multiple-choice@...`

This should not happen if the requested bundle URL and `window.pie.default` always stay aligned.

## Why This Matters

- Breaks dynamic item rendering for mixed element combinations.
- Appears as an element/package issue, but likely comes from loader state consistency.
- Can be misdiagnosed as Angular/browser caching when the issue may be in `pie-players` global IIFE loader behavior.

## Affected Stack

- `@pie-players/pie-section-player` `0.3.20`
- `@pie-players/pie-item-player` `0.3.20`
- `@pie-players/pie-players-shared` `0.3.20`
- Observed in `../element-QuizEngineFixedPlayer`

## Current Loader Behavior (Relevant Code)

Primary file:

- `packages/players-shared/src/pie/iife-loader.ts`

Key behaviors:

1. Global module source is `window.pie.default`.
2. Reuse fast-path triggers when `script[src=bundleUrl]` exists and `window.pie.default` exists.
3. "Different bundle" cleanup removes only one script with `data-pie-bundle="true"` and deletes `window.pie`.
4. Concurrent loading is keyed by URL via `window.pieHelpers.loadingPromises[bundleUrl]`.

## Suspected Failure Mode

The loader can treat "script for requested URL exists" as sufficient to reuse, but does not verify that `window.pie.default` currently corresponds to that URL.

Because `window.pie` is global and mutable, and because cleanup/removal logic is partial, there is a state where:

- the requested script tag is present,
- but `window.pie.default` still reflects a previously loaded bundle content,
- and `registerElementsFromBundle` reads the wrong package map.

That produces the observed "package not found; available: ..." mismatch.

## Reproduction Hints

1. Use a section flow that alternates element sets (for example MC-only then EBSR-containing items).
2. Trigger rapid section/item transitions where preload and in-item load can overlap.
3. Watch for:
   - multiple `script[data-pie-bundle="true"]` tags in `document.head`,
   - `window.pie.default` packages not matching the currently requested element map.

## What To Verify During Fix

- Requested `bundleUrl`
- Current `window.pie.default` package keys
- Whether fast-path reuse is taken
- Number and URLs of `script[data-pie-bundle="true"]`
- Whether concurrent loads for different URLs are serialized globally or only per-URL

## Candidate Fix Directions

1. **Global load mutex** for IIFE script switching (not only per-URL promise map).
2. **Stronger reuse check** before fast-path:
   - verify all requested package names exist in current `window.pie.default`;
   - otherwise force full reload path.
3. **Deterministic cleanup**:
   - remove all stale PIE bundle scripts before loading the next URL, not just one.
4. **State coupling**:
   - track the URL associated with the currently active `window.pie` payload and validate before reuse.
5. **Defensive diagnostics**:
   - log requested packages, current package keys, active bundle URL marker, and decision path.

## Acceptance Criteria

- No "requested package missing / available package list mismatched" errors across repeated transitions.
- Loader always either:
  - reuses a bundle that actually contains requested packages, or
  - performs a clean reload that produces the required packages.
- Behavior remains stable under rapid navigation and repeated hydrate/persist flows.

## Suggested Next Session Plan

1. Add temporary debug instrumentation to `iife-loader.ts`.
2. Write a focused unit/integration test for mixed element sets and rapid switching.
3. Implement one safe fix path (global mutex + package-presence validation).
4. Re-run section demos and downstream app scenario (`../element-QuizEngineFixedPlayer`).
5. Remove temporary debug noise, keep high-signal structured logs behind debug flag.

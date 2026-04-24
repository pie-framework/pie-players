---
'@pie-players/pie-players-shared': minor
---

Replace `IifePieLoader` / `EsmPieLoader` with the deep `ElementLoader` primitive (Phase A of the "kill strategy substitution" refactor).

## What changed

The old per-strategy loader classes carried a dishonest promise contract. `IifePieLoader`'s `load()` could resolve while elements were still unregistered (`whenDefinedWithTimeout` rejections were caught-and-logged but the outer `Promise.all` still fulfilled, non-constructor element classes silently skipped their promise push, and the concurrent-load shortcut awaited the prior in-flight promise without re-verifying the current call's tags). `EsmPieLoader` had the symmetric defects plus an unbounded `whenDefined` wait that could hang forever and an import-map single-injection assumption that broke on a second `load()` call with new elements.

These classes are replaced by a single deep primitive that owns registration truth end-to-end:

```ts
import { ensureRegistered, assertRegistered } from '@pie-players/pie-players-shared';

// Async: resolves iff every tag is actually in `customElements`. Rejects
// with `{ unregisteredTags, reasons }` on timeout, non-constructor class,
// bundle fetch failure, or any other cause. Deduplicates concurrent
// identical requests.
await ensureRegistered(
  { 'pie-multiple-choice': '@pie-element/multiple-choice@11.0.1' },
  { backend: { kind: 'iife', bundleHost: '...', bundleType: BundleType.clientPlayer } },
);

// Sync: throws `ElementAssertionError` with a diagnostic message
// (expected vs missing vs actually-registered) if any tag is missing.
assertRegistered(['pie-multiple-choice']);
```

The two backends (`iife-adapter`, `esm-adapter`) are internal modules behind the `backend` option; the primitive performs a uniform `customElements.whenDefined` verification after every backend call, so no backend can silently claim success.

## Migration

- Direct consumers of `IifePieLoader` / `EsmPieLoader` (rare — these were mostly widget-internal) switch to `ensureRegistered({ backend: { kind: 'iife' | 'esm', ... } })`. The `ItemEntity`-aware aggregation helper (`aggregateElements`) stays exported for callers that pre-warm a section's worth of elements.
- The IIFE bundle-build retry policy (`iifeBundleRetry`) and `onBundleRetryStatus` callback are preserved; they are now fields on the IIFE backend config instead of constructor options. The `bundle-retry-status` event surface on `<pie-item-player>` is unchanged.
- `DEFAULT_BUNDLE_HOST` re-home: now exported from `@pie-players/pie-players-shared/loaders` (still also available from the package root).

## Internal consumer updates (already wired up)

- `PieItemPlayer.svelte` `loadConfig` calls the primitive instead of constructing a loader.
- `SectionItemsPane.svelte` pre-warms via the primitive through a functional `warmupSectionElements` pipeline (Phase B).

Removed public surface:

- `IifePieLoader`, `IifeLoaderConfig`
- `EsmPieLoader`, `EsmLoaderConfig`
- `IifeElementLoader`, `IifeElementLoaderConfig`
- `EsmElementLoader`, `EsmElementLoaderConfig`
- `ElementLoaderInterface`, `LoadOptions`

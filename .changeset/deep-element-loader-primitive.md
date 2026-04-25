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

- Direct consumers of the removed loader classes (rare — these were mostly widget-internal) switch to `ensureRegistered({ backend: { kind: 'iife' | 'esm', ... } })`. The `ItemEntity`-aware aggregation helper (`aggregateElements`) stays exported for callers that pre-warm a section's worth of elements.
- The IIFE bundle-build retry policy (`iifeBundleRetry`) and `onBundleRetryStatus` callback are preserved; they are now fields on the IIFE backend config instead of constructor options. The `bundle-retry-status` event surface on `<pie-item-player>` is unchanged.
- `DEFAULT_BUNDLE_HOST` re-home: now exported from `@pie-players/pie-players-shared/loaders` (still also available from the package root).

### Option-shape changes

- `whenDefinedTimeoutMs` moved from the per-loader constructor argument it inhabited under the old class shapes to a field on `EnsureRegisteredOptions`. Callers that were tuning the per-tag `customElements.whenDefined` deadline pass it on the `ensureRegistered` options object alongside `backend`.
- `loadTimeoutMs` new on `EnsureRegisteredOptions`. Outer cumulative deadline for the backend's `load()` call. Defaults to `DEFAULT_IIFE_BUNDLE_RETRY_CONFIG.timeoutMs` so adapter-internal retry windows fit inside the same overall budget. Closes the "promise never settles" seam for adapters whose underlying fetch can stall indefinitely (e.g. ESM `import()` against a frozen CDN). On timeout the primitive synthesizes an `AdapterFailure` with `kind: "timeout"` reasons per requested tag; surfaces as a normal `ElementLoaderError`.

### Error message shape changes

Hosts that match log-string substrings on these messages need updates:

- `ElementLoaderError` — generalized from the strategy-specific `"Preloaded strategy requires pre-registered elements; missing tags: …"` to `"Element registration failed; missing tags: …"`. The strategy-specific language now lives only on `ElementAssertionError` (thrown by `assertRegistered` when a "preloaded"-strategy host did not pre-register).
- `ElementAssertionError` — message shape changed to `"ElementLoader.assertRegistered: expected [tag1, tag2], missing [tag2]. customElements contains: [tag1, tag-other]."`. The new shape exposes the registry's actual contents to the host so a strict-mode failure pinpoints which pre-registration step was skipped.

### Diagnostic field caveat

`ElementAssertionError.currentlyRegisteredTags` is the array passed to the constructor when the error was built. In production builds it is empty: `CustomElementRegistry` does not expose iteration in standards-compliant browsers, so the primitive cannot enumerate the registry to fill the field. Test harnesses install a `__pieSnapshot` extension on the scripted registry to make diagnostic messages assertable; that path is not available at runtime. Hosts logging the field should expect `[]` outside the test suite — the surrounding `expectedTags` and `missingTags` arrays are always populated.

## Internal consumer updates (already wired up)

- `PieItemPlayer.svelte` `loadConfig` calls the primitive instead of constructing a loader.
- `SectionItemsPane.svelte` pre-warms via the primitive through a functional `warmupSectionElements` pipeline (Phase B).

Removed public surface (the previous parallel loader hierarchy is gone):

- `IifePieLoader`, `IifeLoaderConfig`
- `EsmPieLoader`, `EsmLoaderConfig`
- `IifeElementLoader`, `IifeElementLoaderConfig`
- `EsmElementLoader`, `EsmElementLoaderConfig`
- `ElementLoaderInterface`, `LoadOptions`

---
'@pie-players/pie-section-player': minor
---

Kill section-player strategy substitution and functionalize the widget state (Phase B of the "kill strategy substitution" refactor).

## Root cause fixed

Hosts running `<pie-section-player-splitpane strategy="iife">` could see a sporadic error after navigating between sections — the misleading "preloaded requires pre-registered" message reflected the silent strategy substitution, not the host's actual choice. Under the deep-primitive architecture this rejection now surfaces as `Element registration failed; missing tags: …` from `ElementLoaderError` (and the strict-mode "Preloaded strategy requires …" language is reserved for `ElementAssertionError`, thrown only when a host opted into `strategy="preloaded"` and did not pre-register).

The section-player was aggregate-loading elements once, then silently rewriting every embedded `<pie-item-player>`'s strategy to `"preloaded"`:

```ts
function resolveEmbeddedItemStrategy(playerStrategy: string): string {
  return playerStrategy === 'iife' ? 'preloaded' : playerStrategy;
}
```

Parent and child then coordinated ambiently via DOM mount timing, gated by a cached `elementsLoaded: $state(false)` flag in `SectionItemsPane.svelte` that a post-render `$effect` reset on every section swap. When the host swapped sections under a live pane, the template re-rendered with a new element set (e.g. adding `pie-passage`) while `elementsLoaded = true` was still in scope from the previous render. Items mounted with a false pre-registration claim, asserted, and threw the misleading "preloaded requires pre-registered" error. The error message reflected the substitution, not the host's actual strategy choice.

## What changed

- **Delete `resolveEmbeddedItemStrategy`.** Embedded item-players now inherit the host's requested strategy verbatim. A `<pie-section-player-* strategy="iife">` mounts items with `strategy="iife"`; items and the section both use the same deep `ElementLoader` primitive, which deduplicates the aggregate pre-warm against the per-item registration so no duplicate fetch happens.
- **Delete the cached readiness state machine.** `SectionItemsPane.svelte` no longer carries `elementsLoaded`, `preloadRunToken`, or `lastPreloadSignature` `$state` fields. It is a functional view over a `usePromise(() => warmupSectionElements(...))` helper: template branches on `readiness.status === 'resolved'` directly. No parent-to-child coupling, no post-render effect to reset.
- **Simplify `player-preload.ts`.** The orchestrator (`orchestratePlayerElementPreload`, `PlayerPreloadState`, `createPlayerPreloadStateSetter`, `buildPreloadSignature`, `preloadPlayerElementsWithRetry`) is gone. Retry is a loader concern and now lives inside the IIFE adapter behind the primitive. What remains is a small functional pipeline: validate config contracts, translate props into a backend config, aggregate tags, `await ensureRegistered(tags, { backend })`.

## Host-visible changes

- **Behaviour (intended):** no more spurious "missing tags: …" errors on section swap. Element loading now reliably tracks registration truth.
- **Events:** `elements-loaded-change`, `element-preload-error`, `element-preload-retry`, and `player-error` continue to fire. Listeners that match the historical shape keep working — see the "Event field reporting" note below for the one detail that gained an additional reported value.
- **Props:** unchanged. `strategy`, `loaderOptions`, `iifeBundleHost`, `esmCdnUrl`, and the retry config surface are all preserved.

### Event field reporting

`element-preload-error` and `element-preload-retry` carry a `stage` field that previously only ever reported `"iife-load"` because the section-preload pipeline mislabeled every rejection. The pipeline now reports the stage truthfully:

- `"validate-config"` — a renderable's PIE config contract failed before any backend was contacted.
- `"iife-load"` — IIFE strategy backend rejection.
- `"esm-load"` — ESM strategy backend rejection.
- `"preloaded-assert"` — `strategy="preloaded"` host did not pre-register every aggregate tag; the section-level `assertRegistered` rejected before any item mounted.

Hosts that switched on `stage` will start observing `"validate-config"`, `"esm-load"`, and `"preloaded-assert"` for failure modes that were previously misreported as `"iife-load"`. Hosts that only display the `error` field need no update.

## Breaking: `allowPreloadedFallbackLoad` removed

The `allowPreloadedFallbackLoad` loader option on `<pie-item-player>` is gone. It existed as an escape hatch for hosts that wanted `strategy="preloaded"` to silently fall back to a runtime bundle fetch when pre-registration was incomplete — but that fallback is the precise contract violation the deep primitive eliminates. Under the new architecture `strategy="preloaded"` means exactly one thing: "the host pre-registered these tags; assert loudly or throw". `assertRegistered` produces an `ElementAssertionError` with diagnostic detail (expected / missing / currently-registered) that strict-mode hosts can render or surface to telemetry.

**Migration.** Hosts that relied on the fallback should pick the strategy they actually want:

- If the host is willing to fetch and register on demand, use `strategy="iife"` or `strategy="esm"` and let the primitive's truthful-promise contract drive registration. The dedup cache means switching costs no extra fetches when an aggregate pre-warm has already happened.
- If the host genuinely pre-registers elements and wants strict mode, keep `strategy="preloaded"` and pre-register before mount.

There is no third option. The primitive will not silently coerce a "preloaded" claim into a fetch.

## Breaking: `@pie-players/pie-section-player/utils/player-preload` subpath removed

The `@pie-players/pie-section-player/utils/player-preload` subpath export is gone. It was a pure pass-through barrel re-exporting helpers from the section-player's internal `components/shared/player-preload.ts`. With the orchestrator deleted, the public surface it advertised (`getRenderablesSignature`, `PlayerPreloadState`, `preloadPlayerElements`, etc.) no longer exists. Keeping a thin barrel around the surviving config helpers (`buildBackendConfigFromProps`, `warmupSectionElements`, `formatElementLoadError`, `describeBundleType`, `describeBundleHost`) would advertise an internal pipeline as a host integration point; the section-player widgets are the supported integration point.

**Migration.** Hosts that imported from the subpath should rewrite to use the section-player widget directly. The functions exposed there were always implementation details of the section-player's own preload step.

## Companion change in `@pie-players/pie-item-player`

`PieItemPlayer.loadConfig` is rewritten as a linear pipeline over the new primitive.

Fixed-versioning note: this is a single minor bump that propagates across every package in the release per the monorepo-versioning convention.

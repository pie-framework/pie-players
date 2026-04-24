---
'@pie-players/pie-section-player': minor
---

Kill section-player strategy substitution and functionalize the widget state (Phase B of the "kill strategy substitution" refactor).

## Root cause fixed

Hosts running `<pie-section-player-splitpane strategy="iife">` could see a sporadic error after navigating between sections:

```
[pie-item-player] failed loading: Error: Preloaded strategy requires
pre-registered elements; missing tags: pie-passage--version-3-2-4.
```

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
- **Events:** `elements-loaded-change`, `element-preload-error`, `element-preload-retry`, and `player-error` continue to fire with the same shapes; only their source code changed. Host listeners require no update.
- **Props:** unchanged. `strategy`, `loaderOptions`, `iifeBundleHost`, `esmCdnUrl`, and the retry config surface are all preserved.

## Companion change in `@pie-players/pie-item-player`

`PieItemPlayer.loadConfig` is rewritten as a linear pipeline over the new primitive. The `allowPreloadedFallbackLoad` loader option was removed: `strategy="preloaded"` now has a single sharp contract — "host pre-registered these tags; assert loudly or throw". Hosts that relied on the fallback to coerce `preloaded` into a runtime bundle fetch should set `strategy="iife"` or `strategy="esm"` instead. (The option was documented as an escape hatch, so this is a deliberate cleanup rather than a typical breaking change.)

Fixed-versioning note: this is a single minor bump that propagates across every package in the release per the monorepo-versioning convention.

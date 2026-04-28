---
'@pie-players/pie-section-player': patch
'@pie-players/pie-assessment-toolkit': patch
'@pie-players/pie-assessment-player': patch
'@pie-players/pie-players-shared': patch
---

PIE-501: harden element loading during section-player section swaps.

Pre-1.0 lockstep release: every package in the `fixed` block bumps
together at release time per the project versioning policy. Per pre-1.0
semver convention every release is a patch bump, even when behavior
changes are breaking — the breaking changes inventory below is for
host migration, not for the version bump level. PIE-501
investigation traced sporadic post-section-swap render failures
(`Preloaded strategy requires pre-registered elements; missing tags:
…`) to two coupled root causes — a non-truthful element-load promise
contract, and the section-player rewriting embedded items' loading
strategy and tracking readiness through cached state. Fixing those
unblocked a broader architecture-review compat-removal sweep that had
been gated on the same surfaces.

This release ships both phases of the PIE-501 plan plus the
compat-removal work that fell out of the same review. None of the
removed surfaces are part of the `pie-item` client contract (the only
allowed compatibility surface per
`.cursor/rules/legacy-compatibility-boundaries.mdc`).

## What's new

- **Deep `ElementLoader` primitive** (PIE-501 Phase A). A single loader
  primitive whose promise resolves only when every requested custom-
  element tag is actually registered, and rejects with a per-tag
  reason otherwise. Both IIFE and ESM are now adapters over this
  primitive. Replaces the previous parallel `IifeLoader` / `EsmLoader`
  classes in `@pie-players/pie-players-shared`. The deep primitive is
  the shipped contract; the strategy name (`iife` / `esm` / `preloaded`)
  selects an adapter rather than a parallel implementation.

- **Strategy substitution removed** (PIE-501 Phase B). Embedded
  item-players inherit the host's chosen strategy verbatim. The
  section-player still pre-warms the aggregate element set for
  performance but no longer owns correctness through cached state;
  widget readiness is now a function of inputs. The
  `allowPreloadedFallbackLoad` escape hatch is gone.

- **M5 — strict two-tier mirror rule.** Tier-1 layout-CE props mirror
  to `runtime.*` keys with documented precedence; the resolver enforces
  the mirror per-key.

- **M6 — canonical stage vocabulary.** `pie-stage-change` (`composed`,
  `engine-ready`, `interactive`, `disposed`) and `pie-loading-complete`
  are the canonical readiness surface, with a toolkit-side stage
  tracker and `onStageChange` / `onLoadingComplete` props on the layout
  CEs.

- **M7 — `SectionRuntimeEngine`.** A single FSM-driven runtime engine
  consolidates section-controller lifecycle, readiness derivation, and
  stage emissions previously scattered across multiple coordinators.

- **M8 — tool policy engine.** Allow/block + QTI enforcement become a
  first-class policy surface on `ToolkitCoordinator`
  (`onPolicyChange`, `decideToolPolicy`, `getFloatingTools`,
  `setQtiEnforcement`, `registerPolicySource`), with narrow QTI
  auto-detection mirrored through `runtime.tools.qtiEnforcement`.

- **`FrameworkErrorBus` contract.** A single canonical
  `framework-error` source, single subscription via
  `onFrameworkError(model: FrameworkErrorModel)`, and the layout-CE
  host emits exactly one `framework-error` per error (the previous
  toolkit-bubble + engine-bridge dual-emit is collapsed — see Removed).

- **Tabbed section-player layout.** New `<pie-section-player-tabbed>`
  CE alongside the existing splitpane and vertical layouts.

## Removed (breaking)

- **Deprecated `AssessmentToolkitEvents` event-map and member event
  interfaces** (`AssessmentStartedEvent`, `AssessmentCompletedEvent`,
  `AssessmentPausedEvent`, `AssessmentResumedEvent`,
  `CanNavigateChangedEvent`, `InteractionEvent`, `InteractionType`,
  `ItemChangedEvent`, `ItemMetadata`, `LoadCompleteEvent`,
  `LocaleChangedEvent`, `LocaleLoadingCompleteEvent`,
  `LocaleLoadingErrorEvent`, `LocaleLoadingStartEvent`,
  `NavigationRequestEvent`, `PlayerErrorEvent`, `SessionChangedEvent`,
  `StateRestoredEvent`, `StateSavedEvent`, `SyncFailedEvent`,
  `ToolActivatedEvent`, `ToolDeactivatedEvent`,
  `ToolStateChangedEvent`). They were aspirational and never emitted
  from any production path. The canonical replacement surfaces
  (DOM `CustomEvent`s on `<pie-assessment-toolkit>`,
  `ToolkitCoordinator.subscribe*` helpers, and the M3
  framework-error contract) are unchanged.

- **Deprecated Svelte-store-shaped `toolCoordinatorStore`** and the
  legacy `ToolCoordinator` *interface* (the z-index / visibility shape
  in `packages/assessment-toolkit/src/tools/types.ts`, with
  `registerTool` / `showTool` / `hideTool` / `toggleTool` /
  `bringToFront` / `updateToolElement` / `hideAllTools` /
  `getToolState` / `isToolVisible`). The canonical replacement is the
  class-based `ToolCoordinator` (typed by `ToolCoordinatorApi` in
  `packages/assessment-toolkit/src/services/interfaces.ts`)
  re-exported from `@pie-players/pie-assessment-toolkit` and
  instantiated by `ToolkitCoordinator` as `coordinator.toolCoordinator`.
  All instance methods carry over verbatim, plus a `subscribe()` for
  reactive consumption that replaces the deleted Svelte-store derived
  views. Independently, `ToolkitCoordinator`'s tool-policy surface
  (`onPolicyChange`, `decideToolPolicy`, `getFloatingTools`,
  `setQtiEnforcement`, `registerPolicySource`) is the canonical entry
  point for the *tool policy* concern (allow/block + QTI enforcement)
  — that is a different concern than the floating-tool z-index API
  the deleted interface served.

- **Top-level `createSectionController` prop on every section-player
  layout custom element** (`<pie-section-player-splitpane>`,
  `<pie-section-player-vertical>`, `<pie-section-player-tabbed>`,
  `<pie-section-player-kernel-host>`, `<pie-section-player-base>`)
  and the corresponding kernel pass-through. The factory is now
  exposed only via `runtime.createSectionController`, the canonical
  M5 entry point.

  Note: `<pie-assessment-toolkit>`'s `createSectionController` prop
  is **unchanged** — the toolkit accepts it directly as part of its
  composition surface.

- **Top-level `isolation` prop on every section-player layout custom
  element** (`<pie-section-player-splitpane>`,
  `<pie-section-player-vertical>`, `<pie-section-player-tabbed>`,
  `<pie-section-player-kernel-host>`, `<pie-section-player-base>`)
  and the corresponding kernel pass-through. The isolation strategy
  is now read only from `runtime.isolation`; when omitted, the
  resolver falls back to the package default (`DEFAULT_ISOLATION`).

  Note: the toolkit's `<pie-assessment-toolkit>` keeps `isolation` as a
  JS-only object property (see the toolkit-side carve-out below), but
  the kebab-attribute (`isolation="…"` HTML form) was also removed in
  this sweep. Layout-CE hosts must use `runtime.isolation`; standalone
  toolkit hosts must assign `el.isolation = …` programmatically.

- **Top-level `item-toolbar-tools` / `passage-toolbar-tools`
  attribute aliases (and their `itemToolbarTools` / `passageToolbarTools`
  prop forms) on every section-player layout custom element**
  (`<pie-section-player-splitpane>`, `<pie-section-player-vertical>`,
  `<pie-section-player-tabbed>`, `<pie-section-player-kernel-host>`),
  along with the matching one-time deprecation warnings and the
  `parseToolList(itemToolbarTools)` / `parseToolList(passageToolbarTools)`
  absorption inside `resolveToolsConfig`. Per-region tool placement is
  now configured directly on the canonical `tools` object as
  `tools.placement.item` / `tools.placement.passage` (or via
  `runtime.tools.placement.{item,passage}`).

  The kernel re-exposes the canonical placement arrays as
  comma-separated strings via slot props (`itemToolbarTools`,
  `passageToolbarTools`) so internal card / pane custom elements
  (`<pie-section-player-item-card>`, `<pie-section-player-passage-card>`,
  `<pie-section-player-items-pane>`,
  `<pie-section-player-passages-pane>`) keep their existing
  string-attribute contract unchanged.

- **Deprecated readiness DOM-event aliases on every section-player
  layout custom element** — `readiness-change`, `interaction-ready`,
  and `ready` — along with the engine's `legacy-event-bridge` that
  emitted them, the corresponding `SectionEngineOutput` kinds
  (`readiness-change`, `interaction-ready`, `ready`), the engine
  state fields that gated them (`interactionReadyEmitted`,
  `readyEmitted`, `lastReadinessDetail`), the
  `pie-section-readiness-change` / `pie-section-interaction-ready` /
  `pie-section-ready` instrumentation mappings, and the
  `readinessChange` / `interactionReady` / `ready` entries on
  `SECTION_PLAYER_PUBLIC_EVENTS`. Hosts now consume the canonical
  M6 vocabulary directly:

  - `readiness-change` → `pie-stage-change` (the readiness payload
    is also reachable via the layout CE's `selectReadiness()` /
    `getSnapshot().readiness`).
  - `interaction-ready` → `pie-stage-change` filtered on
    `detail.stage === "interactive"`.
  - `ready` → `pie-loading-complete`.

- **Deprecated `section-controller-ready` Svelte/DOM event** — the
  kernel-side `dispatch("section-controller-ready", ...)` call,
  the matching `on:section-controller-ready={…}` forwarders on every
  layout CE wrapper (`<pie-section-player-splitpane>`,
  `<pie-section-player-vertical>`, `<pie-section-player-tabbed>`,
  `<pie-section-player-kernel-host>`), the
  `sectionControllerReady` entry on `SECTION_PLAYER_PUBLIC_EVENTS`,
  the `SectionPlayerControllerReadyDetail` type export, and the
  `pie-section-controller-ready` instrumentation mapping in
  `SECTION_INSTRUMENTATION_EVENT_MAP`. The kernel still feeds the
  engine FSM's `section-controller-resolved` input on first
  resolution per cohort (canonical stage progression
  `booting-section → engine-ready`); only the kernel-level Svelte
  event and its DOM-forwarded layout-host emit are gone. The
  toolkit-internal `pie-toolkit-section-controller-ready`
  telemetry name is unchanged. Migration:

  - Pull a controller handle directly:
    `await el.waitForSectionController(timeoutMs)` or
    `el.getSectionController()` on the layout CE.
  - Or filter `pie-stage-change` for
    `detail.stage === "engine-ready"` and then call
    `el.getSectionController()`.

- **`autoFocusFirstItem` boolean alias on
  `SectionPlayerFocusPolicy`** and the runtime translation logic that
  mapped it onto the canonical `autoFocus` enum (along with its
  one-time deprecation warning). Hosts now set `autoFocus` directly:

  ```ts
  // before
  el.policies = { focus: { autoFocusFirstItem: true } };
  // after
  el.policies = { focus: { autoFocus: "start-of-content" } };
  // (or `"none"` to disable)
  ```

  The two Playwright tests that pinned the deprecated alias contract
  (`section-player-navigation-contract.spec.ts`) are removed.

- **Orphaned `runtime-event-guards.ts` re-export shim** in
  `@pie-players/pie-assessment-toolkit` (`@deprecated since M7`,
  `createRuntimeId` is the only re-export). Import from
  `@pie-players/pie-assessment-toolkit/runtime/internal` instead.

- **`warnDeprecatedOnce` deprecation-warning utility** and its
  public re-export from `@pie-players/pie-assessment-toolkit`
  (`packages/assessment-toolkit/src/services/deprecation-warnings.ts`,
  along with the test-only `__resetDeprecationWarnings` and the
  `warnDeprecatedOnce` test block in
  `tests/framework-error-bus.test.ts`). Every internal callsite
  was removed earlier in this sweep; no in-tree code depends on the
  utility. External consumers that imported it from the package
  root should inline a per-callsite `console.warn` (the utility
  was a thin once-per-label, dev-only `console.warn` wrapper).

- **Toolkit `isolation` kebab-attribute surface on
  `<pie-assessment-toolkit>`.** The `isolation` prop is now a
  JS-only object property (`type: "Object", reflect: false`); the
  previously observed `isolation="…"` HTML attribute is no longer
  parsed. Hosts that set isolation declaratively must move to a
  property assignment (or set it via `runtime.isolation` on the
  enclosing layout CE):

  ```html
  <!-- before -->
  <pie-assessment-toolkit isolation="shadow"></pie-assessment-toolkit>
  ```

  ```ts
  // after
  el.isolation = "shadow";
  ```

- **Deprecated `ToolkitCoordinatorHooks` error hooks**
  (`onError`, `onTTSError`, `onProviderError`) and their
  subscription/dispatch logic on `ToolkitCoordinator`, plus the
  internal helpers (`toCauseError`, `legacyContextFromModel`,
  `providerIdFromSource`) that synthesized the legacy
  `(error, context)` payload from the canonical
  `FrameworkErrorModel`. The single canonical hook is
  `onFrameworkError(model: FrameworkErrorModel)`, which already
  delivers every `framework-error` exactly once per error
  (filterable on `model.kind`). Migration:

  ```ts
  // before
  coordinator.setHooks({
    onError: (error, context) => log({ error, context }),
    onTTSError: (error) => bumpTtsErrorCount(),
    onProviderError: (error, context) => log(context.providerId, error),
  });

  // after
  coordinator.setHooks({
    onFrameworkError: (model) => {
      // model.kind: "tool-config" | "runtime-init" | "runtime-dispose"
      //           | "coordinator-init" | "provider-init" | "provider-register"
      //           | "tts-init" | "tool-state-load" | "tool-state-save"
      //           | "section-controller-init" | "section-controller-dispose"
      //           | "unknown"
      // model.severity, model.source, model.message, model.details,
      // model.recoverable, model.cause, …
      log(model);
      if (model.kind === "tts-init") bumpTtsErrorCount();
    },
  });
  ```

- **`framework-error` dual-emit on the layout CE host.** Previously,
  while a `<pie-assessment-toolkit>` was nested inside a layout CE,
  the layout host received **two** `framework-error` DOM events per
  error (one engine-bridge emit on the layout host plus the bubbled
  toolkit emit). The dual-emit is collapsed to a single canonical
  emit: the kernel's `handleFrameworkError` listener at
  `<pie-section-player-base>` now calls `event.stopPropagation()`
  after re-feeding the engine, so the bubbled toolkit emit no
  longer reaches the layout CE host. Outside listeners on the layout
  host now see exactly one `framework-error` per error — the
  engine-bridge emit (target = layout host, non-bubbling,
  non-composed). Direct listeners attached to
  `<pie-assessment-toolkit>` itself are unaffected (the toolkit
  dispatch reaches them before the kernel listener runs). The
  `onFrameworkError` callback prop and the package-internal
  `FrameworkErrorBus` are unchanged — both were already single-fire.
  The single-emit contract is now pinned by
  `packages/section-player/tests/section-player-framework-error-dual-emit.test.ts`
  (the file name is preserved for git blame; the test now asserts
  the single canonical emit).

- **`allowPreloadedFallbackLoad` escape hatch.** Removed alongside the
  PIE-501 Phase B strategy-substitution work. Hosts that relied on it
  to mask preload-misses should ensure their preload set is correct
  (the `ElementLoader` primitive now rejects deterministically with a
  per-tag reason if a requested tag never registers).

- **Per-strategy loader classes** (`IifeLoader`, `EsmLoader` and their
  test fixtures) in `@pie-players/pie-players-shared`. Replaced by the
  deep `ElementLoader` primitive plus IIFE / ESM adapters. Hosts that
  imported the loader classes directly should switch to
  `ElementLoader`; hosts that only used the public
  `<pie-item-player>` / `<pie-section-player-*>` attribute surface
  need no change.

## Migration

```ts
// before
const el = document.createElement("pie-section-player-splitpane");
el.createSectionController = () => new SectionController();
el.isolation = "shadow";
el.setAttribute("item-toolbar-tools", "calculator,answer-eliminator");
el.setAttribute("passage-toolbar-tools", "line-reader");

// after
el.runtime = {
  createSectionController: () => new SectionController(),
  isolation: "shadow",
  tools: {
    placement: {
      item: ["calculator", "answer-eliminator"],
      passage: ["line-reader"],
    },
  },
};
```

Section-controller resolution (replaces `section-controller-ready`):

```ts
// before
el.addEventListener("section-controller-ready", (event) => {
  const { controller } = (event as CustomEvent).detail;
  // …
});

// after — pull-style (preferred for one-shot consumers)
const controller = await (
  el as HTMLElement & {
    waitForSectionController?: (timeoutMs?: number) => Promise<unknown>;
  }
).waitForSectionController?.(5000);

// after — event-driven
el.addEventListener("pie-stage-change", (event) => {
  const { stage } = (event as CustomEvent).detail;
  if (stage !== "engine-ready") return;
  const controller = (
    el as HTMLElement & { getSectionController?: () => unknown }
  ).getSectionController?.();
  // …
});
```

`AssessmentToolkitEvents` consumers should subscribe to the canonical
DOM events / coordinator helpers instead. The Svelte-store coordinator
had no in-tree consumers; hosts that imported it should switch to the
class-based `ToolCoordinator` reachable via
`coordinator.toolCoordinator` on `ToolkitCoordinator` (same method
shape — `registerTool`, `showTool`, `hideTool`, `toggleTool`,
`bringToFront`, `updateToolElement`, `hideAllTools`, `getToolState`,
`isToolVisible` — plus `subscribe(listener)` for reactive consumers
that previously relied on the Svelte-store derived views).

```ts
// before
el.addEventListener("readiness-change", (event) => {
  // event.detail: EngineReadinessDetail
});
el.addEventListener("interaction-ready", () => {
  // gate "start test" UI
});
el.addEventListener("ready", () => {
  // all items loaded
});

// after
import type { StageChangeDetail } from "@pie-players/pie-players-shared/pie";
import type { EngineReadinessDetail } from "@pie-players/pie-assessment-toolkit/runtime/internal";

el.addEventListener("pie-stage-change", (event) => {
  const { stage } = (event as CustomEvent<StageChangeDetail>).detail;
  // stage: "composed" | "engine-ready" | "interactive" | "disposed"
  if (stage === "interactive") {
    // gate "start test" UI
  }
});
el.addEventListener("pie-loading-complete", () => {
  // all items loaded (single-shot, cohort-scoped)
});
// Readiness payload (formerly the `readiness-change` detail) is also
// reachable on demand:
const readiness: EngineReadinessDetail | undefined = el.selectReadiness?.();
```

Hosts that previously de-duplicated `framework-error` listeners on the
layout CE host (because the same logical error arrived twice — once
bubbled from the toolkit, once from the engine bridge) can drop that
de-dup logic: the layout host now fires `framework-error` exactly once
per error. The canonical `onFrameworkError` callback prop and the
package-internal `FrameworkErrorBus` were already single-fire and need
no migration.

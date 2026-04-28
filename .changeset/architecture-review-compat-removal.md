---
'@pie-players/pie-section-player': major
'@pie-players/pie-assessment-toolkit': major
---

Broad architecture review — compat removal sweep (part 1).

Removes deprecated compatibility paths that were superseded by the M5
two-tier mirror, the M3 framework-error contract, the M7 runtime engine,
and the M8 tool policy engine. None of these surfaces are part of the
`pie-item` client contract (the only allowed compatibility surface per
`.cursor/rules/legacy-compatibility-boundaries.mdc`), and removing them
unblocks a single canonical path for every consumer.

## Removed

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
  legacy `ToolCoordinator` interface. The canonical coordinator is
  `ToolkitCoordinator` with its tool-policy engine surface
  (`onPolicyChange`, `decideToolPolicy`, `getFloatingTools`,
  `setQtiEnforcement`, `registerPolicySource`).

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

  Note: `<pie-assessment-toolkit>`'s `isolation` prop is **unchanged** —
  the toolkit derives it via the section-player base element from
  `runtime.isolation`.

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

  `section-controller-ready` is **not** part of this removal — it is
  still dispatched on the layout host by the kernel's Svelte
  `createEventDispatcher` (forwarded by each layout CE wrapper) and
  remains `@deprecated since M6` with the same migration guidance
  (`coordinator.waitForSectionController(...)` or `pie-stage-change`
  filtered on `detail.stage === "engine-ready"`).

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

`AssessmentToolkitEvents` consumers should subscribe to the canonical
DOM events / coordinator helpers instead. The Svelte-store coordinator
had no in-tree consumers; hosts that imported it should switch to
`ToolkitCoordinator` directly.

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
el.addEventListener("pie-stage-change", (event) => {
  // event.detail.stage: "composed" | "engine-ready" | "interactive" | "disposed"
  if (event.detail.stage === "interactive") {
    // gate "start test" UI
  }
});
el.addEventListener("pie-loading-complete", () => {
  // all items loaded (single-shot, cohort-scoped)
});
// Readiness payload (formerly the `readiness-change` detail) is also
// reachable on demand:
const readiness = el.selectReadiness?.();
```

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

# Section Player Architecture

This package exposes layout-specific section-player custom elements:

- `pie-section-player-splitpane`
- `pie-section-player-vertical`

## High-level flow

1. Host app imports a layout entrypoint from package exports.
2. Host sets `runtime`, `section`, and `env` on the layout custom element.
3. Layout element composes passages/items and delegates runtime wiring to:
   - `pie-section-player-base`
   - `SectionPlayerShell`
   - `pie-item-shell`
   - `pie-passage-shell`
4. Item rendering is resolved from `DEFAULT_PLAYER_DEFINITIONS` in `component-definitions.ts`.

## Core files

- `src/components/PieSectionPlayerSplitPaneElement.svelte`
- `src/components/PieSectionPlayerVerticalElement.svelte`
- `src/components/PieSectionPlayerBaseElement.svelte`
- `src/components/SectionPlayerShell.svelte`
- `src/components/ItemShellElement.svelte`
- `src/components/PassageShellElement.svelte`
- `src/component-definitions.ts`
- `src/controllers/*`

## Runtime vs layout responsibilities

- `pie-section-player-base`: runtime/toolkit/session wiring and composition events.
- `pie-section-player-shell`: shared layout shell custom element with section-toolbar placement (`top|right|bottom|left|none`).
- Layout components (`splitpane`, `vertical`, custom): render passages/items and layout-specific UI.

This keeps runtime contracts stable while letting new layouts reuse the same toolbar+shell behavior.

## Creating a custom layout

1. Create a new layout custom element in `src/components/`.
2. Reuse `resolveSectionPlayerRuntimeState` from `src/components/shared/section-player-runtime.ts`.
3. Wrap layout content with:
   - `<pie-section-player-base runtime={effectiveRuntime} ...>`
   - `<pie-section-player-shell show-toolbar={...} toolbar-position={...} enabled-tools={...}>...</pie-section-player-shell>`
4. Render passages/items via shared cards (`SectionPassageCard`, `SectionItemCard`) or your own content components.

Minimal shape:

```svelte
<pie-section-player-base runtime={effectiveRuntime} {section} section-id={sectionId} attempt-id={attemptId}>
  <pie-section-player-shell show-toolbar={showToolbar} toolbar-position={toolbarPosition} enabled-tools={enabledTools}>
    <!-- custom layout content -->
  </pie-section-player-shell>
</pie-section-player-base>
```

## Removed architecture

The legacy orchestration path has been removed:

- `PieSectionPlayer.svelte`
- layout element wrappers under `src/components/layout-elements/*`
- internal layout components under `src/components/layouts/*`
- legacy layout orchestrators and wrappers

## Consumer boundary note

Consumers should import package registration entrypoints from `exports` paths and avoid package source path imports.

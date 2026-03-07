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
   - `pie-section-player-item-card`
   - `pie-section-player-passage-card`
   - `pie-item-shell`
   - `pie-passage-shell`
4. Item rendering is resolved from `DEFAULT_PLAYER_DEFINITIONS` in `component-definitions.ts`.

## Core files

- `src/components/PieSectionPlayerSplitPaneElement.svelte`
- `src/components/PieSectionPlayerVerticalElement.svelte`
- `src/components/PieSectionPlayerBaseElement.svelte`
- `src/components/SectionPlayerShell.svelte`
- `src/components/shared/SectionItemCard.svelte`
- `src/components/shared/SectionPassageCard.svelte`
- `src/components/shared/section-player-card-context.ts`
- `src/components/ItemShellElement.svelte`
- `src/components/PassageShellElement.svelte`
- `src/component-definitions.ts`
- `src/controllers/*`

## Public vs internal contracts

- Public author-facing contract: `pie-section-player-shell`.
  - Use this to place the section toolbar (`top|right|bottom|left|none`) around your layout body.
  - Layout authors should focus on rendering passages/items and layout-specific UI inside the shell slot.
- Public card primitives: `pie-section-player-item-card` and `pie-section-player-passage-card`.
  - Layouts pass per-entity values (`item`/`passage`, `playerParams`, toolbar tools).
  - Layouts should prefer context for shared render plumbing (resolved player tag + player action).
- Internal runtime contract: `pie-section-player-base`.
  - Handles runtime/toolkit/session wiring and emits composition events used by layout elements.
  - Consider this package-internal plumbing rather than the primary abstraction for layout authoring.

This keeps runtime contracts stable while giving layout authors one clear composition primitive.

## Runtime contract normalization

- `runtime` is the primary input for runtime fields.
- Top-level runtime-like props on layout elements are compatibility/override inputs used when the corresponding `runtime` field is absent.
- Toolbar visibility is normalized through shared boolean-like coercion before reaching `pie-section-player-shell`.
- Toolbar placement overrides are normalized in `resolveToolsConfig` so section/item/passage tool lists remain predictable.

## Creating a custom layout

1. Create a new layout custom element in `src/components/`.
2. Reuse `resolveSectionPlayerRuntimeState` from `src/components/shared/section-player-runtime.ts`.
3. Treat `pie-section-player-shell` as the main authoring primitive, and render your layout body in its slot.
4. Keep runtime plumbing in `pie-section-player-base` around the shell.
5. Render passages/items via card custom elements (`pie-section-player-passage-card`, `pie-section-player-item-card`) or your own content components.

Minimal shape:

```svelte
<pie-section-player-base runtime={effectiveRuntime} {section} section-id={sectionId} attempt-id={attemptId}>
  <pie-section-player-shell
    show-toolbar={showToolbar}
    toolbar-position={toolbarPosition}
    enabled-tools={enabledTools}
  >
    <pie-section-player-passage-card
      passage={passage}
      playerParams={passagePlayerParams}
      passageToolbarTools={passageToolbarTools}
    ></pie-section-player-passage-card>
    <pie-section-player-item-card
      item={item}
      canonicalItemId={canonicalItemId}
      playerParams={itemPlayerParams}
      itemToolbarTools={itemToolbarTools}
    ></pie-section-player-item-card>
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

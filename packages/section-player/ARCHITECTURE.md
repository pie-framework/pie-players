# Section Player Architecture

This package now targets a single runtime surface: `pie-section-player-splitpane`.

## High-level flow

1. Host app imports `@pie-players/pie-section-player/components/section-player-splitpane-element`.
2. Host sets `runtime`, `section`, and `env` properties on `<pie-section-player-splitpane>`.
3. Splitpane element composes passages/items and delegates session/runtime wiring to:
   - `pie-section-player-base`
   - `pie-item-shell`
   - `pie-passage-shell`
4. Item rendering is resolved from `DEFAULT_PLAYER_DEFINITIONS` in `component-definitions.ts`.

## Core files

- `src/components/PieSectionPlayerSplitPaneElement.svelte`
- `src/components/PieSectionPlayerBaseElement.svelte`
- `src/components/ItemShellElement.svelte`
- `src/components/PassageShellElement.svelte`
- `src/component-definitions.ts`
- `src/controllers/*`

## Removed architecture

The legacy multi-layout orchestration path has been removed:

- `PieSectionPlayer.svelte`
- layout element wrappers under `src/components/layout-elements/*`
- internal layout components under `src/components/layouts/*`
- vertical/item-mode orchestration components no longer used by splitpane

## Consumer boundary note

Consumers should import package registration entrypoints from `exports` paths and avoid package source path imports.

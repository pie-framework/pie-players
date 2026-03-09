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

## Unidirectional flow invariants

These invariants define the package architecture and should be preserved in new layout/runtime work:

1. Single source of truth
   - Toolkit/controller runtime state is authoritative for composition/session data.
   - Layout components are render adapters for derived state, not independent state owners.
2. Directional data flow
   - Runtime input flows down from layout props/runtime object into base/toolkit/card/player render paths.
   - Runtime updates flow up through events (`session-changed`, controller change events), never by mutating parent-owned state from child components.
3. Non-structural updates are identity-stable
   - Response/session updates, tool toggles, and TTS config changes must not remount item/passage shells when content identity is unchanged.
4. Non-structural updates are scroll-stable
   - Pane-local scroll positions should remain stable across session-only updates in splitpane and vertical layouts.
5. Explicit precedence for shared card render wiring
   - Card player render wiring has one canonical source (shared context from layout scaffolding) with prop fallback only when context is unavailable.

### Non-structural update definition

The following are considered non-structural updates and must preserve identity/scroll:

- item response/session changes (`item-session-data-changed`, `item-session-meta-changed`)
- tool state toggles/config changes without replacing the section content model
- runtime setting tweaks that do not alter item/passage renderable identity

If an update changes the section composition structure (add/remove/reorder/new IDs), remount behavior can be valid.

## Verification matrix

- Forward-only controller events + runtime state bootstrap:
  - `packages/section-player/tests/section-player-event-panel.spec.ts`
- Splitpane scroll stability on response selection:
  - `packages/section-player/tests/section-player-event-panel.spec.ts`
- Vertical layout scroll stability on response selection:
  - `packages/section-player/tests/section-player-event-panel.spec.ts`
- Item shell identity stability on session-only updates:
  - `packages/section-player/tests/section-player-event-panel.spec.ts`

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

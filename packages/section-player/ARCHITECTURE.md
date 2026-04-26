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
- `src/components/PieSectionPlayerKernelHostElement.svelte`
- `src/components/SectionPlayerShell.svelte`
- `src/components/SectionPlayerLayoutKernel.svelte`
- `src/components/SectionPlayerLayoutScaffold.svelte`
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

## Configuration tiers: easy attribute + sophisticated `runtime`

This package and `pie-assessment-toolkit` follow a deliberate two-tier
configuration model. The same knob can usually be set in either tier; the
choice is about ergonomics, not capability.

### When to use each tier

- **Easy tier — top-level CE attributes / properties.** Use these for the
  common cases that are static for the lifetime of the player or that hosts
  want to set declaratively in HTML / templating frameworks. Example:

  ```html
  <pie-section-player-splitpane
    section-id="s-1"
    player-type="custom"
    toolbar-position="top"
    show-toolbar
  ></pie-section-player-splitpane>
  ```

- **Sophisticated tier — the `runtime` object.** Use this for advanced cases:
  composed configuration, dynamic overrides, runtime mutation, fields without
  a tier-1 attribute, or anything that benefits from being a single typed
  object passed by reference. Example:

  ```ts
  el.runtime = {
    playerType: "custom",
    toolConfigStrictness: "warn",
    tools: { providers: { calculator: { enabled: true } } },
  };
  ```

### Naming rule

The easy-tier attribute name is the kebab-cased version of the runtime key.
`tool-config-strictness` ↔ `runtime.toolConfigStrictness`. `player-type` ↔
`runtime.playerType`. Hosts can move a knob from the easy tier to `runtime`
(or back) without renaming.

### Precedence rule

`runtime.<key>` wins. When the same knob is set in both tiers, resolution is:

1. `runtime.<key>` if set
2. Top-level attribute / property if set
3. Documented default

This is implemented centrally in `resolveRuntime` / `resolveToolsConfig` in
[src/components/shared/section-player-runtime.ts](src/components/shared/section-player-runtime.ts).
The equivalent path in `pie-assessment-toolkit` follows the same rule. New
knobs MUST go through these helpers; do not add ad-hoc fall-throughs.

### Canonical tier-1 attribute set

The tier-1 attribute set is intended to be the same shape across the
`pie-section-player-*` layout elements, `pie-section-player-base`, and
`pie-assessment-toolkit`. Common members include:

- Identity: `assessment-id`, `section-id`, `attempt-id`
- Player: `player-type`, `lazy-init`
- Tools: `tools` (object property) plus per-level easy attributes that
  mirror `tools.placement`
- Coordination: `coordinator`, `create-section-controller`
- Accessibility: `accessibility`
- Diagnostics: `tool-config-strictness`, `debug`. Framework-error
  delivery is via the canonical `onFrameworkError` callback prop and the
  bubbling `framework-error` DOM event (see "Framework error contract"
  below). The deprecated `framework-error-hook` / `frameworkErrorHook`
  alias is still accepted for migration.
- Layout / shell (section-player only): `show-toolbar`, `toolbar-position`

The exact canonical set is reconciled across CEs in M5 of the Coherent
Options Surface tightening track. Drift today (for example,
`tool-config-strictness` exposed on `pie-assessment-toolkit` but not on
`pie-section-player-base`) is a known target for M5, not a precedent for
new knobs.

### When to add a tier-1 attribute

Add a tier-1 attribute only if all of the following hold:

- It is a common case that hosts set without composing a `runtime` object.
- Its value is a primitive or small typed object that round-trips through
  HTML attributes (string, boolean-like, number; structured data passes via
  property assignment).
- It exists on every CE that conceptually owns the same knob, or has a
  deliberate documented exclusion.

Otherwise expose it through `runtime` only.

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

## Framework error contract

`framework-error` is the canonical error event for any failure that
crosses the framework boundary (coordinator initialization, runtime
initialization, tool configuration, provider/TTS initialization, tool
runtime). The payload is a `FrameworkErrorModel` from
`@pie-players/pie-assessment-toolkit`.

Single-fire delivery
- The toolkit owns a package-internal `FrameworkErrorBus`. A single
  subscriber on `<pie-assessment-toolkit>` performs all
  side-effects (console log, optional fallback banner for fatal
  bootstrap kinds, DOM event emission, canonical prop delivery).
- The canonical `onFrameworkError(model)` callback is delivered exactly
  once per error, regardless of how deep the section-player wrapper
  stack is. Layout custom elements (`pie-section-player-splitpane`,
  `pie-section-player-vertical`, `pie-section-player-tabbed`,
  `pie-section-player-kernel-host`) and `pie-section-player-base`
  forward `onFrameworkError` through `effectiveRuntime →
  pie-section-player-base → pie-assessment-toolkit`. The kernel
  re-emits the bubbling DOM event but does not re-invoke the
  callback, so wrapper depth does not multiply the call count.

Two-tier precedence
- `runtime.onFrameworkError` wins over the top-level
  `onFrameworkError` prop. The merge happens once in `resolveRuntime`.
- The deprecated `frameworkErrorHook` alias is still accepted for
  migration and emits a one-shot `[pie-deprecated]` console warning.

DOM events
- Canonical: `framework-error` (detail = `FrameworkErrorModel`).
- Compatibility: `runtime-error` (detail extends with
  `frameworkError?: FrameworkErrorModel`); kept for hosts mid-migration.

Telemetry
- `pie-toolkit-framework-error` and `pie-section-framework-error` are
  the canonical instrumentation streams; the legacy `*-runtime-error`
  mappings are kept so hosts that still listen to `runtime-error` see
  no telemetry regression while they migrate.

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

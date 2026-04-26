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

### Naming rule (strict mirror, locked in M5)

Every tier-1 surface obeys the same shape:

```
kebab-attribute  ↔  camelCaseProp  ↔  runtime.<sameCamelCaseKey>
```

`tool-config-strictness` ↔ `toolConfigStrictness` prop ↔
`runtime.toolConfigStrictness`. `enabled-tools` ↔ `enabledTools` prop ↔
`runtime.enabledTools`. Hosts can move a knob from the easy tier to
`runtime` (or back) without renaming.

This is enforced by
[`tests/m5-mirror-rule.test.ts`](tests/m5-mirror-rule.test.ts), which
parses the layout CE source files and asserts that every key in
`RuntimeConfig` is reachable through both tiers and that every declared
attribute is the camelCase-to-kebab conversion of its prop.

### Precedence rule

`runtime.<key>` wins. When the same knob is set in both tiers, resolution is:

1. `runtime.<key>` if set
2. Top-level attribute / property if set
3. Documented default

This is implemented centrally in `resolveRuntime` / `resolveToolsConfig` in
[src/components/shared/section-player-runtime.ts](src/components/shared/section-player-runtime.ts)
via a single `pick(runtimeVal, attrVal)` helper applied per key — so adding
a new knob means appending exactly one entry to `RuntimeConfig`, one prop
on each layout CE, and one `pick(...)` slot in `resolveRuntime`.
Per-key precedence is locked behind parametrized tests in
[`tests/section-player-runtime.test.ts`](tests/section-player-runtime.test.ts).
New knobs MUST go through these helpers; do not add ad-hoc fall-throughs.

### Documented exceptions to the mirror rule

A small set of tier-1 attributes have *no* `runtime.<key>` mirror by
design:

- **Identity** (`section-id`, `attempt-id`, `section`): per-attempt host
  state, not configuration. Re-using a section across attempts is the
  reason `assessmentId` *does* mirror.
- **Layout-only shell knobs** (`show-toolbar`, `toolbar-position`,
  `narrow-layout-breakpoint`, `split-pane-collapse-strategy`,
  `content-max-width-no-passage`, `content-max-width-with-passage`,
  `split-pane-min-region-width`, `iife-bundle-host`, `debug`):
  layout-CE rendering / preload-host concerns. Each is a top-level
  prop / kebab attribute on the layout CE that owns it; the resolver
  does not see them.
- **Layout-shell host data** (`policies`, `hooks`, `toolRegistry`,
  `sectionHostButtons`, `itemHostButtons`, `passageHostButtons`):
  consumed by the layout kernel through its top-level prop, not via
  `runtime`. They pass straight through to the kernel/scaffold and
  are not part of the two-tier mirror.
- **Deprecated aliases** (`item-toolbar-tools`, `passage-toolbar-tools`):
  kept as props for back-compat but absorbed at the CE boundary into the
  canonical surface (`tools.placement`).

### Canonical tier-1 attribute set

The tier-1 attribute set is the same shape across the
`pie-section-player-*` layout elements, `pie-section-player-base`, and
`pie-assessment-toolkit`. Common members include:

- Identity: `assessment-id`, `section-id`, `attempt-id`
- Player: `player-type`, `lazy-init`
- Tools: `tools` (object property), `enabled-tools` (shorthand for
  `tools.placement.section`), and the deprecated `item-toolbar-tools` /
  `passage-toolbar-tools` aliases
- Coordination: `coordinator`, `create-section-controller`
- Accessibility: `accessibility`
- Diagnostics: `tool-config-strictness`, `debug`. Framework-error
  delivery is via the canonical `onFrameworkError` callback prop and the
  bubbling `framework-error` DOM event (see "Framework error contract"
  below).
- Layout / shell (section-player only): `show-toolbar`, `toolbar-position`,
  `narrow-layout-breakpoint`, `split-pane-collapse-strategy`,
  `content-max-width-no-passage`, `content-max-width-with-passage`,
  `split-pane-min-region-width`

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

DOM events
- Canonical: `framework-error` (detail = `FrameworkErrorModel`).

Telemetry
- `pie-toolkit-framework-error` and `pie-section-framework-error` are
  the canonical instrumentation streams.

## Readiness vocabulary (M6)

`pie-stage-change` is the canonical readiness vocabulary across the
section-player and the assessment toolkit. It replaces a heterogeneous
mix of legacy events (`ready`, `interaction-ready`,
`section-controller-ready`, `toolkit-ready`, `section-ready`) with a
single typed transition stream that a host can subscribe to once and
correlate across wrapper depths.

Stages and order (post-retro: 4 canonical stages)
- `composed` (host-provided composition resolved — items / passages
  present)
- `engine-ready` (controller / toolkit engine ready — coordinator
  bring-up settled, section controller initialized)
- `interactive` (user input accepted — readiness predicate passed,
  toolkit's join of `engine-ready` and `sectionInitialized` reached)
- `disposed` (cohort change or unmount)

The original M6 plan included `attached`, `runtime-bound`, and
`ui-rendered` stages. The post-M5/M6 cumulative review confirmed zero
internal or external consumers for those three stages, so the retro
removed them. The retro also unifies the canonical list across CE
shapes: both the layout CEs and the toolkit CE now apply the same four
stages, eliminating the auto-skip of `ui-rendered` on the toolkit and
the per-DOM-element single-fire requirement on `attached`.

The `StageTracker` primitive (`@pie-players/pie-players-shared/pie`)
enforces monotonic ordering, applicability per CE shape (layout vs
toolkit; identical post-retro), and cohort reset on
`(sectionId, attemptId)` change. Both the layout kernel and
`<pie-assessment-toolkit>` use the same primitive; `sourceCe` and
`sourceCeShape` distinguish emissions.

DOM events
- Canonical: `pie-stage-change` (detail = `StageChangeDetail`).
- Canonical: `pie-loading-complete` (detail = `LoadingCompleteDetail`)
  — kernel-only; fires once per cohort when every item has loaded.
- Compatibility: `ready`, `interaction-ready`, `readiness-change` are
  kept dual-emitting through the M6 deprecation window.

Callback prop mirrors
- `onStageChange(detail)` is exposed on every `<pie-section-player-…>`
  layout element, `<pie-section-player-base>`, and
  `<pie-assessment-toolkit>`. The kernel and the toolkit invoke the
  resolved handler at the same emit point as `pie-stage-change`, so
  callback and event stay in lockstep across cohort changes.
- `onLoadingComplete(detail)` is exposed on the kernel-backed layout
  CEs only (split-pane / vertical / tabbed / kernel-host). The toolkit
  and the base CE do not own a `pie-loading-complete` emit point and
  intentionally omit the prop. `runtime.onLoadingComplete` set on
  those surfaces still flows through `runtime` passthrough — it just
  never fires from there.

Two-tier precedence
- `runtime.onStageChange` wins over the top-level `onStageChange`
  prop; same for `runtime.onLoadingComplete`. Resolved through the
  shared per-key `pick(...)` slot in `resolveRuntime` (Decision D1) —
  no per-feature special-casing.
- Thrown handlers are caught at the emit point and logged so a faulty
  consumer cannot break the stage pipeline.

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

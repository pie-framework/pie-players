# Section Player Architecture

This package exposes layout-specific section-player custom elements:

- `pie-section-player-splitpane`
- `pie-section-player-vertical`
- `pie-section-player-tabbed`
- `pie-section-player-kernel-host`

## High-level flow

1. Host app imports a layout entrypoint from package exports.
2. Host sets `runtime` and `section` on the layout custom element; `env` travels as `runtime.env`.
3. The layout element runs `SectionPlayerLayoutKernel`, which wraps the layout in
   `pie-section-player-base` (toolkit, controller, session) and `SectionPlayerShell`
   (section toolbar), and publishes the layout context.
4. The layout's markup, or a host's children of `pie-section-player-kernel-host`,
   places `pie-section-player-items-pane` and `pie-section-player-passages-pane`.
   Each pane reads the layout context and renders the cards:
   - `pie-section-player-item-card`, inside `pie-item-scope` from the toolkit
   - `pie-section-player-passage-card`, inside `pie-passage-shell`
5. Item rendering is resolved from `DEFAULT_PLAYER_DEFINITIONS` in `component-definitions.ts`.

## Core files

- `src/components/PieSectionPlayerSplitPaneElement.svelte`
- `src/components/PieSectionPlayerVerticalElement.svelte`
- `src/components/PieSectionPlayerTabbedElement.svelte`
- `src/components/PieSectionPlayerBaseElement.svelte`
- `src/components/PieSectionPlayerKernelHostElement.svelte`
- `src/components/SectionPlayerShell.svelte`
- `src/components/shared/SectionPlayerLayoutKernel.svelte`
- `src/components/shared/SectionPlayerLayoutScaffold.svelte`
- `src/components/shared/section-player-layout-context.ts`
- `src/components/shared/SectionItemsPane.svelte`
- `src/components/shared/SectionPassagesPane.svelte`
- `src/components/shared/SectionPlayerKernelHostBody.svelte`
- `src/components/shared/kernel-host-default-body.ts`
- `src/components/shared/SectionItemCard.svelte`
- `src/components/shared/SectionPassageCard.svelte`
- `src/components/shared/section-player-card-context.ts`
- `src/components/PassageShellElement.svelte`
- `src/component-definitions.ts`
- `src/controllers/*`

## Public vs internal contracts

- Host layout contract: `pie-section-player-kernel-host` and the two panes. See
  [Custom layouts](#custom-layouts).
- Card primitives: `pie-section-player-item-card` and `pie-section-player-passage-card`.
  - The panes pass the per-entity values (`item`/`passage`, `playerParams`, toolbar tools).
  - The card render context carries the shared render plumbing (resolved player tag and action).
- `pie-section-player-shell`: places the section toolbar (`top|right|bottom|left|none`)
  around the layout body. The kernel renders it; hosts set it through `show-toolbar`
  and `toolbar-position` on the layout element.
- Internal runtime contract: `pie-section-player-base`.
  - Handles runtime/toolkit/session wiring and emits the composition events the kernel reads.
  - The kernel renders it; no layout or host composes it directly.

## Layered runtime engine (post-M7)

Section-player owns no runtime resolver, readiness deriver or stage emitter
of its own. Those live in `@pie-players/pie-assessment-toolkit` as a layered
runtime engine. The section-player kernel owns the one engine per layout
host and is the only stage emitter; the toolkit CE owns the section
controller and its session plumbing through `SectionControllerBinding`.

### Architectural pieces

- **Engine core** — pure, framework-free finite-state machine. Inputs: the
  cohort, the controller resolving, readiness signals. Outputs: stage
  transitions and loading completion. Lives in
  [`assessment-toolkit/src/runtime/core/`](../assessment-toolkit/src/runtime/core/).
- **`SectionEngineAdapter`** — the I/O seam over the core. Hands each batch
  of outputs to the DOM event bridge and to `subscribe(...)` listeners.
  ([`assessment-toolkit/src/runtime/adapter/SectionEngineAdapter.ts`](../assessment-toolkit/src/runtime/adapter/SectionEngineAdapter.ts))
- **`dom-event-bridge`** — dispatches `pie-stage-change` and
  `pie-loading-complete` on the layout host element, bubbling and composed.
- **`SectionRuntimeEngine`** — the facade the kernel drives: `attachHost`,
  `dispatchInput`, `subscribe`, `getState`, `dispose`. Holds no controller.
  Lives in
  [`assessment-toolkit/src/runtime/SectionRuntimeEngine.ts`](../assessment-toolkit/src/runtime/SectionRuntimeEngine.ts).
- **`SectionControllerBinding`** — the toolkit CE's controller half: it
  resolves the section controller from the coordinator, keeps the
  registered item and passage shells, and forwards shell events, session
  updates and host commands to the controller.
  Lives in
  [`assessment-toolkit/src/runtime/SectionControllerBinding.ts`](../assessment-toolkit/src/runtime/SectionControllerBinding.ts).
- **Resolvers** — `resolveRuntime`, `resolveToolsConfig`,
  `resolveSectionEngineRuntimeState` produce the effective runtime + tools
  snapshot the engine consumes. Live in
  [`assessment-toolkit/src/runtime/core/engine-resolver.ts`](../assessment-toolkit/src/runtime/core/engine-resolver.ts).

### Section-player wiring

Section-player owns two pieces of glue:

- **`SectionPlayerLayoutKernel.svelte`** — constructs one
  `SectionRuntimeEngine` per layout element, calls
  `attachHost({ host, sourceCe })`, and drives `dispatchInput(...)` from a
  single tracked `$effect` wrapped in `untrack(...)`. It learns from
  `section-ready`, which carries the controller and its cohort, that the
  controller resolved, and latches the readiness error signal from the
  toolkit's bubbling `framework-error` by the error's `scope`. A toolkit
  bootstrap failure is held against the coordinator announced when it was
  reported and clears when `toolkit-ready` announces another. Element warmup
  fails a section through the items pane's `reportWarmup`, which carries the
  renderables signature it ran for and counts only from the cohort's
  `section-ready`, so one section's warmup outcome never reaches the next.
- **`section-player-host-runtime.ts`**
  ([source](src/components/shared/section-player-host-runtime.ts)) — the
  player-coupled wrapper around the toolkit resolver. Holds
  `resolvePlayerRuntime`, `mapRenderablesToItems`, and
  `resolveSectionPlayerRuntimeState` (the only resolver pieces that
  depend on section-player–specific defaults like
  `DEFAULT_PLAYER_DEFINITIONS`). The layout kernel is its one caller, so
  no layout reaches into toolkit core.

### Public toolkit entry points

- `@pie-players/pie-assessment-toolkit/runtime/engine` — the stable entry
  the layout kernel drives the engine through: `SectionRuntimeEngine`, the
  `SectionEngineInput` / `SectionEngineOutput` / `SectionEngineState`
  vocabulary, the runtime config and its resolution (`RuntimeConfig`,
  `resolveSectionEngineRuntimeState`, the `DEFAULT_*` values), the cohort
  helpers, and the readiness signals.
- `@pie-players/pie-assessment-toolkit/tools/registration` — the tool
  surface host and the tool registry the cards and overlays render
  registrations with.
- `@pie-players/pie-assessment-toolkit` — everything else, including
  `createShellEventBridge` for the passage shell.

The engine's core, adapter and bridges have no entry: the section player
reaches them only through the facade.

### Lifecycle emit invariant

One cohort is one event chain on the layout host: one `pie-stage-change`
per stage and one `pie-loading-complete`, whatever the wrapper depth. The
kernel's engine is the only emitter; `<pie-assessment-toolkit>` emits no
stage events, standalone or nested. A host that drives the engine itself
follows the "Common-host wiring example" in
[`packages/assessment-toolkit/README.md`](../assessment-toolkit/README.md#section-runtime-engine-advanced).

## Configuration inputs: one tier per input

Each input of this package and `pie-assessment-toolkit` has exactly one
entry point, chosen by its kind:

- **Attributes** carry primitives a host sets declaratively: identity
  (`section-id`, `attempt-id`), layout and diagnostics, and `nds-icons`,
  `locale` and `tool-config-strictness`.
- **`runtime`** carries composed and callable configuration: `assessmentId`,
  `playerType`, `player`, `lazyInit`, `tools` (with `tools.pnpEnforcement`),
  `toolContextResolvers`, `accessibility`, `coordinator`,
  `createSectionController`, `isolation`, `env`, `contentLanguage` and the
  `onFrameworkError`, `onStageChange` and `onLoadingComplete` callbacks.

```html
<pie-section-player-splitpane
  section-id="s-1"
  toolbar-position="top"
  tool-config-strictness="warn"
  show-toolbar
></pie-section-player-splitpane>
```

```ts
el.runtime = {
  assessmentId: "a-1",
  playerType: "preloaded",
  tools: { providers: { calculator: { enabled: true } } },
  onFrameworkError: (model) => report(model),
};
```

No key exists in both tiers, so nothing resolves between them.
[`tests/runtime-config-boundary.test.ts`](tests/runtime-config-boundary.test.ts)
parses the layout CE sources and asserts that no `RuntimeConfig` key is a
layout prop and that every layout CE declares the three attribute-only inputs.

`resolveRuntime` / `resolveToolsConfig` in
[`packages/assessment-toolkit/src/runtime/core/engine-resolver.ts`](../assessment-toolkit/src/runtime/core/engine-resolver.ts)
(reached through `resolveSectionEngineRuntimeState` on
`@pie-players/pie-assessment-toolkit/runtime/engine`) fill `runtime`'s
defaults and take `toolConfigStrictness` from the element, defaulting to
`error`. They are locked by
[`packages/assessment-toolkit/tests/runtime/core/engine-resolver.test.ts`](../assessment-toolkit/tests/runtime/core/engine-resolver.test.ts);
the section-player-coupled wrapper (`resolvePlayerRuntime`,
`resolveSectionPlayerRuntimeState`) lives in
[`src/components/shared/section-player-host-runtime.ts`](src/components/shared/section-player-host-runtime.ts)
and is locked by
[`tests/section-player-runtime.test.ts`](tests/section-player-runtime.test.ts).
New knobs MUST go through these helpers; do not add ad-hoc fall-throughs.

### Inputs outside `RuntimeConfig`

These inputs are element props the resolver never sees:

- **Identity** (`section-id`, `attempt-id`, `section`, `session`):
  per-attempt host state, not configuration. `session` is the
  section's session: the controller created for `section` applies it in
  place of hydrating from the persistence strategy.
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
  `runtime`. They pass straight through to the kernel/scaffold.
- Per-region toolbar tool placement is configured directly on the
  canonical `tools` object as `tools.placement.item` /
  `tools.placement.passage` (or via `runtime.tools.placement.{item,passage}`).
  Per-region toolbar strings are derived from those placement arrays for
  the internal card and pane custom elements.

`<pie-assessment-toolkit>` takes the runtime fields as its own properties:
`createSectionController` as a JS-only prop, `isolation` as a property or an
`isolation` attribute (`inherit` | `force`), and its own `assessment-id`
attribute. Section-player layouts forward `runtime.createSectionController`,
`runtime.isolation` and `runtime.assessmentId` to the wrapped toolkit; a
standalone host that needs to override coordinator inheritance passes an
explicit `coordinator={...}`.

### Canonical attribute set

The attribute set is the same shape across the `pie-section-player-*` layout
elements and `pie-section-player-base`:

- Identity: `section-id`, `attempt-id`
- Interface: `nds-icons`, `locale`
- Diagnostics: `tool-config-strictness`, and `debug` on the layouts only.
  Framework-error delivery is via `runtime.onFrameworkError` and the
  `framework-error` DOM event, which bubbles from `<pie-assessment-toolkit>`
  and is dispatched without bubbling on a layout element (see "Framework
  error contract" below).
- Layout / shell (section-player only): `show-toolbar`, `toolbar-position`,
  `narrow-layout-breakpoint`, `content-max-width-no-passage`,
  `content-max-width-with-passage`, and on splitpane
  `split-pane-collapse-strategy`, `split-pane-min-region-width` and
  `split-pane-initial-passage-width`

### When to add an attribute

Add an attribute only if all of the following hold:

- It is a common case that hosts set without composing a `runtime` object.
- Its value is a primitive or small typed object that round-trips through
  HTML attributes (string, boolean-like, number; structured data passes via
  property assignment).
- It exists on every CE that conceptually owns the same knob, or has a
  deliberate documented exclusion.

Otherwise expose it through `runtime` only.

## Runtime contract normalization

- `runtime` is the input for runtime fields.
- Toolbar visibility is normalized through shared boolean-like coercion before reaching `pie-section-player-shell`.
- Toolbar placement comes from `runtime.tools.placement.{section,item,passage}`.

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

## Event delivery

The toolkit's events (`session-changed`, `composition-changed`,
`runtime-owned`, `runtime-inherited`, `toolkit-ready`, `section-ready`)
reach the layout element and `document` by native bubbling alone, so a
listener on either receives each dispatch once. No section-player
component re-dispatches them: a Svelte custom element's
`addEventListener` also subscribes to the component's own events, so a
re-dispatch reaches every listener on that element a second time. The
base, kernel and layout forwards that did so delivered these events to
the layout element three times until 2026-09. `framework-error` follows
the contract below.

The shells' events for their runtime (`pie-register`,
`pie-unregister`, `pie-item-session-changed`, `pie-content-loaded`,
`pie-item-player-error`, `pie-formative-action`,
`pie-media-time-source`) stop at the toolkit that handles them. A raw
item-player `session-changed` stops at its `<pie-item-scope>`, which
drops it when it repeats the last event that shell forwarded, and
otherwise forwards it to the runtime and, unless it carries only
metadata, as `item-session-changed`.

## Framework error contract

`framework-error` is the canonical error event for any failure that
crosses the framework boundary (coordinator initialization, runtime
initialization, tool configuration, provider/TTS initialization, tool
runtime). The payload is a `FrameworkErrorModel` from
`@pie-players/pie-assessment-toolkit`.

Single-fire delivery (callback / bus)
- The toolkit owns a package-internal `FrameworkErrorBus`. A single
  subscriber on `<pie-assessment-toolkit>` performs all
  side-effects (console log, optional fallback banner for fatal
  bootstrap kinds, DOM event emission, canonical prop delivery).
- The canonical `onFrameworkError(model)` callback is delivered exactly
  once per error, regardless of how deep the section-player wrapper
  stack is. Layout custom elements (`pie-section-player-splitpane`,
  `pie-section-player-vertical`, `pie-section-player-tabbed`,
  `pie-section-player-kernel-host`) and `pie-section-player-base`
  forward `runtime.onFrameworkError` through `effectiveRuntime →
  pie-section-player-base → pie-assessment-toolkit`.
- A coordinator the host passes as `runtime.coordinator` reports into
  a bus of its own. The toolkit subscribes to it and republishes each
  error on its bus, so those errors reach the same subscriber; the
  host coordinator's own hooks still receive them. They skip the
  toolkit's initialization banner, which replaces the section: the host
  that constructed the coordinator handles its failures.

DOM event (single-emit)
- `<pie-assessment-toolkit>` dispatches one `framework-error` per error,
  `bubbles: true, composed: true`. It reaches the layout CE host and
  `document` once. The kernel listener at `<pie-section-player-base>`
  only reads it: a non-recoverable error sets the readiness error signal,
  which ends the stage chain with the current stage `failed`.
  [`tests/section-player-event-delivery.spec.ts`](tests/section-player-event-delivery.spec.ts)
  pins the event and callback counts on every layout element.

DOM events
- Canonical: `framework-error` (detail = `FrameworkErrorModel`).

Telemetry
- `pie-toolkit-framework-error` and `pie-section-framework-error` are
  the canonical instrumentation streams.

## Readiness vocabulary (M6)

`pie-stage-change` is the canonical readiness vocabulary across the
section-player and the assessment toolkit: a single typed transition stream
that a host can subscribe to once and correlate across wrapper depths.

Stages and order (post-retro: 4 canonical stages)
- `composed` (host-provided composition resolved — items / passages
  present)
- `engine-ready` (controller / toolkit engine ready — coordinator
  bring-up settled, section controller initialized)
- `interactive` (user input accepted). A layout element enters it once
  the section controller is ready and the section's element pre-warm has
  resolved for the current items.
- `disposed` (cohort change or unmount)

The original M6 plan included `attached`, `runtime-bound`, and
`ui-rendered` stages. The post-M5/M6 cumulative review confirmed zero
internal or external consumers for those three stages, so the retro
removed them.

The section runtime engine derives the stages in order and resets on a
`(sectionId, attemptId)` change; the layout kernel emits them through the
engine's DOM event bridge, and each detail's `sourceCe` names the layout
element. `status` is `entered`. A non-recoverable framework error before
`interactive` ends the chain: the current stage is emitted `failed` and
each stage it never reached `skipped`, and `disposed` still follows on
cohort change or unmount.

DOM events
- Canonical: `pie-stage-change` (detail = `StageChangeDetail`).
- Canonical: `pie-loading-complete` (detail = `LoadingCompleteDetail`)
  — kernel-only; fires once per cohort, on the same condition as a layout
  element's `interactive`: the section controller is ready and the element
  pre-warm has resolved for the current items.
- Use the canonical events as follows:
  - `readiness-change` → listen for `pie-stage-change`.
  - `interaction-ready` → listen for `pie-stage-change` and filter on
    `detail.stage === "interactive"`.
  - `ready` → listen for `pie-loading-complete`.
  - `section-controller-ready` → call
    `waitForSectionController(timeoutMs)` or `getSectionController()`
    on the layout CE, or filter `pie-stage-change` for
    `detail.stage === "engine-ready"`.

Callbacks
- `runtime.onStageChange(detail)` and `runtime.onLoadingComplete(detail)`
  fire on the kernel-backed layout CEs (split-pane / vertical / tabbed /
  kernel-host). The kernel invokes the handler at the same emit point as
  the DOM event, so callback and event stay in lockstep across cohort
  changes. The base CE and the toolkit own no emit point; the two
  callbacks pass through them and never fire there.
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
- Kernel host stock body, layout context resolution, pane registry and readiness rule:
  - `packages/section-player/tests/section-player-custom-layout.test.ts`
- Host-built layout rendering and reaching `pie-loading-complete`:
  - `packages/section-player/tests/section-player-custom-layout.spec.ts`

## Custom layouts

A layout is an arrangement of two panes under a section player. The kernel runs
the section, the panes render it, and the layout element owns only placement:
pane containers, dividers, tabs and backdrops. The stock layouts and a host's own
layout are built the same way. The README's
[Custom layout authoring](README.md#custom-layout-authoring) is the host-facing
contract.

### Kernel host composition

`pie-section-player-kernel-host` is a layout element without a layout of its
own. `SectionPlayerLayoutKernel` and the scaffold (base and shell) render in its
open shadow root, with one default slot as the shell's body. The host's light-DOM
children fill the slot. The panes, cards and item content stay in light DOM,
because document styles (`components.css`, the item players' injected styles,
MathJax) reach item content only there; the stock layout elements are
`shadow: "none"` for the same reason. Events from the shadow tree retarget to the
kernel host, so `pie-stage-change`, `pie-loading-complete` and the toolkit's
events reach a host listener once, with `sourceCe:
"pie-section-player-kernel-host"`.

### Default body

`attachKernelHostDefaultBody` mounts `SectionPlayerKernelHostBody` into the kernel
host's light DOM while the host has no element children, and follows the child
list through a `MutationObserver`. Text and comment children do not count. Slot
fallback content was the alternative and loses on placement: fallback content
lives in the shadow tree, out of reach of document styles, and stays mounted,
hidden, beside a host's own panes, which would register a second pane of each
kind.

### Layout context

`section-player-layout-context.ts` follows the card render context: a
`createContext` from `@pie-players/pie-context` keyed by
`Symbol.for("@pie-players/pie-section-player/layout-context")`, one
`ContextProvider` per kernel republished through `setValue`, and panes
subscribing with `connectContextWithRetry`. The global symbol lets a pane from one
copy of the package resolve a provider from another. The provider sits in the
kernel's tree, so a pane's request travels through the slot to the closest
section player and nested players resolve their own. A pane that connects before
its provider is answered when the provider announces itself. Hosts never import
the context.

The context carries the composition, the pre-warm inputs (renderables, their
signature, `preloadEnabled`), the resolved player env, attributes, props and
strategy, the heading level, the tool registry, toolbar tools and host buttons,
`elementsLoaded`, the active pane of each kind, and the panes' `register` and
`report*` callbacks. The panes take no props: no value a pane renders differs by
placement.

### Pane registry and readiness

`createSectionPlayerPaneRegistry` keeps each kind's panes in connection order,
and the first is active. The kernel accepts `reportWarmup` and the
pre-warm retry and error reports from the active items pane only, so readiness
follows exactly one pane and a pane that renders nothing cannot hold or release
`interactive`. A duplicate idles and takes over when the active pane disconnects.
The passages pane takes no part in readiness; it shows its loading card until
`elementsLoaded`.

Misplaced panes are reported through `console.warn`, once per section player: the
channel the toolkit, `pie-item-scope` and the item toolbar use for an element
placed where it cannot work, with the same "Reported once per ..." form.
`framework-error` was the alternative; it latches the cohort's error state, and a
layout mistake is the host's to fix in development. The duplicate check runs a
task after a second registration, so a layout that swaps a pane is not reported.
The missing-pane check runs a task after `section-ready` for a composition with
items; such a section never reaches `interactive`, because no pane runs the
pre-warm. A section with no items and no items pane does not complete either, and is
not reported.

### Stock layouts

Split-pane, vertical, tabbed (through `SectionPlayerTabbedContent` and
`SectionPlayerVerticalContent`) and the kernel host's default body all place the
same two panes. A new stock layout element is a `shadow: "none"` custom element
that renders `SectionPlayerLayoutKernel` with its own `sourceCe` and places the
panes in its markup, plus its registration in `src/pie-section-player.ts`.

## Removed architecture

The earlier orchestration path has been removed:

- `PieSectionPlayer.svelte`
- layout element wrappers under `src/components/layout-elements/*`
- internal layout components under `src/components/layouts/*`
- previous layout orchestrators and wrappers

## Consumer boundary note

Consumers should import package registration entrypoints from `exports` paths and avoid package source path imports.

# Section Player Architecture

This document is for contributors to `@pie-players/pie-section-player`: how the
package is assembled, how it drives the toolkit's runtime engine, and the rules
new layout and runtime work follows. Hosts integrating the player read the
[README](./README.md), which is the API reference.

The package exposes four section player custom elements:
`pie-section-player-splitpane`, `pie-section-player-vertical`,
`pie-section-player-tabbed` and `pie-section-player-kernel-host`.

## High-level flow

1. The host imports the package root, which registers every element.
2. The host sets `runtime` and `section` on the layout element; `env` travels as `runtime.env`.
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

## Public and internal contracts

- Host layout contract: `pie-section-player-kernel-host` and the two panes
  ([Custom layouts](#custom-layouts)).
- Card primitives: `pie-section-player-item-card` and `pie-section-player-passage-card`.
  - The panes pass the per-entity values (`item` or `passage`, `playerParams`, toolbar tools).
  - The card render context carries the shared render plumbing (resolved player tag and action).
- `pie-section-player-shell` places the section toolbar (`top`, `right`,
  `bottom`, `left` or `none`) around the layout body. The kernel renders it;
  hosts set it through `show-toolbar` and `toolbar-position` on the layout
  element.
- `pie-section-player-base` is the internal runtime contract. It handles the
  runtime, toolkit and session wiring and emits the composition events the
  kernel reads. The kernel renders it; no layout or host composes it directly.

## Layered runtime engine

The section player owns no runtime resolver, readiness deriver or stage emitter
of its own. Those live in `@pie-players/pie-assessment-toolkit` as a layered
runtime engine. The section player kernel owns the one engine per layout host
and is the only stage emitter. The toolkit custom element holds the section
controller and its session plumbing through `SectionControllerBinding`
([Controller ownership](#controller-ownership)).

### Architectural pieces

- **Engine core**: a pure, framework-free finite-state machine. Its inputs are
  the cohort (the `(sectionId, attemptId)` pair), the controller resolving, and
  readiness signals; its outputs are stage transitions and loading completion.
  It lives in
  [`assessment-toolkit/src/runtime/core/`](../assessment-toolkit/src/runtime/core/).
- **`SectionEngineAdapter`**: the I/O seam over the core. It hands each batch
  of outputs to the DOM event bridge and to `subscribe(...)` listeners
  ([source](../assessment-toolkit/src/runtime/adapter/SectionEngineAdapter.ts)).
- **`dom-event-bridge`**: dispatches `pie-stage-change` and
  `pie-loading-complete` on the layout host element, bubbling and composed.
- **`SectionRuntimeEngine`**: the facade the kernel drives, with `attachHost`,
  `dispatchInput`, `subscribe`, `getState` and `dispose`. It holds no controller
  ([source](../assessment-toolkit/src/runtime/SectionRuntimeEngine.ts)).
- **`SectionControllerBinding`**: the toolkit custom element's controller half.
  It resolves the section controller from the coordinator, keeps the registered
  item and passage shells, and forwards shell events, session updates and host
  commands to the controller
  ([source](../assessment-toolkit/src/runtime/SectionControllerBinding.ts)).
- **Resolvers**: `resolveRuntime`, `resolveToolsConfig` and
  `resolveSectionEngineRuntimeState` produce the effective runtime and tools
  snapshot the engine consumes
  ([source](../assessment-toolkit/src/runtime/core/engine-resolver.ts)).

### Section player wiring

The section player owns two pieces of glue:

- **`SectionPlayerLayoutKernel.svelte`** constructs one `SectionRuntimeEngine`
  per layout element, calls `attachHost({ host, sourceCe })`, and drives
  `dispatchInput(...)` from a single tracked `$effect` wrapped in
  `untrack(...)`. It learns that the controller resolved from `section-ready`,
  which carries the controller and its cohort, and latches the readiness error
  signal from the toolkit's bubbling `framework-error` by the error's `scope`. A
  toolkit bootstrap failure is held against the coordinator announced when it
  was reported, and clears when `toolkit-ready` announces another. Element
  pre-warm fails a section through the items pane's `reportWarmup`, which
  carries the renderables signature it ran for and counts only from the
  cohort's `section-ready`, so one section's pre-warm outcome never reaches the
  next.
- **`section-player-host-runtime.ts`**
  ([source](src/components/shared/section-player-host-runtime.ts)) is the
  player-coupled wrapper around the toolkit resolver. It holds
  `resolvePlayerRuntime`, `mapRenderablesToItems` and
  `resolveSectionPlayerRuntimeState`, the only resolver pieces that depend on
  section player defaults such as `DEFAULT_PLAYER_DEFINITIONS`. The layout
  kernel is its one caller, so no layout reaches into the toolkit core.
  `resolvePlayerRuntime` spreads every `runtime.player` field into the item
  player's properties, except `resolveBackend`, and adds `hosted: true` when
  `hosted` is unset and `backend.delivery` is enabled.

### Public toolkit entry points

- `@pie-players/pie-assessment-toolkit/runtime/engine`: the stable entry the
  layout kernel drives the engine through. It carries `SectionRuntimeEngine`,
  the `SectionEngineInput`, `SectionEngineOutput` and `SectionEngineState`
  vocabulary, the runtime config and its resolution (`RuntimeConfig`,
  `resolveSectionEngineRuntimeState`, the `DEFAULT_*` values), the cohort
  helpers and the readiness signals.
- `@pie-players/pie-assessment-toolkit/tools/registration`: the tool surface
  host and the tool registry the cards and overlays render registrations with.
- `@pie-players/pie-assessment-toolkit`: everything else, including
  `createShellEventBridge` for the passage shell.

The engine's core, adapter and bridges have no entry: the section player
reaches them only through the facade.

### Lifecycle emit invariant

One cohort is one event chain on the layout host: one `pie-stage-change` per
stage and one `pie-loading-complete`, whatever the wrapper depth. The kernel's
engine is the only emitter; `<pie-assessment-toolkit>` emits no stage events,
standalone or nested. A host that drives the engine itself follows the
"Common-host wiring example" in the
[toolkit README](../assessment-toolkit/README.md#section-runtime-engine-advanced).

## Controller ownership

The section player is controller-first. `SectionController` is the domain
authority for section-level state: navigation, the canonical aggregation of item
sessions, and the persistence snapshot. The custom elements (the layouts, the
base element, the item and passage shells) are transport adapters: DOM events,
context bridging and host wiring.

The coordinator creates each section's controller in
`getOrCreateSectionController`, through its `hooks.createSectionController`
when set and otherwise through the factory the toolkit element passes. The
section player supplies that factory as `runtime.createSectionController`, or
`() => new SectionController()` when the host sets none. The toolkit element
then holds the controller through `SectionControllerBinding`.

The section runtime creates no per-item controller instances; item behavior
aligns through shared session contracts. An aggregate-first controller avoids
dual ownership of item state and a lifecycle fan-out across many item instances.
The decision is revisited only on a concrete requirement for one of:

- independent per-item persistence and rehydration lifecycles
- per-item conflict and version resolution
- per-item plugin hook pipelines that cannot be expressed as pure helpers

An item controller here means a per-item counterpart of `SectionController`.
The PIE element's `controller` module, which builds view models and scores,
belongs to the item player.

## Configuration inputs: one tier per input

Each input of this package and `pie-assessment-toolkit` has exactly one entry
point, chosen by its kind:

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
parses the layout element sources and asserts that no `RuntimeConfig` key is a
layout prop and that every layout element declares the three attribute-only
inputs.

`resolveRuntime` and `resolveToolsConfig` in
[`engine-resolver.ts`](../assessment-toolkit/src/runtime/core/engine-resolver.ts)
(reached through `resolveSectionEngineRuntimeState` on
`@pie-players/pie-assessment-toolkit/runtime/engine`) fill `runtime`'s defaults
and take `toolConfigStrictness` from the element, defaulting to `error`;
[`engine-resolver.test.ts`](../assessment-toolkit/tests/runtime/core/engine-resolver.test.ts)
locks them. The section player wrapper (`resolvePlayerRuntime`,
`resolveSectionPlayerRuntimeState`) in
[`section-player-host-runtime.ts`](src/components/shared/section-player-host-runtime.ts)
is locked by [`tests/section-player-runtime.test.ts`](tests/section-player-runtime.test.ts).
A new runtime field goes through these helpers; an ad-hoc fall-through elsewhere
would give it a second resolution path.

### Inputs outside `RuntimeConfig`

These inputs are element props the resolver never sees:

- **Identity** (`section-id`, `attempt-id`, `section`, `session`): per-attempt
  host state. `session` is the section's session: the controller created for
  `section` applies it in place of hydrating from the persistence strategy.
- **Layout and shell attributes** (`show-toolbar`, `toolbar-position`,
  `base-heading-level`, `narrow-layout-breakpoint`,
  `content-max-width-no-passage`, `content-max-width-with-passage`,
  `split-pane-collapse-strategy`, `split-pane-min-region-width`,
  `split-pane-initial-passage-width`, `iife-bundle-host`, `debug`): rendering
  and pre-warm concerns. Each is a top-level prop and kebab-case attribute on the
  layout element that owns it.
- **Layout host data** (`policies`, `hooks`, `toolRegistry`,
  `sectionHostButtons`, `itemHostButtons`, `passageHostButtons`): read by the
  layout kernel through its top-level props and passed straight through to the
  kernel and scaffold.
- **Tool placement** is configured on the `tools` object as
  `runtime.tools.placement.section`, `.item` and `.passage`. The per-region
  toolbar strings the internal card and pane elements take are derived from
  those arrays.

`<pie-assessment-toolkit>` takes the runtime fields as its own properties:
`createSectionController` as a JavaScript-only prop, `isolation` as a property
or an `isolation` attribute (`inherit` or `force`), and its own `assessment-id`
attribute. The section player layouts forward `runtime.createSectionController`,
`runtime.isolation` and `runtime.assessmentId` to the wrapped toolkit; a
standalone host that needs to override coordinator inheritance passes an
explicit `coordinator={...}`.

### Canonical attribute set

The attribute set has the same shape across the section player elements:

- Identity: `section-id`, `attempt-id`
- Interface: `nds-icons`, `locale`
- Diagnostics: `tool-config-strictness`, and `debug` on the layouts and the
  kernel host. Framework errors reach a host through `runtime.onFrameworkError`
  and the `framework-error` DOM event, which the toolkit dispatches once,
  bubbling and composed ([Framework error contract](#framework-error-contract)).
- Layout and shell, on the layouts and the kernel host: `show-toolbar`,
  `toolbar-position`, `base-heading-level` and `iife-bundle-host`
- Layout dimensions, on the three layouts: `narrow-layout-breakpoint`,
  `content-max-width-no-passage` and `content-max-width-with-passage`, and on
  the splitpane `split-pane-collapse-strategy`, `split-pane-min-region-width`
  and `split-pane-initial-passage-width`

`pie-section-player-base` takes the identity, interface and
`tool-config-strictness` attributes only.

### When to add an attribute

Add an attribute only if all of the following hold:

- It is a common case that hosts set without composing a `runtime` object.
- Its value is a primitive that round-trips through HTML attributes (string,
  boolean-like, number); structured data passes through property assignment.
- It exists on every element that owns the same setting, or has a deliberate
  documented exclusion.

Otherwise expose it through `runtime` only.

## Runtime contract normalization

- `runtime` is the input for runtime fields.
- Toolbar visibility is normalized through shared boolean-like coercion before
  it reaches `pie-section-player-shell`.
- At or below `narrow-layout-breakpoint`, every layout passes `top` to the shell
  as the toolbar position, whatever `toolbar-position` says. The shell itself
  moves `left` and `right` to `top` at a fixed 1100px and renders no toolbar for
  `none`.

## Section player policies

`policies` resolves through `resolveSectionPlayerPolicies` against
`DEFAULT_SECTION_PLAYER_POLICIES`; for `preload` and `telemetry`, any value but
`false` means enabled.

- **Readiness.** The kernel gates readiness by `readiness.mode`. Both modes hold
  `interactive` and `pie-loading-complete` until the section's element pre-warm
  resolves and the item cards can mount. The kernel has no later loading
  signal, so the two modes currently emit the same sequence.
- **Pre-warm.** With `preload.enabled: false`, `SectionItemsPane` skips
  `warmupSectionElements` (in `components/shared/player-preload.ts`). Items
  still mount, and each item player registers its own elements on demand.
- **Telemetry.** With `telemetry.enabled: false`, the layout elements skip
  `attachInstrumentationEventBridge`, so no `pie-section-*` events reach the
  instrumentation provider. A host that wants another shape of opt-out
  overrides `runtime.player.loaderConfig.instrumentationProvider`.

## Unidirectional flow invariants

These invariants define the package architecture, and new layout and runtime
work preserves them:

1. Single source of truth
   - Toolkit and controller runtime state is authoritative for composition and
     session data ([Controller ownership](#controller-ownership)).
   - Layout components are render adapters for derived state and own no state
     of their own; no layout or card creates a competing source of truth for
     composition or session.
2. Directional data flow
   - Runtime input flows down from the layout props and the `runtime` object
     into the base, toolkit, card and player render paths.
   - Runtime updates flow up through events (`runtime-*`, `session-changed`,
     controller events) and are reconciled by their runtime owners. A child
     never mutates parent-owned state.
3. Non-structural updates are identity-stable
   - Response and session updates, tool toggles and text-to-speech config
     changes do not remount item or passage shells while content identity is
     unchanged.
4. Non-structural updates are scroll-stable
   - Pane-local scroll positions stay stable across session-only updates in the
     splitpane and vertical layouts.
5. Explicit precedence for shared card render wiring
   - Card player render wiring has one canonical source, the shared context
     from the layout scaffolding, with a prop fallback only when the context is
     unavailable.

### Non-structural update definition

These updates are non-structural and preserve identity and scroll:

- item response and session changes (`item-session-data-changed`, `item-session-meta-changed`)
- tool state toggles and config changes that keep the section content model
- runtime setting changes that keep item and passage renderable identity

A change to the section composition structure (added, removed or reordered
entities, new ids) may remount the affected nodes.

## Event delivery

The toolkit's events (`session-changed`, `composition-changed`,
`runtime-owned`, `runtime-inherited`, `runtime-ready`, `toolkit-ready`,
`section-ready`) reach the layout element and `document` by native bubbling
alone, so a listener on either receives each dispatch once. No section player
component re-dispatches them: a Svelte custom element's `addEventListener` also
subscribes to the component's own events, so a re-dispatch reaches every
listener on that element a second time. `framework-error` follows the contract
below.

The shells' events for their runtime (`pie-register`, `pie-unregister`,
`pie-item-session-changed`, `pie-content-loaded`, `pie-item-player-error`,
`pie-formative-action`, `pie-media-time-source`) stop at the toolkit that
handles them. A raw item player `session-changed` stops at its
`<pie-item-scope>`, which drops it when it repeats the last event that shell
forwarded, and otherwise forwards it to the runtime and, unless it carries only
metadata, as `item-session-changed`.

## Framework error contract

`framework-error` is the canonical error event for any failure that crosses the
framework boundary: coordinator initialization, runtime initialization, tool
configuration, provider and text-to-speech initialization, tool runtime. The
payload is a `FrameworkErrorModel` from `@pie-players/pie-assessment-toolkit`.

**Single-fire delivery.**

- The toolkit owns a package-internal `FrameworkErrorBus`. A single subscriber
  on `<pie-assessment-toolkit>` performs every side effect: the console log, the
  optional fallback banner for fatal bootstrap kinds, the DOM event and the
  callback.
- `onFrameworkError(model)` is delivered exactly once per error, however deep
  the section player wrapper stack. The layout elements, the kernel host and
  `pie-section-player-base` forward `runtime.onFrameworkError` through the
  effective runtime to `pie-section-player-base` and on to
  `pie-assessment-toolkit`.
- A coordinator the host passes as `runtime.coordinator` reports into a bus of
  its own. The toolkit subscribes to it and republishes each error on its bus,
  so those errors reach the same subscriber; the host coordinator's own hooks
  still receive them. They skip the toolkit's initialization banner, which
  replaces the section: the host that constructed the coordinator handles its
  failures.

**DOM event.** `<pie-assessment-toolkit>` dispatches one `framework-error` per
error, `bubbles: true, composed: true`, so it reaches the layout element and
`document` once. The kernel's listener at `<pie-section-player-base>` only
reads it: a non-recoverable error sets the readiness error signal, which ends
the stage chain with the current stage `failed`.
[`tests/section-player-event-delivery.spec.ts`](tests/section-player-event-delivery.spec.ts)
pins the event and callback counts on every layout element.

**Telemetry.** `pie-toolkit-framework-error` and `pie-section-framework-error`
are the instrumentation streams.

## Readiness stages

`pie-stage-change` is the readiness vocabulary across the section player and the
assessment toolkit: one typed transition stream a host subscribes to once and
correlates across wrapper depths. Its detail is a `StageChangeDetail`.

| Stage | Entered when |
| --- | --- |
| `composed` | The host-provided composition resolved: items and passages are present |
| `engine-ready` | Coordinator bring-up settled and the section controller initialized |
| `interactive` | The section controller is ready and the section's element pre-warm has resolved for the current items, so user input is accepted |
| `disposed` | The cohort changed or the element unmounted |

The section runtime engine derives the stages in order and resets on a cohort
change; the layout kernel emits them through the engine's DOM event bridge, and
each detail's `sourceCe` names the layout element. `status` is `entered`. A
non-recoverable framework error before `interactive` ends the chain: the first
stage the section did not reach is emitted `failed` and any after it `skipped`,
and `disposed` still follows on cohort change or unmount.

`pie-loading-complete` (detail `LoadingCompleteDetail`) is kernel-only and fires
once per cohort, on the condition of a layout element's `interactive`. The
items load after it; the controller's `section-loading-complete` marks them
loaded.

`runtime.onStageChange(detail)` and `runtime.onLoadingComplete(detail)` fire on
the kernel-backed elements (splitpane, vertical, tabbed, kernel host). The
kernel invokes each handler at the emit point of its DOM event, so callback and
event stay in lockstep across cohort changes. The base element and the toolkit
own no emit point; the two callbacks pass through them and never fire there. A
handler that throws is caught at the emit point and logged, so a faulty consumer
cannot break the stage pipeline.

## Verification matrix

| Behavior | Test |
| --- | --- |
| Forward-only controller events and runtime state bootstrap | `tests/section-player-event-panel.spec.ts` |
| Splitpane scroll stability on response selection | `tests/section-player-event-panel.spec.ts` |
| Vertical layout scroll stability on response selection | `tests/section-player-event-panel.spec.ts` |
| Item shell identity stability on session-only updates | `tests/section-player-event-panel.spec.ts` |
| Kernel host stock body, layout context resolution, pane registry and readiness rule | `tests/section-player-custom-layout.test.ts` |
| Host-built layout rendering and reaching `pie-loading-complete` | `tests/section-player-custom-layout.spec.ts` |

## Custom layouts

A layout is an arrangement of two panes under a section player. The kernel runs
the section, the panes render it, and the layout element owns only placement:
pane containers, dividers, tabs and backdrops. The stock layouts and a host's own
layout are built the same way.
[Custom Section Layouts](../../docs/section-player/custom-layouts.md) is the
host-facing contract.

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

## Consumer boundary

Consumers import the package through its `exports` paths, never through source
paths.

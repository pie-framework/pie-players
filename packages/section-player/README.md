# @pie-players/pie-section-player

Section rendering package with layout custom elements:

- `pie-section-player-splitpane`
- `pie-section-player-vertical`
- `pie-section-player-tabbed`

Use the layout custom elements listed above for section rendering.

## Install

```bash
npm install @pie-players/pie-section-player
```

## Runtime boundary and migration

- Browser-only package: `@pie-players/pie-section-player` registers custom elements and
  is intended for browser/DOM hosts, not plain Node runtime imports.
- Node-import-safe packages (for server/runtime utilities) are documented in
  `docs/setup/library-packaging-strategy.md`.
- Migration direction: prefer the stable default entry for side-effect registration:

```ts
import "@pie-players/pie-section-player";
```

If hosts need explicit registration control, keep using documented component
entrypoints under `@pie-players/pie-section-player/components/*`.

Standalone browser variants for this package are intentionally deferred; the
current supported contract is the default bundler entrypoints under `dist`.

## SectionController

`SectionController` is the domain authority inside a section player. It owns
in-section navigation state, the canonical aggregation of per-item sessions,
and the host-facing persistence snapshot. The layout custom elements
(`pie-section-player-splitpane` / `-vertical` / `-tabbed`) are transport
adapters around it. See
[`docs/section-player/controller-boundaries.md`](../../docs/section-player/controller-boundaries.md)
for the rationale behind that split, and
[`docs/section-player/client-architecture-tutorial.md`](../../docs/section-player/client-architecture-tutorial.md)
for the end-to-end walkthrough.

The handle implements `SectionControllerHandle` from
`@pie-players/pie-assessment-toolkit`; see the JSDoc on that interface for
the per-method contract.

### Obtaining the handle

```ts
const host = document.querySelector("pie-section-player-splitpane") as any;
const controller = await host.waitForSectionController?.(5000);
```

`waitForSectionController(timeoutMs)` resolves when the layout CE has wired
its controller (the same anchor `pie-stage-change` reaches with
`detail.stage === "engine-ready"`). Use `getSectionController()` if you've
already passed the readiness anchor synchronously.

### Session lifecycle

A typical host flow:

```ts
controller?.configureSessionPersistence?.({ context, strategy });
await controller?.hydrate?.();
const unsubscribe = controller?.subscribe?.(handleEvent);
// ...later, on save / unload:
await controller?.persist?.();
unsubscribe?.();
```

`getSession()` / `applySession(session, { mode })` / `updateItemSession(itemId,
detail)` are the direct read/write surfaces and exchange the same
`SectionControllerSessionState` shape the persistence strategy load/save
methods receive. See [Item session management](#item-session-management) for
worked examples.

### Event stream

The controller's typed event stream (`SectionControllerEvent` discriminated
union) is the single source of truth for in-section change. Hosts usually
subscribe through `ToolkitCoordinator.subscribeItemEvents` /
`subscribeSectionLifecycleEvents` (cohort-aware filtering, survives
navigation) — see [JS API example for advanced host
policy](#js-api-example-for-advanced-host-policy). Key event types:

- `item-selected` — item navigation within the current section.
- `item-session-data-changed` / `item-session-meta-changed` — per-item
  session updates the persistence layer should observe.
- `content-loaded` — passage / item / rubric finished loading.
- `section-loading-complete` — every renderable in the section finished
  loading.
- `section-items-complete-changed` — aggregate completion flip.
- `section-navigation-change` — the controller's section identity changed.

## Usage

Import the custom-element registration entrypoint in consumers:

```ts
import '@pie-players/pie-section-player/components/section-player-splitpane-element';
import '@pie-players/pie-section-player/components/section-player-vertical-element';
import '@pie-players/pie-section-player/components/section-player-tabbed-element';
import '@pie-players/pie-section-player/components/section-player-item-card-element';
import '@pie-players/pie-section-player/components/section-player-passage-card-element';
```

Render in HTML/Svelte/JSX:

```html
<pie-section-player-splitpane></pie-section-player-splitpane>
```

Set complex values (`runtime`, `section`, `env`) as JS properties.

## Runtime Inputs

Both layout elements support:

- `runtime` (object): primary coordinator/tools/player runtime bundle
- `section` (object): assessment section payload
- `env` (object): optional top-level override for `{ mode, role }`
- `debug` (boolean-like): verbose debug logging control (`"true"` enables, `"false"`/`"0"` disables)
- `toolbar-position` (string): `top|right|bottom|left|none`
- `narrow-layout-breakpoint` (number, optional): viewport width in px below which the layout collapses (split pane: single column; vertical: toolbar moves to top). Clamped to 400–2000; default 1100.
- `content-max-width-no-passage` (number, optional): max width in px when no passages exist. Clamped to 320–2200. Unset by default (layout uses available width).
- `content-max-width-with-passage` (number, optional): max width in px when passages are present. Clamped to 320–2200. Unset by default (layout uses available width).
- `split-pane-min-region-width` (number, optional): splitpane minimum pane width in px. Clamped to 160–1200. Unset by default (split bounds stay at 20–80). (Ignored by vertical layout; supported for API parity.)
- `split-pane-collapse-strategy` (string, optional): splitpane stacked-mode strategy. Supported values: `tabbed` (default) and `vertical`. (Ignored by vertical/tabbed layouts; supported for API parity.)
- `show-toolbar` (boolean-like): accepts `true/false` and common string forms (`"true"`, `"false"`, `"1"`, `"0"`, `"yes"`, `"no"`)
- Host extension props (JS properties only): `toolRegistry`, `sectionHostButtons`, `itemHostButtons`, `passageHostButtons`, `hooks`

When viewport width is within the collapsed range (~1100px and below), splitpane and
vertical layout hosts normalize section toolbar placement to `top`. This includes
`left`, `right`, `bottom`, and `none` values.

`hooks.cardTitleFormatter` remains active across responsive splitpane transitions (split -> stacked and stacked -> split), because title rendering is provided through shared card context rather than layout-specific state.

To opt into PIE-117 dimensions from a host, configure:

```html
<pie-section-player-splitpane
  content-max-width-no-passage="800"
  content-max-width-with-passage="1200"
  split-pane-min-region-width="280"
></pie-section-player-splitpane>
```

Use the same max-width attributes on `pie-section-player-vertical` when you want the same no-passage/with-passage width behavior in vertical mode.

To force splitpane stacked mode to use vertical rendering:

```html
<pie-section-player-splitpane
  narrow-layout-breakpoint="1100"
  split-pane-collapse-strategy="vertical"
></pie-section-player-splitpane>
```

By default, splitpane stacked mode uses tabs. The dedicated `pie-section-player-tabbed` layout also always renders passage/items tabs when passages are present.

### Tab styling hooks

`pie-section-player-tabbed` and splitpane `tabbed` collapse mode expose canonical `pie-*`
hooks for theming:

- `pie-section-player-tabs`
- `pie-section-player-tab`
- `pie-section-player-tab--active`
- `pie-section-player-tab-panel`

For theme compatibility with existing passage-label patterns, tabs also expose:

- `data-pie-purpose="passage-label"` and alias class `passage-label`
- `data-pie-purpose="item-label"` and alias class `item-label`

Tab colors, spacing, and track geometry can be themed via CSS variables:
`--pie-section-player-tab-color`, `--pie-section-player-tab-background`,
`--pie-section-player-tab-active-color`,
`--pie-section-player-tab-active-background`,
`--pie-section-player-tab-gap`,
`--pie-section-player-tab-track-radius`,
`--pie-section-player-tab-track-padding`, and
`--pie-section-player-tab-padding-block`.

### Card header styling hooks

Passage and item cards share a common header row
(`.pie-section-player-content-card-header`, with the card-specific aliases
`.pie-section-player-passage-header` / `.pie-section-player-item-header`).

- Title and toolbar are centered vertically by default. There is no prop or
  attribute for this — hosts needing a non-standard alignment should override
  the selector in their own stylesheet.
- The header fill is transparent by default. Hosts/themes opt into a color
  via the `--pie-section-player-card-header-background` CSS variable; the
  framework does not ship a brand palette.

Example (host CSS):

```css
pie-section-player-passage-card,
pie-section-player-item-card {
  --pie-section-player-card-header-background: #c9e5e6;
}
```

When both max-width attributes are set, the with-passage cap resolves to the greater
of the two configured values (after clamp), so with-passage mode never ends up narrower
than no-passage mode.

### API direction: CE defaults first, JS customization for advanced cases

The intended usage model is:

- **CE props for default/standard flows (roughly 90% use cases)**:
  - `assessment-id`, `section`, `section-id`, `attempt-id`, `debug`
  - `show-toolbar`, `toolbar-position`, `narrow-layout-breakpoint`
  - `content-max-width-no-passage`, `content-max-width-with-passage`, `split-pane-min-region-width`, `split-pane-collapse-strategy`
- **JS API for advanced customization**:
  - Get the controller handle via `getSectionController()` or `waitForSectionController()` (preferred)
  - Listen for `pie-stage-change` and filter on `detail.stage === "engine-ready"` for an event-driven entry point
  - Apply custom policy/gating in host code (for example, domain-specific `canNext` based on controller events like `section-items-complete-changed`)
  - Compose forward/backward eligibility in host code using `selectNavigation()` + host state; there is intentionally no separate parallel CE gating API for this
  - Inject custom toolbar tooling with `toolRegistry` and optional host button arrays (`sectionHostButtons`, `itemHostButtons`, `passageHostButtons`)
  - Register host callbacks via `hooks` (for example `hooks.cardTitleFormatter`)

Example:

```ts
const host = document.querySelector("pie-section-player-splitpane") as any;
host.hooks = {
  cardTitleFormatter: (context: any) => {
    if (context.kind === "item") {
      return `Question ${context.itemIndex + 1}: ${context.item?.name || context.defaultTitle}`;
    }
    return context.passage?.name || context.defaultTitle;
  },
};
```

Advanced runtime configuration is supplied through the `runtime` object. Set player config, tools, accessibility, coordinator, env, and `createSectionController` on `runtime.<key>`.

### Backend delivery for embedded items

Hosts can configure item-player backend delivery once at the section-player
runtime level. Section-player derives a concrete `backend` prop for each
embedded item player before it renders the item. This is intended for hosts such
as Quiz Engine that need server-processed PIE models and server scoring without
querying every nested `<pie-item-player>`.

```ts
import type {
  SectionPlayerRuntimeConfig,
} from "@pie-players/pie-section-player";

const runtime: SectionPlayerRuntimeConfig = {
  playerType: "iife",
  env: {
    mode: "gather",
    role: "student",
  },
  player: {
    backend: {
      delivery: {
        enabled: true,
        baseUrl: bffUrl,
        assignmentId: playerSessionId,
        endpoints: {
          load: "/api/player/load",
          saveSession: "/api/player/save",
          model: "/api/player/model",
          score: "/api/player/score",
        },
        autosave: { enabled: true, debounceMs: 250 },
      },
    },
  },
};

sectionPlayer.runtime = runtime;
```

When `runtime.player.backend.delivery` is enabled, section-player treats
`itemId` and `sessionId` as per-item delivery identity. It derives them from
`canonicalItemId || item.id` and the item session before forwarding `backend` to
each embedded item player. Static delivery fields such as `baseUrl`, `auth`,
`endpoints`, `assignmentId`, and `autosave` are preserved. Use `assignmentId`
for shared attempt/player identity.

`runtime.player.resolveBackend` is a section-player-reserved key. It is called
with `{ itemId, canonicalItemId, item, itemIndex, itemSession, sectionId, env,
baseBackend }` and is stripped before props reach `<pie-item-player>`. Use it
only when the backend needs custom per-item identity mapping. The resolver
receives cloned backend objects, so per-item identity changes do not mutate the
shared runtime configuration or leak across items.

Section-player only derives the concrete `backend` prop. It does not call
`loadFromBackend()` on nested item players. Embedded `<pie-item-player>` loads
automatically when its derived `backend.delivery` config has a load signature,
so every mounted item player issues one backend load for its own item. Passage
players do not receive item delivery backend config, but shared non-delivery
backend config is preserved.

This backend delivery config is separate from the element-loader backend used
for IIFE/ESM bundle preloading.

### Host-owned focus

Section-player does not move focus on behalf of host-level affordances such
as "Skip to Main", nor does it make passage/question containers tab stops.
Hosts own page chrome, skip links, landmarks, and any special focus placement.
For example, Quiz Engine's Fixed Player shell can focus its own
`main#main-content`; the next Tab then follows the browser's natural order
into the first actionable control rendered inside the section player.

The passage and item card custom elements are content/layout surfaces, not
public focus targets. Splitpane passage content remains scrollable through the
pane's native scroll behavior, but the passage pane itself is not inserted into
sequential keyboard navigation.

```html
<a href="#main-content" class="skip-link">Skip to Main</a>
<main id="main-content" tabindex="-1">
  <pie-section-player-splitpane></pie-section-player-splitpane>
</main>
```

**Wired policy toggles.** Each `SectionPlayerPolicies` field has a real
runtime effect; nothing in this surface is decorative.

- `readiness.mode` (`"progressive"` | `"strict"`) — drives readiness-event
  emission via `createReadinessDetail` in `SectionPlayerLayoutKernel`.
- `preload.enabled` — when `false`, `SectionItemsPane` short-circuits the
  section-level element warmup pipeline (`warmupSectionElements`). Items
  still mount and item-players register their own elements on demand. Use
  this to disable section pre-warm when the host already owns element
  registration end-to-end. Default: `true`.
- `telemetry.enabled` — when `false`, the layout custom elements skip
  `attachInstrumentationEventBridge` setup, so no `pie-section-*`
  telemetry events flow through the bridge. Hosts that want a different
  shape of opt-out can still override `runtime.player.loaderConfig.instrumentationProvider`.
  Default: `true`.

The exported `isPreloadEnabled(policies)` and `isTelemetryEnabled(policies)`
helpers read these toggles with the documented default-true semantics, so
host code that needs to mirror the same gate (e.g. when composing a custom
layout host) can call them directly.

### Navigation signals

- `item-selected`: item-level navigation change within the current section in the `SectionController` broadcast stream (`itemIndex`, `currentItemId`, `totalItems`).
- `section-navigation-change`: section-level navigation/selection change in the `SectionController` broadcast stream (`previousSectionId`, `currentSectionId`, `reason`).

Runtime configuration is explicit:

- `runtime` owns runtime fields (`assessmentId`, `playerType`, `player`, `lazyInit`, `tools`, `accessibility`, `coordinator`, `isolation`, `env`, `createSectionController`).
- Tool placement is configured through `runtime.tools.placement.section`, `runtime.tools.placement.item`, and `runtime.tools.placement.passage`.
- Tool configuration validation is canonical in toolkit initialization (`pie-assessment-toolkit`), including toolbar overlays. Use `runtime.toolConfigStrictness` (`off` | `warn` | `error`) to control warning-only vs fail-fast behavior.
- TTS provider config must use `tools.providers.textToSpeech` (canonical). `tools.providers.tts` is rejected by validation.
- Host tool overrides are additive:
  - `toolRegistry` overrides the default toolbar registry when provided
  - host buttons are appended per toolbar scope via `sectionHostButtons`, `itemHostButtons`, `passageHostButtons`

Debug logging can be controlled per section-player host:

- Enable: `<pie-section-player-splitpane debug="true">`
- Disable: `<pie-section-player-splitpane debug="false">` (or `debug="0"`)

You can also disable globally via `window.PIE_DEBUG = false`.

See the progressive demo routes in `apps/section-demos/src/routes/(demos)` (for example `single-question/+page.svelte` and `session-hydrate-db/+page.svelte`) for end-to-end host integrations.

## Data flow and stability guarantees

Section-player follows a unidirectional flow model:

- Inputs flow downward (`runtime`, `section`, `env`, toolbar options) into base/toolkit/layout/card render paths.
- State updates flow upward as events (`runtime-*`, `session-changed`, controller change events) and are reconciled by runtime owners.
- Layout/card components should not create competing sources of truth for composition/session.

### Stability guarantees

For non-structural updates, section-player guarantees behavior stability:

- Item/passage shell identity remains stable (no remount churn for response-only updates).
- Pane-local scroll position remains stable in splitpane and vertical layouts.

Non-structural updates include:

- response/session updates
- tool toggles/config updates
- runtime config changes that do not alter composition identity

Structural composition changes (new/removed/reordered entities) may legitimately re-render/remount affected nodes.

## Custom layout authoring

For section layout authors, `pie-section-player-shell` is the primary abstraction:

- Use `pie-section-player-shell` to place the section toolbar around your layout body.
- Keep your custom layout logic focused on passages/items and layout UI.
- Treat `pie-section-player-base` as internal runtime plumbing that wraps the shell.
- Use `pie-section-player-item-card` and `pie-section-player-passage-card` as reusable card primitives.
- Prefer shared context for cross-cutting card render plumbing (resolved player tag/action) over repeated prop drilling.

Minimal pattern for package layout components:

```svelte
<pie-section-player-base runtime={effectiveRuntime} {section} section-id={sectionId} attempt-id={attemptId}>
  <pie-section-player-shell
    show-toolbar={showToolbar}
    toolbar-position={toolbarPosition}
    toolRegistry={toolRegistry}
    sectionHostButtons={sectionHostButtons}
  >
    <!-- layout-specific body -->
    <pie-section-player-passage-card
      passage={passage}
      playerParams={passagePlayerParams}
      passageToolbarTools={passageToolbarTools}
      toolRegistry={toolRegistry}
      hostButtons={passageHostButtons}
    ></pie-section-player-passage-card>
    <pie-section-player-item-card
      item={item}
      canonicalItemId={canonicalItemId}
      playerParams={itemPlayerParams}
      itemToolbarTools={itemToolbarTools}
      toolRegistry={toolRegistry}
      hostButtons={itemHostButtons}
    ></pie-section-player-item-card>
  </pie-section-player-shell>
</pie-section-player-base>
```

### JS API example for advanced host policy

```ts
const host = document.querySelector("pie-section-player-splitpane") as any;
const controller = await host.waitForSectionController?.(5000);
let sectionComplete = false;

const unsubscribe = controller?.subscribe?.((event: any) => {
  if (event?.type === "section-items-complete-changed") {
    sectionComplete = event.complete === true;
  }
});

function canAdvance() {
  const nav = host.selectNavigation?.();
  return Boolean(nav?.canNext && sectionComplete);
}
```

If you already have a `ToolkitCoordinator`, prefer helper subscriptions for host logic. Subscriptions follow the toolkit's active section cohort automatically — a single subscribe call survives navigation:

```ts
const unsubscribeItem = coordinator.subscribeItemEvents({
  listener: (event: any) => {
    // item-scoped stream
  },
});

const unsubscribeSection = coordinator.subscribeSectionLifecycleEvents({
  listener: (event: any) => {
    // section-loading-complete / section-items-complete-changed / section-error / section-navigation-change
  },
});
```

Subscribe **after** the first `getOrCreateSectionController(...)` resolves (or after `toolkit-ready` once the section player has fully wired its controller — typically the safest anchor in host code is `toolkit-ready` followed by the first controller-resolve). Calling subscribe before any cohort exists throws.

Use `subscribeSectionEvents(...)` only for advanced mixed filtering requirements.

> **Upgrading from `<0.3.35`?** The `sectionId` / `attemptId` arguments on `subscribeItemEvents` / `subscribeSectionLifecycleEvents` / `subscribeSectionEvents` were dropped — subscriptions now follow the toolkit's active section cohort automatically and migrate across navigation. See the **"Migrating from `<0.3.35`"** section in [`@pie-players/pie-assessment-toolkit`](../assessment-toolkit/README.md#migrating-from-0335-breaking--pre-10) for the full upgrade recipe.

### Item-level observability configuration

Item-level resource observability is configured on the embedded `pie-item-player` via
`loaderConfig`. In section-player integrations, pass this through `runtime.player.loaderConfig`.

```ts
import { ConsoleInstrumentationProvider } from "@pie-players/pie-players-shared";

const provider = new ConsoleInstrumentationProvider({ useColors: true });
await provider.initialize({ debug: true });

sectionPlayerEl.runtime = {
  playerType: "esm",
  player: {
    loaderConfig: {
      trackPageActions: true,
      instrumentationProvider: provider,
      maxResourceRetries: 3,
      resourceRetryDelay: 500,
    },
    loaderOptions: {
      esmCdnUrl: "https://cdn.jsdelivr.net/npm",
    },
  },
};
```

Important:

- `loaderOptions` controls bundle loading. `loaderConfig` controls runtime resource monitoring.
- Custom providers (functions/instances) must be passed as JS properties (`runtime` object), not serialized string attributes.

### Instrumentation ownership and semantics

Section-player instrumentation is provider-agnostic and uses the shared
`InstrumentationProvider` contract.

- Canonical provider path: `runtime.player.loaderConfig.instrumentationProvider`
- With `trackPageActions: true`, missing/`undefined` providers use the default New Relic provider path.
- `instrumentationProvider: null` explicitly disables instrumentation.
- Invalid provider objects are ignored (optional debug warning), also no-op.
- Existing `item-player` behavior is preserved.
- For local debug overlays, compose providers (for example `NewRelicInstrumentationProvider` + `DebugPanelInstrumentationProvider`) through `CompositeInstrumentationProvider`.
- Toolkit telemetry forwarding uses the same provider path, so tool/backend
  operational events are visible alongside section events when toolkit is mounted.

Canonical lifecycle stream (engine-routed, dispatched on the outer layout CE):

- `pie-stage-change` — single typed transition stream covering
  `composed` → `engine-ready` → `interactive` → `disposed`. Payload is a
  `StageChangeDetail`.
- `pie-loading-complete` — fires once per cohort when every item has
  loaded (kernel-routed; gated on `interactive`).
- `framework-error` — canonical error event for any failure crossing the
  framework boundary. Payload is a `FrameworkErrorModel`. The toolkit's
  package-internal `FrameworkErrorBus` and the `onFrameworkError`
  callback prop deliver each error exactly once regardless of wrapper
  depth. The `framework-error` *DOM event* on the outer layout CE
  also delivers each error exactly once: the kernel listener at
  `<pie-section-player-base>` intercepts the toolkit's bubbled emit
  and calls `event.stopPropagation()`, leaving only the canonical
  engine-bridge emit on the layout host. The single-emit contract is
  pinned by `tests/section-player-framework-error-dual-emit.test.ts`.
  Direct listeners attached to `<pie-assessment-toolkit>` itself
  still see the toolkit's own emit.

Callback-prop mirrors with two-tier precedence (`runtime.<key>` wins over
the top-level prop):

- `onStageChange(detail)` — on every layout CE, `pie-section-player-base`,
  and `pie-assessment-toolkit`.
- `onLoadingComplete(detail)` — on the kernel-backed layout CEs only
  (split-pane / vertical / tabbed / kernel-host).
- `onFrameworkError(model)` — on every layout CE and
  `pie-section-player-base`. Fires exactly once per error regardless of
  wrapper depth (delivered through the package-internal
  `FrameworkErrorBus`). The `framework-error` DOM event on the layout
  CE host is also single-fire; consume either.

Section-player owned instrumentation stream:

- `pie-section-stage-change`
- `pie-section-loading-complete`
- `pie-section-session-changed`
- `pie-section-composition-changed`
- `pie-section-framework-error`

Build consumers against these canonical lifecycle events:

- `readiness-change` → listen for `pie-stage-change`. The readiness
  payload is also available via `selectReadiness()` /
  `getSnapshot().readiness` on the layout CE.
- `interaction-ready` → `pie-stage-change` filtered on
  `detail.stage === "interactive"`.
- `ready` → `pie-loading-complete`.
- `section-controller-ready` → call
  `waitForSectionController(timeoutMs)` or `getSectionController()`
  on the layout CE, or filter `pie-stage-change` for
  `detail.stage === "engine-ready"`.

If toolkit is mounted, toolkit lifecycle events are emitted on a separate
`pie-toolkit-*` stream. This separation avoids semantic overlap; bridge dedupe
is a defensive safety net only.

Toolkit tool/backend operational stream:

- `pie-tool-init-start|success|error`
- `pie-tool-backend-call-start|success|error`
- `pie-tool-library-load-start|success|error`

### Item session management

Section session data can be managed either through persistence hooks or directly through the controller API.

```ts
const host = document.querySelector("pie-section-player-splitpane") as any;
const controller = await host.waitForSectionController?.(5000);

// Read current section session snapshot.
const currentSession = controller?.getSession?.();

// Replace section session state (resume from backend snapshot).
await controller?.applySession?.({
  currentItemIndex: 0,
  visitedItemIdentifiers: ["q1"],
  itemSessions: {
    q1: {
      itemIdentifier: "q1",
      pieSessionId: "q1-session",
      session: { id: "q1-session", data: [{ id: "choice", value: "a" }] }
    }
  }
}, { mode: "replace" });

// Update a single item session directly.
await controller?.updateItemSession?.("q1", {
  session: { id: "q1-session", data: [{ id: "choice", value: "b" }] },
  complete: true,
});
```

The same controller snapshot is what the persistence strategy saves/loads.
When a controller is reused for the same `sectionId`/`attemptId`, `updateInput()` refreshes composition input while preserving in-memory section session data.

## Content trust boundary

Section-player layouts embed `<pie-item-player>` elements for each item.
Item and passage markup is sanitized by default via DOMPurify; see
[pie-item-player README](./README.md#content-trust-boundary)
property. Hosts can forward those settings through the section-player
`runtime.player` overrides — the runtime flattens these onto the embedded
`<pie-item-player>` instance, so any field not recognized by the kernel is
passed straight through as a prop/attribute:

```ts
const runtime = {
  playerType: "iife",
  player: {
    trustMarkup: false, // default, keeps DOMPurify on
    // sanitizeMarkup: (html) => myCustomSanitize(html),
  },
};
```

Set `trustMarkup: true` only when the section payload is guaranteed to be
produced by a trusted pipeline.

## Exports

Published exports are intentionally minimal:

- `@pie-players/pie-section-player`
- `@pie-players/pie-section-player/components/section-player-splitpane-element`
- `@pie-players/pie-section-player/components/section-player-vertical-element`
- `@pie-players/pie-section-player/components/section-player-tabbed-element`
- `@pie-players/pie-section-player/components/section-player-kernel-host-element`
- `@pie-players/pie-section-player/components/section-player-shell-element`
- `@pie-players/pie-section-player/components/section-player-item-card-element`
- `@pie-players/pie-section-player/components/section-player-passage-card-element`
- `@pie-players/pie-section-player/components/section-player-items-pane-element`
- `@pie-players/pie-section-player/components/section-player-passages-pane-element`
- `@pie-players/pie-section-player/contracts/layout-contract`
- `@pie-players/pie-section-player/contracts/public-events`
- `@pie-players/pie-section-player/contracts/runtime-host-contract`
- `@pie-players/pie-section-player/contracts/layout-parity-metadata`
- `@pie-players/pie-section-player/contracts/host-hooks`
- `@pie-players/pie-section-player/policies`

## Development

```bash
bun run --cwd packages/section-player dev
bun run --cwd packages/section-player check
bun run --cwd packages/section-player build
```

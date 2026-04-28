# @pie-players/pie-section-player

Section rendering package with layout custom elements:

- `pie-section-player-splitpane`
- `pie-section-player-vertical`
- `pie-section-player-tabbed`

The package no longer exposes the legacy `pie-section-player` layout orchestration API.

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
- `split-pane-min-region-width` (number, optional): splitpane minimum pane width in px. Clamped to 160–1200. Unset by default (legacy split bounds stay at 20–80). (Ignored by vertical layout; supported for API parity.)
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

Tab colors/spacing can be themed via CSS variables such as:
`--pie-section-player-tab-color`, `--pie-section-player-tab-active-color`,
`--pie-section-player-tab-indicator-color`, and `--pie-section-player-tab-spacing`.

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
  - `enabled-tools` (per-region tool placement is configured via `tools.placement.{item,passage}`; the `item-toolbar-tools` / `passage-toolbar-tools` aliases were removed in the broad architecture review compat sweep)
- **JS API for advanced customization**:
  - Get the controller handle via `getSectionController()` or `waitForSectionController()` (preferred)
  - Listen for `pie-stage-change` and filter on `detail.stage === "engine-ready"` for an event-driven entry point
  - The legacy `section-controller-ready` event is still emitted by the kernel during the 0.x compatibility window but is `@deprecated since M6`
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

Advanced CE props are still supported as escape hatches (`runtime`, `coordinator`, etc.), but hosts should prefer JS/controller composition for non-standard behavior. Note: `createSectionController` is **runtime-only** — set it on `runtime.createSectionController` rather than as a top-level CE prop (the prop alias was removed in the broad architecture review compat sweep).

### Focus management

Section-player owns its own focus contract so hosts can integrate a
"Skip to Main" affordance and keyboard navigation without re-encoding
the passage-first rule.

**Public focus targets.** Both card custom elements are `tabindex="-1"`
(programmatically focusable, never in sequential tab order) and expose a
`:focus-visible` outline:

- `<pie-section-player-passage-card>` (when the section has a passage)
- `<pie-section-player-item-card>`

The inner `.pie-section-player-content-card[data-section-item-card]`
selector is an internal back-compat hook and is not part of the public
contract — prefer querying the custom element tags.

**Declarative control.** The `SectionPlayerFocusPolicy.autoFocus` strategy
governs focus on every navigation event (Next / Back / `navigateTo`) and is
also honored by the imperative `focusStart()`:

- `"start-of-content"` *(default)* — focus the passage card when present,
  otherwise the first item card. Matches the canonical assessment UX where
  Skip-to-Main and navigation land in the same place. Best for
  one-item-per-page layouts (splitpane, tabbed).
- `"current-item"` — focus the newly-active item card (queried as
  `pie-section-player-item-card[is-current]`). Best for stacked/list
  layouts where multiple items are visible at once (vertical, custom
  kernel-host variants). Works in both paginated and keep-together
  sections — QTI 3 `keep-together` is a pagination hint only and does
  not disable item-level navigation or current-item tracking.
- `"none"` — framework never moves focus on navigation; the host owns it
  entirely. `focusStart()` still moves focus (defaults to
  start-of-content) because hosts only call it when they *want* focus to
  move.

```ts
const host = document.querySelector("pie-section-player-splitpane") as any;
host.policies = {
  readiness: { mode: "progressive" },
  preload: { enabled: true },
  focus: { autoFocus: "start-of-content" },
  telemetry: { enabled: true },
};
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
- `focus.autoFocus` — focus strategy on navigation; see "Focus management"
  above.
- `telemetry.enabled` — when `false`, the layout custom elements skip
  `attachInstrumentationEventBridge` setup, so no `pie-section-*`
  telemetry events flow through the bridge. Hosts that want a different
  shape of opt-out can still override `runtime.player.loaderConfig.instrumentationProvider`.
  Default: `true`.

The exported `isPreloadEnabled(policies)` and `isTelemetryEnabled(policies)`
helpers read these toggles with the documented default-true semantics, so
host code that needs to mirror the same gate (e.g. when composing a custom
layout host) can call them directly.

**Imperative escape hatch (host-owned focus moments).** Every layout
element (`pie-section-player-splitpane`, `-vertical`, `-tabbed`,
`-kernel-host`, and `-base`) exposes a `focusStart(): boolean` method.
Call it from host-owned affordances the framework cannot observe — most
commonly a "Skip to Main" button in the host's ribbon:

```ts
document.querySelector("pie-section-player-splitpane")?.focusStart();
```

`focusStart()` honors the `autoFocus` strategy so Skip-to-Main lands
wherever the host has opted in for navigation focus:

- `"start-of-content"` *(default)* → passage card when present, else first
  item card.
- `"current-item"` → the item card currently marked `is-current`, falling
  back to start-of-content if no current item is resolvable.
- `"none"` → start-of-content (hosts call `focusStart()` precisely
  because they want focus to move).

For Next / Back / question-number navigation the host does **not** call
`focusStart()` — the `autoFocus` policy fires automatically.

**Deprecation.** `SectionPlayerFocusPolicy.autoFocusFirstItem` still
works for one release (mapped onto `autoFocus`: `true` →
`"start-of-content"`, `false` → `"none"`) and emits a one-time console
warning. It will be removed in the next major. Migrate to `autoFocus`.

### Navigation signals

- `item-selected`: item-level navigation change within the current section in the `SectionController` broadcast stream (`itemIndex`, `currentItemId`, `totalItems`).
- `section-navigation-change`: section-level navigation/selection change in the `SectionController` broadcast stream (`previousSectionId`, `currentSectionId`, `reason`).

Runtime precedence is explicit:

- `runtime` values are primary for runtime fields (`assessmentId`, `playerType`, `player`, `lazyInit`, `tools`, `accessibility`, `coordinator`, `isolation`, `env`). `createSectionController` is exposed only via `runtime.createSectionController`.
- Top-level runtime-like props remain compatibility inputs and are merged with `runtime` values. For `player`, top-level values are merged first, then `runtime.player` overrides. Nested `loaderOptions` and `loaderConfig` are also merged with the same precedence.
- The section-level toolbar placement override (`enabled-tools`) is normalized on top of the runtime tools config and merges into `tools.placement.section`. Per-region placement (`tools.placement.item` / `tools.placement.passage`) is configured directly on the canonical `tools` / `runtime.tools` object — the deprecated `item-toolbar-tools` / `passage-toolbar-tools` aliases were removed in the broad architecture review compat sweep.
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
    enabled-tools={enabledTools}
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

If you already have a `ToolkitCoordinator` from `toolkit-ready`, prefer helper subscriptions for host logic:

```ts
const unsubscribeItem = coordinator.subscribeItemEvents({
  sectionId,
  attemptId,
  listener: (event: any) => {
    // item-scoped stream
  },
});

const unsubscribeSection = coordinator.subscribeSectionLifecycleEvents({
  sectionId,
  attemptId,
  listener: (event: any) => {
    // section-loading-complete / section-items-complete-changed / section-error / section-navigation-change
  },
});
```

Use `subscribeSectionEvents(...)` only for advanced mixed filtering requirements.

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
  `StageChangeDetail`. Replaces the legacy readiness vocabulary.
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
  still see the toolkit's own emit. The previous dual-emit on the
  layout host was removed in the broad architecture review compat
  sweep.

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
  CE host is also single-fire post-compat-sweep; consume either.

Section-player owned instrumentation stream:

- `pie-section-stage-change`
- `pie-section-loading-complete`
- `pie-section-controller-ready`
- `pie-section-session-changed`
- `pie-section-composition-changed`
- `pie-section-framework-error`

The deprecated readiness aliases (`readiness-change`,
`interaction-ready`, `ready`) and their `legacy-event-bridge` were
removed in the broad architecture review compat sweep. Migrate
consumers as follows:

- `readiness-change` → listen for `pie-stage-change`. The readiness
  payload is also available via `selectReadiness()` /
  `getSnapshot().readiness` on the layout CE.
- `interaction-ready` → `pie-stage-change` filtered on
  `detail.stage === "interactive"`.
- `ready` → `pie-loading-complete`.
- `section-controller-ready` is still dispatched by the kernel's
  Svelte `createEventDispatcher` (forwarded by each layout CE wrapper)
  and is **not** part of this compat removal. New host code should
  prefer `coordinator.waitForSectionController(sectionId, attemptId)`
  or `pie-stage-change` filtered on `detail.stage === "engine-ready"`.

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

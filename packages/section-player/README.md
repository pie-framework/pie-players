# @pie-players/pie-section-player

Section rendering package with layout custom elements:

- `pie-section-player-splitpane`
- `pie-section-player-vertical`

The package no longer exposes the legacy `pie-section-player` layout orchestration API.

## Install

```bash
npm install @pie-players/pie-section-player
```

## Usage

Import the custom-element registration entrypoint in consumers:

```ts
import '@pie-players/pie-section-player/components/section-player-splitpane-element';
import '@pie-players/pie-section-player/components/section-player-vertical-element';
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
- `toolbar-position` (string): `top|right|bottom|left|none`
- `narrow-layout-breakpoint` (number, optional): viewport width in px below which the layout collapses (split pane: single column; vertical: toolbar moves to top). Clamped to 400–2000; default 1100.
- `show-toolbar` (boolean-like): accepts `true/false` and common string forms (`"true"`, `"false"`, `"1"`, `"0"`, `"yes"`, `"no"`)

### API direction: CE defaults first, JS customization for advanced cases

The intended usage model is:

- **CE props for default/standard flows (roughly 90% use cases)**:
  - `assessment-id`, `section`, `section-id`, `attempt-id`
  - `show-toolbar`, `toolbar-position`, `narrow-layout-breakpoint`, `enabled-tools`, `item-toolbar-tools`, `passage-toolbar-tools`
- **JS API for advanced customization**:
  - Get the controller handle via `getSectionController()` or `waitForSectionController()`
  - Listen to `section-controller-ready`
  - Apply custom policy/gating in host code (for example, domain-specific `canNext` based on controller events like `section-items-complete-changed`)
  - Compose forward/backward eligibility in host code using `selectNavigation()` + host state; there is intentionally no separate parallel CE gating API for this

Advanced CE props are still supported as escape hatches (`runtime`, `coordinator`, `createSectionController`, etc.), but hosts should prefer JS/controller composition for non-standard behavior.

### Navigation signals

- `item-selected`: item-level navigation change within the current section in the `SectionController` broadcast stream (`itemIndex`, `currentItemId`, `totalItems`).
- `section-navigation-change`: section-level navigation/selection change in the `SectionController` broadcast stream (`previousSectionId`, `currentSectionId`, `reason`).

Runtime precedence is explicit:

- `runtime` values are primary for runtime fields (`assessmentId`, `playerType`, `player`, `lazyInit`, `tools`, `accessibility`, `coordinator`, `createSectionController`, `isolation`, `env`).
- Top-level runtime-like props are treated as compatibility/override inputs when a corresponding `runtime` field is absent.
- Toolbar placement overrides (`enabled-tools`, `item-toolbar-tools`, `passage-toolbar-tools`) are normalized on top of the runtime tools config.

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
  >
    <!-- layout-specific body -->
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

## Exports

Published exports are intentionally minimal:

- `@pie-players/pie-section-player`
- `@pie-players/pie-section-player/components/section-player-splitpane-element`
- `@pie-players/pie-section-player/components/section-player-vertical-element`
- `@pie-players/pie-section-player/components/section-player-kernel-host-element`
- `@pie-players/pie-section-player/components/section-player-shell-element`
- `@pie-players/pie-section-player/components/section-player-item-card-element`
- `@pie-players/pie-section-player/components/section-player-passage-card-element`
- `@pie-players/pie-section-player/contracts/layout-contract`
- `@pie-players/pie-section-player/contracts/public-events`
- `@pie-players/pie-section-player/contracts/runtime-host-contract`
- `@pie-players/pie-section-player/contracts/layout-parity-metadata`
- `@pie-players/pie-section-player/policies`

## Development

```bash
bun run --cwd packages/section-player dev
bun run --cwd packages/section-player check
bun run --cwd packages/section-player build
```

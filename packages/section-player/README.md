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
- `show-toolbar` (boolean-like): accepts `true/false` and common string forms (`"true"`, `"false"`, `"1"`, `"0"`, `"yes"`, `"no"`)

Runtime precedence is explicit:

- `runtime` values are primary for runtime fields (`assessmentId`, `playerType`, `player`, `lazyInit`, `tools`, `accessibility`, `coordinator`, `createSectionController`, `isolation`, `env`).
- Top-level runtime-like props are treated as compatibility/override inputs when a corresponding `runtime` field is absent.
- Toolbar placement overrides (`enabled-tools`, `item-toolbar-tools`, `passage-toolbar-tools`) are normalized on top of the runtime tools config.

See `apps/section-demos/src/routes/demo/[[id]]/+page.svelte` for an end-to-end host integration.

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

## Exports

Published exports are intentionally minimal:

- `@pie-players/pie-section-player`
- `@pie-players/pie-section-player/components/section-player-splitpane-element`
- `@pie-players/pie-section-player/components/section-player-vertical-element`
- `@pie-players/pie-section-player/components/section-player-shell-element`
- `@pie-players/pie-section-player/components/section-player-item-card-element`
- `@pie-players/pie-section-player/components/section-player-passage-card-element`

## Development

```bash
bun run --cwd packages/section-player dev
bun run --cwd packages/section-player check
bun run --cwd packages/section-player build
```

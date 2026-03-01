# @pie-players/pie-section-player

Section rendering package focused on the splitpane custom element:

- `pie-section-player-splitpane`

The package no longer exposes the legacy `pie-section-player` layout orchestration API.

## Install

```bash
npm install @pie-players/pie-section-player
```

## Usage

Import the custom-element registration entrypoint in consumers:

```ts
import '@pie-players/pie-section-player/components/section-player-splitpane-element';
```

Render in HTML/Svelte/JSX:

```html
<pie-section-player-splitpane></pie-section-player-splitpane>
```

Set complex values (`runtime`, `section`, `env`) as JS properties.

## Runtime Inputs

`pie-section-player-splitpane` supports:

- `runtime` (object): coordinator/tools/player runtime bundle
- `section` (object): assessment section payload
- `env` (object): `{ mode, role }`
- `view` (string): candidate/scorer view mode
- `toolbar-position` (string): `top|right|bottom|left|none`
- `show-toolbar` (boolean)

See `apps/section-demos/src/routes/demo/[[id]]/+page.svelte` for an end-to-end host integration.

## Exports

Published exports are intentionally minimal:

- `@pie-players/pie-section-player`
- `@pie-players/pie-section-player/components/section-player-splitpane-element`

## Development

```bash
bun run --cwd packages/section-player dev
bun run --cwd packages/section-player check
bun run --cwd packages/section-player build
```

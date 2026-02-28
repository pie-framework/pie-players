# Unified `pie-item-player` Strategies

`@pie-players/pie-item-player` is a single custom-element tag that supports multiple loading strategies:

- `iife` - dynamic bundle loading from a bundle host
- `esm` - dynamic module loading from an ESM CDN
- `preloaded` - skip loading and assume the host preloaded required elements

## Basic standalone usage

```html
<pie-item-player
  strategy="iife"
  config='{"elements":{},"models":[],"markup":"<div></div>"}'
  env='{"mode":"gather","role":"student"}'
  session='{"id":"session-1","data":[]}'
></pie-item-player>
```

Use the `loaderOptions` property for strategy-specific configuration:

```ts
const player = document.querySelector("pie-item-player");
player.loaderOptions = {
  bundleHost: "https://proxy.pie-api.com/bundles",
  esmCdnUrl: "https://esm.sh",
  view: "delivery",
};
```

## Strategy contract

### `strategy="iife"`

- Uses IIFE bundles through `IifePieLoader`
- Supports delivery and author modes
- Best when using PIE bundle host infrastructure

Recommended options:

```ts
player.loaderOptions = {
  bundleHost: "https://proxy.pie-api.com/bundles",
};
```

### `strategy="esm"`

- Uses `EsmPieLoader` and import-map based module loading
- Selects views (`delivery`, `author`, `print`) via module subpaths
- Best when using modern ESM-compatible element packages

Recommended options:

```ts
player.loaderOptions = {
  esmCdnUrl: "https://esm.sh",
  view: "delivery",
  loadControllers: true,
};
```

### `strategy="preloaded"`

- No element loading occurs in the player
- Host is responsible for section/page-level preload
- Useful for fixed/static and orchestrated section runtimes

Use with `skip-element-loading` and host-side preload orchestration.

## Section player integration

`pie-section-player` and `pie-section-player-splitpane` now resolve item rendering via `pie-item-player`.

`player-type` controls strategy:

- `iife` -> `pie-item-player` with `strategy="iife"`
- `esm` -> `pie-item-player` with `strategy="esm"`
- `fixed` -> `pie-item-player` with `strategy="preloaded"`

For demos, set query params:

- `?player=iife`
- `?player=esm`
- `?player=fixed`

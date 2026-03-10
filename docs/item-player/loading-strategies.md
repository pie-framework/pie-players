# Loading Strategies

`<pie-item-player>` supports three loading strategies, set via the `strategy` attribute:

| Strategy | Loader | Source | Best for |
|----------|--------|--------|----------|
| `iife` | `IifePieLoader` | Bundle host (script injection) | Production deployments using PIE bundle infrastructure |
| `esm` | `EsmPieLoader` | ESM CDN (import maps) | Modern ESM-compatible element packages |
| `preloaded` | `IifePieLoader` | Host-preloaded bundles | Section-level preloading, static builds, offline use |

## Standalone usage

```html
<script src="https://cdn.jsdelivr.net/npm/@pie-players/pie-item-player/dist/pie-item-player.js"></script>

<pie-item-player
  strategy="iife"
  config='{"elements":{"my-el":"my-el@1.0.0"},"models":[{"id":"1","element":"my-el"}],"markup":"<my-el id=\"1\"></my-el>"}'
  env='{"mode":"gather","role":"student"}'
  session='{"id":"s1","data":[]}'
></pie-item-player>

<script>
  const player = document.querySelector("pie-item-player");
  player.addEventListener("session-changed", (e) => {
    console.log("Session updated:", e.detail.session);
  });
</script>
```

## `loaderOptions`

Strategy-specific options are set via the `loaderOptions` property (not attribute):

```ts
const player = document.querySelector("pie-item-player");
player.loaderOptions = {
  bundleHost: "https://proxy.pie-api.com/bundles",
  esmCdnUrl: "https://esm.sh",
  view: "delivery",
  loadControllers: true,
};
```

| Option | Used by | Default | Description |
|--------|---------|---------|-------------|
| `bundleHost` | `iife`, `preloaded` | `https://proxy.pie-api.com/bundles/` | Base URL for IIFE bundle downloads |
| `esmCdnUrl` | `esm` | `https://esm.sh` | Base URL for ESM module resolution |
| `view` | `esm` | resolved from `env.mode` | ESM view: `"delivery"`, `"author"`, or `"print"` |
| `loadControllers` | `esm` | `true` | Whether to load PIE controllers alongside elements |

## Strategy details

### `strategy="iife"`

Loads IIFE bundles from the bundle host by injecting `<script>` tags into the document. The bundle type depends on the player's mode:

- `mode="view"` + `hosted=false` → `clientPlayer` bundle (elements + controllers)
- `mode="view"` + `hosted=true` → `player` bundle (elements only; controllers provided by host)
- `mode="author"` → `editor` bundle (authoring config elements)

After loading, elements are registered in `window.PIE_REGISTRY` and defined as custom elements with versioned tag names (e.g. `multiple-choice--version-9-9-1`).

```ts
player.strategy = "iife";
player.loaderOptions = {
  bundleHost: "https://proxy.pie-api.com/bundles",
};
```

### `strategy="esm"`

Loads ESM modules from a CDN using dynamically injected import maps and `import()`. Each PIE element is resolved to a CDN URL with a view-specific subpath (`/delivery`, `/author`, `/print`).

```ts
player.strategy = "esm";
player.loaderOptions = {
  esmCdnUrl: "https://esm.sh",
  view: "delivery",
  loadControllers: true,
};
```

The view defaults to `"delivery"` unless `mode="author"` (which resolves to `"author"`), or explicitly overridden via `loaderOptions.view`.

### `strategy="preloaded"`

The player assumes all required PIE custom elements are already defined in the browser. No bundle loading occurs. This is useful when:

- A section player or host app preloads bundles at the page level
- Using a static preloaded-player build (see below)
- Running offline or in test environments

```html
<pie-item-player
  strategy="preloaded"
  skip-element-loading
  config="..."
></pie-item-player>
```

Pair with `skip-element-loading` to bypass the loader entirely.

### Preloaded player builds

The `configs/preloaded-player/` directory contains JSON manifests that define fixed sets of PIE elements to bundle into a single `@pie-players/pie-preloaded-player` package. This package registers all listed elements at import time, so `<pie-item-player strategy="preloaded">` can render them without any network requests.

Build a preloaded bundle locally:

```bash
bun run cli pie-packages:preloaded-player-build-package \
  --elements-file configs/preloaded-player/sb1.json
```

CI publishes preloaded-player variants via `.github/workflows/publish-preloaded-player.yml`.

## Section player integration

The section player renders each item via `<pie-item-player>`. Its `player-type` attribute maps directly to the item player's `strategy`:

| Section player `player-type` | Item player `strategy` |
|------------------------------|------------------------|
| `iife` | `iife` |
| `esm` | `esm` |
| `preloaded` | `preloaded` |

In the demo apps, use query parameters to switch strategies:

- `?player=iife`
- `?player=esm`
- `?player=preloaded`

## Invalid strategy fallback

If an unrecognized value is passed to `strategy`, the player normalizes it to `"iife"` via `normalizeItemPlayerStrategy()`.

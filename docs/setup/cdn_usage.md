# Using PIE web components from an npm CDN

`@pie-players/pie-item-player` loads directly in the browser from an npm CDN such as **jsDelivr** or **unpkg**, because its root entry imports no bare specifier. The section player, the assessment player, the toolkit's custom elements and the `pie-tool-*` packages import other packages by bare specifier, so a host loads them through a bundler, or an import map that resolves every one of those specifiers (see [library packaging strategy](./library-packaging-strategy.md#consumer-guidance-current-scope)).

## Item player (recommended)

### `@pie-players/pie-item-player` (`strategy="esm"`)

```html
<script type="module">
  import 'https://cdn.jsdelivr.net/npm/@pie-players/pie-item-player@x.y.z/dist/pie-item-player.js';
</script>

<pie-item-player strategy="esm"></pie-item-player>
```

### `@pie-players/pie-item-player` (`strategy="iife"`)

```html
<script type="module">
  import 'https://cdn.jsdelivr.net/npm/@pie-players/pie-item-player@x.y.z/dist/pie-item-player.js';
</script>

<pie-item-player strategy="iife"></pie-item-player>
```

## Tools

Tools load through a bundler or an import map, for the reason above. `pie-item-toolbar` and `pie-section-toolbar` take their coordinator from the runtime context that an enclosing `<pie-assessment-toolkit>` or section player provides, and render buttons only for tools in the tool registry they receive, typically `createPackagedToolRegistry()` from `@pie-players/pie-default-tool-loaders`. The [assessment toolkit README](../../packages/assessment-toolkit/README.md) covers the setup.

## Notes

- A package loads raw from a CDN when it publishes its built file under `dist/`, registers its custom element tag and imports no bare specifier. Of the players, only `pie-item-player` meets all three.
- Object values such as `config`, `runtime` or a `toolRegistry` are JS properties; HTML attributes carry strings.
- Pin versions in production (`@x.y.z`) to avoid breaking changes.
- For the full list of publishable packages, see `docs/setup/publishable_packages.md`.

## Local ESM CDN (development, no publishing)

`bun run local-esm-cdn` serves a pie-elements-ng checkout (`PIE_ELEMENTS_NG_PATH`, else the sibling `../pie-elements-ng`) as an ESM CDN on port 5179, or `LOCAL_ESM_CDN_PORT`. It builds the checkout's React element and lib packages first; `LOCAL_ESM_CDN_SKIP_BUILD=1` skips the build. Point the ESM player at it with `loaderOptions.esmCdnUrl`.

`bun run dev:section:cdn` serves the same checkout, built, from the section demos' dev server, and their `?player=esm` loads from it.

## Automatic HMR File Watching

The Vite plugin watches `pie-elements-ng` dist files and triggers full-reload HMR when changes are detected.

**Watched directories**:

- `packages/elements-react/*/dist/**`
- `packages/elements-svelte/*/dist/**`
- `packages/lib-react/*/dist/**`
- `packages/shared/*/dist/**`

**Behavior**: When any file in these directories changes, Vite triggers a full page reload in the browser. This eliminates the need to manually refresh after rebuilding pie-elements-ng packages.

**Debug Mode**: Set `LOCAL_ESM_CDN_DEBUG=true` environment variable to enable verbose console logging for troubleshooting.

## Troubleshooting

### Enable Debug Logging

Set the environment variable before starting the dev server:

```bash
LOCAL_ESM_CDN_DEBUG=true bun run dev
```

This enables verbose logging showing:

- Which files are being resolved
- Import rewriting details
- Package resolution paths
- Health check status

### Verify HMR is Working

1. Start the dev server with the Vite plugin loaded
2. Open browser dev tools console
3. Touch a dist file in pie-elements-ng: `touch ../pie-elements-ng/packages/elements-react/multiple-choice/dist/index.js`
4. You should see a Vite HMR message and the page should reload automatically

### Common Issues

- **Plugin not loading**: Check that `../pie-elements-ng` exists relative to the example app
- **No HMR updates**: Verify the Vite plugin is actually loaded (check console for loading message)
- **Import errors**: Enable debug mode to see detailed resolution logs

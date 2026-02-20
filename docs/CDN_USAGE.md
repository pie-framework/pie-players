# Using PIE web components from an npm CDN

The player and tool packages in this repo compile to **custom elements** and can be loaded directly in the browser via an npm CDN such as **jsDelivr** or **unpkg**.

## ESM players (recommended)

### `@pie-framework/pie-esm-player`

```html
<script type="module">
  import 'https://cdn.jsdelivr.net/npm/@pie-framework/pie-esm-player@1.0.0/dist/pie-esm-player.js';
</script>

<pie-esm-player></pie-esm-player>
```

### `@pie-framework/pie-iife-player`

```html
<script type="module">
  import 'https://cdn.jsdelivr.net/npm/@pie-framework/pie-iife-player@1.0.0/dist/pie-iife-player.js';
</script>

<pie-iife-player></pie-iife-player>
```

### `@pie-framework/pie-fixed-player`

```html
<script type="module">
  import 'https://cdn.jsdelivr.net/npm/@pie-framework/pie-fixed-player@1.0.1/dist/pie-fixed-player.js';
</script>

<pie-fixed-player></pie-fixed-player>
```

## Tools

Example:

```html
<script type="module">
  import 'https://cdn.jsdelivr.net/npm/@pie-framework/pie-tool-toolbar@1.0.0/dist/tool-toolbar.js';
  import { ToolCoordinator } from 'https://cdn.jsdelivr.net/npm/@pie-framework/pie-assessment-toolkit@0.1.0/dist/index.js';

  // `pie-tool-toolbar` renders buttons without a coordinator, but the buttons won't do anything.
  // Wire a ToolCoordinator so tools can actually open/close.
  const coordinator = new ToolCoordinator();

  window.addEventListener('DOMContentLoaded', () => {
    const toolbar = document.querySelector('pie-tool-toolbar');
    toolbar.toolCoordinator = coordinator; // JS property (NOT an attribute)
  });
</script>

<pie-tool-toolbar tools="protractor,ruler,graph"></pie-tool-toolbar>
```

## Notes

- CDN imports require the package to publish its built file under `dist/` and register the custom element tag (this repo’s player/tool packages do).
- Tool coordination is done via **JS properties** (e.g. `toolbar.toolCoordinator = new ToolCoordinator()`), not HTML attributes.
- Pin versions in production (`@x.y.z`) to avoid breaking changes.
- For package compatibility tiers and source-export policy, see `docs/publish-compatibility-matrix.md`.

## Local ESM CDN (development, no publishing)

When developing ESM-loading flows without publishing PIE element packages, you can run a local "ESM CDN" server from a sibling `pie-elements-ng` checkout and point the ESM player to it via `esm-cdn-url`.

See the repo root README for the full workflow and the `bun run local-esm-cdn` convenience script.

Tip: if you run the local server on a different port, set `LOCAL_ESM_CDN_PORT=...` and update your app to use that base URL (for the example app: `?localEsmCdnUrl=http://localhost:PORT`).

## Recent Enhancements (2026)

### Automatic HMR File Watching

As of commit `914ca87` (Jan 21, 2026), the Vite plugin automatically watches pie-elements-ng dist files and triggers full-reload HMR when changes are detected.

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

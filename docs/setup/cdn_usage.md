# Using PIE web components from an npm CDN

`@pie-players/pie-item-player` loads directly in the browser from an npm CDN such as **jsDelivr** or **unpkg**, because its root entry imports no bare specifier. The section player publishes a separate self-contained build for the same purpose (see [Section player](#section-player-browser-build)). The assessment player, the toolkit's custom elements and every `pie-tool-*` package except `pie-tool-dictionary` and `pie-tool-picture-dictionary`, which bundle everything they use, import other packages by bare specifier and reach the toolkit's text-to-speech service. That service imports `speech-rule-engine`'s JSON locale tables without import attributes, and a browser loads JSON as a module only with one, so a host loads these packages through a bundler (see [library packaging strategy](./library-packaging-strategy.md#consumer-guidance-current-scope)).

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

## Section player (browser build)

`@pie-players/pie-section-player` publishes `dist/browser/pie-section-player.js`, exported as `./browser`, next to its npm build. It bundles the section player, the assessment toolkit and the default tools, imports nothing by bare specifier, and needs no import map or bundler. Tools load as chunks on first use. Hosts that bundle keep using the npm entry; it is byte-identical with and without the browser build.

```html
<script type="module">
  import 'https://cdn.jsdelivr.net/npm/@pie-players/pie-section-player@x.y.z/dist/browser/pie-section-player.js';
</script>

<pie-section-player-splitpane show-toolbar="true"></pie-section-player-splitpane>
```

- **Full file path.** jsDelivr serves the entry file at the short package URL without a redirect, so its relative chunk imports 404. A copy taken from `node_modules` needs all of `dist/browser/`, not the entry alone.
- **One version per page.** Tags are page-global and the first registration wins. A second copy, another version or a CDN `pie-item-player` loaded first, leaves the registered definitions in place and throws nothing, so the page runs the first version that loaded. Switching versions takes a reload; side-by-side comparison needs separate iframes.
- **One directory per version when self-hosting.** Chunk names hash source paths, not contents, so two versions in one directory overwrite each other's chunks.
- **Toolkit.** The toolkit has no build of its own. The section player's `toolkit-ready` event carries the `ToolkitCoordinator` it creates. A host that builds its own coordinator imports the toolkit from `https://cdn.jsdelivr.net/npm/@pie-players/pie-assessment-toolkit@x.y.z/+esm`, at the same version as the section player; the section player does not re-export the class, which would give npm hosts a second copy.
- **Custom tools.** The build alone also exports `createPackagedToolRegistry` and `DEFAULT_TOOL_MODULE_LOADERS`. A host that adds its own registration builds the packaged set with `createPackagedToolRegistry()`, registers on it and passes the result as `toolRegistry`; the packaged tools still load from the build's chunks.

### Content Security Policy

A host under a CSP allows, beyond its own origin:

| Directive | Source | Why |
| --- | --- | --- |
| `script-src` | the CDN origin, e.g. `https://cdn.jsdelivr.net` | The entry, its chunks, and the Cortex calculator's worker file, which the worker's `blob:` module imports |
| `worker-src` | `blob:` | A browser refuses a worker script from another origin, so the Cortex calculator starts its worker from a same-origin `blob:` module that imports the file. A self-hosted copy on the page's own origin starts the worker directly. MathJax 4 starts its speech worker from a `blob:` script the same way |
| `connect-src` | `https://cdn.jsdelivr.net` | The speech-rule-engine inside the `iife` strategy's MathJax 3 fetches its locale maps when the player loads its first `iife` item, and throws an uncaught error when the request is blocked |

The following load from third-party origins in every install, npm or CDN, and are not specific to this build: under `iife`, MathJax 3's CHTML fonts from unpkg (`@pie-lib/math-rendering-module` sets `fontURL` with no override); under `esm`, MathJax 4's fonts and speech data from the element CDN, the [asset root](../item-player/loading-strategies.md#mathjax-assets) of adapter 0.1.3 and later, and from jsDelivr for earlier adapters; the `ndsIcons` toolbar path's FontAwesome from jsDelivr and its Roboto from ui.renaissance.com. The toolkit's math speech also fetches SRE 5 locale tables from jsDelivr unless `mathSpeech.engineOptions.json` is set.

## Tools

Outside the section player's browser build, tools load through a bundler, for the reason above. `pie-item-toolbar` and `pie-section-toolbar` take their coordinator from the runtime context that an enclosing `<pie-assessment-toolkit>` or section player provides, and render buttons only for tools in the tool registry they receive, typically `createPackagedToolRegistry()` from `@pie-players/pie-default-tool-loaders`, whose loaders define each tool's element on first render; a host that passes `toolModuleLoaders: {}` imports the elements itself. The [assessment toolkit README](../../packages/assessment-toolkit/README.md) covers the setup.

## Notes

- A package loads raw from a CDN when it publishes its built file under `dist/`, registers its custom element tag and imports no bare specifier. Of the players, `pie-item-player` meets all three, and `pie-section-player` does through `dist/browser/`.
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

# Loading from a CDN

Three entry points load in a browser straight from an npm CDN such as jsDelivr
or unpkg, with no bundler and no import map: the item player, the section
player's browser build, and the print player. Each publishes its built file
under `dist/`, registers its custom element, and imports no bare specifier.

Every other entry point
[loads through a bundler](./packages.md#browser-through-a-bundler):
the section player's npm build, the assessment player, the toolkit's custom
elements and every tool package. They import their siblings by bare specifier,
and the toolkit's text-to-speech service imports `speech-rule-engine`'s JSON
locale tables without the import attribute a browser requires.
[Packages and entry points](./packages.md) catalogs the packages and
classifies every entry point.

## Item player

```html
<pie-item-player></pie-item-player>

<script type="module">
  import "https://cdn.jsdelivr.net/npm/@pie-players/pie-item-player@x.y.z/dist/pie-item-player.js";

  const player = document.querySelector("pie-item-player");
  player.config = {
    elements: { "multiple-choice": "@pie-element/multiple-choice@14.0.3" },
    models: [
      {
        id: "q1",
        element: "multiple-choice",
        prompt: "Which city is the capital of France?",
        choiceMode: "radio",
        choices: [
          { label: "Paris", value: "paris", correct: true },
          { label: "London", value: "london" },
        ],
      },
    ],
    markup: '<multiple-choice id="q1"></multiple-choice>',
  };
</script>
```

`config`, `env`, `session` and the section player's `runtime` and
`toolRegistry` are object-valued, so script sets them as properties.
[Getting started](../getting-started.md) continues the example with
saving and scoring the response.

The same file serves every loading strategy. The `strategy` attribute picks
where the player loads the elements an item names from:

- `iife`, the default: IIFE bundles from the bundle host,
  `https://proxy.pie-api.com/bundles/` unless `loaderOptions.bundleHost` names
  another;
- `esm`: browser ESM builds from `https://cdn.jsdelivr.net/npm`, or the
  `loaderOptions.esmCdnUrl` the host sets, with esm.sh as the other built-in
  provider;
- `preloaded`: elements the host has already registered.

[Loading strategies](../item-player/loading-strategies.md) covers each strategy
and its [`loaderOptions`](../item-player/loading-strategies.md#loaderoptions).

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

Outside this build, tools load through a bundler; the
[assessment toolkit README](../../packages/assessment-toolkit/README.md) covers
toolbar and tool registry setup.

### Content Security Policy

[Security](../security/readme.md#content-security-policy) gives the
[base policy](../security/readme.md#base-policy) and the origins each loading
strategy adds: [`iife`](../security/readme.md#iife-origins),
[`esm`](../security/readme.md#esm-origins),
[`preloaded`](../security/readme.md#preloaded-origins), and the
[tools](../security/readme.md#tool-origins).
[MathJax assets](../item-player/math-rendering.md#mathjax-assets) covers where
math rendering loads its fonts and speech data from. Loading a player from a
CDN changes the policy in three places:

- The page's module script that imports the entry carries the nonce.
  `'strict-dynamic'` then admits the entry's imports and chunks, so the CDN
  origin needs no `script-src` entry.
- A browser refuses a worker script from another origin, so the Cortex
  calculator starts its worker from a same-origin `blob:` module that imports
  the file from the CDN. MathJax 4 starts its speech worker from a `blob:`
  script as well. A policy that sets `worker-src` or `child-src` lists `blob:`
  there. A self-hosted copy on the page's own origin starts the Cortex worker
  directly.
- A policy without `'strict-dynamic'` lists the CDN origin in `script-src`, and
  refuses the import map the `esm` strategy injects
  ([Policies without `'strict-dynamic'`](../security/readme.md#policies-without-strict-dynamic)).

## Print player

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/@pie-players/pie-print-player@x.y.z/dist/print-player.js"></script>
```

The script registers `<pie-print>`, which loads each element's print build
through the shared ESM adapter. The
[print player README](../../packages/print-player/README.md) covers its
`config`.

## Pinning

Production pages pin the exact version (`@x.y.z`) in every CDN URL. The
packages are on `0.x`, where breaking changes ship as patch releases, so any
range takes them, jsDelivr's `@0.3` included
([Versioning and stability](./versioning.md#pinning)).

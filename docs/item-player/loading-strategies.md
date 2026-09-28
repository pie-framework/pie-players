# Loading Strategies

`<pie-item-player>` supports three loading strategies, set via the `strategy` attribute. All strategies route through the `ElementLoader` primitive (`@pie-players/pie-players-shared/loaders`); the strategy selects which backend the primitive uses (or, for `preloaded`, asserts that no backend is needed):

| Strategy | Backend | Source | Best for |
| -------- | ------- | ------ | -------- |
| `iife` | IIFE backend | Bundle host (script injection) | Production deployments using PIE bundle infrastructure |
| `esm` | ESM backend | ESM CDN (URL or import-map resolution) | Modern ESM-compatible element packages |
| `preloaded` | _none_ (uses `assertRegistered`) | Host-preloaded bundles | Section-level preloading, static builds, offline use |

## Standalone usage

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/@pie-players/pie-item-player/dist/pie-item-player.js"></script>

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
  esmCdnUrl: "https://cdn.jsdelivr.net/npm",
  esmCdnProvider: "jsdelivr",
  moduleResolution: "url",
  view: "delivery",
  loadControllers: true,
  runtimeSupportCheck: "off",
};
```

| Option | Used by | Default | Description |
| ------ | ------- | ------- | ----------- |
| `bundleHost` | `iife` | `https://proxy.pie-api.com/bundles/` | Base URL for IIFE bundle downloads |
| `esmCdnUrl` | `esm` | `https://cdn.jsdelivr.net/npm` | Base URL for ESM module resolution |
| `esmCdnProvider` | `esm` | inferred from `esmCdnUrl` | CDN route strategy. Use `"jsdelivr"`, `"esm.sh"`, or a provider object with package and shared-dependency URL builders |
| `moduleResolution` | `esm` | `"url"` | Module resolution mode: `"url"` (fully-qualified CDN imports) or `"import-map"` |
| `view` | `esm` | resolved from `env.mode` | ESM view: `"delivery"`, `"author"`, or `"print"` |
| `loadControllers` | `esm` | `true`; `false` for a hosted player outside author mode | Whether to load PIE controllers alongside elements. A player is hosted when `hosted` is set or `backend.delivery` is enabled, and a hosted player resolves no controller. The section pre-warm resolves the default the same way |
| `runtimeSupportCheck` | `esm` | `"off"` | When `"on"`, reads each package's optional `./runtime-support` metadata through `esmCdnProvider` and surfaces unsupported view hints before loading |

## Strategy details

### `strategy="iife"`

Loads IIFE bundles from the bundle host by injecting `<script>` tags into the document. The bundle type depends on the player's mode:

- `mode="view"` + `hosted=false` → `clientPlayer` bundle (elements + controllers)
- `mode="view"` + `hosted=true` → `player` bundle (elements only; controllers provided by host)
- `mode="author"` → `editor` bundle (authoring config elements)

`clientPlayer` bundles carry the controllers, so the answer key and the scoring logic run in the learner's browser. That is the default: `hosted` is false unless the host sets it or enables `backend.delivery`. See [`../security/readme.md`](../security/readme.md#delivery-integrity) for what a proctored delivery has to do instead, and for the CSP each strategy needs.

After loading, elements are registered in `window.PIE_REGISTRY` and defined as custom elements with versioned tag names (e.g. `multiple-choice--version-9-9-1`).

IIFE bundles resolve `@pie-lib/math-rendering` to `window["@pie-lib/math-rendering"]`, so the player installs its MathJax renderer there before the first bundle loads. A host that wants the MathJax module fetched sooner calls `ensureItemPlayerMathRenderingReady()` from `@pie-players/pie-item-player` at startup. A host that loads IIFE element bundles itself, outside the player, awaits `ensureItemPlayerMathRenderingReady()` before the first bundle evaluates, because the bundle reads the renderer as it evaluates; `@pie-players/pie-item-player/preloaded` exports it without defining the player. A renderer already on `window` stays.

```ts
player.strategy = "iife";
player.loaderOptions = {
  bundleHost: "https://proxy.pie-api.com/bundles",
};
```

### `strategy="esm"`

Loads ESM modules from a CDN with dynamic `import()`. By default, the player imports fully-qualified CDN URLs (`moduleResolution: "url"`), which avoids one-time import-map staleness across repeated loads. You can still opt into import-map mode with `moduleResolution: "import-map"`.

The ESM loader consumes the static browser ESM package surface defined by the
producer-side `pie-elements-ng` package contract.
For an item element such as `@pie-element/multiple-choice@13.2.2`, it loads
published files like:

- `dist/browser/delivery/index.js` for delivery mode
- `dist/browser/author/index.js` for authoring mode
- `dist/browser/controller/index.js` when `loadControllers` is enabled

The player does not transform element package entrypoints through jsDelivr
`+esm`. Shared browser singletons such as React are resolved from exact
`pie.browserSharedDependencies` metadata in the element package's
`package.json`; dependency and peer-dependency ranges are install metadata, not
runtime fallback contracts.

```ts
player.strategy = "esm";
player.loaderOptions = {
  esmCdnUrl: "https://cdn.jsdelivr.net/npm",
  esmCdnProvider: "jsdelivr",
  moduleResolution: "url",
  view: "delivery",
  loadControllers: true,
};
```

The view defaults to `"delivery"` unless `mode="author"` (which resolves to `"author"`), or explicitly overridden via `loaderOptions.view`.

In both modes the player injects an import map for the shared dependencies. Firefox applies one import map per page, and only before the page's first module load, so it rejects the player's map on a page that loaded a module first, and any map after the first. The player detects a rejected map by importing one of its specifiers, and from then on loads that page's elements through es-module-shims in shim mode, which `@pie-players/pie-players-shared` bundles and loads only on such a page. Browsers that apply the map load natively. A page that runs its own es-module-shims must run it in shim mode; the player reuses that instance, and fails the load with an error naming the cause when it runs in polyfill mode. The CSP base policy in [`../security/readme.md`](../security/readme.md#content-security-policy) covers both paths.

#### Shared editor runtime

A package that declares `pie.browserEditorRuntime` also publishes, for each view its `views` names, a variant that imports Tiptap and ProseMirror from a shared runtime package instead of bundling them. Under `moduleResolution: "url"` the player loads that variant, `dist/browser/<views[view]>/index.js`, and adds the runtime's `pie.browserModules` to the import map, each at `dist/browser/<module>/index.js` of the runtime package on the same CDN, so every editor on the page runs one engine. A view `views` does not name loads its `./browser/*` module, and so does every package under `moduleResolution: "import-map"` or without the declaration.

The runtime is a page singleton. The first load that needs it maps the highest version among the packages it loads and records it as `data-pie-editor-runtime` on the import map script; later loads on the page, from any player, use that version. It serves a package that declares the same runtime at a version in its caret range at or below its own: the same major, and below 1.0.0 the same minor. A lower version it serves is reported as a resolved shared-dependency conflict, as React is. A package it cannot serve loads `./browser/*` and is reported the same way: a `[pie-esm]` console warning and, with instrumentation, a `pie-esm-shared-dependency-conflict` event. The player also loads `./browser/*` and reports it when the runtime's `package.json`, its modules or the variant fail to load, when the page already maps one of the runtime's specifiers, and in a browser without import maps.

ESM element builds bring their own math rendering, so the player installs no renderer and never fetches its MathJax module. An ESM element still uses a renderer the host installs on `window["@pie-lib/math-rendering"]`.

For esm.sh, pass both the provider name and base URL:

```ts
player.loaderOptions = {
  esmCdnProvider: "esm.sh",
  esmCdnUrl: "https://esm.sh",
};
```

With this provider, PIE package artifacts are fetched from `raw.esm.sh` while
shared browser dependencies are fetched from `esm.sh`.

### `strategy="preloaded"`

The player assumes all required PIE custom elements are already defined in the browser and loads nothing. The host installs the pie-elements-ng packages it needs as npm dependencies, its own build bundles their ESM builds, and it registers them with `registerPreloadedElements` ([below](#registering-elements-from-npm)) before the player renders. Preloaded is ESM only, because the elements are resolved at the host's build time; IIFE bundles are the runtime-loaded `iife` strategy.

```html
<pie-item-player
  strategy="preloaded"
  config="..."
></pie-item-player>
```

Registration records each package's version in `window.PIE_PRELOADED_ELEMENTS`. The player replaces every authored spec of a recorded package with that version on its runtime copy of the config. Content can author a package under another base tag than the one it is registered under, so the player then defines each resulting versioned tag the page lacks from the element registered for the same package spec, with that registration's controller and bundle type (`defineAuthoredPreloadedTags`), and calls `assertRegistered` from the `ElementLoader` primitive for the versioned tags. A tag whose package spec the page did not register stays undefined and throws `ElementAssertionError`, naming each missing tag and the tags its package is registered as; there is no fall-back to bundle fetching.

The player installs no math renderer under `preloaded`, as under `esm`: the elements load MathJax 4 once per page, on their first render.

### Registering elements from npm

A host that installs element packages registers them with `registerPreloadedElements` from `@pie-players/pie-item-player/preloaded`, before the player renders. That entry defines no element and installs no stylesheet. It ships in `@pie-players/pie-item-player`, so the host declares that package and the element packages alone:

```ts
import { registerPreloadedElements } from "@pie-players/pie-item-player/preloaded";
import * as delivery from "@pie-element/multiple-choice/browser/delivery";
import * as controller from "@pie-element/multiple-choice/browser/controller";
import manifest from "../package.json"; // pins "@pie-element/multiple-choice": "13.4.0-next.15"

registerPreloadedElements([
  {
    tag: "pie-element-multiple-choice",
    package: "@pie-element/multiple-choice",
    version: manifest.dependencies["@pie-element/multiple-choice"],
    element: delivery,
    controller,
  },
]);
await import("@pie-players/pie-item-player");
```

- `tag` is the base tag to register. The element registers under its versioned form, `pie-element-multiple-choice--version-13-4-0-next-15`. Content that authors the package under another base tag, such as `multiple-choice`, renders through the versioned tag the player defines from this registration.
- `version` is the installed version, exact; a range throws. Reading it from the host's own exact pin, as above, keeps it equal to the installed package.
- Install every pie-elements-ng package from one release, in one `npm install --save-exact` from the same dist-tag, and upgrade them together. A release pins exact versions of the `@pie-lib/*` and `@pie-element/shared-*` libraries its elements share, so packages from two releases install a second copy of each library. `npm ls @pie-lib/render-ui` lists one version for a consistent set.
- A package registers at one version per page, because the players align every authored version of a package to the registered one. Registering a second version throws.
- `element` is the package's `./browser/delivery` module: `./browser/*` is the npm entry because it resolves React from the element package, so a host does not switch to `./delivery`.
- `controller` is the package's `./browser/controller` module. A player that is not hosted runs its `model()` in the browser and warns once per tag registered without one. A hosted player renders server-processed models and needs none.
- The call is synchronous and validates every entry before registering any. A tag that is already defined keeps its definition.

### Preloaded player builds

Generated `@pie-players/pie-preloaded-player` builds predate npm registration. Each carries a PITS IIFE bundle of its elements and installs the math renderer that bundle reads in its own entry. They stay published for hosts that have not moved to npm registration; a new integration registers ESM builds instead.

The `configs/preloaded-player/` directory contains JSON manifests that define predefined sets of PIE elements to bundle into a single `@pie-players/pie-preloaded-player` package. This package registers all listed elements at import time through `registerPreloadedElements`, without controllers, so a hosted `<pie-item-player strategy="preloaded">` renders them without fetching bundles. See [`docs/preloaded-player/readme.md`](../preloaded-player/readme.md).

Build a preloaded bundle locally:

```bash
bun run cli pie-packages:preloaded-player-build-package \
  --elementsFile configs/preloaded-player/<name>.json
```

CI publishes preloaded-player variants via `.github/workflows/publish-preloaded-player.yml`.

## Section player integration

The section player renders each item via `<pie-item-player>`. Hosts select the strategy through `runtime.playerType` on the section-player element, which maps directly onto the item player's `strategy`:

| `runtime.playerType` | Item player `strategy` |
| -------------------- | ---------------------- |
| `iife` | `iife` |
| `esm` | `esm` |
| `preloaded` | `preloaded` |

```ts
const player = document.querySelector("pie-section-player-splitpane");
player.runtime = { playerType: "preloaded" };
```

`player-type` carries the resolved value internally — `PieSectionPlayerBaseElement` to `<pie-assessment-toolkit>` to the item player — and is not an attribute on `<pie-section-player-splitpane>` or `<pie-section-player-vertical>`. `<pie-assessment-player>` does accept a `player-type` attribute, and maps it onto the section player's `runtime.playerType`.

In the demo apps, use query parameters to switch strategies:

- `?player=iife`
- `?player=esm`
- `?player=preloaded`

## Invalid strategy fallback

If an unrecognized value is passed to `strategy`, the player normalizes it to `"iife"` via `normalizeItemPlayerStrategy()`.

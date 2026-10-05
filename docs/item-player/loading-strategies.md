# Loading Strategies

`<pie-item-player>` supports three loading strategies, set via the `strategy` attribute. All strategies route through the `ElementLoader` primitive (`@pie-players/pie-players-shared/loaders`); the strategy selects which backend the primitive uses (or, for `preloaded`, asserts that no backend is needed):

| Strategy | Backend | Source | Best for |
| -------- | ------- | ------ | -------- |
| `iife` | IIFE backend | Bundle host (script injection) | Production deployments using PIE bundle infrastructure |
| `esm` | ESM backend | ESM CDN (URL or import-map resolution) | Modern ESM-compatible element packages |
| `preloaded` | _none_ (uses `assertRegistered`) | Elements the host registers | Section-level preloading, static builds, offline use |

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

ESM element builds bring their own math rendering, so the player installs no renderer and never fetches its MathJax module. An ESM element still uses a renderer the host installs on `window["@pie-lib/math-rendering"]`, and so does the player for the math in the item's own markup ([below](#item-markup-math)).

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

The player installs no math renderer under `preloaded`, as under `esm`: the elements start MathJax 4 themselves, on `window.MathJax` or as a copy of their own ([below](#one-mathjax-version-per-page)).

### Registering elements from npm

A host that installs element packages registers them with `registerPreloadedElements` from `@pie-players/pie-item-player/preloaded`, before the player renders. That entry defines no element and installs no stylesheet. It ships in `@pie-players/pie-item-player`, so the host declares that package and the element packages alone:

```ts
import { registerPreloadedElements } from "@pie-players/pie-item-player/preloaded";
import * as delivery from "@pie-element/multiple-choice/browser/delivery";
import * as controller from "@pie-element/multiple-choice/browser/controller";
import manifest from "../package.json"; // pins "@pie-element/multiple-choice" exactly

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

- `tag` is the base tag to register. The element registers under its versioned form, which encodes the version: 13.4.0-next.15 registers as `pie-element-multiple-choice--version-13-4-0-next-15`. Content that authors the package under another base tag, such as `multiple-choice`, renders through the versioned tag the player defines from this registration.
- `version` is the installed version, exact; a range throws. Reading it from the host's own exact pin, as above, keeps it equal to the installed package.
- Install every pie-elements-ng package from one release, in one `npm install --save-exact` from the same dist-tag, and upgrade them together. Elements whose `./browser/*` builds typeset on `window.MathJax` share the MathJax the first of them loads, in the build and configuration of that element's release. Releases change both, so in a mixed set an element can typeset with a MathJax it was not built for: `@pie-element/multiple-choice` 13.4.0-next.15 loads a build without MathML input, 13.4.0-next.16 one with it. Elements that bundle their own MathJax ([below](#one-mathjax-version-per-page)) share none.
- A package registers at one version per page, because the players align every authored version of a package to the registered one. Registering a second version throws.
- `element` is the package's `./browser/delivery` module: `./browser/*` is the npm entry because it resolves React from the element package, so a host does not switch to `./delivery`.
- `controller` is the package's `./browser/controller` module. A player that is not hosted runs its `model()` in the browser and warns once per tag registered without one. A hosted player renders server-processed models and needs none.
- The call is synchronous and validates every entry before registering any. A tag that is already defined keeps its definition.

### Preloaded player builds

Generated `@pie-players/pie-preloaded-player` builds bundle a fixed set of pie-elements-ng elements from their ESM browser builds together with the item player, and ship the MathJax, fonts and speech data those elements render with, so nothing loads from the bundle service or a CDN. They stay published for hosts that have not moved to npm registration; a new integration registers ESM builds instead.

The `configs/preloaded-player/` directory contains JSON manifests that define predefined sets of PIE elements to bundle into a single `@pie-players/pie-preloaded-player` package. This package registers all listed elements at import time through `registerPreloadedElements`, without controllers, so a hosted `<pie-item-player strategy="preloaded">` renders them without fetching bundles. See [`docs/preloaded-player/readme.md`](../preloaded-player/readme.md).

Build a preloaded bundle locally:

```bash
bun run cli pie-packages:preloaded-player-build-package \
  --elementsFile configs/preloaded-player/<name>.json
```

CI publishes preloaded-player variants via `.github/workflows/publish-preloaded-player.yml`.

## Item markup math

Each element typesets the math in its own subtree. The player typesets the math in the rest of the item and passage markup with the page's renderer, `window["@pie-lib/math-rendering"]`, handing it only the parts that hold math and no element, so no element's content is typeset twice. It does so once the elements are initialized and again when a markup block is replaced, and does not hold `load-complete` back. Under `iife` the renderer is the one the player installs. Under `esm` and `preloaded` it is one the host installs, which ESM elements render with as well; on a page without one the markup's math stays as authored. The player installs none there because its renderer runs MathJax 3 and ESM elements run MathJax 4.

## One MathJax version per page

The page's `window.MathJax` holds one MathJax major version, and which builds typeset on it decides what a page can combine. These builds, page-global below, typeset on `window.MathJax`:

- The `iife` strategy's renderer, MathJax 3.2.2, and the same renderer in a `@pie-players/pie-preloaded-player` build that carries an IIFE bundle (`pie-elements-bundle-<hash>.js` beside `math-rendering.js`).
- ESM element builds whose `@pie-element/shared-math-rendering-mathjax` is 0.1.1 or earlier. They load MathJax 4.1.3 into `window.MathJax`, or typeset with the MathJax the page already has.
- A host's own MathJax.

ESM element builds whose adapter is 0.1.2-next.20261003161149 or later bundle a MathJax 4.1.3 private to the module: it neither reads nor writes `window.MathJax`, and every element package on the page starts its own copy, with its own `<style id="PIE-MJX-CHTML-styles-<n>">`. An element pins its adapter exactly in its `package.json`; `@pie-element/multiple-choice` 14.0.0 pins 0.1.1. `esm` loads the build of the version the item names, `preloaded` runs the builds the host installed, and a generated preloaded-player build that bundles ESM builds carries the versions its manifest lists. [Math Rendering in pie-elements-ng](https://github.com/pie-framework/pie-elements-ng/blob/develop/docs/MATH-RENDERING.md#builds) describes both adapter builds.

ESM builds run MathJax 4 because MathJax 3 ships no ES modules and depends on the `window.MathJax` global; its last release is 3.2.2, from June 2022, and npm marks `mathjax-full` deprecated in favour of `@mathjax/src`. MathJax 3 and MathJax 4 on `window.MathJax` together is unsupported: an `iife` item player next to `esm` or `preloaded` elements that typeset on the page global, or a host's own MathJax 3 next to them. The player still attempts to render such a page and guarantees nothing about the result. Elements with their own MathJax run beside a host's MathJax 3 that typesets only its own content. Observed in Chromium, with the builds each observation applies to:

- An `iife` item loaded after MathJax 4 fails at its math-rendering step with `MathJax.loader.preLoad is not a function`, so the whole item fails to load. Page-global builds only; a bundled MathJax leaves `window.MathJax` unset.
- MathJax 3 loaded after MathJax 4 overflows the stack during its startup, and later math stays untypeset. Page-global builds only; MathJax 3 loaded after a bundled MathJax starts and typesets normally.
- ESM elements on a page that already runs MathJax 3 typeset with that MathJax and its configuration, so PIE's macros such as `\longdiv` render as errors. Page-global builds only; a bundled MathJax typesets with its own configuration and macros.
- Page-global and bundled ESM builds alike hand their math to a renderer on `window["@pie-lib/math-rendering"]` when the page has one. After an `iife` item player installs its MathJax 3 renderer there, ESM elements typeset through it, which carries the macros, so an element with its own MathJax typesets with MathJax 3 on that page.
- MathJax 3 typesetting the page after ESM math rendered typesets MathJax 4's hidden MathML again, so formulas show twice. Page-global and bundled builds alike: the hidden MathML is in the page's DOM either way.
- MathJax 3 writes its styles to `<style id="MJX-CHTML-styles">`, and so does the MathJax 4 that adapters 0.1.1-next.4 and earlier load; with those, the version that renders second removes the other's stylesheet, and math the first one rendered loses its layout. Later adapters write to their own stylesheet, `PIE-MJX-CHTML-styles` on the page global and `PIE-MJX-CHTML-styles-<n>` bundled, which MathJax 3 leaves in place. MathJax 3's stylesheet still matches the `mjx-*` elements of both and tightens their spacing, and the adapter reports it as `foreign-output-stylesheet`.

A host that runs MathJax 3 for its own content keeps PIE on `iife`, or uses element builds with their own MathJax and typesets only its own containers. Testing and results are tracked in [PIE-1108](https://illuminate.atlassian.net/browse/PIE-1108).

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

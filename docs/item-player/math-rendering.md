# Math Rendering

How `<pie-item-player>` and the PIE elements it renders typeset math under each
[loading strategy](./loading-strategies.md), where MathJax loads its fonts and
speech data from, and which MathJax builds can share a page. For hosts that
choose a strategy, self-host element assets, or run MathJax for their own
content.

The MathJax adapter is `@pie-element/shared-math-rendering-mathjax`, the
pie-elements-ng package through which element builds and the item player run
MathJax 4. Each element pins its adapter version exactly in its
`package.json`, and several behaviors below depend on that version.
[Math Rendering in pie-elements-ng](https://github.com/pie-framework/pie-elements-ng/blob/develop/docs/MATH-RENDERING.md)
covers the producer side.

## Renderers by strategy

| Strategy | Element math | Item markup math |
| -------- | ------------ | ---------------- |
| `iife` | The element bundles read the MathJax 3.2.2 renderer the player installs on `window["@pie-lib/math-rendering"]` ([`strategy="iife"`](./loading-strategies.md#strategyiife)) | The same renderer |
| `esm` | Each element hands its math to a renderer on `window["@pie-lib/math-rendering"]` when the page has one, and otherwise runs MathJax 4.1.3 itself | The page's renderer, otherwise the player's own MathJax 4.1.3 |
| `preloaded` | As `esm`, with the builds the host installed | As `esm` |

## Item markup math

Each element typesets the math in its own subtree. The player typesets the math
in the rest of the item and passage markup, handing a renderer only the parts
that hold math and no element, so no element's content is typeset twice. It
typesets once the elements are initialized and again when a markup block is
replaced. [`load-complete`](./loading-strategies.md#load-completion) waits for
the first pass, so a host that reveals the item on it shows the markup's math
typeset.

The renderer is the page's, `window["@pie-lib/math-rendering"]`: under `iife`
the one the player installs, under `esm` and `preloaded` one the host installs,
which ESM elements render with as well. On a page without one, the player
imports a MathJax 4.1.3 of its own on the first markup that holds math: the
browser build of the MathJax adapter, which ESM elements bundle. Like the
elements' copies, it neither reads nor writes `window.MathJax` or the page
renderer, and it loads its fonts and speech data as
[MathJax assets](#mathjax-assets) sets out.

## MathJax assets

Copies of the MathJax adapter from 0.1.3, in the elements and in the player's
own MathJax, load MathJax's fonts and speech data as math renders, and on the
adapter's npm build MathJax itself. No build names a CDN host. A copy loads each
file from:

1. Its URL in `window["@pie-lib/math-rendering@2"].opts.assetUrls`, keyed by npm
   path, such as `@mathjax/mathjax-newcm-font@4.1.3/chtml/woff2/mjx-ncm-n.woff2`.
   The browser build reads it.
2. Otherwise the asset root, an npm root: a URL under which
   `<package>@<version>/<path>` serves that file of the package. A copy takes
   the first of `opts.assetRoot`; for the player's own MathJax under `esm`, the
   npm root of the element CDN (`esmCdnUrl` for jsDelivr, `https://raw.esm.sh`
   for esm.sh, the root of a provider object's `packageJsonUrl` layout when it
   has one); and the npm root of the URL the copy loaded from.

Under `esm` the files come from the CDN the elements load from, with no
configuration. A generated [preloaded-player build](../preloaded-player/readme.md)
lists every file it ships in `assetUrls`, each by
`new URL("./mathjax/npm/…", import.meta.url)`, so it needs no root and a host
bundler emits the files. A host that registers ESM builds it bundles itself
passes the files' location through `registerPreloadedElements`
([Registering elements from npm](./loading-strategies.md#registering-elements-from-npm)):

```ts
registerPreloadedElements(entries, {
  math: {
    assetRoot: "https://assets.example.com/npm",
    speechLocales: ["en", "es"],
  },
});
```

- `assetRoot` is the npm root. A self-hosted one serves the files
  [Math Rendering in pie-elements-ng](https://github.com/pie-framework/pie-elements-ng/blob/develop/docs/MATH-RENDERING.md#assets)
  lists, for the packages the adapter's `pie.assetPackages` names. A relative
  URL resolves against the page.
- `assetUrls` maps npm paths to the URLs of those files, a string or a `URL`
  each; the files it does not list load from the root.
- `speechPath` is the directory of `speech-worker.js` and its `mathmaps/`, by
  default `mathjax@<version>/sre` under the root. A directory of its own serves
  locales that SRE (the Speech Rule Engine, MathJax's speech component) does not
  ship.
- `speechLocales` are the locales the speech language menu lists, as ids or as
  ids mapped to their labels; by default every locale SRE ships. List only those
  that can load.
- `inTabOrder: true` puts typeset math in the keyboard tab order, a tab stop on
  each expression, for the MathJax menu's setting and its explorer; unset or
  `false`, math stays out of it. A copy reads it as it starts MathJax, at its
  first math load, so a later change reaches only copies that have not started.
  A host that loads a generated preloaded-player build, whose entry registers
  its elements itself, sets `opts.inTabOrder` on the page before the entry
  evaluates, and the entry's registration keeps it. The `iife` strategy's
  MathJax 3 renderer, a MathJax the host loads and configures itself, and
  adapter 0.1.4 and earlier ignore it.

The call writes the options it is given to
`window["@pie-lib/math-rendering@2"].opts`, adds its `assetUrls` to those the
page lists, and keeps the page options it leaves unset. A host without the
players sets the same page options before the first element renders.

With neither a root nor the fonts' URLs, a copy warns once and dispatches
`pie-mathjax-no-asset-root` on `window`: the browser build renders without web
fonts and speech, and the npm build loads no MathJax. Players with
`trackPageActions` on forward the event to instrumentation once per provider.
Copies up to adapter 0.1.2 ignore the options and load from jsDelivr. The
origins these files add to a Content-Security-Policy are in
[security](../security/readme.md#content-security-policy).

## One MathJax version per page

The page's `window.MathJax` holds one MathJax major version, and which builds
typeset on it decides what a page can combine. These builds, page-global below,
typeset on `window.MathJax`:

- The `iife` strategy's renderer, MathJax 3.2.2, and the same renderer in a
  `@pie-players/pie-preloaded-player` build that carries an IIFE bundle
  (`pie-elements-bundle-<hash>.js` beside `math-rendering.js`).
- ESM element builds whose MathJax adapter is 0.1.1 or earlier. They load
  MathJax 4.1.3 into `window.MathJax`, or typeset with the MathJax the page
  already has.
- A host's own MathJax.

ESM element builds whose adapter is 0.1.2-next.20261003161149 or later bundle a
MathJax 4.1.3 private to the module: it neither reads nor writes
`window.MathJax`, and every element package on the page starts its own copy,
with its own `<style id="PIE-MJX-CHTML-styles-<n>">`. From 0.1.3 each copy loads
its files from the [asset root](#mathjax-assets). `@pie-element/multiple-choice`
14.0.0, for one, pins adapter 0.1.1. `esm` loads the build of the version the
item names, `preloaded` runs the builds the host installed, and a generated
preloaded-player build that bundles ESM builds carries the versions its manifest
lists.
[Math Rendering in pie-elements-ng](https://github.com/pie-framework/pie-elements-ng/blob/develop/docs/MATH-RENDERING.md#builds)
describes both adapter builds.

ESM builds run MathJax 4 because MathJax 3 ships no ES modules and depends on
the `window.MathJax` global, and npm marks `mathjax-full` deprecated in favor of
`@mathjax/src`. MathJax 3 and MathJax 4 on `window.MathJax` together is
unsupported: an `iife` item player next to `esm` or `preloaded` elements that
typeset on the page global, or a host's own MathJax 3 next to them. The player
still attempts to render such a page and guarantees nothing about the result.
Elements with their own MathJax run beside a host's MathJax 3 that typesets only
its own content.

In Chromium, mixed pages fail in these ways:

- An `iife` item loaded after MathJax 4 fails at its math-rendering step with
  `MathJax.loader.preLoad is not a function`, so the whole item fails to load.
  Page-global builds only; a bundled MathJax leaves `window.MathJax` unset.
- MathJax 3 loaded after MathJax 4 overflows the stack during its startup, and
  later math stays untypeset. Page-global builds only; MathJax 3 loaded after a
  bundled MathJax starts and typesets normally.
- ESM elements on a page that already runs MathJax 3 typeset with that MathJax
  and its configuration, so PIE's macros such as `\longdiv` render as errors.
  Page-global builds only; a bundled MathJax typesets with its own configuration
  and macros.
- Page-global and bundled ESM builds alike hand their math to a renderer on
  `window["@pie-lib/math-rendering"]` when the page has one. After an `iife`
  item player installs its MathJax 3 renderer there, ESM elements typeset
  through it, which carries the macros, so an element with its own MathJax
  typesets with MathJax 3 on that page.
- MathJax 3 typesetting the page after ESM math rendered typesets MathJax 4's
  hidden MathML again, so formulas show twice. Page-global and bundled builds
  alike: the hidden MathML is in the page's DOM either way.
- MathJax 3 writes its styles to `<style id="MJX-CHTML-styles">`, and so does
  the MathJax 4 that adapters 0.1.1-next.4 and earlier load; with those, the
  version that renders second removes the other's stylesheet, and math the first
  one rendered loses its layout. Later adapters write to their own stylesheet,
  `PIE-MJX-CHTML-styles` on the page global and `PIE-MJX-CHTML-styles-<n>`
  bundled, which MathJax 3 leaves in place. MathJax 3's stylesheet still matches
  the `mjx-*` elements of both and tightens their spacing.

The MathJax adapter reports a mixed page. When `window.MathJax` is a MathJax 3
build (`mathjax-3-global`), or another MathJax output stylesheet sits beside its
own (`foreign-output-stylesheet`), it logs one console error per page and
dispatches `pie-mathjax-version-conflict` on `window` once per condition, with
`condition`, `message` and `docsUrl` in its detail. Players with
`trackPageActions` on forward it to instrumentation once per provider.

A host that runs MathJax 3 for its own content keeps PIE on `iife`, or uses
element builds with their own MathJax and typesets only its own containers.

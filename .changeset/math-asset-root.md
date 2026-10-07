---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-section-player": patch
---

`registerPreloadedElements` takes math asset options as a second argument,
`{ math: { assetRoot, assetUrls, speechPath, speechLocales } }`, and writes them
to `window["@pie-lib/math-rendering@2"].opts`, where every copy of
`@pie-element/shared-math-rendering-mathjax` from 0.1.3 reads them as it starts
MathJax. A host that registers elements it bundles itself, or bundles the
adapter's npm build, sets `assetRoot`, an npm root serving MathJax's files, or
lists each file's URL in `assetUrls`: without either, the browser build renders
without web fonts and speech and the npm build loads no MathJax. Under `esm` the
item player's own MathJax, now adapter 0.1.3, loads its files from the element
CDN's npm root. Under `preloaded` the item player forwards the adapter's
`pie-mathjax-no-asset-root` and `pie-mathjax-version-conflict` events to
instrumentation when `trackPageActions` is on.

Generated preloaded packages carry MathJax inside their element and player
chunks and list each font and speech file under `dist/mathjax/npm/` in
`assetUrls` by `new URL(…, import.meta.url)`, so every file loads from the
package's own server, or from the host's build output when a host bundler
processes the entry. Speech ships in English; a build config's `speechLocales`
ships more. The generator takes elements on adapter 0.1.3 or later and no longer
ships `dist/mathjax/load.js` or a page MathJax.

Hosts P and R load generated packages: a set config pinning elements on an
earlier adapter stops building until it moves, and packages already published are
unchanged. Host M registers no math options, so the player's own markup math
renders without web fonts or speech once it takes this release. Hosts V and A run
`iife` and see no change.

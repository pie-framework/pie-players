---
"@pie-players/pie-item-player": patch
"@pie-players/pie-players-shared": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-players-cli": patch
---

Add `registerPreloadedElements` (PIE-1070): a host that bundles the
`./browser/delivery` modules of pie-elements-ng ESM builds registers them for
the `preloaded` strategy without a generated `@pie-players/pie-preloaded-player`
build, passing each package's `./browser/controller` module for a player that
is not hosted. Only pie-elements-ng ESM builds publish those subpaths. It is
exported from `@pie-players/pie-players-shared/loaders` and from the new
`@pie-players/pie-item-player/preloaded`, which also exports
`ensureItemPlayerMathRenderingReady` without defining the player. Registration
takes exact versions only and one version per package, and a player that is not
hosted warns about each preloaded tag registered without a controller.
`ElementAssertionError` names the tags each missing tag's package is registered
as.

Generated preloaded builds register through that entry and install the item
player's own math renderer, keeping one the page already has, so a build's
`dist/` tree carries `preloaded.js` in place of `math-rendering.js`. The
session debugger takes `hosted`, `runtimeSupportCheck` probes only under
`strategy="esm"` through the configured CDN provider, and the ESM import map
skips specifiers the page already maps.

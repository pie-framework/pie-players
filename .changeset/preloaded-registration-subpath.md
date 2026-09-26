---
"@pie-players/pie-item-player": patch
"@pie-players/pie-players-shared": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-players-cli": patch
---

Add `@pie-players/pie-item-player/preloaded`, which exports
`registerPreloadedElements` and `ensureItemPlayerMathRenderingReady` without
defining the player. Registration takes exact versions only and one version per
package, and a player that is not hosted warns about each preloaded tag
registered without a controller. `ElementAssertionError` names the tags each
missing tag's package is registered as.

Generated preloaded builds register through that entry and install the item
player's own math renderer, keeping one the page already has, so the `dist/`
tree Host P serves carries `preloaded.js` in place of `math-rendering.js`. The
session debugger takes `hosted`, `runtimeSupportCheck` probes only under
`strategy="esm"` through the configured CDN provider, and the ESM import map
skips specifiers the page already maps.

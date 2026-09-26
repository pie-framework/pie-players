---
"@pie-players/pie-players-shared": patch
---

Add `registerPreloadedElements` to `@pie-players/pie-players-shared/loaders`
(PIE-1070): a host that bundles pie-elements-ng `./browser/delivery` modules
registers them for the `preloaded` strategy without a generated
`@pie-players/pie-preloaded-player` build. An entry takes the package's
`./browser/controller` module for a player that is not hosted.

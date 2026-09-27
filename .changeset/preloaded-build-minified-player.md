---
"@pie-players/pie-players-cli": patch
---

A generated `@pie-players/pie-preloaded-player` build ships the item player's
modules with their whitespace stripped. A host that bundles the build loses the
modules' pure annotations and the `webpackIgnore` hints on the `esm` strategy's
runtime imports, which the `preloaded` strategy never runs.

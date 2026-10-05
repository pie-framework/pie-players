---
"@pie-players/pie-item-player": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-players-shared": patch
---

On a page with no math renderer, under `esm` and `preloaded`, the item player
typesets the math in an item's and a passage's own markup on a MathJax 4.1.3 of
its own, where that math had stayed as authored. It is the browser build of
`@pie-element/shared-math-rendering-mathjax`, imported on the first markup that
holds math, and leaves `window.MathJax` and `window["@pie-lib/math-rendering"]`
alone. Its chunks add about 2.9 MB to the item player and to the section
player's browser build; Host M, which inlines every dynamic import into one
module, carries them and evaluates them at startup, as it does the elements'
copies. Generated `@pie-players/pie-preloaded-player` builds serve the engine's
fonts and speech data from `dist/mathjax/npm/`, so Host P renders that math with
nothing loaded from jsDelivr.

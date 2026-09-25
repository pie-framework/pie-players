---
"@pie-players/pie-item-player": patch
"@pie-players/pie-section-player": patch
---

`strategy="esm"` no longer loads the MathJax 3 math-rendering module. ESM element
builds bring their own renderer, so the item player and the section player's
preload install `window["@pie-lib/math-rendering"]` only for IIFE and preloaded
elements. Importing `@pie-players/pie-item-player` no longer starts that load
either; IIFE hosts that want it fetched at startup call
`ensureItemPlayerMathRenderingReady()`.

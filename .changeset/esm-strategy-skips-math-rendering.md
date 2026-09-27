---
"@pie-players/pie-item-player": patch
"@pie-players/pie-section-player": patch
---

`strategy="esm"` no longer loads the MathJax 3 math-rendering module (PIE-1096).
ESM element builds bring their own renderer, so the item player and the section
player's preload install `window["@pie-lib/math-rendering"]` only for IIFE and
preloaded elements. Importing `@pie-players/pie-item-player` no longer starts
that load either, so a host that loads IIFE element bundles itself must await
`ensureItemPlayerMathRenderingReady()` before the first bundle evaluates.

Under `esm` the elements therefore typeset with MathJax 4, which loads with its
New Computer Modern fonts from `cdn.jsdelivr.net` whatever `esmCdnUrl` names,
where the player's MathJax 3 took its fonts from `unpkg.com`. A page that cannot
reach jsDelivr renders no math. A CSP lists that origin in `font-src`, and in
`script-src` unless it uses `'strict-dynamic'`.

---
"@pie-players/pie-players-cli": patch
---

A generated `@pie-players/pie-preloaded-player` build bundles its elements with
Vite from their pie-elements-ng ESM browser builds, and ships the MathJax they
render with, so no element, MathJax, font or speech file comes from the PITS
bundle service or a CDN. The generator refuses an element without an ESM browser
build. The `knowledge-checks` and `star-0326` sets bundled legacy IIFE elements
and no longer publish; their published builds stay installable.

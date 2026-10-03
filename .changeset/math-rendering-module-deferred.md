---
"@pie-players/pie-item-player": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-players-shared": patch
---

A host build that inlines dynamic imports, as Vite through 7 does with
`inlineDynamicImports`, no longer sets the player's bundled MathJax 3 up as the
bundle loads. That setup threw on a page already running MathJax 4, and on a
page without MathJax it left a MathJax 3 global that PIE's MathJax 4 renderer
reports as a version conflict. MathJax 3 now sets up when the IIFE strategy
first needs it, as it does when the chunk loads separately.

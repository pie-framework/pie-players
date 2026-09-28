---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-section-player": patch
---

With `trackPageActions` on, the ESM loader forwards the `pie-mathjax-version-conflict`
event that PIE's MathJax 4 renderer dispatches when a page also runs MathJax 3 to the
instrumentation provider, as a `pie-mathjax-version-conflict` event carrying `condition`
and `docsUrl`. Each provider tracks an event once however many players load on the page.

---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
---

`registerPreloadedElements` takes `math.inTabOrder`, a boolean it writes to `window["@pie-lib/math-rendering@2"].opts.inTabOrder`. With `true`, copies of `@pie-element/shared-math-rendering-mathjax` that read it put typeset math in the keyboard tab order as they start MathJax; unset, math stays out of it.

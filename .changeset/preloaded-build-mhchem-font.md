---
"@pie-players/pie-players-cli": patch
---

A generated `@pie-players/pie-preloaded-player` build ships MathJax's mhchem font
extension, which MathJax loads from the build's font path when content uses `\ce`
or `\pu`.

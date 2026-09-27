---
"@pie-players/pie-players-shared": patch
---

`pie-players-shared` lists only its vendored NDS elements in `sideEffects`, so
bundlers drop the modules a host does not import. A single-file build no longer
carries a second, unused MathJax 3 module of about 1.7 MB.

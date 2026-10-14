---
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-section-player": patch
---

Take the Cortex calculator out of the packaged tool loaders, so a host bundle no longer carries its engine. The packaged registration offers `calculator-desmos` and `calculator-geogebra`; a host that selects `calculator-cortex` composes it in with `createCalculatorToolRegistration`, which the section player's `./browser` build also exports, and gets an unsupported-provider error until it does.

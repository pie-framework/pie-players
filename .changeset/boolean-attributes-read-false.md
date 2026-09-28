---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-section-player-tools-pnp-debugger": patch
"@pie-players/pie-tool-annotation-toolbar": patch
"@pie-players/pie-tool-answer-eliminator": patch
"@pie-players/pie-tool-calculator-cortex": patch
"@pie-players/pie-tool-calculator-geogebra": patch
"@pie-players/pie-tool-calculator-shared": patch
"@pie-players/pie-tool-theme": patch
"@pie-players/pie-tool-dictionary": patch
"@pie-players/pie-tool-graph": patch
"@pie-players/pie-tool-line-reader": patch
"@pie-players/pie-tool-periodic-table": patch
"@pie-players/pie-tool-picture-dictionary": patch
"@pie-players/pie-tool-protractor": patch
"@pie-players/pie-tool-ruler": patch
"@pie-players/pie-tool-text-to-speech": patch
"@pie-players/pie-tool-tts-inline": patch
---

Boolean attributes on the custom elements read `"false"`, `"0"`, `"off"` and
`"no"` as false instead of treating any present value as true, so
`trust-markup="false"` no longer skips sanitization.

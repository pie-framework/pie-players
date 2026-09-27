---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-players-shared": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-tool-annotation-toolbar": patch
"@pie-players/pie-tool-answer-eliminator": patch
"@pie-players/pie-tool-calculator-cortex": patch
"@pie-players/pie-tool-calculator-geogebra": patch
"@pie-players/pie-tool-calculator-inline-cortex": patch
"@pie-players/pie-tool-calculator-inline-desmos": patch
"@pie-players/pie-tool-calculator-inline-geogebra": patch
"@pie-players/pie-tool-calculator-shared": patch
"@pie-players/pie-tool-theme": patch
"@pie-players/pie-tool-graph": patch
"@pie-players/pie-tool-line-reader": patch
"@pie-players/pie-tool-periodic-table": patch
"@pie-players/pie-tool-protractor": patch
"@pie-players/pie-tool-ruler": patch
"@pie-players/pie-tool-text-to-speech": patch
"@pie-players/pie-tool-tts-inline": patch
---

The `pie-tool-*` bundles import the toolkit and `pie-players-shared` from the
host's `node_modules` instead of inlining them, and the section player imports
`@pie-players/pie-item-player`, so a page with both players defines one
`pie-item-player` and fetches one MathJax module. The toolkit's `sideEffects`
lists only its custom elements.

The section player's `./contracts/*` and `./policies` subpaths register no
element and import in Node. Each exports only its own module's names, so import
anything else from the package root. `pie-players-shared` drops
`./server/npm-registry` and `./server/npm-auth-env`.
`pie-tool-calculator-shared`'s root entry no longer exports the calculator
shells: it registers `<pie-tool-calculator>`, as `./calculator-element` does,
and the package no longer depends on `svelte`. `speech-rule-engine` is pinned to
`5.0.0-rc.4`, whose locale tables the toolkit imports by file path, and math
rendering imports `@pie-lib/math-rendering-module/module/index.js`, which
webpack's fully-specified ESM resolution finds.

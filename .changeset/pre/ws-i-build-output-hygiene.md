---
"@pie-players/pie-assessment-player": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-calculator-cortex": patch
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-item-list": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-i18n-generated": patch
"@pie-players/pie-players-shared": patch
"@pie-players/pie-print-player": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-section-player-tools-event-debugger": patch
"@pie-players/pie-section-player-tools-instrumentation-debugger": patch
"@pie-players/pie-section-player-tools-pnp-debugger": patch
"@pie-players/pie-section-player-tools-session-debugger": patch
"@pie-players/pie-section-player-tools-tts-settings": patch
"@pie-players/pie-theme": patch
"@pie-players/pie-tool-annotation-toolbar": patch
"@pie-players/pie-tool-answer-eliminator": patch
"@pie-players/pie-tool-calculator-desmos": patch
"@pie-players/pie-tool-calculator-inline-desmos": patch
"@pie-players/pie-tool-calculator-shared": patch
"@pie-players/pie-tool-dictionary": patch
"@pie-players/pie-tool-graph": patch
"@pie-players/pie-tool-line-reader": patch
"@pie-players/pie-tool-magnifier": patch
"@pie-players/pie-tool-periodic-table": patch
"@pie-players/pie-tool-picture-dictionary": patch
"@pie-players/pie-tool-protractor": patch
"@pie-players/pie-tool-ruler": patch
"@pie-players/pie-tool-sign-language": patch
"@pie-players/pie-tool-theme": patch
"@pie-players/pie-tool-tts-inline": patch
---

Published bundles are fully minified, whitespace included, about a fifth smaller across the suite; licence and `/*!` comments stay, and `/* @__PURE__ */` annotations go. The Cortex calculator ships one copy of Compute Engine, shared by the main bundle and its evaluation worker, which cuts the package from about 14 MB to 8.4 MB, and the worker keeps its blob wrapper for cross-origin pages. Packages publish only the declaration files a type entry reaches. `check:bundle-safety` fails any Vite bundle that is not minified, and `check:declaration-reachability` fails a package that ships an unreachable declaration.

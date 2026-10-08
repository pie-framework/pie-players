---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-assessment-player": patch
"@pie-players/pie-calculator-cortex": patch
"@pie-players/pie-calculator-desmos": patch
"@pie-players/pie-calculator-geogebra": patch
"@pie-players/pie-context": patch
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-players-shared": patch
"@pie-players/pie-print-player": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-section-player-tools-event-debugger": patch
"@pie-players/pie-section-player-tools-instrumentation-debugger": patch
"@pie-players/pie-section-player-tools-pnp-debugger": patch
"@pie-players/pie-section-player-tools-session-debugger": patch
"@pie-players/pie-section-player-tools-shared": patch
"@pie-players/pie-section-player-tools-tts-settings": patch
"@pie-players/pie-theme": patch
"@pie-players/pie-tool-annotation-toolbar": patch
"@pie-players/pie-tool-answer-eliminator": patch
"@pie-players/pie-tool-calculator-cortex": patch
"@pie-players/pie-tool-calculator-geogebra": patch
"@pie-players/pie-tool-calculator-shared": patch
"@pie-players/pie-tool-graph": patch
"@pie-players/pie-tool-line-reader": patch
"@pie-players/pie-tool-periodic-table": patch
"@pie-players/pie-tool-protractor": patch
"@pie-players/pie-tool-ruler": patch
"@pie-players/pie-tool-sign-language": patch
"@pie-players/pie-tool-theme": patch
"@pie-players/pie-tool-tts-inline": patch
"@pie-players/pie-tts": patch
"@pie-players/tts-client-server": patch
"@pie-players/tts-server-core": patch
"@pie-players/tts-server-polly": patch
---

The toolkit root exports 185 names instead of 326: the names only tool packages use moved to `./tools/registration`, and the names nothing imports are removed, among them the backend activity-session adapters, the item loader and the session-storage helpers. The TypeScript examples in the READMEs match the current API.

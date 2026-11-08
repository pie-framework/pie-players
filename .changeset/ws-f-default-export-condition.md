---
"@pie-players/pie-assessment-player": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-calculator": patch
"@pie-players/pie-calculator-cortex": patch
"@pie-players/pie-calculator-desmos": patch
"@pie-players/pie-calculator-geogebra": patch
"@pie-players/pie-context": patch
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-i18n-generated": patch
"@pie-players/pie-item-list": patch
"@pie-players/pie-item-player": patch
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
"@pie-players/pie-tts": patch
"@pie-players/tts-client-server": patch
"@pie-players/tts-server-core": patch
"@pie-players/tts-server-google": patch
"@pie-players/tts-server-polly": patch
"@pie-players/tts-server-sc": patch
---

Every `exports` entry of every published package now lists a `default` condition straight after `import`, with the same target. `require.resolve` and any resolver that matches neither `import` nor `types` used to fail with `ERR_PACKAGE_PATH_NOT_EXPORTED` and now land on the ESM file. The packages stay ESM-only; none ships CommonJS, and `docs/install/packages.md` says so.

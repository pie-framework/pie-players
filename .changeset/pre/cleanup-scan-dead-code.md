---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-print-player": patch
"@pie-players/pie-calculator-cortex": patch
"@pie-players/pie-calculator-desmos": patch
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-section-player-tools-event-debugger": patch
"@pie-players/pie-section-player-tools-instrumentation-debugger": patch
"@pie-players/pie-section-player-tools-pnp-debugger": patch
"@pie-players/pie-section-player-tools-session-debugger": patch
"@pie-players/pie-tool-annotation-toolbar": patch
"@pie-players/pie-tool-calculator-desmos": patch
"@pie-players/pie-tool-graph": patch
"@pie-players/pie-tool-periodic-table": patch
"@pie-players/pie-tool-protractor": patch
"@pie-players/pie-tool-ruler": patch
"@pie-players/pie-tool-tts-inline": patch
"@pie-players/pie-tts": patch
---

Removes dead internal code: unused class members and module exports outside
every package entry, the toolkit's unused tool-scope-level registration and
tool-config error helpers, the section player's no-op `ensureDefined`
component loaders, and stale `files` entries for assets the
tools inline. The print player no longer logs element resolution to the
console.

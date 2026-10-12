---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-assessment-player": patch
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-print-player": patch
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-section-player-tools-pnp-debugger": patch
"@pie-players/pie-tool-calculator-shared": patch
"@pie-players/pie-tool-dictionary": patch
"@pie-players/pie-tool-graph": patch
"@pie-players/pie-tool-periodic-table": patch
"@pie-players/pie-tool-picture-dictionary": patch
"@pie-players/tts-server-core": patch
---

`ToolScopeLevel` and `ToolbarContext.scope.level` admit only the five registered
scope levels; any other string already threw when a tool id was built. The
calculator, graph and periodic-table panels mark their root with
`data-pie-tool-id`. `tts-server-core` drops its unused speech-mark helpers,
`generateCacheKey` and `hashText`. The assessment player bundles players-shared
whole and drops its shell-element and contract subpaths, which resolved to the
registering bundle. The dictionary tools resolve players-shared from the host, as
every other tool does. players-shared adds `isPlainRecord` to `./object`, and
`pie-default-tool-loaders` exports `CONTENT_LEAD_SURFACE`, which the print player
now re-exports.

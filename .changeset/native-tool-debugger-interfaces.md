---
"@pie-players/pie-tool-annotation-toolbar": patch
"@pie-players/pie-tool-graph": patch
"@pie-players/pie-tool-periodic-table": patch
"@pie-players/pie-tool-answer-eliminator": patch
"@pie-players/pie-tool-theme": patch
"@pie-players/pie-tool-line-reader": patch
"@pie-players/pie-tool-calculator-shared": patch
"@pie-players/pie-tool-calculator-inline-desmos": patch
"@pie-players/pie-section-player-tools-event-debugger": patch
"@pie-players/pie-section-player-tools-instrumentation-debugger": patch
"@pie-players/pie-section-player-tools-session-debugger": patch
"@pie-players/pie-section-player-tools-tts-settings": patch
"@pie-players/pie-section-player-tools-pnp-debugger": patch
"@pie-players/pie-tool-calculator-desmos": patch
---

Publish native HTMLElement interfaces and tag-name inference for the remaining tool
and debugger custom elements, sharing their inputs with the current Svelte components.
Properties remain optional until mount. The calculator wrapper re-exports the
provider-neutral calculator element interface.

Existing tags, inputs, runtime exports and filenames stay the same. Hosts can import
the native types and use document.createElement/querySelector without requiring
Svelte declarations or casting to copied interfaces.

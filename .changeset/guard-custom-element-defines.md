---
"@pie-players/pie-item-player": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-section-player-tools-event-debugger": patch
"@pie-players/pie-section-player-tools-instrumentation-debugger": patch
"@pie-players/pie-section-player-tools-pnp-debugger": patch
"@pie-players/pie-section-player-tools-session-debugger": patch
"@pie-players/pie-section-player-tools-tts-settings": patch
"@pie-players/pie-tool-annotation-toolbar": patch
"@pie-players/pie-tool-answer-eliminator": patch
"@pie-players/pie-tool-calculator-cortex": patch
"@pie-players/pie-tool-calculator-geogebra": patch
"@pie-players/pie-tool-calculator-inline-cortex": patch
"@pie-players/pie-tool-calculator-inline-desmos": patch
"@pie-players/pie-tool-calculator-inline-geogebra": patch
"@pie-players/pie-tool-dictionary": patch
"@pie-players/pie-tool-graph": patch
"@pie-players/pie-tool-line-reader": patch
"@pie-players/pie-tool-periodic-table": patch
"@pie-players/pie-tool-picture-dictionary": patch
"@pie-players/pie-tool-protractor": patch
"@pie-players/pie-tool-ruler": patch
"@pie-players/pie-tool-sign-language": patch
"@pie-players/pie-tool-text-to-speech": patch
"@pie-players/pie-tool-theme": patch
"@pie-players/pie-tool-tts-inline": patch
---

Loading a second copy of a player or tool into a page that already registered
its custom elements no longer throws. The copy that registered a tag first keeps
rendering it, the rule `pie-item-player` and the toolkit's elements already
follow.
